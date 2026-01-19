import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
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
  title: "Local Assembly",
  description: "Find and share public assemblies and civic actions.",
};

function MainNav() {
  return (
    <header className="border-b border-neutral-200">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight text-neutral-900"
        >
          Local Assembly
        </Link>

        <nav aria-label="Main navigation">
          <ul className="flex items-center gap-4">
            <li>
              <Link
                href="/"
                className="text-sm text-neutral-700 hover:text-neutral-900"
              >
                Home
              </Link>
            </li>
            <li>
              <Link
                href="/email-your-congressperson"
                className="text-sm text-neutral-700 hover:text-neutral-900"
              >
                Email Your Congressperson
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <MainNav />
        {children}
      </body>
    </html>
  );
}
