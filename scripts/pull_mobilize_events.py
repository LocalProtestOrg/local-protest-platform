#!/usr/bin/env python3
"""
Local Assembly weekly importer for Supabase `protests` table.

Key goals:
- Pull ~200 upcoming events (next N days) from Mobilize API
- Enrich sparse listings by fetching each event's source_url page and extracting:
  - fuller description
  - organizer name (if present)
  - image (if present)
- Upsert into Supabase with stable keys (source_key + external_id)

Table columns supported (yours):
id, user_id, organizer_username, title, description, city, state, event_time, created_at, image_path, status,
report_count, last_reported_at, event_types, is_accessible, accessibility_features, source_type, source_name,
source_url, source_key, external_id, last_seen_at

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

UA = "LocalAssemblyBot/1.0 (+https://www.localassembly.org)"


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
        resp = requests.get(url, params=params, timeout=45, headers={"User-Agent": UA})
        if resp.status_code >= 400:
            raise RuntimeError(f"Mobilize API error {resp.status_code}: {resp.text[:700]}")

        payload = resp.json()
        events = payload.get("data") or []
        if not events:
            break

        out.extend(events)
        page += 1

    return out


def extract_from_jsonld(obj: Any) -> List[Dict[str, Any]]:
    """
    Return a list of possible Event-ish objects from JSON-LD.
    Handles:
    - single dict
    - list of dicts
    - @graph
    """
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


def clean_text(s: str, max_len: int = 4000) -> str:
    s = (s or "").strip()
    s = re.sub(r"[ \t\r\f\v]+", " ", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s[:max_len].strip()


def fetch_and_enrich(source_url: str) -> Dict[str, Optional[str]]:
    """
    Fetch event page and try to extract:
    - description
    - organizer/source_name
    - image_url
    - accessibility hints (best-effort)
    """
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

    # 1) JSON-LD Event (best)
    jsonld_events: List[Dict[str, Any]] = []
    for tag in soup.find_all("script", attrs={"type": "application/ld+json"}):
        try:
            raw = tag.string or tag.get_text() or ""
            raw = raw.strip()
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

        # Accessibility (best-effort)
        is_accessible = None
        accessibility_features = None
        # Some pages include "accessibilityFeature" or similar, not guaranteed.
        af = ev.get("accessibilityFeature")
        if isinstance(af, list):
            accessibility_features = ", ".join([str(x) for x in af if x])
        elif isinstance(af, str):
            accessibility_features = af

        if accessibility_features:
            is_accessible = "true"

        return {
            "description": desc if desc else None,
            "source_name": organizer if organizer else None,
            "image_url": image_url if image_url else None,
            "is_accessible": is_accessible,
            "accessibility_features": accessibility_features,
        }

    # 2) OpenGraph / meta description (good fallback)
    og_desc = soup.find("meta", attrs={"property": "og:description"})
    meta_desc = soup.find("meta", attrs={"name": "description"})
    desc = None
    if og_desc and og_desc.get("content"):
        desc = clean_text(og_desc["content"])
    elif meta_desc and meta_desc.get("content"):
        desc = clean_text(meta_desc["content"])

    og_img = soup.find("meta", attrs={"property": "og:image"})
    image_url = og_img.get("content") if og_img and og_img.get("content") else None

    # Organizer fallback: sometimes in og:site_name
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
    source_key: str = "mobilize",
    default_status: str = "active",
    enrich: bool = True,
    enrich_timeout_soft_limit: int = 200,
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

            # Start with API description; enrich if too short or empty
            final_desc = clean_text(desc_api) if desc_api else ""
            final_source_name = sponsor_name or "Mobilize"
            image_path = None
            is_accessible = None
            accessibility_features = None

            # Only enrich a bounded number per run (keeps workflow fast and polite)
            should_enrich = enrich and browser_url and (len(final_desc) < 180)
            if should_enrich and enrich_count < enrich_timeout_soft_limit:
                enrich_count += 1
                extra = fetch_and_enrich(browser_url)

                if extra.get("description"):
                    # Prefer richer description if we got one
                    final_desc = clean_text(extra["description"])

                if extra.get("source_name"):
                    final_source_name = extra["source_name"]

                if extra.get("image_url"):
                    image_path = extra["image_url"]

                if extra.get("is_accessible"):
                    is_accessible = True

                if extra.get("accessibility_features"):
                    accessibility_features = extra["accessibility_features"]

            # Final safety check after enrichment
            if not looks_safe(title, final_desc):
                continue

            row = {
                "title": title,
                "description": final_desc[:4000] if final_desc else title,
                "city": city,
                "state": state,
                "event_time": iso_utc_from_unix(int(start_u)),  # timestamptz
                "image_path": image_path,
                "status": default_status,
                "event_types": ev_type,  # your column is plural
                "is_accessible": is_accessible,
                "accessibility_features": accessibility_features,
                "source_type": "api",
                "source_name": final_source_name,
                "source_url": browser_url,
                "source_key": source_key,
                "external_id": external_id,
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
        resp = requests.post(endpoint, params=params, headers=headers, data=json.dumps(batch), timeout=120)
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

    ap.add_argument("--enrich", action="store_true", help="Fetch source pages to enrich sparse descriptions")
    ap.add_argument("--enrich-max", type=int, default=200, help="Max number of source pages to fetch per run")

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

    print(f"Fetching Mobilize events (next {args.days} days), aiming for {args.limit} rows...")

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
        enrich=args.enrich,
        enrich_timeout_soft_limit=args.enrich_max,
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
