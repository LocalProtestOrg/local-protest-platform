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

  // new fields (safe even if not used yet)
  event_types: string[] | null;
  is_accessible: boolean | null;
  accessibility_features: string[] | null;
};

type PageProps = {
  searchParams?: { q?: string };
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
  robots: {
    index: true,
    follow: true,
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

export default async function HomePage({ searchParams }: PageProps) {
  const q = (searchParams?.q ?? "").trim();

  let query = supabase
    .from("protests")
    .select(
      "id,title,description,city,state,event_time,created_at,organizer_username,image_path,status,event_types,is_accessible,accessibility_features"
    )
    .eq("status", "active")
    .order("created_at", { ascending: false });

  // Simple server-side keyword search for now (filter module later)
  if (q) {
    const escaped = q.replaceAll(",", " "); // keep or() string safe
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

  const { data, error } = await query;
  const protests = (data ?? []) as ProtestRow[];

  // ✅ JSON-LD: WebSite + SearchAction + (optional) ItemList of latest results
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
        name: q ? `Search results for "${q}"` : "Latest civic event listings",
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
      {/* JSON-LD for SEO */}
      <script
        type="application/ld+json"
        // Next recommends dangerouslySetInnerHTML for JSON-LD
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
          {q ? (
            <p style={{ margin: 0 }}>
              Showing results for <strong>{q}</strong> ({protests.length})
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
