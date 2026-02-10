#!/usr/bin/env python3
"""
Pull upcoming civic events from Mobilize and either:
1) Write a CSV for manual import, and/or
2) Upsert into Supabase (PostgREST)

Mobilize API docs (filters): timeslot_start/timeslot_end, is_virtual, event_types, etc. :contentReference[oaicite:1]{index=1}

Usage:
  python scripts/pull_mobilize_events.py --limit 200 --days 28 --out events_import.csv
  python scripts/pull_mobilize_events.py --limit 200 --days 28 --out events_import.csv --upsert

Required env vars for --upsert:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import html
import json
import os
import re
import sys
from typing import Any, Dict, List, Optional, Tuple

import requests


MOBILIZE_API_BASE = "https://api.mobilize.us/v1"

# These are Mobilize "event_type" values (not "event_types"). The list endpoint uses event_types=... filters. :contentReference[oaicite:2]{index=2}
DEFAULT_EVENT_TYPES = [
    "RALLY",
    "TOWN_HALL",
    "MEETING",
    "COMMUNITY",
    "WORKSHOP",
    "VISIBILITY_EVENT",
    "SOLIDARITY_EVENT",
    "OTHER",
]

# Conservative keyword filter to avoid obvious violent content.
BANNED_TERMS = [
    "riot", "rioting", "loot", "looting", "armed", "weapon", "weapons", "guns",
    "molotov", "kill", "assassinate", "attack", "violent", "violence",
]

# Fields we will send to Supabase.
# If your table does not have some of these optional columns, remove them from DEFAULT_DB_FIELDS.
DEFAULT_DB_FIELDS = [
    "title",
    "description",
    "event_time",     # timestamptz
    "city",
    "state",
    "postal_code",
    "venue",
    "address1",
    "address2",
    "lat",
    "lng",
    "source",
    "source_url",
    "event_type",
    "tags",
    "status",
]


def unix(ts: dt.datetime) -> int:
    return int(ts.replace(tzinfo=dt.timezone.utc).timestamp())


def iso_utc_from_unix(ts_unix: int) -> str:
    # Supabase timestamptz accepts ISO 8601
    return dt.datetime.fromtimestamp(int(ts_unix), tz=dt.timezone.utc).isoformat()


def strip_html(s: str) -> str:
    s = html.unescape(s or "")
    s = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", s, flags=re.I | re.S)
    s = re.sub(r"<[^>]+>", " ", s)
    s = re.sub(r"[ \t\r\f\v]+", " ", s)
    s = re.sub(r"\n{2,}", "\n", s)
    return s.strip()


def looks_safe(title: str, desc: str) -> bool:
    text = f"{title}\n{desc}".lower()
    return not any(term in text for term in BANNED_TERMS)


def mobilize_list_events(
    *,
    start_unix: int,
    end_unix: int,
    limit: int,
    per_page: int,
    include_virtual: bool,
    event_types: List[str],
) -> List[Dict[str, Any]]:
    """
    Fetch events from Mobilize. Uses the documented filters for list public events. :contentReference[oaicite:3]{index=3}
    Pagination: Mobilize supports per_page/page parameters in practice; if it ever ignores them, we still stop once we stop receiving results.
    """
    out: List[Dict[str, Any]] = []
    page = 1

    while len(out) < limit:
        params: List[Tuple[str, str]] = []

        # Time window filters (documented) :contentReference[oaicite:4]{index=4}
        params.append(("timeslot_start", f"gte_{start_unix}"))
        params.append(("timeslot_end", f"lt_{end_unix}"))

        # Virtual filter (documented) :contentReference[oaicite:5]{index=5}
        if not include_virtual:
            params.append(("is_virtual", "false"))

        # event_types filter (documented; repeat param) :contentReference[oaicite:6]{index=6}
        for et in event_types:
            params.append(("event_types", et))

        # Paging (works widely with Mobilize)
        params.append(("per_page", str(per_page)))
        params.append(("page", str(page)))

        url = f"{MOBILIZE_API_BASE}/events"
        resp = requests.get(url, params=params, timeout=45)
        if resp.status_code >= 400:
            raise RuntimeError(f"Mobilize API error {resp.status_code}: {resp.text[:500]}")

        payload = resp.json()
        events = payload.get("data") or []
        if not events:
            break

        out.extend(events)
        page += 1

        # Safety stop if server stops paging but keeps returning same page.
        if page > 200:
            break

    return out[:limit]


def normalize_event_rows(events: List[Dict[str, Any]], limit: int) -> List[Dict[str, Any]]:
    """
    Each event can have multiple timeslots. We output one row per timeslot, deduped.
    """
    rows: List[Dict[str, Any]] = []
    seen: set = set()

    for ev in events:
        title = (ev.get("title") or "").strip()
        desc = strip_html(ev.get("description") or "")

        if not title:
            continue

        if not looks_safe(title, desc):
            continue

        browser_url = (ev.get("browser_url") or "").strip()
        ev_type = (ev.get("event_type") or "").strip()

        sponsor_name = None
        sponsor = ev.get("sponsor")
        if isinstance(sponsor, dict):
            sponsor_name = sponsor.get("name")

        location = ev.get("location") or {}
        city = (location.get("locality") or "").strip()
        state = (location.get("region") or "").strip()
        postal = (location.get("postal_code") or "").strip()
        venue = (location.get("venue") or "").strip()

        address_lines = location.get("address_lines") if isinstance(location.get("address_lines"), list) else ["", ""]
        address1 = (address_lines[0] if len(address_lines) > 0 else "") or ""
        address2 = (address_lines[1] if len(address_lines) > 1 else "") or ""

        geo = location.get("location") or {}
        lat = geo.get("latitude")
        lng = geo.get("longitude")

        tags = []
        for t in (ev.get("tags") or []):
            if isinstance(t, dict) and t.get("name"):
                tags.append(t["name"])
        tags_str = ", ".join(tags)

        timeslots = ev.get("timeslots") or []
        for ts in timeslots:
            ts_id = ts.get("id")
            start_u = ts.get("start_date")
            end_u = ts.get("end_date")

            if not start_u:
                continue

            key = (ev.get("id"), ts_id, start_u)
            if key in seen:
                continue
            seen.add(key)

            event_time = iso_utc_from_unix(int(start_u))  # timestamptz

            row = {
                "title": title,
                "description": desc[:4000],
                "event_time": event_time,   # matches your Supabase timestamptz column
                "city": city,
                "state": state,
                "postal_code": postal,
                "venue": venue,
                "address1": address1,
                "address2": address2,
                "lat": lat,
                "lng": lng,
                "source": sponsor_name or "Mobilize",
                "source_url": browser_url,
                "event_type": ev_type,
                "tags": tags_str,
                "status": "active",
            }

            rows.append(row)
            if len(rows) >= limit:
                return rows

    return rows


def write_csv(path: str, rows: List[Dict[str, Any]], fieldnames: List[str]) -> None:
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in fieldnames})


def upsert_supabase(
    *,
    supabase_url: str,
    service_role_key: str,
    table: str,
    rows: List[Dict[str, Any]],
    fields: List[str],
    on_conflict: str,
) -> None:
    """
    Upsert via PostgREST:
      POST /rest/v1/{table}?on_conflict=col1,col2
      Prefer: resolution=merge-duplicates

    This requires a UNIQUE index/constraint on the on_conflict columns in Postgres.
    """
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

    payload_rows = [{k: r.get(k) for k in fields} for r in rows]

    batch_size = 200
    for i in range(0, len(payload_rows), batch_size):
        batch = payload_rows[i:i + batch_size]
        resp = requests.post(endpoint, params=params, headers=headers, data=json.dumps(batch), timeout=90)
        if resp.status_code >= 400:
            raise RuntimeError(f"Supabase upsert failed {resp.status_code}: {resp.text[:800]}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=200)
    ap.add_argument("--days", type=int, default=28)
    ap.add_argument("--out", default="events_import.csv")
    ap.add_argument("--per-page", type=int, default=100)
    ap.add_argument("--include-virtual", action="store_true")
    ap.add_argument("--event-type", action="append", dest="event_types", default=None)
    ap.add_argument("--upsert", action="store_true")
    ap.add_argument("--supabase-table", default="protests")
    ap.add_argument(
        "--on-conflict",
        default="source_url,event_time",
        help="Comma-separated columns used for Supabase upsert. Requires a UNIQUE index on these columns.",
    )
    ap.add_argument(
        "--db-fields",
        default=",".join(DEFAULT_DB_FIELDS),
        help="Comma-separated list of columns to send to Supabase and to write to CSV.",
    )
    args = ap.parse_args()

    now = dt.datetime.utcnow()
    end = now + dt.timedelta(days=args.days)

    event_types = args.event_types or DEFAULT_EVENT_TYPES
    db_fields = [x.strip() for x in args.db_fields.split(",") if x.strip()]

    print(f"Fetching up to {args.limit} events for next {args.days} days...")

    try:
        events = mobilize_list_events(
            start_unix=unix(now),
            end_unix=unix(end),
            limit=max(args.limit, 500),  # fetch more raw events because we output per timeslot and filter
            per_page=args.per_page,
            include_virtual=args.include_virtual,
            event_types=event_types,
        )
    except Exception as e:
        print(f"ERROR fetching Mobilize events: {e}", file=sys.stderr)
        # Still write an empty CSV so the workflow can succeed and you can see it ran.
        write_csv(args.out, [], db_fields)
        print(f"Wrote empty CSV to {args.out}")
        return 0

    rows = normalize_event_rows(events, args.limit)

    write_csv(args.out, rows, db_fields)
    print(f"Wrote {len(rows)} rows to {args.out}")

    if args.upsert:
        supabase_url = os.environ.get("SUPABASE_URL", "").strip()
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
        if not supabase_url or not key:
            print("ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.", file=sys.stderr)
            return 1

        try:
            upsert_supabase(
                supabase_url=supabase_url,
                service_role_key=key,
                table=args.supabase_table,
                rows=rows,
                fields=db_fields,
                on_conflict=args.on_conflict,
            )
        except Exception as e:
            print(f"ERROR upserting to Supabase: {e}", file=sys.stderr)
            return 1

        print(f"Upserted {len(rows)} rows into Supabase table '{args.supabase_table}'")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
