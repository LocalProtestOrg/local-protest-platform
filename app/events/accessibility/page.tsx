import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { ACCESSIBILITY_FEATURES } from "@/lib/eventOptions";

export const metadata: Metadata = {
  title: "ADA & Accessibility — Civic Events | Local Assembly",
  description:
    "Browse accessibility information for civic events. Find listings with features like ASL interpretation, ramps, accessible restrooms, and more.",
  alternates: { canonical: "https://localassembly.org/events/accessibility" },
  robots: { index: true, follow: true },
};

export default function AccessibilityIndexPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Accessibility & ADA for Civic Events",
    url: "https://localassembly.org/events/accessibility",
    description:
      "Browse accessibility features for civic events, including ramps, ASL, accessible restrooms, and other accommodations.",
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <PageHeader
        title="Accessibility & ADA"
        subtitle="Browse events by accessibility features (filters later)."
        imageUrl="/images/home-hero.jpg"
      />

      <main style={{ maxWidth: 980, margin: "0 auto", padding: 24 }}>
        <header style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
          <Link href="/events">← Back to Events</Link>
          <Link href="/create">Create</Link>
        </header>

        <p style={{ marginTop: 14, color: "#444" }}>
          Organizers can mark events as accessible and select specific accommodations. Use the pages below
          to browse.
        </p>

        <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 8 }}>
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
      </main>
    </>
  );
}
