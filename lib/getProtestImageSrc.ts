// lib/getProtestImageSrc.ts
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

/**
 * Returns a usable image URL for Next/Image or <img>.
 * Supports:
 *  - full URLs (https://...)
 *  - local public paths (/images/...)
 *  - Supabase Storage object paths (fallback.jpg, folder/file.jpg)
 */
export function getProtestImageSrc(image_path?: string | null) {
  const FALLBACK_LOCAL = "/images/fallback.jpg";

  if (!image_path) return FALLBACK_LOCAL;

  // Full remote URL
  if (image_path.startsWith("http://") || image_path.startsWith("https://")) {
    return image_path;
  }

  // Local public file
  if (image_path.startsWith("/")) {
    return image_path;
  }

  // Otherwise treat it as a Supabase Storage object path
  const supabase = createClientComponentClient();
  const { data } = supabase.storage.from("protest-images").getPublicUrl(image_path);

  return data?.publicUrl || FALLBACK_LOCAL;
}
