import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import EmailYourCongresspersonClient from "./EmailYourCongresspersonClient";

const SITE_NAME = "Local Assembly";
const SITE_URL = "https://www.localassembly.org";
const OG_IMAGE = `${SITE_URL}/images/home-hero.jpg`;

export const revalidate = 0;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Email Your Congressperson | Find Your Rep and Send a Message",
  description:
    "Contact your U.S. Representative or Senators with a clear message. Use this page to find who represents you and create a message you can customize.",
  keywords: [
    "email your congressperson",
    "contact my representative",
    "contact my senator",
    "find my congressperson",
    "how to contact congress",
    "how can I get involved",
    "what can I do to help",
    "civic engagement",
    "Local Assembly",
  ],
  alternates: { canonical: "/email-your-congressperson" },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/email-your-congressperson`,
    title: "Email Your Congressperson | Local Assembly",
    description:
      "Find who represents you and create a message you can customize. Neutral tool for civic action.",
    siteName: SITE_NAME,
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Email your congressperson" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Email Your Congressperson | Local Assembly",
    description: "Find your Representative and Senators and create a message you can customize.",
    images: [OG_IMAGE],
  },
  robots: { index: true, follow: true },
};

export default function EmailYourCongresspersonPage() {
  return (
    <>
      <PageHeader
        title="Email Your Congressperson"
        subtitle="Send a message to your elected officials in minutes."
        imageUrl="/images/home-hero.jpg"
      />
      <EmailYourCongresspersonClient />
    </>
  );
}
