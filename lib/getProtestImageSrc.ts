// lib/getProtestImageSrc.ts
import { supabase } from "@/lib/supabase";

const FALLBACK_LOCAL = "/images/fallback.jpg";
const DEFAULT_LOCAL = "/images/default-protest.jpeg";

/**
 * Returns a usable image URL for <img src="...">.
 * Handles:
 *  - http(s) URLs
 *  - /images/... local public paths
 *  - images/... relative local paths stored in DB
 *  - legacy filenames (fallback.jpg)
 *  - Supabase Storage object paths (protests/<id>/cover.jpg)
 */
export function getProtestImageSrc(image_path: string | null) {
  const p = (image_path ?? "").trim();
  if (!p) return DEFAULT_LOCAL;

  if (p.startsWith("http://") || p.startsWith("https://")) return p;
  if (p.startsWith("/")) return p;
  if (p.startsWith("images/")) return "/" + p;

  if (p === "fallback.jpg") return FALLBACK_LOCAL;
  if (p === "default-protest.jpeg") return DEFAULT_LOCAL;
  if (p === "default-protest.jpg") return "/images/default-protest.jpg";

  return supabase.storage.from("protest-images").getPublicUrl(p).data.publicUrl;
}
