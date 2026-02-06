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
    .replace(/[[:space:]]+/g, " ")
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

function getSourcesFromEnv(): ImportSource[] {
  const raw = (process.env.IMPORT_SOURCES_JSON || "[]").trim();

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

async function fetchWithTimeout(url: string, ms: number, init?: RequestInit) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(t);
  }
}

async function fetchIcs(url: string) {
  const trimmed = (url || "").trim();
  if (!trimmed) throw new Error("ICS URL is empty");
  if (!/^https?:\/\//i.test(trimmed)) throw new Error(`ICS URL must start with http(s): ${trimmed}`);

  // Attempt 1: plain fetch
  try {
    const res = await fetchWithTimeout(trimmed, 15000);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `ICS fetch failed (http ${res.status}) for ${trimmed}` + (body ? ` | body: ${body.slice(0, 200)}` : "")
      );
    }
    const text = await res.text();
    if (!text || text.length < 10) throw new Error("ICS response was empty");
    return text;
  } catch (err: any) {
    const msg1 = err?.name === "AbortError" ? "timeout" : (err?.message || String(err));

    // Attempt 2: browser-ish headers (some sites block serverless user agents)
    try {
      const res2 = await fetchWithTimeout(trimmed, 20000, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari",
          Accept: "text/calendar, text/plain;q=0.9, */*;q=0.8",
        },
        redirect: "follow",
      });

      if (!res2.ok) {
        const body2 = await res2.text().catch(() => "");
        throw new Error(
          `ICS fetch failed (http ${res2.status}) for ${trimmed}` +
            (body2 ? ` | body: ${body2.slice(0, 200)}` : "")
        );
      }

      const text2 = await res2.text();
      if (!text2 || text2.length < 10) throw new Error("ICS response was empty");
      return text2;
    } catch (err2: any) {
      const msg2 = err2?.name === "AbortError" ? "timeout" : (err2?.message || String(err2));

      // This is the message you are seeing as "fetch failed".
      // We wrap it so you can distinguish timeout vs DNS/TLS vs blocked host.
      throw new Error(`fetch failed (network): attempt1=${msg1}; attempt2=${msg2}`);
    }
  }
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

      results.push({
        source: src.key,
        name: src.name,
        url: src.url,
        fetched: limited.length,
        ok: true,
      });
    } catch (e: any) {
      results.push({
        source: src.key,
        name: src.name,
        url: src.url,
        ok: false,
        error: e?.message || String(e),
        hint:
          "If this works locally but fails on Vercel, the remote host may block serverless requests or Vercel cannot reach it. Try a different feed URL or mirror the ICS to a host that allows server-to-server fetching.",
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
