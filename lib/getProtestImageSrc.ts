// lib/getProtestImageSrc.ts
import { supabase } from "@/lib/supabase";

const FALLBACK_LOCAL = "/images/fallback.jpg";
const DEFAULT_LOCAL = "/images/default-protest.jpeg";

// Explicitly allowed remote hosts (tight allowlist)
const ALLOWED_REMOTE_HOSTS = new Set([
  "images.unsplash.com",
  "plus.unsplash.com",
]);

/**
 * Returns a safe, usable image URL for <img> or next/image.
 *
 * Rules:
 *  - NEVER allow source.unsplash.com (unstable + rate-limited)
 *  - Allow local public images (/images/...)
 *  - Allow Supabase Storage object paths
 *  - Allow explicitly whitelisted remote hosts only
 *  - Everything else → local default image
 */
export function getProtestImageSrc(image_path: string | null): string {
  const p = (image_path ?? "").trim();

  if (!p) return DEFAULT_LOCAL;

  // 1️⃣ Full URL
  if (p.startsWith("http://") || p.startsWith("https://")) {
    try {
      const url = new URL(p);

      // ❌ Block source.unsplash.com explicitly
      if (url.hostname === "source.unsplash.com") {
        return DEFAULT_LOCAL;
      }

      // ✅ Allow only approved remote hosts
      if (ALLOWED_REMOTE_HOSTS.has(url.hostname)) {
        return p;
      }

      // ❌ Everything else is rejected
      return DEFAULT_LOCAL;
    } catch {
      return DEFAULT_LOCAL;
    }
  }

  // 2️⃣ Local public paths
  if (p.startsWith("/")) return p;
  if (p.startsWith("images/")) return "/" + p;

  // 3️⃣ Legacy filenames stored in DB
  if (p === "fallback.jpg") return FALLBACK_LOCAL;
  if (p === "default-protest.jpeg") return DEFAULT_LOCAL;
  if (p === "default-protest.jpg") return "/images/default-protest.jpg";

  // 4️⃣ Supabase Storage object path
  return (
    supabase.storage
      .from("protest-images")
      .getPublicUrl(p).data.publicUrl || DEFAULT_LOCAL
  );
}
