import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Your bucket name (you said this is public already)
const BUCKET = "protest-images";

// Path to the JSON you downloaded
const INPUT_JSON = path.resolve("scripts/protests_import_supabase.json");

// Optional: store uploads in a folder for organization
const UPLOAD_PREFIX = "seed/2026-01";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function downloadImage(url) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Failed download ${url} (${res.status})`);

  const contentType = res.headers.get("content-type") || "image/jpeg";
  const arrayBuffer = await res.arrayBuffer();
  return { bytes: new Uint8Array(arrayBuffer), contentType };
}

function extFromContentType(contentType) {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  return "jpg";
}

async function uploadToStorage(bytes, contentType) {
  const ext = extFromContentType(contentType);
  const filename = `${crypto.randomUUID()}.${ext}`;
  const objectPath = `${UPLOAD_PREFIX}/${filename}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(objectPath, bytes, {
      contentType,
      upsert: false,
      cacheControl: "3600",
    });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return objectPath;
}

async function insertProtest(row) {
  // Only insert columns that exist in your table schema.
  // id + created_at are defaults.
  const payload = {
    user_id: row.user_id ?? null,
    organizer_username: row.organizer_username ?? null,
    title: row.title,
    description: row.description,
    city: row.city ?? null,
    state: row.state ?? null,
    event_time: row.event_time ?? null,
    image_path: row.image_path ?? null,
    status: row.status ?? "active",
    report_count: row.report_count ?? 0,
    last_reported_at: row.last_reported_at ?? null,
  };

  const { error } = await supabase.from("protests").insert(payload);
  if (error) throw new Error(`DB insert failed: ${error.message}`);
}

async function main() {
  const raw = await fs.readFile(INPUT_JSON, "utf-8");
  const rows = JSON.parse(raw);

  console.log(`Loaded ${rows.length} protests from ${INPUT_JSON}`);
  console.log(`Uploading images to bucket "${BUCKET}" under "${UPLOAD_PREFIX}/"...`);

  let ok = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    try {
      const imageUrl = row.image_path; // currently this JSON has a URL in image_path
      if (!imageUrl || typeof imageUrl !== "string") {
        throw new Error("Missing image URL in image_path");
      }

      const { bytes, contentType } = await downloadImage(imageUrl);
      const storagePath = await uploadToStorage(bytes, contentType);

      // Replace URL with Storage path (what your app expects)
      row.image_path = storagePath;

      await insertProtest(row);

      ok++;
      console.log(`✅ [${i + 1}/${rows.length}] Inserted: ${row.title}`);
      // small delay to be polite to remote image host + your DB
      await sleep(150);
    } catch (err) {
      failed++;
      console.error(`❌ [${i + 1}/${rows.length}] Failed: ${row.title}`);
      console.error(err?.message || err);
      // continue
      await sleep(150);
    }
  }

  console.log(`\nDone. Success: ${ok}, Failed: ${failed}`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
