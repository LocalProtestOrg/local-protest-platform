import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";

export const revalidate = 0;

const SITE_NAME = "Local Assembly";
const SITE_URL = "https://www.localassembly.org";
const OG_IMAGE = `${SITE_URL}/images/home-hero.jpg`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Know Your Rights | Local Assembly",
  description:
    "Know your rights when attending or organizing public civic events in the United States, including peaceful assembly, permits, recording, police interactions, dispersal orders, and accessibility.",
  keywords: [
    "know your rights protest",
    "protest rights",
    "peaceful assembly rights",
    "can I record police",
    "dispersal order",
    "permit requirements protest",
    "first amendment",
    "what to do if stopped by police",
    "how to stay safe at a protest",
    "civic engagement",
    "Local Assembly",
  ],
  alternates: { canonical: "/know-your-rights" },
  openGraph: {
    type: "article",
    url: `${SITE_URL}/know-your-rights`,
    title: "Know Your Rights | Local Assembly",
    description:
      "Practical overview of common rights and responsibilities when attending or organizing public civic events in the United States.",
    siteName: SITE_NAME,
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Know Your Rights" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Know Your Rights | Local Assembly",
    description:
      "Practical overview of common rights and responsibilities when attending or organizing public civic events in the United States.",
    images: [OG_IMAGE],
  },
  robots: { index: true, follow: true },
};

const styles = {
  h1: { fontSize: 34, fontWeight: 900, margin: "0 0 8px" },
  lead: { margin: 0, color: "#333", maxWidth: 780, fontSize: 16, lineHeight: 1.7 },
  section: { display: "grid", gap: 18, lineHeight: 1.75 },
  card: {
    border: "1px solid rgba(0,0,0,0.12)",
    borderRadius: 14,
    padding: 16,
    background: "white",
  } as const,
  h2: { fontSize: 22, fontWeight: 900, margin: "6px 0 6px" },
  h3: { fontSize: 17, fontWeight: 900, margin: "10px 0 6px" },
  p: { margin: 0, color: "#222" },
  ul: { margin: "8px 0 0 20px", padding: 0, color: "#222" },
  li: { marginBottom: 8 },
  note: { margin: 0, color: "#444", fontSize: 14, lineHeight: 1.6 },
  divider: { height: 1, background: "rgba(0,0,0,0.10)", margin: "8px 0" },
  inlineLink: { color: "inherit", fontWeight: 800, textDecoration: "underline" } as const,
  callout: {
    border: "1px solid rgba(0,0,0,0.10)",
    borderRadius: 12,
    padding: 12,
    background: "rgba(0,0,0,0.03)",
  } as const,
  quote: {
    margin: "8px 0 0",
    padding: "10px 12px",
    borderLeft: "4px solid rgba(0,0,0,0.25)",
    background: "rgba(0,0,0,0.03)",
    borderRadius: 10,
    color: "#222",
  } as const,
  printCard: {
    marginTop: 10,
    padding: 14,
    borderRadius: 14,
    border: "2px dashed rgba(0,0,0,0.35)",
    background: "white",
  } as const,
  printHeaderRow: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  } as const,
  tag: {
    display: "inline-block",
    fontSize: 12,
    fontWeight: 900,
    padding: "4px 8px",
    borderRadius: 999,
    border: "1px solid rgba(0,0,0,0.15)",
    background: "rgba(0,0,0,0.03)",
    color: "#222",
  } as const,
  cardText: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 1.6,
    color: "#111",
  } as const,
  cardList: {
    margin: "8px 0 0 18px",
    padding: 0,
    color: "#111",
  } as const,
};

export default function KnowYourRightsPage() {
  const faq = [
    {
      q: "Do I have the right to peacefully assemble in public?",
      a: "In general, the First Amendment protects peaceful assembly and expression in many public spaces. Rules can vary by location, and gatherings must remain peaceful and follow lawful instructions.",
    },
    {
      q: "When is a permit required for a public event?",
      a: "Permits may be required for things like street closures, amplified sound, large structures, or certain parks and public venues. Permit rules vary by city and state and are usually handled by organizers.",
    },
    {
      q: "Can I record what happens at a public event?",
      a: "In many situations, people can record in public spaces as long as they do not interfere with officials or block operations. Restrictions can apply in secure or restricted areas.",
    },
    {
      q: "What should I do if I am stopped by law enforcement?",
      a: "Stay calm. You can ask if you are free to leave. If you are detained, you can remain silent and request an attorney. Local laws and circumstances may affect what happens next.",
    },
    {
      q: "What does it mean if authorities issue an order to disperse?",
      a: "Authorities may issue a lawful dispersal order if they believe a gathering is unsafe or unlawful. If ordered, leave calmly and follow instructions to reduce risk of detention.",
    },
    {
      q: "How does accessibility apply to civic events?",
      a: "Accessibility can include routes, seating, signage, and accommodations for hearing or visual needs. When organizers include accessibility details, it helps attendees plan and participate.",
    },
    {
      q: "What can I say if I do not want to answer questions? / ¿Qué puedo decir si no quiero contestar preguntas?",
      a:
        "English: You can say, \"I am exercising my right to remain silent. Am I free to leave?\" If you are detained, you can request an attorney.\n\n" +
        "Español: Usted puede decir, \"Estoy ejerciendo mi derecho de permanecer callado. ¿Soy libre de irme?\" Si está detenido, puede pedir un abogado.",
    },
  ];

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              header, nav { display: none !important; }
              a { color: #000 !important; text-decoration: none !important; }
              main { padding: 0 !important; }
              .no-print { display: none !important; }
              .print-focus { break-inside: avoid; page-break-inside: avoid; }
            }
          `,
        }}
      />

      <PageHeader
        title="Know Your Rights"
        subtitle="Clear, practical information for participating in civic life"
        imageUrl="/images/home-hero.jpg"
        showText={false}
      />

      <main style={{ maxWidth: 820, margin: "0 auto", padding: 24 }}>
        <header style={{ marginBottom: 18 }}>
          <h1 style={styles.h1}>Know Your Rights</h1>
          <p style={styles.lead}>
            Local Assembly is a neutral platform. We do not endorse causes or events. This page is a
            practical overview of common rights and responsibilities when attending or organizing
            public civic events in the United States. For upcoming listings, visit{" "}
            <Link href="/events" style={styles.inlineLink}>
              Browse Upcoming Civic Events
            </Link>
            .
          </p>
        </header>

        <section style={styles.section}>
          <div style={styles.card}>
            <h2 style={styles.h2}>Quick Summary</h2>
            <p style={styles.p}>
              Laws vary by state and city. This is general guidance, not legal advice. If you are
              organizing an event, start with{" "}
              <Link href="/create" style={styles.inlineLink}>
                Create Event
              </Link>{" "}
              and keep listings factual and safety-focused.
            </p>
            <ul style={styles.ul}>
              <li style={styles.li}>
                You generally have the right to <strong>peacefully assemble</strong> in public spaces.
              </li>
              <li style={styles.li}>
                Permits may be required for{" "}
                <strong>street closures, amplified sound, large structures</strong>, or certain public
                venues.
              </li>
              <li style={styles.li}>
                You can often <strong>record in public</strong> if you do not interfere with officials.
              </li>
              <li style={styles.li}>
                If questioned, you can ask: <strong>&quot;Am I free to leave?&quot;</strong> If
                detained, you can remain silent and request an attorney.
              </li>
              <li style={styles.li}>
                Accessibility information helps more people participate. If you know it, include it
                in the listing.
              </li>
            </ul>
          </div>

          {/* ... keep the rest of your sections exactly as you have them ... */}

          <div style={styles.card}>
            <h2 style={styles.h2}>FAQ</h2>
            <p style={styles.note}>
              These answers are general. Local rules vary. If you need legal advice, consult a
              qualified professional.
            </p>

            <div style={styles.divider} />

            {faq.map((item) => (
              <div key={item.q} style={{ display: "grid", gap: 6, marginTop: 12 }}>
                <h3 style={styles.h3}>{item.q}</h3>
                <p style={{ ...styles.p, whiteSpace: "pre-line" }}>{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="no-print" style={{ marginTop: 40, display: "grid", justifyItems: "center" }}>
          <Link
            href="/events"
            style={{
              display: "inline-block",
              padding: "14px 22px",
              borderRadius: 14,
              background: "black",
              color: "white",
              fontWeight: 900,
              textDecoration: "none",
              textAlign: "center",
            }}
          >
            Browse Upcoming Civic Events
          </Link>
        </div>
      </main>
    </>
  );
}
