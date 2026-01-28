import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://localassembly.org"),
  title: {
    default: "Local Assembly",
    template: "%s — Local Assembly",
  },
  description: "A neutral, community-submitted directory of public assemblies and civic events.",
  alternates: {
    canonical: "/",
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
    url: "https://localassembly.org/",
    siteName: "Local Assembly",
    title: "Local Assembly",
    description:
      "A neutral, community-submitted directory of public demonstrations and civic gatherings.",
    images: [
      {
        url: "/images/home-hero.jpg",
        width: 1200,
        height: 630,
        alt: "Local Assembly — civic event listings",
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
    url: "https://localassembly.org/",
    description:
      "A neutral, community-submitted directory of public demonstrations and civic gatherings.",
    potentialAction: {
      "@type": "SearchAction",
      target: "https://localassembly.org/?q={search_term_string}",
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
      </body>
    </html>
  );
}