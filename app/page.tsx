import type { Metadata, Viewport } from "next";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import HeroSearch from "@/components/HeroSearch";
import ProtestCard from "@/components/ProtestCard";
import { supabase } from "@/lib/supabase";
import { unstable_noStore as noStore } from "next/cache";

export const revalidate = 0;
export const dynamic = "force-dynamic";

const HOME_EVENTS_LIMIT = 6;

type ProtestRow = {
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

  event_types: string[] | null;
  is_accessible: boolean | null;
  accessibility_features: string[] | null;
};

type PageProps = {
  searchParams?: Promise<{
    q?: string;
    types?: string; // comma-separated
    accessible?: string; // "true" | "false"
    features?: string; // comma-separated
  }>;
};

const SITE_NAME = "Local Assembly";
const SITE_URL = "https://www.localassembly.org";
const OG_IMAGE = `${SITE_URL}/images/home-hero.jpg`;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
  colorScheme: "light",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Local Assembly | Find Protests, Rallies, Town Halls, and Civic Events Near You",
    template: "%s | Local Assembly",
  },
  description:
    "Find local protests and civic events near you. Local Assembly is a neutral, community-submitted directory for public demonstrations, rallies, town halls, voter registration drives, and civic gatherings across the United States.",
  keywords: [
    "local protest near me",
    "protests near me",
    "rallies near me",
    "town hall near me",
    "civic events near me",
    "community events",
    "public demonstrations",
    "march near me",
    "voter registration drive",
    "how can I get involved",
    "what can I do to help",
    "get involved locally",
    "civic engagement",
    "community organizing",
    "community action",
    "events directory",
    "Local Assembly",
  ],
  alternates: { canonical: "/" },
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
  formatDetection: { telephone: false, address: false, email: false },
  openGraph: {
    type: "website",
    url: SITE_URL,
    title: "Local Assembly | Find Civic Events Near You",
    description:
      "Search and browse community-submitted civic events across the U.S. Neutral platform. Local Assembly does not endorse or oppose any listing.",
    siteName: SITE_NAME,
    locale: "en_US",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Local Assembly civic event listings" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Local Assembly | Find Civic Events Near You",
    description:
      "Find protests, rallies, town halls, and civic events near you. Community-submitted listings across the U.S. Neutral platform.",
    images: [OG_IMAGE],
  },
  other: {
    "application-name": SITE_NAME,
    "apple-mobile-web-app-title": SITE_NAME,
    "apple-mobile-web-app-capable": "yes",
    "mobile-web-app-capable": "yes",
    "msapplication-TileColor": "#ffffff",
    "og:image:secure_url": OG_IMAGE,
    "og:image:alt": "Local Assembly civic event listings",
  },
};

function stripHtml(s: string) {
  return s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function safeText(s: string, max = 200) {
  const t = stripHtml(s || "");
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
}

function parseCsvParam(v: string | undefined) {
  if (!v) return [];
  const parts = v
    .split(",")
    .map((s) => decodeURIComponent(s).trim())
    .filter(Boolean);
  return Array.from(new Set(parts));
}

function parseAccessibleParam(v: string | undefined): boolean | null {
  if (!v) return null;
  const t = v.trim().toLowerCase();
  if (t === "true") return true;
  if (t === "false") return false;
  return null;
}

function escapeIlike(input: string) {
  return input.replace(/[%_]/g, "\\$&");
}

function parseCityState(q: string): { city?: string; state?: string } {
  const raw = q.trim();
  if (!raw) return {};

  const normalized = raw.replace(",", " ").replace(/\s+/g, " ").trim();
  const parts = normalized.split(" ");
  const last = parts[parts.length - 1];

  if (last && /^[A-Za-z]{2}$/.test(last)) {
    const state = last.toUpperCase();
    const city = parts.slice(0, -1).join(" ").trim();
    return { city: city || undefined, state };
  }

  return {};
}

export default async function HomePage({ searchParams }: PageProps) {
  noStore();

  const sp = (await searchParams) ?? {};
  const q = (sp.q ?? "").trim();

  const types = parseCsvParam(sp.types);
  const features = parseCsvParam(sp.features);
  const accessible = parseAccessibleParam(sp.accessible);

  let query = supabase
    .from("protests")
    .select(
      "id,title,description,city,state,event_time,created_at,organizer_username,image_path,status,event_types,is_accessible,accessibility_features"
    )
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(HOME_EVENTS_LIMIT);

  if (types.length > 0) query = query.overlaps("event_types", types);
  if (accessible !== null) query = query.eq("is_accessible", accessible);
  if (features.length > 0) query = query.overlaps("accessibility_features", features);

  if (q) {
    const { city, state } = parseCityState(q);

    if (city || state) {
      if (city) query = query.ilike("city", `%${escapeIlike(city)}%`);
      if (state) query = query.eq("state", state);
    } else {
      const escaped = escapeIlike(q.replaceAll(",", " "));
      query = query.or(
        [
          `title.ilike.%${escaped}%`,
          `description.ilike.%${escaped}%`,
          `city.ilike.%${escaped}%`,
          `state.ilike.%${escaped}%`,
          `organizer_username.ilike.%${escaped}%`,
        ].join(",")
      );
    }
  }

  const { data, error } = await query;
  const protests = (data ?? []) as ProtestRow[];

  const appliedFiltersLabel = [
    q ? `q="${q}"` : null,
    types.length ? `types=${types.join("|")}` : null,
    accessible !== null ? `accessible=${String(accessible)}` : null,
    features.length ? `features=${features.join("|")}` : null,
  ]
    .filter(Boolean)
    .join(" • ");

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: SITE_NAME,
        url: SITE_URL,
        logo: `${SITE_URL}/favicon-32.png`,
        sameAs: [],
      },
      {
        "@type": "WebSite",
        name: SITE_NAME,
        url: SITE_URL,
        description:
          "A neutral, community-submitted directory of public demonstrations and civic gatherings across the United States.",
        potentialAction: {
          "@type": "SearchAction",
          target: `${SITE_URL}/?q={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": "WebPage",
        name: "Home",
        url: `${SITE_URL}/`,
        description:
          "Find local protests and civic events near you. Browse community-submitted listings across the U.S.",
      },
      {
        "@type": "ItemList",
        name: appliedFiltersLabel ? `Listings (${appliedFiltersLabel})` : "Latest civic event listings",
        itemListOrder: "https://schema.org/ItemListOrderDescending",
        numberOfItems: protests.length,
        itemListElement: protests.slice(0, 25).map((p, idx) => ({
          "@type": "ListItem",
          position: idx + 1,
          url: `${SITE_URL}/protest/${p.id}`,
          name: p.title,
          description: p.description ? safeText(p.description, 160) : undefined,
        })),
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <PageHeader
        title="Local Assembly"
        subtitle="A neutral, community-submitted directory of public demonstrations and civic gatherings."
        imageUrl="/images/home-hero.jpg"
      />

      <main className="mx-auto max-w-[980px] px-4 py-6 md:px-6">
        <header>
          <h1 className="m-0 text-[26px] font-black md:text-[28px]">Find civic events near you</h1>
          <p className="mt-2 max-w-[760px] text-sm text-neutral-700 md:text-base">
            Search by event name, city, state, or organizer. This platform is neutral and does not
            endorse or oppose any listing.
          </p>
        </header>

        <div className="mt-4">
          <HeroSearch />
        </div>

        {error ? <p className="mt-4 text-sm text-red-700">Database error: {error.message}</p> : null}

        <div className="mt-4 text-sm text-neutral-600">
          {appliedFiltersLabel ? (
            <p className="m-0">
              Showing results ({protests.length}) • <span>{appliedFiltersLabel}</span>
            </p>
          ) : (
            <p className="m-0">Showing latest listings ({protests.length})</p>
          )}
        </div>

        <section className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          {protests.length === 0 ? (
            <p className="md:col-span-3">No listings found.</p>
          ) : (
            protests.map((p) => (
              <ProtestCard
                key={p.id}
                protest={{
                  id: p.id,
                  title: p.title,
                  description: p.description ?? "",
                  city: p.city,
                  state: p.state,
                  event_time: p.event_time,
                  image_path: p.image_path,
                }}
              />
            ))
          )}
        </section>

        <div className="mt-6 grid gap-3 justify-items-center">
          <Link
            href="/events"
            className="inline-block rounded-xl border border-black/20 bg-white px-5 py-3 font-extrabold text-black no-underline"
          >
            See All Events
          </Link>

          <a
            href="https://www.localassembly.org/email-your-congressperson"
            className="inline-block rounded-xl border border-black/20 bg-red-600 px-5 py-3 text-center font-black text-white no-underline"
            style={{ color: "white" }}
          >
            Email Your Congressperson
          </a>
        </div>

        <footer className="mt-8 text-xs text-neutral-600">
          Community note: Comments are public. The organizer moderates comments for each listing.
        </footer>
      </main>
    </>
  );
}
