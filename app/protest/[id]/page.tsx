import type { Metadata } from "next";
import { supabase } from "@/lib/supabase";
import ProtestDetailClient from "./ProtestDetailClient";

export const revalidate = 0;

type Protest = {
  id: string;
  title: string;
  description: string;
  city: string | null;
  state: string | null;
  event_time: string | null;
  created_at: string;
  organizer_username: string | null;
  image_path: string | null;
  status: string;
  report_count: number;

  // New fields (if present)
  event_types?: string[] | null;
  is_accessible?: boolean | null;
  accessibility_features?: string[] | null;
};

function stripHtml(s: string) {
  return (s || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function safeText(s: string, max = 160) {
  const t = stripHtml(s || "");
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
}

function resolveImageSrcServer(image_path: string | null) {
  const DEFAULT_LOCAL = "/images/default-protest.jpeg";
  const FALLBACK_LOCAL = "/images/fallback.jpg";

  const p = (image_path ?? "").trim();
  if (!p) return DEFAULT_LOCAL;

  if (p.startsWith("http://") || p.startsWith("https://")) return p;
  if (p.startsWith("/")) return p;
  if (p.startsWith("images/")) return "/" + p;

  if (p === "fallback.jpg") return FALLBACK_LOCAL;
  if (p === "default-protest.jpeg") return DEFAULT_LOCAL;
  if (p === "default-protest.jpg") return "/images/default-protest.jpg";

  // Supabase Storage public URL
  return supabase.storage.from("protest-images").getPublicUrl(p).data.publicUrl;
}

async function fetchProtest(id: string): Promise<Protest | null> {
  const { data, error } = await supabase.from("protests").select("*").eq("id", id).single();
  if (error || !data) return null;
  return data as Protest;
}

// ✅ Per-event SEO
export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const p = await fetchProtest(params.id);

  if (!p) {
    return {
      title: "Event not found — Local Assembly",
      description: "This listing could not be found.",
      robots: { index: false, follow: true },
    };
  }

  // If hidden/under review, do not index.
  if (p.status !== "active") {
    return {
      title: "Listing unavailable — Local Assembly",
      description: "This listing is currently unavailable or under review.",
      robots: { index: false, follow: true },
    };
  }

  const location =
    p.city && p.state ? `${p.city}, ${p.state}` : p.city ? p.city : p.state ? p.state : "United States";

  const title = `${p.title} — ${location} | Local Assembly`;
  const description = safeText(p.description || "View listing details on Local Assembly.", 170);
  const url = `https://localassembly.org/protest/${p.id}`;

  // Build absolute OG image url
  const rawImg = resolveImageSrcServer(p.image_path);
  const ogImage =
    rawImg.startsWith("http://") || rawImg.startsWith("https://")
      ? rawImg
      : `https://localassembly.org${rawImg}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      title,
      description,
      siteName: "Local Assembly",
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: p.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
    robots: { index: true, follow: true },
  };
}

export default async function ProtestPage({ params }: { params: { id: string } }) {
  const p = await fetchProtest(params.id);

  // We still render your full client experience.
  // (If missing, client will show Not found.)
  const baseImageUrl = p ? resolveImageSrcServer(p.image_path) : "/images/default-protest.jpeg";

  // ✅ JSON-LD Event schema (only if active)
  const jsonLd =
    p && p.status === "active"
      ? {
          "@context": "https://schema.org",
          "@type": "Event",
          name: p.title,
          description: safeText(p.description || "", 500),
          eventStatus: "https://schema.org/EventScheduled",
          startDate: p.event_time || undefined,
          url: `https://localassembly.org/protest/${p.id}`,
          location: {
            "@type": "Place",
            name:
              p.city && p.state
                ? `${p.city}, ${p.state}`
                : p.city
                ? p.city
                : p.state
                ? p.state
                : "Location not provided",
            address: {
              "@type": "PostalAddress",
              addressLocality: p.city || undefined,
              addressRegion: p.state || undefined,
              addressCountry: "US",
            },
          },
          organizer: {
            "@type": "Organization",
            name: p.organizer_username ? `@${p.organizer_username}` : "Organizer",
          },
          image: baseImageUrl
            ? [
                baseImageUrl.startsWith("http://") || baseImageUrl.startsWith("https://")
                  ? baseImageUrl
                  : `https://localassembly.org${baseImageUrl}`,
              ]
            : undefined,
          accessibilityFeature: (p.accessibility_features || undefined) ?? undefined,
          isAccessibleForFree: true,
        }
      : null;

  return (
    <>
      {jsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      ) : null}

      <ProtestDetailClient />
    </>
  );
}
