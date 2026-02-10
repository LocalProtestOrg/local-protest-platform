#!/usr/bin/env python3
"""
Weekly importer for LocalAssembly protests table (Supabase) from Mobilize.

- Pulls upcoming events from Mobilize within the next N days
- Outputs a CSV (always)
- Optionally upserts into Supabase via PostgREST (requires secrets)
- Writes ONLY columns that exist in your `protests` table:
  id (auto)
  user_id (left null)
  organizer_username (left null)
  title
  description
  city
  state
  event_time (timestamptz)  <- IMPORTANT
  image_path (left null)
  status
  report_count (left null)
  last_reported_at (left null)
  event_types
  is_accessible (left null)
  accessibility_features (left null)
  source_type
  source_name
  source_url
  source_key
  external_id
  last_seen_at

Upsert key recommendation:
- source_key + external_id
  external_id is built as "{mobilize_event_id}:{timeslot_id}:{start_unix}"

Mobilize API docs:
https://github.com/mobilizeamerica/api
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
from typing import Any, Dict, List, Tuple

import requests

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

# EXACT columns we will write / send (must exist in Supabase table)
DB_FIELDS_DEFAULT = [
    "title",
    "description",
    "city",
    "state",
    "event_time",
    "status",
    "event_types",
    "source_type",
    "source_name",
    "source_url",
    "source_key",
    "external_id",
    "last_seen_at",
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
    per_page: int,
    include_virtual: bool,
    event_types_filter: List[str],
    max_pages: int = 200,
) -> List[Dict[str, Any]]:
    """
    Fetch events from Mobilize within a timeslot window.
    Uses list endpoint: GET /v1/events
    """
    out: List[Dict[str, Any]] = []
    page = 1

    while page <= max_pages:
        params: List[Tuple[str, str]] = []
        params.append(("timeslot_start", f"gte_{start_unix}"))
        params.append(("timeslot_end", f"lt_{end_unix}"))

        if not include_virtual:
            params.append(("is_virtual", "false"))

        for et in event_types_filter:
            params.append(("event_types", et))

        params.append(("per_page", str(per_page)))
        params.append(("page", str(page)))

        url = f"{MOBILIZE_API_BASE}/events"
        resp = requests.get(url, params=params, timeout=45)
        if resp.status_code >= 400:
            raise RuntimeError(f"Mobilize API error {resp.status_code}: {resp.text[:700]}")

        payload = resp.json()
        events = payload.get("data") or []
        if not events:
            break

        out.extend(events)
        page += 1

        # If API provides "next" and it's falsy, stop early
        nxt = payload.get("next")
        if nxt in (None, "", False):
            # Many responses omit "next"; we still rely on empty page exit.
            pass

    return out


def normalize_to_rows(
    events: List[Dict[str, Any]],
    *,
    limit: int,
    now_iso: str,
    source_key: str = "mobilize",
    default_status: str = "active",
) -> List[Dict[str, Any]]:
    """
    Convert Mobilize events -> rows that match your protests table.
    We output ONE row per timeslot.
    """
    rows: List[Dict[str, Any]] = []
    seen: set = set()

    for ev in events:
        ev_id = ev.get("id")
        title = (ev.get("title") or "").strip()
        desc = strip_html(ev.get("description") or "")

        if not title:
            continue

        if not looks_safe(title, desc):
            continue

        browser_url = (ev.get("browser_url") or "").strip()
        ev_type = (ev.get("event_type") or "").strip()  # single string like RALLY etc.

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

            # external_id we control (stable)
            external_id = f"{ev_id}:{ts_id}:{int(start_u)}"

            # dedupe in-memory
            if external_id in seen:
                continue
            seen.add(external_id)

            row = {
                "title": title,
                "description": desc[:4000],
                "city": city,
                "state": state,
                "event_time": iso_utc_from_unix(int(start_u)),  # timestamptz
                "status": default_status,
                "event_types": ev_type,  # your table column is plural; store the single type string
                "source_type": "api",
                "source_name": sponsor_name or "Mobilize",
                "source_url": browser_url,
                "source_key": source_key,     # "mobilize"
                "external_id": external_id,   # unique per timeslot
                "last_seen_at": now_iso,
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


def supabase_upsert(
    *,
    supabase_url: str,
    service_role_key: str,
    table: str,
    rows: List[Dict[str, Any]],
    fieldnames: List[str],
    on_conflict: str,
) -> None:
    """
    Upsert via PostgREST:
      POST /rest/v1/{table}?on_conflict=col1,col2
      Prefer: resolution=merge-duplicates

    IMPORTANT: Postgres must have a UNIQUE index/constraint on on_conflict columns.
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

    payload = [{k: r.get(k) for k in fieldnames} for r in rows]

    batch_size = 200
    for i in range(0, len(payload), batch_size):
        batch = payload[i:i + batch_size]
        resp = requests.post(endpoint, params=params, headers=headers, data=json.dumps(batch), timeout=90)
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

    ap.add_argument("--upsert", action="store_true")
    ap.add_argument("--supabase-table", default="protests")
    ap.add_argument(
        "--on-conflict",
        default="source_key,external_id",
        help="Comma-separated columns for Supabase on_conflict. Must have UNIQUE index/constraint.",
    )
    ap.add_argument(
        "--db-fields",
        default=",".join(DB_FIELDS_DEFAULT),
        help="Comma-separated list of columns to write/send (must exist in Supabase table).",
    )

    args = ap.parse_args()

    now = dt.datetime.utcnow()
    end = now + dt.timedelta(days=args.days)
    now_iso = now.replace(tzinfo=dt.timezone.utc).isoformat()

    event_types_filter = args.event_types_filter or DEFAULT_EVENT_TYPES_FILTER
    db_fields = [x.strip() for x in args.db_fields.split(",") if x.strip()]

    print(f"Fetching events from Mobilize (next {args.days} days), aiming for {args.limit} rows...")

    try:
        events = mobilize_list_events(
            start_unix=unix(now),
            end_unix=unix(end),
            per_page=args.per_page,
            include_virtual=args.include_virtual,
            event_types_filter=event_types_filter,
        )
    except Exception as e:
        print(f"ERROR fetching Mobilize events: {e}", file=sys.stderr)
        write_csv(args.out, [], db_fields)
        print(f"Wrote empty CSV to {args.out}")
        return 0

    rows = normalize_to_rows(
        events,
        limit=args.limit,
        now_iso=now_iso,
        source_key="mobilize",
        default_status="active",
    )

    write_csv(args.out, rows, db_fields)
    print(f"Wrote {len(rows)} rows to {args.out}")

    if args.upsert:
        supabase_url = os.environ.get("SUPABASE_URL", "").strip()
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()

        if not supabase_url or not key:
            print("ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.", file=sys.stderr)
            return 1

        try:
            supabase_upsert(
                supabase_url=supabase_url,
                service_role_key=key,
                table=args.supabase_table,
                rows=rows,
                fieldnames=db_fields,
                on_conflict=args.on_conflict,
            )
        except Exception as e:
            print(f"ERROR upserting to Supabase: {e}", file=sys.stderr)
            return 1

        print(f"Upserted {len(rows)} rows into Supabase table '{args.supabase_table}'")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
