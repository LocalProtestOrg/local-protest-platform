import type { Metadata } from "next";
import { supabase } from "@/lib/supabase";
import ProtestDetailClient from "./ProtestDetailClient";

export const revalidate = 0;

const SITE_NAME = "Local Assembly";
const SITE_URL = "https://www.localassembly.org";

type PageProps = {
  params: Promise<{ id: string }>;
};

type Protest = {
  id: string;
  title: string;
  description: string | null;
  city: string | null;
  state: string | null;
  event_time: string | null;
  created_at: string | null;
  organizer_username: string | null;
  image_path: string | null;
  status: string | null;
  report_count?: number | null;

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

  // Supabase Storage public URL for a path like "abc123.jpg"
  return supabase.storage.from("protest-images").getPublicUrl(p).data.publicUrl;
}

function toAbsoluteUrl(maybeRelative: string) {
  if (!maybeRelative) return `${SITE_URL}/images/fallback.jpg`;
  if (maybeRelative.startsWith("http://") || maybeRelative.startsWith("https://")) return maybeRelative;
  if (maybeRelative.startsWith("/")) return `${SITE_URL}${maybeRelative}`;
  return `${SITE_URL}/${maybeRelative}`;
}

async function fetchProtest(id: string): Promise<Protest | null> {
  const { data, error } = await supabase.from("protests").select("*").eq("id", id).single();
  if (error || !data) return null;
  return data as Protest;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const p = await fetchProtest(id);

  const canonical = `/protest/${id}`;

  if (!p) {
    return {
      metadataBase: new URL(SITE_URL),
      title: "Event Not Found | Local Assembly",
      description: "This listing could not be found.",
      alternates: { canonical },
      robots: { index: false, follow: false },
    };
  }

  if (p.status !== "active") {
    return {
      metadataBase: new URL(SITE_URL),
      title: "Listing Unavailable | Local Assembly",
      description: "This listing is currently unavailable or under review.",
      alternates: { canonical },
      robots: { index: false, follow: false },
    };
  }

  const location =
    p.city && p.state
      ? `${p.city}, ${p.state}`
      : p.city
      ? p.city
      : p.state
      ? p.state
      : "United States";

  const pageTitle = `${p.title} in ${location}`;
  const description =
    (p.description && safeText(p.description, 170)) ||
    `View details for ${p.title} in ${location}. Find protests, rallies, town halls, and civic events near you on Local Assembly.`;

  const rawImg = resolveImageSrcServer(p.image_path);
  const ogImage = toAbsoluteUrl(rawImg);

  const url = `${SITE_URL}/protest/${p.id}`;

  return {
    metadataBase: new URL(SITE_URL),
    title: `${pageTitle} | ${SITE_NAME}`,
    description,
    keywords: [
      "local protest near me",
      "protests near me",
      "rallies near me",
      "town hall near me",
      "civic event",
      "how can I get involved",
      "what can I do to help",
      p.city || "",
      p.state || "",
      location,
      SITE_NAME,
    ].filter(Boolean),
    alternates: { canonical },
    openGraph: {
      type: "article",
      url,
      title: `${pageTitle} | ${SITE_NAME}`,
      description,
      siteName: SITE_NAME,
      images: [{ url: ogImage, width: 1200, height: 630, alt: pageTitle }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${pageTitle} | ${SITE_NAME}`,
      description,
      images: [ogImage],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
  };
}

export default async function ProtestPage({ params }: PageProps) {
  const { id } = await params;
  const p = await fetchProtest(id);

  // Always render client UI; client can show Not Found states.
  // Only emit JSON-LD if listing exists and is active.
  const baseImageUrl = p ? resolveImageSrcServer(p.image_path) : "/images/default-protest.jpeg";
  const absImageUrl = toAbsoluteUrl(baseImageUrl);

  const locationName =
    p?.city && p?.state
      ? `${p.city}, ${p.state}`
      : p?.city
      ? p.city
      : p?.state
      ? p.state
      : "Location not provided";

  const jsonLd =
    p && p.status === "active"
      ? {
          "@context": "https://schema.org",
          "@type": "Event",
          name: p.title,
          description: safeText(p.description || "", 500),
          startDate: p.event_time || undefined,
          eventStatus: "https://schema.org/EventScheduled",
          eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
          isAccessibleForFree: true,
          url: `${SITE_URL}/protest/${p.id}`,
          image: absImageUrl ? [absImageUrl] : undefined,
          location: {
            "@type": "Place",
            name: locationName,
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
            url: SITE_URL,
          },
          // Optional fields if present in your table
          eventType: p.event_types && p.event_types.length ? p.event_types : undefined,
          accessibilityFeature:
            p.accessibility_features && p.accessibility_features.length ? p.accessibility_features : undefined,
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
