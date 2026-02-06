import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import CreateProtestForm from "./CreateProtestForm";

export const revalidate = 0;

const SITE_NAME = "Local Assembly";
const SITE_URL = "https://www.localassembly.org";
const OG_IMAGE = `${SITE_URL}/images/home-hero.jpg`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Create a Listing | Local Assembly",
  description:
    "Create a new civic event listing on Local Assembly. Post a civic gathering so others can find it.",
  alternates: { canonical: "/create" },

  // You do not want this indexed (good choice), but allow crawlers to follow links.
  robots: { index: false, follow: true },

  openGraph: {
    type: "website",
    url: `${SITE_URL}/create`,
    title: "Create a Listing | Local Assembly",
    description:
      "Post a civic gathering so others can find it. Local Assembly is a neutral, community-submitted directory.",
    siteName: SITE_NAME,
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Create a listing on Local Assembly" }],
  },

  twitter: {
    card: "summary_large_image",
    title: "Create a Listing | Local Assembly",
    description:
      "Post a civic gathering so others can find it. Local Assembly is a neutral, community-submitted directory.",
    images: [OG_IMAGE],
  },
};

export default function CreatePage() {
  return (
    <>
      <PageHeader
        title="Create a listing"
        subtitle="Post a civic gathering so others can find it. This platform is neutral and does not endorse listings."
        imageUrl="/images/home-hero.jpg"
      />

      <main style={{ maxWidth: 980, margin: "0 auto", padding: 24 }}>
        <header style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 16 }}>
          <div style={{ minWidth: 260, flex: "1 1 320px" }}>
            <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0 }}>New listing</h1>
            <p style={{ marginTop: 8, color: "#444", maxWidth: 760 }}>
              Please keep it factual. Avoid threats, doxxing, or calls for violence.
            </p>
          </div>

          <nav style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <Link href="/">Home</Link>
          </nav>
        </header>

        <div style={{ marginTop: 18 }}>
          <CreateProtestForm />
        </div>
      </main>
    </>
  );
}
