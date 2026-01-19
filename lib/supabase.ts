import { createClient } from "@supabase/supabase-js";

// These MUST be NEXT_PUBLIC for browser + Next build steps.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Don't throw at import-time in case a build step evaluates modules.
// Instead, throw only when the client is actually used.
function assertEnv() {
  if (!supabaseUrl) throw new Error("supabaseUrl is required.");
  if (!supabaseAnonKey) throw new Error("supabaseAnonKey is required.");
}

export const supabase = (() => {
  assertEnv();
  return createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
})();
