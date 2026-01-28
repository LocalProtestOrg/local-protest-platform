import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";

export const revalidate = 0;

export const metadata: Metadata = {
  title: "Know Your Rights | Local Assembly",
  description:
    "Know your rights when attending or organizing public civic events in the United States: peaceful assembly, permits, recording, police interactions, dispersal orders, and accessibility.",
  alternates: { canonical: "https://localassembly.org/know-your-rights" },
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

      <PageHeader
        title="Know Your Rights"
        subtitle="Clear, practical information for participating in civic life"
        imageUrl="/images/home-hero.jpg"
        showText={false}
      />

      <main style={{ maxWidth: 820, margin: "0 auto", padding: 24 }}>
        {/* On-page H1 for SEO + scanability */}
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
          {/* Quick Summary */}
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

          <div style={styles.card}>
            <h2 style={styles.h2}>Your Right to Peaceful Assembly</h2>
            <p style={styles.p}>
              The First Amendment protects the right of people to gather peacefully and express views
              in many public spaces, such as sidewalks, parks, and plazas.
            </p>
            <ul style={styles.ul}>
              <li style={styles.li}>Gather peacefully in public places</li>
              <li style={styles.li}>Hold signs and express opinions</li>
              <li style={styles.li}>Attend, observe, and document public demonstrations</li>
              <li style={styles.li}>Speak with others and share information</li>
            </ul>
          </div>

          <div style={styles.card}>
            <h2 style={styles.h2}>When Permits May Be Required</h2>
            <p style={styles.p}>Some events may require permits, especially if they:</p>
            <ul style={styles.ul}>
              <li style={styles.li}>Block traffic or sidewalks</li>
              <li style={styles.li}>Use amplified sound</li>
              <li style={styles.li}>Take place in certain parks or government-owned spaces</li>
              <li style={styles.li}>Include large crowds, stages, tents, or structures</li>
            </ul>
            <p style={{ ...styles.note, marginTop: 10 }}>
              Permit requirements typically apply to organizers, not individual attendees. A permit
              requirement does not automatically mean an event is unlawful.
            </p>
          </div>

          <div style={styles.card}>
            <h2 style={styles.h2}>Interacting With Law Enforcement</h2>
            <p style={styles.p}>Law enforcement may be present to manage safety and traffic.</p>

            <h3 style={styles.h3}>Common rights in public spaces</h3>
            <ul style={styles.ul}>
              <li style={styles.li}>You may attend and observe public events</li>
              <li style={styles.li}>You may record in public if you do not interfere</li>
              <li style={styles.li}>You are generally not required to discuss beliefs or affiliations</li>
            </ul>

            <h3 style={styles.h3}>If you are stopped or questioned</h3>
            <ul style={styles.ul}>
              <li style={styles.li}>
                Ask: <strong>&quot;Am I free to leave?&quot;</strong>
              </li>
              <li style={styles.li}>
                If detained, you can <strong>remain silent</strong> and request an attorney
              </li>
              <li style={styles.li}>Stay calm and avoid escalating the situation</li>
            </ul>
          </div>

          <div style={styles.card}>
            <h2 style={styles.h2}>If You Are Asked to Disperse</h2>
            <p style={styles.p}>
              Authorities may issue a lawful order to disperse if a gathering is deemed unsafe or
              unlawful.
            </p>
            <ul style={styles.ul}>
              <li style={styles.li}>Listen carefully to instructions</li>
              <li style={styles.li}>Leave calmly if ordered</li>
              <li style={styles.li}>Avoid confrontation</li>
            </ul>
          </div>

          <div style={styles.card}>
            <h2 style={styles.h2}>Your Rights as an Observer</h2>
            <p style={styles.p}>
              You do not need special credentials to observe or record public events. You can usually
              document what you see in public spaces, as long as you do not interfere.
            </p>
            <ul style={styles.ul}>
              <li style={styles.li}>Photography and video recording are generally allowed in public places</li>
              <li style={styles.li}>You may observe from a reasonable distance</li>
              <li style={styles.li}>Restrictions may apply in secure or restricted areas</li>
            </ul>
          </div>

          <div style={styles.card}>
            <h2 style={styles.h2}>Accessibility Rights at Public Events</h2>
            <p style={styles.p}>Public events should strive to be accessible when possible. Examples include:</p>
            <ul style={styles.ul}>
              <li style={styles.li}>Wheelchair-accessible routes</li>
              <li style={styles.li}>Clear signage</li>
              <li style={styles.li}>Seating or rest areas</li>
              <li style={styles.li}>Accommodations for hearing or visual impairments</li>
            </ul>
            <p style={{ ...styles.note, marginTop: 10 }}>
              When organizers include accessibility details, it helps attendees plan and participate.
            </p>
          </div>

          <div style={styles.card}>
            <h2 style={styles.h2}>If You Are Arrested or Detained</h2>
            <ul style={styles.ul}>
              <li style={styles.li}>You have the right to remain silent</li>
              <li style={styles.li}>You have the right to an attorney</li>
              <li style={styles.li}>You should not consent to searches unless legally required</li>
            </ul>
            <p style={{ ...styles.note, marginTop: 10 }}>
              Ask for legal representation and avoid discussing details without counsel.
            </p>
          </div>

          <div style={styles.card}>
            <h2 style={styles.h2}>Know Your Local Laws</h2>
            <p style={styles.p}>
              State and local rules can differ for curfews, noise limits, march routes, and public
              space regulations. Before attending or organizing an event, review local guidelines when
              possible.
            </p>
            <p style={{ ...styles.note, marginTop: 10 }}>
              If you want to contact your representatives, use{" "}
              <a
                href="https://www.localassembly.org/email-your-congressperson"
                style={styles.inlineLink}
              >
                Email Your Congressperson
              </a>
              .
            </p>
          </div>

          <div style={styles.card}>
            <h2 style={styles.h2}>Our Commitment</h2>
            <p style={styles.p}>
              Local Assembly provides a platform for discovering civic events. We do not organize,
              endorse, or promote any specific cause.
            </p>
            <p style={{ ...styles.p, marginTop: 10 }}>
              Our goal is to support informed participation, public safety, accessibility, and
              transparency.
            </p>
          </div>

          {/* FAQ */}
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
                <p style={styles.p}>{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <div style={{ marginTop: 40, display: "grid", justifyItems: "center" }}>
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