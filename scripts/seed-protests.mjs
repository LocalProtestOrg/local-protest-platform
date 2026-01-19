import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;


const INPUT_JSON = path.resolve("scripts/protests_import_supabase.json");
const FALLBACK_STORAGE_PATH = "fallback.jpg"; // make sure this exists in protest-images bucket

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.");
  process.exit(1);
}

// Explicitly force the service role key to be used in requests
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: {
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: SUPABASE_SERVICE_ROLE_KEY,
    },
  },
});

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function insertProtest(row) {
  const payload = {
    user_id: row.user_id ?? null,
    organizer_username: row.organizer_username ?? null,
    title: row.title,
    description: row.description,
    city: row.city ?? null,
    state: row.state ?? null,
    event_time: row.event_time ?? null,
    image_path: FALLBACK_STORAGE_PATH,
    status: row.status ?? "active",
    report_count: row.report_count ?? 0,
    last_reported_at: row.last_reported_at ?? null,
  };

  const { error } = await supabase.from("protests").insert(payload);
  if (error) throw new Error(error.message);
}

async function main() {
  // Safe debugging (does not print secrets)
  console.log("URL OK:", !!SUPABASE_URL);
  console.log(
    "KEY looks like JWT:",
    (SUPABASE_SERVICE_ROLE_KEY.split(".").length === 3) ? "YES" : "NO"
  );

  const raw = await fs.readFile(INPUT_JSON, "utf-8");
  const rows = JSON.parse(raw);

  console.log(`Loaded ${rows.length} protests from ${INPUT_JSON}`);
  console.log(`Using fallback image path: ${FALLBACK_STORAGE_PATH}`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      await insertProtest(row);
      success++;
      console.log(`✅ [${i + 1}/${rows.length}] Inserted: ${row.title}`);
      await sleep(40);
    } catch (err) {
      failed++;
      console.error(`❌ [${i + 1}/${rows.length}] Failed: ${row.title}`);
      console.error(err);
      await sleep(40);
    }
  }

  console.log(`\nDone. Success: ${success}, Failed: ${failed}`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
