import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function assertEnv() {
  if (!supabaseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL is required.");
  if (!supabaseAnonKey) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is required.");
}

/**
 * Browser + client-side usage:
 * - Safe to import anywhere (does not throw on import)
 * - Only throws if you call getSupabaseClient() without env
 */
let _client: SupabaseClient | null = null;

export function getSupabaseClient() {
  if (_client) return _client;
  assertEnv();
  _client = createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
  return _client;
}

// Backwards-compatible export for existing imports.
// This still does NOT throw at import-time.
export const supabase = new Proxy(
  {},
  {
    get(_target, prop) {
      const client = getSupabaseClient() as any;
      return client[prop];
    },
  }
) as unknown as SupabaseClient;
