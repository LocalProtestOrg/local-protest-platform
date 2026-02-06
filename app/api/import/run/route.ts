import { NextResponse } from "next/server";
import ICAL from "ical.js";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ImportSource = {
  key: string;
  name: string;
  type: "ics";
  url: string;
};

type ImportedEvent = {
  external_id: string;
  title: string;
  description: string | null;
  start_iso: string | null;
  source_url: string | null;
  city: string | null;
  state: string | null;
};

function stripHtml(s: string) {
  return (s || "")
    .replace(/<[^>]*>/g, " ")
    // Use a JS-safe whitespace collapse (avoid regex escapes that can get mangled)
    .replace(/\s+/g, " ")
    .trim();
}

function clampText(s: string, max = 2000) {
  const t = stripHtml(s || "");
  if (t.length <= max) return t;
  return t.slice(0, max);
}

function safeTitle(s: string) {
  const t = stripHtml(s || "").trim();
  return t || "Civic Event";
}

function parseMaybeCityState(location: string): { city: string | null; state: string | null } {
  const raw = (location || "").trim();
  if (!raw) return { city: null, state: null };

  // Simple heuristic: "City, ST"
  const m = raw.match(/^\s*([^,]+),\s*([A-Za-z]{2})\s*$/);
  if (m) return { city: m[1].trim(), state: m[2].toUpperCase() };

  return { city: null, state: null };
}

async function fetchIcs(url: string) {
  let res: Response;

  try {
    res = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      headers: {
        // Some calendar hosts reject requests without a UA and Accept header
        "User-Agent": "LocalAssemblyImportBot/1.0 (+https://www.localassembly.org)",
        Accept: "text/calendar,text/plain,*/*",
      },
    });
  } catch (err: any) {
    // Network-level failure: DNS/TLS/connection refused/etc.
    throw new Error(`fetch failed (network): ${err?.message || String(err)}`);
  }

  if (!res.ok) {
    const ct = res.headers.get("content-type") || "";
    const bodyPreview = await res.text().catch(() => "");
    throw new Error(
      `ICS fetch failed (${res.status}) ct=${ct} url=${url} body=${bodyPreview.slice(0, 200)}`
    );
  }

  const text = await res.text();

  // Basic sanity check: ICS files usually contain BEGIN:VCALENDAR
  if (!text.includes("BEGIN:VCALENDAR")) {
    const ct = res.headers.get("content-type") || "";
    throw new Error(
      `ICS fetch returned non-calendar content ct=${ct} url=${url} preview=${text.slice(0, 200)}`
    );
  }

  return text;
}

function icsToEvents(icsText: string): ImportedEvent[] {
  const jcalData = ICAL.parse(icsText);
  const comp = new ICAL.Component(jcalData);
  const vevents = comp.getAllSubcomponents("vevent");

  const out: ImportedEvent[] = [];

  for (const v of vevents) {
    const e = new ICAL.Event(v);

    const uid = (e.uid || "").trim();
    if (!uid) continue;

    const title = safeTitle(e.summary || "");
    const desc = clampText(e.description || "", 2000) || null;

    // If all-day event, startDate is still usable
    const start = e.startDate ? e.startDate.toJSDate() : null;
    const start_iso = start ? start.toISOString() : null;

    const urlProp = v.getFirstPropertyValue("url");
    const source_url = typeof urlProp === "string" && urlProp.trim() ? urlProp.trim() : null;

    const loc = (e.location || "").trim();
    const { city, state } = parseMaybeCityState(loc);

    out.push({
      external_id: uid,
      title,
      description: desc,
      start_iso,
      source_url,
      city,
      state,
    });
  }

  return out;
}

function getSourcesFromEnv(): ImportSource[] {
  const raw = process.env.IMPORT_SOURCES_JSON || "[]";

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("IMPORT_SOURCES_JSON is not valid JSON");
  }

  if (!Array.isArray(parsed)) throw new Error("IMPORT_SOURCES_JSON must be an array");

  return parsed
    .map((s) => ({
      key: String(s.key || "").trim(),
      name: String(s.name || "").trim(),
      type: "ics" as const,
      url: String(s.url || "").trim(),
    }))
    .filter((s) => s.key && s.name && s.url);
}

export async function GET(req: Request) {
  const secret = (process.env.CRON_SECRET || "").trim();
  const url = new URL(req.url);
  const token = (url.searchParams.get("token") || "").trim();

  if (!secret || token !== secret) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const sources = getSourcesFromEnv();
  if (!sources.length) {
    return NextResponse.json({ ok: false, error: "No import sources configured" }, { status: 400 });
  }

  const nowIso = new Date().toISOString();

  const results: any[] = [];
  let totalUpserts = 0;

  for (const src of sources) {
    try {
      const icsText = await fetchIcs(src.url);
      const events = icsToEvents(icsText);

      // Safety limit per feed
      const limited = events.slice(0, 200);

      for (const ev of limited) {
        const organizer_username = `import:${src.key}`;

        const payload: any = {
          title: ev.title,
          description: ev.description,
          city: ev.city,
          state: ev.state,
          event_time: ev.start_iso,
          organizer_username,
          status: "active",

          source_type: "import",
          source_name: src.name,
          source_key: src.key,
          external_id: ev.external_id,
          source_url: ev.source_url,
          last_seen_at: nowIso,

          // Keep these null for imports unless you later map them
          event_types: null,
          is_accessible: null,
          accessibility_features: null,
          image_path: null,
        };

        const { error } = await supabase.from("protests").upsert(payload, {
          onConflict: "source_key,external_id",
        });

        if (error) throw error;
        totalUpserts += 1;
      }

      results.push({ source: src.key, name: src.name, fetched: limited.length, ok: true });
    } catch (e: any) {
      results.push({ source: src.key, name: src.name, ok: false, error: e?.message || String(e) });
    }
  }

  // Expire imported events we have not seen recently (default 45 days)
  const expireDays = 45;
  const cutoff = new Date(Date.now() - expireDays * 24 * 60 * 60 * 1000).toISOString();

  const { error: expireErr } = await supabase
    .from("protests")
    .update({ status: "inactive" })
    .eq("source_type", "import")
    .lt("last_seen_at", cutoff);

  return NextResponse.json({
    ok: true,
    sources: results,
    totalUpserts,
    expiredOlderThanDays: expireDays,
    expireError: expireErr ? expireErr.message : null,
  });
}
