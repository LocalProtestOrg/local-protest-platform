#!/usr/bin/env python3
"""
Local Assembly weekly importer for Supabase `protests` table.

- Pull events from Mobilize within the next N days
- Enrich sparse listings by fetching each event's source_url page (JSON-LD / OpenGraph)
- Always writes a CSV
- Optionally upserts into Supabase
- IMPORTANT: Fails the run if 0 rows are produced, so it never "succeeds" silently.

Mobilize API docs:
https://github.com/mobilizeamerica/api
"""

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
from typing import Any, Dict, List, Tuple, Optional

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

# EXACT columns written/sent to Supabase (must exist in your table)
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

# Use a browser-like UA to avoid bot blocks
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


def mobilize_list_events(
    *,
    start_unix: int,
    end_unix: int,
    per_page: int,
    include_virtual: bool,
    event_types_filter: List[str],
    max_pages: int = 50,
) -> List[Dict[str, Any]]:
    """
    Mobilize public events pagination:
    - First request uses /v1/events with filters.
    - Response may include `next` which is a URL/path to fetch directly.
    - Do NOT use page= or cursor= (they cause Invalid page/cursor).
    """
    out: List[Dict[str, Any]] = []

    # First request URL + params
    next_url: Optional[str] = f"{MOBILIZE_API_BASE}/events"
    params: List[Tuple[str, str]] = []
    params.append(("timeslot_start", f"gte_{start_unix}"))
    params.append(("timeslot_end", f"lt_{end_unix}"))

    if not include_virtual:
        params.append(("is_virtual", "false"))

    for et in event_types_filter:
        params.append(("event_types", et))

    params.append(("per_page", str(per_page)))

    loops = 0
    while next_url and loops < max_pages:
        loops += 1

        # If next_url is a relative path, make it absolute
        if next_url.startswith("/"):
            url = "https://api.mobilize.us" + next_url
        else:
            url = next_url

        # Only include params on the FIRST request.
        # Next URLs already include their own querystring.
        use_params = params if loops == 1 else None

        last_status = None
        last_text = ""
        for attempt in range(1, 6):
            resp = requests.get(url, params=use_params, timeout=45, headers={"User-Agent": UA})
            last_status = resp.status_code
            last_text = resp.text[:700]

            if resp.status_code == 429 or resp.status_code >= 500:
                wait = 2 ** attempt
                print(f"Mobilize returned {resp.status_code}. Retry in {wait}s (attempt {attempt}/5)...", file=sys.stderr)
                time.sleep(wait)
                continue

            if resp.status_code >= 400:
                raise RuntimeError(f"Mobilize API error {resp.status_code}: {last_text}")

            payload = resp.json()
            events = payload.get("data") or []
            out.extend(events)

            # IMPORTANT: next is a URL/path, not a cursor param
            next_url = payload.get("next")
            break
        else:
            raise RuntimeError(f"Mobilize API failed after retries. Last status {last_status}: {last_text}")

        # Stop if no more pages
        if not next_url:
            break

    return out




def extract_from_jsonld(obj: Any) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []

    def walk(x: Any):
        if isinstance(x, dict):
            if x.get("@type") in ("Event", "SocialEvent"):
                out.append(x)
            if "@graph" in x and isinstance(x["@graph"], list):
                for g in x["@graph"]:
                    walk(g)
            for v in x.values():
                walk(v)
        elif isinstance(x, list):
            for i in x:
                walk(i)

    walk(obj)
    return out


def fetch_and_enrich(source_url: str) -> Dict[str, Optional[str]]:
    if not source_url:
        return {"description": None, "source_name": None, "image_url": None, "is_accessible": None, "accessibility_features": None}

    try:
        resp = requests.get(
            source_url,
            timeout=30,
            headers={"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9"},
        )
        if resp.status_code >= 400:
            return {"description": None, "source_name": None, "image_url": None, "is_accessible": None, "accessibility_features": None}
    except Exception:
        return {"description": None, "source_name": None, "image_url": None, "is_accessible": None, "accessibility_features": None}

    soup = BeautifulSoup(resp.text, "lxml")

    # JSON-LD Event (best)
    jsonld_events: List[Dict[str, Any]] = []
    for tag in soup.find_all("script", attrs={"type": "application/ld+json"}):
        try:
            raw = (tag.string or tag.get_text() or "").strip()
            if not raw:
                continue
            obj = json.loads(raw)
            jsonld_events.extend(extract_from_jsonld(obj))
        except Exception:
            continue

    if jsonld_events:
        ev = jsonld_events[0]

        desc = ev.get("description")
        if isinstance(desc, str):
            desc = clean_text(strip_html(desc))

        organizer = None
        org = ev.get("organizer")
        if isinstance(org, dict):
            organizer = org.get("name") or org.get("legalName")
        elif isinstance(org, list) and org and isinstance(org[0], dict):
            organizer = org[0].get("name") or org[0].get("legalName")

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
            "source_name": organizer if organizer else None,
            "image_url": image_url if image_url else None,
            "is_accessible": None,
            "accessibility_features": None,
        }

    # OpenGraph fallback
    og_desc = soup.find("meta", attrs={"property": "og:description"})
    meta_desc = soup.find("meta", attrs={"name": "description"})
    desc = None
    if og_desc and og_desc.get("content"):
        desc = clean_text(og_desc["content"])
    elif meta_desc and meta_desc.get("content"):
        desc = clean_text(meta_desc["content"])

    og_img = soup.find("meta", attrs={"property": "og:image"})
    image_url = og_img.get("content") if og_img and og_img.get("content") else None

    og_site = soup.find("meta", attrs={"property": "og:site_name"})
    organizer = og_site.get("content") if og_site and og_site.get("content") else None

    return {
        "description": desc if desc else None,
        "source_name": organizer if organizer else None,
        "image_url": image_url if image_url else None,
        "is_accessible": None,
        "accessibility_features": None,
    }


def normalize_to_rows(
    events: List[Dict[str, Any]],
    *,
    limit: int,
    now_iso: str,
    enrich: bool,
    enrich_max: int,
) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    seen: set = set()
    enrich_count = 0

    for ev in events:
        ev_id = ev.get("id")
        title = (ev.get("title") or "").strip()
        desc_api = strip_html(ev.get("description") or "")

        if not title:
            continue

        if not looks_safe(title, desc_api):
            continue

        browser_url = (ev.get("browser_url") or "").strip()
        ev_type = (ev.get("event_type") or "").strip()

        sponsor_name = None
        sponsor = ev.get("sponsor")
        if isinstance(sponsor, dict) and sponsor.get("name"):
            sponsor_name = sponsor["name"]

        location = ev.get("location") or {}
        city = (location.get("locality") or "").strip()
        state = (location.get("region") or "").strip()

        timeslots = ev.get("timeslots") or []
        for ts in timeslots:
            ts_id = ts.get("id")
            start_u = ts.get("start_date")
            if not start_u:
                continue

            external_id = f"{ev_id}:{ts_id}:{int(start_u)}"
            if external_id in seen:
                continue
            seen.add(external_id)

            final_desc = clean_text(desc_api) if desc_api else ""
            final_source_name = sponsor_name or "Mobilize"
            image_path = None

            should_enrich = enrich and browser_url and (len(final_desc) < 180)
            if should_enrich and enrich_count < enrich_max:
                enrich_count += 1
                extra = fetch_and_enrich(browser_url)
                if extra.get("description"):
                    final_desc = clean_text(extra["description"])
                if extra.get("source_name"):
                    final_source_name = extra["source_name"]
                if extra.get("image_url"):
                    image_path = extra["image_url"]

            if not looks_safe(title, final_desc):
                continue

            rows.append({
                "title": title,
                "description": (final_desc[:4000] if final_desc else title),
                "city": city,
                "state": state,
                "event_time": iso_utc_from_unix(int(start_u)),
                "image_path": image_path,
                "status": "active",
                "event_types": ev_type,
                "is_accessible": None,
                "accessibility_features": None,
                "source_type": "api",
                "source_name": final_source_name,
                "source_url": browser_url,
                "source_key": "mobilize",
                "external_id": external_id,
                "last_seen_at": now_iso,
            })

            if len(rows) >= limit:
                return rows

    return rows


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
        raise RuntimeError(f"Supabase upsert failed {resp.status_code}: {resp.text[:900]}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=200)
    ap.add_argument("--days", type=int, default=28)
    ap.add_argument("--out", default="events_import.csv")
    ap.add_argument("--per-page", type=int, default=100)
    ap.add_argument("--include-virtual", action="store_true")
    ap.add_argument("--event-type", action="append", dest="event_types_filter", default=None)

    ap.add_argument("--enrich", action="store_true")
    ap.add_argument("--enrich-max", type=int, default=200)

    ap.add_argument("--upsert", action="store_true")
    ap.add_argument("--supabase-table", default="protests")
    ap.add_argument("--on-conflict", default="source_key,external_id")
    ap.add_argument("--db-fields", default=",".join(DB_FIELDS_DEFAULT))

    args = ap.parse_args()

    now = dt.datetime.utcnow()
    end = now + dt.timedelta(days=args.days)
    now_iso = now.replace(tzinfo=dt.timezone.utc).isoformat()

    event_types_filter = args.event_types_filter or DEFAULT_EVENT_TYPES_FILTER
    db_fields = [x.strip() for x in args.db_fields.split(",") if x.strip()]

    print(f"Fetching Mobilize events, next {args.days} days ...")
    events = mobilize_list_events(
        start_unix=unix(now),
        end_unix=unix(end),
        per_page=args.per_page,
        include_virtual=args.include_virtual,
        event_types_filter=event_types_filter,
    )
    print(f"Fetched {len(events)} raw events from Mobilize.")

    if len(events) == 0:
        # Fail loudly so the action is not "green but empty"
        write_csv(args.out, [], db_fields)
        print("ERROR: Mobilize returned 0 events. Wrote empty CSV and failing.", file=sys.stderr)
        return 1

    rows = normalize_to_rows(
        events,
        limit=args.limit,
        now_iso=now_iso,
        enrich=args.enrich,
        enrich_max=args.enrich_max,
    )
    print(f"Normalized to {len(rows)} rows.")

    if len(rows) == 0:
        write_csv(args.out, [], db_fields)
        print("ERROR: Normalized to 0 rows. Wrote empty CSV and failing.", file=sys.stderr)
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
        print(f"Upserted {len(rows)} rows into Supabase table '{args.supabase_table}'")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
