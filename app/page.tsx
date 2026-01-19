import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import HeroSearch from "@/components/HeroSearch";
import ProtestCard from "@/components/ProtestCard";
import { supabase } from "@/lib/supabase";

export const revalidate = 0;

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

  // Filters / new fields
  event_types: string[] | null;
  is_accessible: boolean | null;
  accessibility_features: string[] | null;
};

type PageProps = {
  searchParams?: {
    q?: string;
    types?: string; // comma-separated
    accessible?: string; // "true" | "false"
    features?: string; // comma-separated
  };
};

// ✅ Homepage SEO (App Router)
export const metadata: Metadata = {
  title: "Local Assembly — Find Protests, Rallies, Town Halls & Civic Events Near You",
  description:
    "Local Assembly is a neutral, community-submitted directory of public demonstrations, rallies, town halls, voter registration drives, and civic gatherings across the United States.",
  alternates: { canonical: "https://localassembly.org/" },
  openGraph: {
    type: "website",
    url: "https://localassembly.org/",
    title: "Local Assembly — Civic Events Near You",
    description:
      "Browse and search community-submitted civic gatherings across the U.S. This platform is neutral and does not endorse listings.",
    siteName: "Local Assembly",
    images: [
      {
        url: "https://localassembly.org/images/home-hero.jpg",
        width: 1200,
        height: 630,
        alt: "Local Assembly civic gathering listings",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Local Assembly — Civic Events Near You",
    description:
      "Search and browse community-submitted civic events across the U.S. Neutral platform; no endorsements.",
    images: ["https://localassembly.org/images/home-hero.jpg"],
  },
  robots: { index: true, follow: true },
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
  // split by comma, trim, drop empties, dedupe
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

export default async function HomePage({ searchParams }: PageProps) {
  const q = (searchParams?.q ?? "").trim();
  const types = parseCsvParam(searchParams?.types);
  const features = parseCsvParam(searchParams?.features);
  const accessible = parseAccessibleParam(searchParams?.accessible);

  let query = supabase
    .from("protests")
    .select(
      "id,title,description,city,state,event_time,created_at,organizer_username,image_path,status,event_types,is_accessible,accessibility_features"
    )
    .eq("status", "active")
    .order("created_at", { ascending: false });

  // Keyword search (basic; filter module later)
  if (q) {
    const escaped = q.replaceAll(",", " "); // keep the `or()` string safe-ish
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

  // ✅ Event types filter (text[])
  if (types.length > 0) {
    // Postgres array overlap: event_types && ARRAY[...]
    query = query.overlaps("event_types", types);
  }

  // ✅ Accessible filter (boolean)
  if (accessible !== null) {
    query = query.eq("is_accessible", accessible);
  }

  // ✅ Accessibility features filter (text[])
  if (features.length > 0) {
    query = query.overlaps("accessibility_features", features);
  }

  const { data, error } = await query;
  const protests = (data ?? []) as ProtestRow[];

  // Label for results summary / JSON-LD ItemList
  const appliedFiltersLabel = [
    q ? `q="${q}"` : null,
    types.length ? `types=${types.join("|")}` : null,
    accessible !== null ? `accessible=${String(accessible)}` : null,
    features.length ? `features=${features.join("|")}` : null,
  ]
    .filter(Boolean)
    .join(" • ");

  // ✅ JSON-LD: WebSite + SearchAction + ItemList
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: "Local Assembly",
        url: "https://localassembly.org/",
        description:
          "A neutral, community-submitted directory of public demonstrations and civic gatherings.",
        potentialAction: {
          "@type": "SearchAction",
          target: "https://localassembly.org/?q={search_term_string}",
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": "ItemList",
        name: appliedFiltersLabel
          ? `Listings (${appliedFiltersLabel})`
          : "Latest civic event listings",
        itemListOrder: "https://schema.org/ItemListOrderDescending",
        numberOfItems: protests.length,
        itemListElement: protests.slice(0, 25).map((p, idx) => ({
          "@type": "ListItem",
          position: idx + 1,
          url: `https://localassembly.org/protest/${p.id}`,
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

      <main style={{ maxWidth: 980, margin: "0 auto", padding: 24 }}>
        <header style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0 }}>
              Find civic events near you
            </h1>
            <p style={{ marginTop: 8, color: "#444", maxWidth: 760 }}>
              Search by event name, city, state, or organizer. This platform is neutral and does not
              endorse or oppose any listing.
            </p>
          </div>

          <nav style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <Link href="/create">Create</Link>
            <Link href="/login">Login</Link>
          </nav>
        </header>

        {/* HERO SEARCH */}
        <div style={{ marginTop: 18 }}>
          <HeroSearch />
        </div>

        {error ? (
          <p style={{ marginTop: 16, color: "crimson" }}>Database error: {error.message}</p>
        ) : null}

        <div style={{ marginTop: 14, color: "#555" }}>
          {appliedFiltersLabel ? (
            <p style={{ margin: 0 }}>
              Showing results ({protests.length}) • <span>{appliedFiltersLabel}</span>
            </p>
          ) : (
            <p style={{ margin: 0 }}>Showing latest listings ({protests.length})</p>
          )}
        </div>

        <section style={{ marginTop: 16, display: "grid", gap: 14 }}>
          {protests.length === 0 ? (
            <p>No listings found.</p>
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

        <footer style={{ marginTop: 32, color: "#666", fontSize: 13 }}>
          Community note: Comments are public. The organizer moderates comments for each listing.
        </footer>
      </main>
    </>
  );
}
