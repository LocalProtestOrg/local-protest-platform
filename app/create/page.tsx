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

      <main className="mx-auto max-w-[980px] px-4 py-6 md:px-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-[260px]">
            <h1 className="m-0 text-[26px] font-black md:text-[28px]">New listing</h1>
            <p className="mt-2 max-w-[760px] text-sm text-neutral-700 md:text-base">
              Please keep it factual. Avoid threats, doxxing, or calls for violence.
            </p>
          </div>

          <nav className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-block rounded-xl border border-black/20 bg-white px-4 py-2 font-extrabold text-black no-underline"
            >
              Home
            </Link>

            <Link
              href="/events"
              className="inline-block rounded-xl border border-black/20 bg-white px-4 py-2 font-extrabold text-black no-underline"
            >
              Events
            </Link>
          </nav>
        </header>

        <section className="mt-5 rounded
