import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import ProtestCard from "@/components/ProtestCard";
import { supabase } from "@/lib/supabase";
import { EVENT_TYPES, ACCESSIBILITY_FEATURES } from "@/lib/eventOptions";

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
  event_types: string[] | null;
  is_accessible: boolean | null;
  accessibility_features: string[] | null;
};

export const metadata: Metadata = {
  title: "Browse Civic Events — Local Assembly",
  description:
    "Browse community-submitted civic events across the United States including rallies, town halls, voter registration drives, trainings, and more.",
  alternates: { canonical: "https://localassembly.org/events" },
  robots: { index: true, follow: true },
};

function safeText(s: string, max = 160) {
  const t = (s || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
}

export default async function EventsIndexPage() {
  const { data, error } = await supabase
    .from("protests")
    .select(
      "id,title,description,city,state,event_time,created_at,organizer_username,image_path,status,event_types,is_accessible,accessibility_features"
    )
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(60);

  const protests = (data ?? []) as ProtestRow[];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Browse Civic Events",
    url: "https://localassembly.org/events",
    description:
      "Browse community-submitted civic events across the United States. Neutral platform; no endorsements.",
    mainEntity: {
      "@type": "ItemList",
      itemListOrder: "https://schema.org/ItemListOrderDescending",
      numberOfItems: protests.length,
      itemListElement: protests.slice(0, 25).map((p, idx) => ({
        "@type": "ListItem",
        position: idx + 1,
        url: `https://localassembly.org/protest/${p.id}`,
        name: p.title,
        description: p.description ? safeText(p.description) : undefined,
      })),
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <PageHeader
        title="Browse Civic Events"
        subtitle="Explore community-submitted civic gatherings across the U.S."
        imageUrl="/images/home-hero.jpg"
      />

      <main style={{ maxWidth: 980, margin: "0 auto", padding: 24 }}>
        <p style={{ marginTop: 0, color: "#444" }}>
          Use these pages to browse by event type or accessibility. (Filters can come later.)
        </p>

        <section style={{ marginTop: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 900, margin: 0 }}>Browse by event type</h2>
          <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
            {EVENT_TYPES.map((t) => (
              <Link
                key={t}
                href={`/events/types/${encodeURIComponent(t)}`}
                style={{
                  border: "1px solid #e5e5e5",
                  borderRadius: 999,
                  padding: "8px 12px",
                  background: "white",
                }}
              >
                {t}
              </Link>
            ))}
          </div>
        </section>

        <section style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 900, margin: 0 }}>Browse by accessibility</h2>
          <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
            <Link
              href="/events/accessibility"
              style={{
                border: "1px solid #111",
                borderRadius: 999,
                padding: "8px 12px",
                background: "#111",
                color: "white",
                fontWeight: 800,
              }}
            >
              Accessibility overview
            </Link>

            {ACCESSIBILITY_FEATURES.map((f) => (
              <Link
                key={f}
                href={`/events/accessibility/${encodeURIComponent(f)}`}
                style={{
                  border: "1px solid #e5e5e5",
                  borderRadius: 999,
                  padding: "8px 12px",
                  background: "white",
                }}
              >
                {f}
              </Link>
            ))}
          </div>
        </section>

        {error ? (
          <p style={{ marginTop: 16, color: "crimson" }}>Database error: {error.message}</p>
        ) : null}

        <section style={{ marginTop: 26 }}>
          <h2 style={{ fontSize: 18, fontWeight: 900, margin: 0 }}>Latest listings</h2>
          <div style={{ marginTop: 12, display: "grid", gap: 14 }}>
            {protests.length === 0 ? (
              <p>No listings yet.</p>
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
          </div>
        </section>

        <p style={{ marginTop: 28, color: "#666", fontSize: 13 }}>
          Neutrality note: Local Assembly does not endorse or oppose any listing.
        </p>
      </main>
    </>
  );
}
