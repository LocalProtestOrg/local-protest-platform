import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";

export const revalidate = 0;

export const metadata: Metadata = {
  title: "Know Your Rights | Local Assembly",
  description:
    "Learn your basic rights when participating in public civic events, demonstrations, and gatherings in the United States.",
  alternates: { canonical: "https://localassembly.org/know-your-rights" },
  robots: { index: true, follow: true },
};

export default function KnowYourRightsPage() {
  return (
    <>
      <PageHeader
        title="Know Your Rights"
        subtitle="Clear, practical information for participating in civic life"
        imageUrl="/images/home-hero.jpg"
      />

      <main style={{ maxWidth: 820, margin: "0 auto", padding: 24 }}>
        <section style={{ display: "grid", gap: 18, lineHeight: 1.6 }}>
          <p>
            Local Assembly is a neutral platform. We do not endorse causes or events. This page exists
            to help the public understand their basic rights when participating in public civic
            activity in the United States.
          </p>

          <p>
            Laws can vary by state and city. This information is general guidance and not legal
            advice. For questions about local laws, consult a trusted legal resource or local
            authorities.
          </p>

          <h2>Your Right to Peaceful Assembly</h2>
          <p>
            The First Amendment protects the right of people to gather peacefully and express their
            views in public spaces.
          </p>
          <ul>
            <li>Gather peacefully in public places such as sidewalks, parks, and plazas</li>
            <li>Hold signs and express opinions</li>
            <li>Attend or observe public demonstrations</li>
            <li>Speak with others and share information</li>
          </ul>

          <h2>When Permits May Be Required</h2>
          <p>Some events may require permits, especially if they:</p>
          <ul>
            <li>Block traffic or sidewalks</li>
            <li>Use amplified sound</li>
            <li>Take place in certain parks or government-owned spaces</li>
            <li>Involve large crowds, stages, or structures</li>
          </ul>
          <p>
            Permit requirements typically apply to organizers, not individual attendees. A permit
            does not mean an event is unlawful.
          </p>

          <h2>Interacting With Law Enforcement</h2>
          <p>Law enforcement may be present to manage safety and traffic.</p>
          <ul>
            <li>You may attend and observe public events</li>
            <li>You may record police activity in public spaces if you do not interfere</li>
            <li>You are not required to answer questions about beliefs or affiliations</li>
          </ul>
          <p>
            If stopped, you may ask if you are free to leave. If detained, you have the right to
            remain silent and to request an attorney.
          </p>

          <h2>If You Are Asked to Disperse</h2>
          <p>
            Authorities may issue a lawful order to disperse if a gathering is deemed unsafe or
            unlawful.
          </p>
          <ul>
            <li>Listen carefully to instructions</li>
            <li>Leave calmly if ordered</li>
            <li>Avoid confrontation</li>
          </ul>

          <h2>Your Rights as an Observer</h2>
          <p>
            You do not need special credentials to observe or record public events.
          </p>
          <ul>
            <li>Photography and video recording are generally allowed in public spaces</li>
            <li>You may observe from a reasonable distance</li>
            <li>Restrictions may apply in secure or restricted areas</li>
          </ul>

          <h2>Accessibility Rights at Public Events</h2>
          <p>
            Public events should strive to be accessible. Accessibility considerations may include:
          </p>
          <ul>
            <li>Wheelchair-accessible routes</li>
            <li>Clear signage</li>
            <li>Seating or rest areas</li>
            <li>Accommodations for hearing or visual impairments</li>
          </ul>
          <p>
            When available, Local Assembly encourages organizers to include accessibility
            information in their listings.
          </p>

          <h2>If You Are Arrested or Detained</h2>
          <ul>
            <li>You have the right to remain silent</li>
            <li>You have the right to an attorney</li>
            <li>You should not consent to searches unless legally required</li>
          </ul>
          <p>
            Ask for legal representation and avoid discussing details without counsel.
          </p>

          <h2>Know Your Local Laws</h2>
          <p>
            Local laws may differ regarding curfews, noise limits, march routes, and other
            regulations. Reviewing local guidelines before attending or organizing events can be
            helpful.
          </p>

          <h2>Our Commitment</h2>
          <p>
            Local Assembly provides a platform for discovering civic events. We do not organize,
            endorse, or promote any specific cause.
          </p>
          <p>
            Our goal is to support informed participation, public safety, accessibility, and
            transparency.
          </p>
        </section>

        {/* CTA */}
        <div
          style={{
            marginTop: 40,
            display: "grid",
            justifyItems: "center",
          }}
        >
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