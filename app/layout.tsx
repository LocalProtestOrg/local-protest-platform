import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/*
  IMPORTANT
  Your server resolves to:
  https://www.localassembly.org

  So EVERYTHING below uses www:
  - metadataBase
  - canonical
  - openGraph url
  - JSON-LD
  - SearchAction target

  All must match exactly or Google flags redirects/duplicates.
*/

export const metadata: Metadata = {
  metadataBase: new URL("https://www.localassembly.org"),

  title: {
    default: "Local Assembly",
    template: "%s | Local Assembly",
  },

  description:
    "A neutral, community-submitted directory of public assemblies and civic events.",

  alternates: {
    canonical: "/", // resolves to https://www.localassembly.org/
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },

  openGraph: {
    type: "website",
    url: "https://www.localassembly.org/",
    siteName: "Local Assembly",
    title: "Local Assembly",
    description:
      "A neutral, community-submitted directory of public demonstrations and civic gatherings.",
    images: [
      {
        url: "/images/home-hero.jpg",
        width: 1200,
        height: 630,
        alt: "Local Assembly civic event listings",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "Local Assembly",
    description:
      "A neutral, community-submitted directory of public demonstrations and civic gatherings.",
    images: ["/images/home-hero.jpg"],
  },

  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const siteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Local Assembly",
    url: "https://www.localassembly.org/",
    description:
      "A neutral, community-submitted directory of public demonstrations and civic gatherings.",
    potentialAction: {
      "@type": "SearchAction",
      target: "https://www.localassembly.org/?q={search_term_string}",
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }}
        />

        {children}

        {/* Vercel Analytics */}
        <Analytics />
      </body>
    </html>
  );
}
