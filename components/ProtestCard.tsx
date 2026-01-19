// components/ProtestCard.tsx
"use client";

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
};

function formatLocation(city?: string | null, state?: string | null) {
  const c = (city || "").trim();
  const s = (state || "").trim();
  if (c && s) return `${c}, ${s}`;
  return c || s || "Location TBD";
}

export default function ProtestCard({ protest }: { protest: Protest }) {
  // ✅ Fix: coerce undefined → null for TypeScript + runtime
  const imgSrc = getProtestImageSrc(protest.image_path ?? null);
  const location = formatLocation(protest.city, protest.state);

  return (
    <Link
      href={`/protest/${protest.id}`}
      className="block rounded-xl border border-black/10 overflow-hidden hover:shadow-sm transition"
    >
      <div className="relative aspect-[16/9] bg-black/5">
        <Image
          src={imgSrc}
          alt={protest.title}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 33vw"
          // If remote images ever cause issues again, uncomment:
          // unoptimized
          onError={(e) => {
            // Final safety: if a URL 404s, switch to local fallback
            // Note: Next/Image wraps img internally; this is a best-effort safeguard.
            const target = e.target as HTMLImageElement | null;
            if (!target) return;
            if (!target.src.endsWith("/images/fallback.jpg")) {
              target.src = "/images/fallback.jpg";
            }
          }}
        />
      </div>

      <div className="p-4">
        <div className="font-semibold text-lg leading-snug line-clamp-2">
          {protest.title}
        </div>

        <div className="mt-1 text-sm text-black/70">{location}</div>

        <div className="mt-2 text-sm text-black/80 line-clamp-3">
          {protest.description}
        </div>
      </div>
    </Link>
  );
}
