import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import ProtestCard from "@/components/ProtestCard";
import { supabase } from "@/lib/supabase";
import { ACCESSIBILITY_FEATURES } from "@/lib/eventOptions";

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
  is_accessible: boolean | null;
  accessibility_features: string[] | null;
};

function safeText(s: string, max = 160) {
  const t = (s || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ feature: string }>;
}): Promise<Metadata> {
  const { feature } = await params;
  const decoded = decodeURIComponent(feature);

  return {
    title: `${decoded} — Accessible Civic Events | Local Assembly`,
    description: `Browse civic events marked with accessibility feature: ${decoded}.`,
    alternates: {
      canonical: `https://localassembly.org/events/accessibility/${encodeURIComponent(decoded)}`,
    },
    robots: { index: true, follow: true },
  };
}

export default async function EventsByAccessibilityFeaturePage({
  params,
}: {
  params: Promise<{ feature: string }>;
}) {
  const { feature } = await params;
  const decoded = decodeURIComponent(feature);

  const isKnown = ACCESSIBILITY_FEATURES.includes(decoded as any);

  const { data, error } = await supabase
    .from("protests")
    .select(
      "id,title,description,city,state,event_time,created_at,organizer_username,image_path,status,is_accessible,accessibility_features"
    )
    .eq("status", "active")
    .eq("is_accessible", true)
    .contains("accessibility_features", [decoded])
    .order("created_at", { ascending: false })
    .limit(80);

  const protests = (data ?? []) as ProtestRow[];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `Accessible events — ${decoded}`,
    url: `https://localassembly.org/events/accessibility/${encodeURIComponent(decoded)}`,
    description: `Browse civic events marked with accessibility feature: ${decoded}.`,
    mainEntity: {
      "@type": "ItemList",
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <PageHeader
        title={decoded}
        subtitle="Browse events by accessibility feature."
        imageUrl="/images/home-hero.jpg"
      />

      <main style={{ maxWidth: 980, margin: "0 auto", padding: 24 }}>
        <header style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
          <Link href="/events/accessibility">← Back to Accessibility</Link>
          <Link href="/create">Create</Link>
        </header>

        {!isKnown ? (
          <p style={{ marginTop: 14, color: "#b00020" }}>
            Note: “{decoded}” is not in the official accessibility feature list, but we’ll still show any listings tagged with it.
          </p>
        ) : null}

        {error ? (
          <p style={{ marginTop: 16, color: "crimson" }}>Database error: {error.message}</p>
        ) : null}

        <section style={{ marginTop: 16, display: "grid", gap: 14 }}>
          {protests.length === 0 ? (
            <p>No accessible listings found for this feature yet.</p>
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
      </main>
    </>
  );
}
