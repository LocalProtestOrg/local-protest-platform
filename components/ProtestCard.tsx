// components/ProtestCard.tsx
"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { getProtestImageSrc } from "@/lib/getProtestImageSrc";

type Protest = {
  id: string;
  title: string;
  description: string;

  city?: string | null;
  state?: string | null;
  event_time?: string | null; // ISO string
  image_path?: string | null; // may be undefined depending on select()

  // ✅ NEW (optional depending on select)
  event_types?: string[] | null; // text[]
  is_accessible?: boolean | null;
  accessibility_features?: string[] | null; // text[]
};

function formatLocation(city?: string | null, state?: string | null) {
  const c = (city || "").trim();
  const s = (state || "").trim();
  if (c && s) return `${c}, ${s}`;
  return c || s || "Location TBD";
}

function safeFirst(arr?: string[] | null) {
  return Array.isArray(arr) && arr.length > 0 ? (arr[0] ?? "").trim() : "";
}

export default function ProtestCard({ protest }: { protest: Protest }) {
  const location = formatLocation(protest.city, protest.state);

  // ✅ Image src with reliable fallback handling for next/image
  const baseSrc = useMemo(
    () => getProtestImageSrc(protest.image_path ?? null),
    [protest.image_path]
  );
  const [imgSrc, setImgSrc] = useState(baseSrc);

  // If baseSrc changes (new props), keep state in sync
  if (imgSrc !== baseSrc && baseSrc) {
    // This is safe because it converges quickly; avoids needing another useEffect import.
    setImgSrc(baseSrc);
  }

  // ✅ Badges
  const eventTypeLabel = safeFirst(protest.event_types) || "Other Events";
  const isAccessible = Boolean(protest.is_accessible);

  const featureCount = Array.isArray(protest.accessibility_features)
    ? protest.accessibility_features.length
    : 0;

  const featuresPreview = useMemo(() => {
    const feats = Array.isArray(protest.accessibility_features)
      ? protest.accessibility_features.filter(Boolean)
      : [];
    // show up to 2 short items
    return feats.slice(0, 2);
  }, [protest.accessibility_features]);

  return (
    <Link
      href={`/protest/${protest.id}`}
      className="block overflow-hidden rounded-xl border border-black/10 bg-white hover:shadow-sm transition"
    >
      <div className="relative aspect-[16/9] bg-black/5">
        <Image
          src={imgSrc}
          alt={protest.title}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 33vw"
          onError={() => {
            // Fallback only once
            if (imgSrc !== "/images/fallback.jpg") setImgSrc("/images/fallback.jpg");
          }}
        />

        {/* ✅ Badges over image */}
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-neutral-900 shadow-sm ring-1 ring-black/5">
            {eventTypeLabel}
          </span>

          {isAccessible && (
            <span className="rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-neutral-900 shadow-sm ring-1 ring-black/5">
              ADA Accessible
              {featureCount > 0 ? ` • ${featureCount}` : ""}
            </span>
          )}
        </div>
      </div>

      <div className="p-4">
        <div className="line-clamp-2 text-lg font-semibold leading-snug">
          {protest.title}
        </div>

        <div className="mt-1 text-sm text-black/70">{location}</div>

        <div className="mt-2 line-clamp-3 text-sm text-black/80">
          {protest.description}
        </div>

        {/* ✅ Optional: small accessibility preview text */}
        {isAccessible && featuresPreview.length > 0 && (
          <div className="mt-3 text-xs text-black/60">
            Accessibility:{" "}
            {featuresPreview.join(", ")}
            {featureCount > featuresPreview.length ? "…" : ""}
          </div>
        )}
      </div>
    </Link>
  );
}
