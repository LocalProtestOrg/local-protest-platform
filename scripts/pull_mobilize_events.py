#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import datetime as dt
import html as htmllib
import json
import os
import re
import sys
import time
from typing import Any, Dict, List, Optional, Tuple

import requests
from bs4 import BeautifulSoup

MOBILIZE_API_BASE = "https://api.mobilize.us/v1"

DEFAULT_EVENT_TYPES_FILTER = [
    "RALLY",
    "TOWN_HALL",
    "MEETING",
    "COMMUNITY",
    "WORKSHOP",
    "VISIBILITY_EVENT",
    "SOLIDARITY_EVENT",
    "OTHER",
]

BANNED_TERMS = [
    "riot", "rioting", "loot", "looting", "armed", "weapon", "weapons", "guns",
    "molotov", "kill", "assassinate", "attack", "violent", "violence",
]

DB_FIELDS_DEFAULT = [
    "title",
    "description",
    "city",
    "state",
    "event_time",
    "image_path",
    "status",
    "event_types",
    "is_accessible",
    "accessibility_features",
    "source_type",
    "source_name",
    "source_url",
    "source_key",
    "external_id",
    "last_seen_at",
]

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36"


def unix(ts: dt.datetime) -> int:
    return int(ts.replace(tzinfo=dt.timezone.utc).timestamp())


def iso_utc_from_unix(ts_unix: int) -> str:
    return dt.datetime.fromtimestamp(int(ts_unix), tz=dt.timezone.utc).isoformat()


def strip_html(s: str) -> str:
    s = htmllib.unescape(s or "")
    s = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", s, flags=re.I | re.S)
    s = re.sub(r"<[^>]+>", " ", s)
    s = re.sub(r"[ \t\r\f\v]+", " ", s)
    s = re.sub(r"\n{2,}", "\n", s)
    return s.strip()


def clean_text(s: str, max_len: int = 4000) -> str:
    s = (s or "").strip()
    s = re.sub(r"[ \t\r\f\v]+", " ", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s[:max_len].strip()


def looks_safe(title: str, desc: str) -> bool:
    text = f"{title}\n{desc}".lower()
    return not any(term in text for term in BANNED_TERMS)


def to_pg_text_array_literal(values: List[str]) -> Optional[str]:
    vals = [v.strip() for v in values if v and v.strip()]
    if not vals:
        return None

    escaped = []
    for v in vals:
        v = v.replace("\\", "\\\\").replace('"', '\\"')
        if any(ch in v for ch in [",", "{", "}", " ", "\t"]):
            escaped.append(f'"{v}"')
        else:
            escaped.append(v)

    return "{" + ",".join(escaped) + "}"


def _request_json_with_retries(url: str, params: Optional[List[Tuple[str, str]]]) -> Dict[str, Any]:
    last_status = None
    last_text = ""
    for attempt in range(1, 6):
        resp = requests.get(
            url,
            params=params,
            timeout=45,
            headers={"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9"},
        )
        last_status = resp.status_code
        last_text = (resp.text or "")[:900]

        if resp.status_code == 429:
            wait = 2 ** attempt
            print(f"Mobilize returned 429. Retry in {wait}s (attempt {attempt}/5)", file=sys.stderr)
            time.sleep(wait)
            continue

        if resp.status_code >= 500:
            wait = 2 ** attempt
            print(f"Mobilize returned {resp.status_code}. Retry in {wait}s (attempt {attempt}/5)", file=sys.stderr)
            time.sleep(wait)
            continue

        if resp.status_code >= 400:
            raise RuntimeError(f"Mobilize API error {resp.status_code}: {last_text}")

        return resp.json()

    if last_status == 429:
        print("WARNING: Mobilize still rate-limited after retries. Skipping this run.", file=sys.stderr)
        return {"data": [], "next": None}

    raise RuntimeError(f"Mobilize API failed after retries. Last status {last_status}: {last_text}")


def extract_jsonld_events(obj: Any) -> List[Dict[str, Any]]:
    found: List[Dict[str, Any]] = []

    def walk(x: Any):
        if isinstance(x, dict):
            t = x.get("@type")
            if t in ("Event", "SocialEvent"):
                found.append(x)
            g = x.get("@graph")
            if isinstance(g, list):
                for it in g:
                    walk(it)
            for v in x.values():
                walk(v)
        elif isinstance(x, list):
            for it in x:
                walk(it)

    walk(obj)
    return found


def fetch_and_enrich(source_url: str) -> Dict[str, Optional[str]]:
    if not source_url:
        return {"description": None, "source_name": None, "image_url": None}

    try:
        resp = requests.get(
            source_url,
            timeout=30,
            headers={"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9"},
        )
        if resp.status_code >= 400:
            return {"description": None, "source_name": None, "image_url": None}
    except Exception:
        return {"description": None, "source_name": None, "image_url": None}

    soup = BeautifulSoup(resp.text, "lxml")

    for tag in soup.find_all("script", attrs={"type": "application/ld+json"}):
        raw = (tag.string or tag.get_text() or "").strip()
        if not raw:
            continue
        try:
            obj = json.loads(raw)
        except Exception:
            continue

        events = extract_jsonld_events(obj)
        if not events:
            continue

        ev = events[0]

        desc = ev.get("description")
        if isinstance(desc, str):
            desc = clean_text(strip_html(desc))

        org_name = None
        org = ev.get("organizer")
        if isinstance(org, dict):
            org_name = org.get("name") or org.get("legalName")
        elif isinstance(org, list) and org and isinstance(org[0], dict):
            org_name = org[0].get("name") or org[0].get("legalName")

        image_url = None
        img = ev.get("image")
        if isinstance(img, str):
            image_url = img
        elif isinstance(img, list) and img and isinstance(img[0], str):
            image_url = img[0]
        elif isinstance(img, dict):
            image_url = img.get("url")

        return {
            "description": desc if desc else None,
            "source_name": org_name if org_name else None,
            "image_url": image_url if image_url else None,
        }

    def meta(prop: str, attr: str = "property") -> Optional[str]:
        m = soup.find("meta", attrs={attr: prop})
        if m and m.get("content"):
            return str(m["content"]).strip()
        return None

    og_desc = meta("og:description")
    og_img = meta("og:image")
    og_site = meta("og:site_name")
    if not og_desc:
        og_desc = meta("description", attr="name")

    return {
        "description": clean_text(og_desc) if og_desc else None,
        "source_name": og_site if og_site else None,
        "image_url": og_img if og_img else None,
    }


def iter_mobilize_pages(
    *,
    start_unix: int,
    end_unix: int,
    per_page: int,
    include_virtual: bool,
    event_types_filter: List[str],
    max_loops: int,
):
    params: List[Tuple[str, str]] = [
        ("timeslot_start", f"gte_{start_unix}"),
        ("timeslot_end", f"lt_{end_unix}"),
        ("per_page", str(per_page)),
    ]

    if not include_virtual:
        params.append(("is_virtual", "false"))

    for et in event_types_filter:
        params.append(("event_types", et))

    next_url: Optional[str] = f"{MOBILIZE_API_BASE}/events"

    loops = 0
    while next_url and loops < max_loops:
        loops += 1

        url = "https://api.mobilize.us" + next_url if next_url.startswith("/") else next_url
        use_params = params if loops == 1 else None

        payload = _request_json_with_retries(url, use_params)
        events = payload.get("data") or []
        next_url = payload.get("next")

        print(f"Mobilize page {loops}: received {len(events)} events, next={(str(next_url)[:120] if next_url else None)}")

        yield events

        if not next_url:
            break

        time.sleep(0.8)

        if len(events) == 0 and next_url is None:
            break


def build_rows_streaming(
    *,
    start_unix: int,
    end_unix: int,
    per_page: int,
    include_virtual: bool,
    event_types_filter: List[str],
    max_loops: int,
    limit: int,
    enrich: bool,
    enrich_max: int,
    now_iso: str,
) -> Tuple[List[Dict[str, Any]], int]:
    rows: List[Dict[str, Any]] = []
    seen_external: set = set()
    enrich_count = 0
    raw_seen = 0

    for page_events in iter_mobilize_pages(
        start_unix=start_unix,
        end_unix=end_unix,
        per_page=per_page,
        include_virtual=include_virtual,
        event_types_filter=event_types_filter,
        max_loops=max_loops,
    ):
        raw_seen += len(page_events)

        if len(page_events) == 0 and raw_seen == 0:
            break

        for ev in page_events:
            ev_id = ev.get("id")
            title = (ev.get("title") or "").strip()
            desc_api = strip_html(ev.get("description") or "")

            if not title:
                continue

            browser_url = (ev.get("browser_url") or "").strip()
            ev_type = (ev.get("event_type") or "").strip()

            sponsor_name = None
            sponsor = ev.get("sponsor")
            if isinstance(sponsor, dict) and sponsor.get("name"):
                sponsor_name = sponsor["name"]

            loc = ev.get("location") or {}
            city = (loc.get("locality") or "").strip()
            state = (loc.get("region") or "").strip()

            timeslots = ev.get("timeslots") or []
            for ts in timeslots:
                ts_id = ts.get("id")
                start_u = ts.get("start_date")
                if not start_u:
                    continue

                external_id = f"{ev_id}:{ts_id}:{int(start_u)}"
                if external_id in seen_external:
                    continue
                seen_external.add(external_id)

                final_desc = clean_text(desc_api) if desc_api else ""
                final_source_name = sponsor_name or "Mobilize"
                image_path = None

                if enrich and browser_url and (len(final_desc) < 180) and (enrich_count < enrich_max):
                    enrich_count += 1
                    extra = fetch_and_enrich(browser_url)
                    if extra.get("description"):
                        final_desc = clean_text(extra["description"])
                    if extra.get("source_name"):
                        final_source_name = extra["source_name"]
                    if extra.get("image_url"):
                        image_path = extra["image_url"]
                    time.sleep(0.25)

                if not looks_safe(title, final_desc):
                    continue

                event_types_pg = to_pg_text_array_literal([ev_type]) if ev_type else None

                rows.append({
                    "title": title,
                    "description": (final_desc[:4000] if final_desc else title),
                    "city": city,
                    "state": state,
                    "event_time": iso_utc_from_unix(int(start_u)),
                    "image_path": image_path,
                    "status": "active",
                    "event_types": event_types_pg,
                    # NOT NULL fixes:
                    "is_accessible": False,
                    # accessibility_features is NOT NULL in your DB:
                    # safest for text[] is an empty array literal
                    "accessibility_features": "{}",
                    "source_type": "api",
                    "source_name": final_source_name,
                    "source_url": browser_url,
                    "source_key": "mobilize",
                    "external_id": external_id,
                    "last_seen_at": now_iso,
                })

                if len(rows) >= limit:
                    return rows, raw_seen

    return rows, raw_seen


def write_csv(path: str, rows: List[Dict[str, Any]], fieldnames: List[str]) -> None:
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in fieldnames})


def supabase_upsert(
    *,
    supabase_url: str,
    service_role_key: str,
    table: str,
    rows: List[Dict[str, Any]],
    fieldnames: List[str],
    on_conflict: str,
) -> None:
    if not rows:
        print("No rows to upsert.")
        return

    endpoint = f"{supabase_url.rstrip('/')}/rest/v1/{table}"
    params = {"on_conflict": on_conflict}
    headers = {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }

    payload = [{k: r.get(k) for k in fieldnames} for r in rows]

    resp = requests.post(endpoint, params=params, headers=headers, data=json.dumps(payload), timeout=120)
    if resp.status_code >= 400:
        raise RuntimeError(f"Supabase upsert failed {resp.status_code}: {(resp.text or '')[:900]}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=60)
    ap.add_argument("--days", type=int, default=28)
    ap.add_argument("--out", default="events_import.csv")
    ap.add_argument("--per-page", type=int, default=50)
    ap.add_argument("--include-virtual", action="store_true")
    ap.add_argument("--event-type", action="append", dest="event_types_filter", default=None)

    ap.add_argument("--enrich", action="store_true")
    ap.add_argument("--enrich-max", type=int, default=25)

    ap.add_argument("--upsert", action="store_true")
    ap.add_argument("--supabase-table", default="protests")
    ap.add_argument("--on-conflict", default="source_key,external_id")
    ap.add_argument("--db-fields", default=",".join(DB_FIELDS_DEFAULT))
    ap.add_argument("--max-loops", type=int, default=20)

    args = ap.parse_args()

    now = dt.datetime.utcnow()
    end = now + dt.timedelta(days=args.days)
    now_iso = now.replace(tzinfo=dt.timezone.utc).isoformat()

    event_types_filter = args.event_types_filter or DEFAULT_EVENT_TYPES_FILTER
    db_fields = [x.strip() for x in args.db_fields.split(",") if x.strip()]

    print(f"Fetching Mobilize events, next {args.days} days ...")

    rows, raw_seen = build_rows_streaming(
        start_unix=unix(now),
        end_unix=unix(end),
        per_page=args.per_page,
        include_virtual=args.include_virtual,
        event_types_filter=event_types_filter,
        max_loops=args.max_loops,
        limit=args.limit,
        enrich=args.enrich,
        enrich_max=args.enrich_max,
        now_iso=now_iso,
    )

    print(f"Raw events seen: {raw_seen}")
    print(f"Normalized to {len(rows)} rows.")

    if raw_seen == 0:
        print("No events fetched (likely rate-limited). Skipping upsert and exiting success.", file=sys.stderr)
        return 0

    if len(rows) == 0:
        print("No rows produced after normalization. Exiting with error.", file=sys.stderr)
        return 1

    write_csv(args.out, rows, db_fields)
    print(f"Wrote {len(rows)} rows to {args.out}")

    if args.upsert:
        supabase_url = os.environ.get("SUPABASE_URL", "").strip()
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()

        if not supabase_url or not key:
            print("ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.", file=sys.stderr)
            return 1

        supabase_upsert(
            supabase_url=supabase_url,
            service_role_key=key,
            table=args.supabase_table,
            rows=rows,
            fieldnames=db_fields,
            on_conflict=args.on_conflict,
        )
        print(f"Upserted {len(rows)} rows into Supabase table '{args.supabase_table}'.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
