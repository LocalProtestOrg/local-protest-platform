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
  // JS regex does NOT support [[:space:]] like PHP does.
  return (s || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
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

  // Heuristic: "City, ST"
  const m = raw.match(/^\s*([^,]+),\s*([A-Za-z]{2})\s*$/);
  if (m) return { city: m[1].trim(), state: m[2].toUpperCase() };

  return { city: null, state: null };
}

async function fetchIcs(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`ICS fetch failed (${res.status}) for ${url}`);
  return await res.text();
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

  const sources: ImportSource[] = parsed
    .map((s) => ({
      key: String(s?.key || "").trim(),
      name: String(s?.name || "").trim(),
      type: "ics" as const,
      url: String(s?.url || "").trim(),
    }))
    .filter((s) => s.key && s.name && s.url);

  return sources;
}

function daysFromNowIso(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET || "";

  // ✅ Authorize either:
  // - Vercel Cron header (scheduled runs)
  // - Manual token query param (testing)
  const vercelCronHeader = req.headers.get("x-vercel-cron");
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";

  const authorized = (!!secret && !!vercelCronHeader) || (!!secret && token === secret);

  if (!authorized) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const sources = getSourcesFromEnv();
  if (!sources.length) {
    return NextResponse.json({ ok: false, error: "No import sources configured" }, { status: 400 });
  }

  const nowIso = new Date().toISOString();

  const results: any[] = [];
  let totalUpserts = 0;

  // ✅ Safety window: only publish events between -7 days and +180 days
  const minDateIso = daysFromNowIso(-7);
  const maxDateIso = daysFromNowIso(180);

  for (const src of sources) {
    try {
      const icsText = await fetchIcs(src.url);
      const events = icsToEvents(icsText);

      // Safety: limit volume
      const limited = events.slice(0, 200);

      // Safety: filter by time range when event_time exists
      const filtered = limited.filter((ev) => {
        if (!ev.start_iso) return true; // allow if feed omits date
        return ev.start_iso >= minDateIso && ev.start_iso <= maxDateIso;
      });

      for (const ev of filtered) {
        const organizer_username = `import:${src.key}`;

        const payload = {
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

          event_types: null,
          is_accessible: null,
          accessibility_features: null,
          image_path: null,
        };

        const { error } = await supabase
          .from("protests")
          .upsert(payload, { onConflict: "source_key,external_id" });

        if (error) throw error;
        totalUpserts += 1;
      }

      results.push({
        source: src.key,
        name: src.name,
        fetched: limited.length,
        kept: filtered.length,
        ok: true,
      });
    } catch (e: any) {
      results.push({
        source: src.key,
        name: src.name,
        ok: false,
        error: e?.message || String(e),
      });
    }
  }

  // Expire imported events not seen recently
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
