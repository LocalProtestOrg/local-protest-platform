#!/usr/bin/env python3
"""
Pull upcoming civic events from the Mobilize API and output a CSV (and optionally upsert to Supabase).

Why Mobilize?
- Mobilize exposes a public GET /v1/events endpoint with date filtering via timeslot_start/timeslot_end comparison params,
  plus paging via per_page/page/cursor. See Mobilize API docs.

What this script does:
- Pulls events whose timeslots start in the next N days (default: 28)
- Filters to in-person events (is_virtual=false)
- Filters to a set of "civic / community action" event types (configurable)
- Dedupe by Mobilize event id + timeslot id
- Outputs a CSV you can import to your database
- Optional: upsert into Supabase via REST (PostgREST) if you set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY

USAGE:
  python scripts/pull_mobilize_events.py --limit 200 --days 28 --out events_import.csv

OPTIONAL SUPABASE UPSERT:
  export SUPABASE_URL="https://xxxx.supabase.co"
  export SUPABASE_SERVICE_ROLE_KEY="your_service_role_key"
  python scripts/pull_mobilize_events.py --limit 200 --days 28 --out events_import.csv --upsert

NOTES:
- Mobilize 'description' may be HTML. This script keeps a plain-text version for your listing.
- Always review imported events before publishing.
"""

import argparse
import datetime as dt
import html
import os
import re
import sys
from typing import Any, Dict, List, Tuple, Optional

import requests

MOBILIZE_API_BASE = "https://api.mobilize.us/v1"

DEFAULT_EVENT_TYPES = [
    "RALLY",
    "VISIBILITY_EVENT",
    "SOLIDARITY_EVENT",
    "TOWN_HALL",
    "COMMUNITY",
    "MEETING",
    "WORKSHOP",
]

def unix(ts: dt.datetime) -> int:
    return int(ts.replace(tzinfo=dt.timezone.utc).timestamp())

def strip_html(s: str) -> str:
    # Very simple HTML-to-text cleanup (good enough for summaries)
    s = html.unescape(s or "")
    s = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", s, flags=re.I|re.S)
    s = re.sub(r"<[^>]+>", " ", s)
    s = re.sub(r"[ \t\r\f\v]+", " ", s)
    s = re.sub(r"\n{2,}", "\n", s)
    return s.strip()

def is_peaceful_enough(title: str, desc: str) -> bool:
    """
    Conservative filter to exclude obviously violent content.
    This does NOT guarantee an event is peaceful — it just avoids clear red flags.
    """
    text = f"{title}\n{desc}".lower()
    banned = [
        "riot", "loot", "looting", "armed", "weapon", "guns", "molotov",
        "kill", "assassinate", "attack", "violent", "violence",
    ]
    return not any(b in text for b in banned)

def fetch_page(params: Dict[str, Any]) -> Dict[str, Any]:
    url = f"{MOBILIZE_API_BASE}/events"
    resp = requests.get(url, params=params, timeout=30)
    resp.raise_for_status()
    return resp.json()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=200)
    ap.add_argument("--days", type=int, default=28)
    ap.add_argument("--out", default="events_import.csv")
    ap.add_argument("--timezone", default="America/New_York")
    ap.add_argument("--per-page", type=int, default=100)
    ap.add_argument("--event-type", action="append", dest="event_types", default=None,
                    help="Repeatable. If omitted, defaults to a civic-focused set.")
    ap.add_argument("--include-virtual", action="store_true", help="Include virtual events")
    ap.add_argument("--upsert", action="store_true", help="Upsert into Supabase (requires env vars)")
    ap.add_argument("--supabase-table", default="protests")
    args = ap.parse_args()

    start = dt.datetime.utcnow()
    end = start + dt.timedelta(days=args.days)

    event_types = args.event_types or DEFAULT_EVENT_TYPES

    params = {
        "timeslot_start": f"gte_{unix(start)}",
        "timeslot_start": f"gte_{unix(start)}",
        "timeslot_end": f"lt_{unix(end)}",
        "per_page": args.per_page,
        # Use page-based for simplicity; API also supports cursor pagination.
        "page": 1,
    }

    # Add event_types filters as repeated params
    # requests supports this by passing a list for the key.
    params["event_types"] = event_types

    if not args.include_virtual:
        params["is_virtual"] = "false"

    out_rows: List[Dict[str, Any]] = []
    seen: set = set()

    while len(out_rows) < args.limit:
        data = fetch_page(params)
        events = data.get("data") or []
        if not events:
            break

        for ev in events:
            title = (ev.get("title") or "").strip()
            desc_html = ev.get("description") or ""
            desc = strip_html(desc_html)

            # Peacefulness heuristic
            if not is_peaceful_enough(title, desc):
                continue

            tz = ev.get("timezone") or args.timezone
            sponsor = (ev.get("sponsor") or {}).get("name") if isinstance(ev.get("sponsor"), dict) else None
            url = ev.get("browser_url") or ""
            ev_type = ev.get("event_type") or ""

            loc = ev.get("location") or {}
            city = (loc.get("locality") or "").strip()
            state = (loc.get("region") or "").strip()
            postal = (loc.get("postal_code") or "").strip()
            venue = (loc.get("venue") or "").strip()

            geo = loc.get("location") or {}
            lat = geo.get("latitude")
            lng = geo.get("longitude")

            tags = []
            for t in (ev.get("tags") or []):
                name = t.get("name") if isinstance(t, dict) else None
                if name:
                    tags.append(name)
            tags_str = ", ".join(tags)

            # Each Mobilize event can have multiple timeslots.
            for ts in (ev.get("timeslots") or []):
                ts_id = ts.get("id")
                start_unix = ts.get("start_date")
                end_unix = ts.get("end_date")

                if not start_unix:
                    continue

                key = (ev.get("id"), ts_id, start_unix)
                if key in seen:
                    continue
                seen.add(key)

                start_dt = dt.datetime.fromtimestamp(int(start_unix), tz=dt.timezone.utc).isoformat()
                end_dt = (
                    dt.datetime.fromtimestamp(int(end_unix), tz=dt.timezone.utc).isoformat()
                    if end_unix else ""
                )

                out_rows.append({
                    "title": title,
                    "description": desc[:2000],  # keep it reasonable
                    "start_datetime": start_dt,
                    "end_datetime": end_dt,
                    "timezone": tz,
                    "city": city,
                    "state": state,
                    "postal_code": postal,
                    "venue": venue,
                    "address1": (loc.get("address_lines") or ["",""])[0] if isinstance(loc.get("address_lines"), list) else "",
                    "address2": (loc.get("address_lines") or ["",""])[1] if isinstance(loc.get("address_lines"), list) else "",
                    "lat": lat,
                    "lng": lng,
                    "source": sponsor or "Mobilize",
                    "source_url": url,
                    "event_type": ev_type,
                    "tags": tags_str,
                    "status": "active",
                })

                if len(out_rows) >= args.limit:
                    break

            if len(out_rows) >= args.limit:
                break

        # Advance page
        params["page"] += 1

        # Safety: stop if API says no more pages
        if not data.get("next"):
            break

    # Write CSV
    import csv
    with open(args.out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(out_rows[0].keys()) if out_rows else [
            "title","description","start_datetime","end_datetime","timezone","city","state","postal_code",
            "venue","address1","address2","lat","lng","source","source_url","event_type","tags","status"
        ])
        w.writeheader()
        for r in out_rows:
            w.writerow(r)

    print(f"Wrote {len(out_rows)} rows to {args.out}")

    if args.upsert:
        supa_url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        if not supa_url or not key:
            print("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.", file=sys.stderr)
            sys.exit(2)

        # Upsert via PostgREST
        endpoint = f"{supa_url.rstrip('/')}/rest/v1/{args.supabase_table}"
        headers = {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        }

        # You may want to upsert on a unique key (e.g., source_url + start_datetime).
        # That requires a UNIQUE constraint in Postgres. Without it, this will insert duplicates.
        # For now, we just insert in batches.
        BATCH = 200
        for i in range(0, len(out_rows), BATCH):
            batch = out_rows[i:i+BATCH]
            r = requests.post(endpoint, headers=headers, data=json.dumps(batch), timeout=60)
            r.raise_for_status()

        print(f"Upsert/inserted {len(out_rows)} rows into Supabase table '{args.supabase_table}'")

if __name__ == "__main__":
    main()
