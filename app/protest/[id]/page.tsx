import type { Metadata } from "next";
import { supabase } from "@/lib/supabase";
import ProtestDetailClient from "./ProtestDetailClient";
import type { Metadata } from "next";
import { supabase } from "@/lib/supabase";

const SITE_NAME = "Local Assembly";
const SITE_URL = "https://www.localassembly.org";

type PageProps = {
  params: Promise<{ id: string }>;
};

function stripHtml(s: string) {
  return s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function safeText(s: string, max = 160) {
  const t = stripHtml(s || "");
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
}

function fallbackOgImage(id: string) {
  // If you do not have per-event OG images, use the site hero
  return `${SITE_URL}/images/home-hero.jpg`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;

  const { data } = await supabase
    .from("protests")
    .select("id,title,description,city,state,event_time,image_path,status")
    .eq("id", id)
    .maybeSingle();

  // If missing or inactive, keep it indexable if you want, or set noindex
  if (!data || data.status !== "active") {
    return {
      metadataBase: new URL(SITE_URL),
      title: "Event Not Found",
      description: "This listing is not available.",
      robots: { index: false, follow: false },
      alternates: { canonical: `/protest/${id}` },
    };
  }

  const titleCore = data.title?.trim() || "Civic Event";
  const place = [data.city, data.state].filter(Boolean).join(", ");
  const pageTitle = place ? `${titleCore} in ${place}` : titleCore;

  const desc =
    (data.description && safeText(data.description, 170)) ||
    (place
      ? `View event details for ${titleCore} in ${place}. Find protests, rallies, and civic events near you on Local Assembly.`
      : `View event details for ${titleCore}. Find protests, rallies, and civic events near you on Local Assembly.`);

  // If your image_path is a Supabase storage path, convert it to an absolute URL that actually resolves.
  // If you already have a public URL stored, keep it.
  const ogImage =
    data.image_path && data.image_path.startsWith("http")
      ? data.image_path
      : fallbackOgImage(id);

  const url = `${SITE_URL}/protest/${data.id}`;

  return {
    metadataBase: new URL(SITE_URL),
    title: `${pageTitle} | ${SITE_NAME}`,
    description: desc,
    keywords: [
      "local protest near me",
      "protests near me",
      "rallies near me",
      "town hall near me",
      "civic event",
      "how can I get involved",
      "what can I do to help",
      place,
      data.city || "",
      data.state || "",
      SITE_NAME,
    ].filter(Boolean),
    alternates: { canonical: `/protest/${data.id}` },
    openGraph: {
      type: "article",
      url,
      title: `${pageTitle} | ${SITE_NAME}`,
      description: desc,
      siteName: SITE_NAME,
      images: [{ url: ogImage, width: 1200, height: 630, alt: pageTitle }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${pageTitle} | ${SITE_NAME}`,
      description: desc,
      images: [ogImage],
    },
    robots: { index: true, follow: true },
  };
}

export default async function ProtestDetailPage({ params }: PageProps) {
  const { id } = await params;

  // your existing page implementation here
  return (
    <main className="mx-auto max-w-[980px] px-4 py-6 md:px-6">
      <h1 className="text-2xl font-black">Event</h1>
      <p className="text-sm text-neutral-700">Listing ID: {id}</p>
    </main>
  );
}

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
  const url = `https://www.localassembly.org/protest/${p.id}`;

  // Build absolute OG image url
  const rawImg = resolveImageSrcServer(p.image_path);
  const ogImage =
    rawImg.startsWith("http://") || rawImg.startsWith("https://")
      ? rawImg
      : `https://www.localassembly.org${rawImg}`;

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
          url: `https://www.localassembly.org/protest/${p.id}`,
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
                  : `https://www.localassembly.org${baseImageUrl}`,
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
