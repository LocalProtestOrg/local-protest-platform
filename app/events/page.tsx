import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import ProtestCard from "@/components/ProtestCard";
import { supabase } from "@/lib/supabase";
import { unstable_noStore as noStore } from "next/cache";

export const revalidate = 0;
export const dynamic = "force-dynamic";

const PER_PAGE = 12;

type ProtestRow = {
  id: string;
  title: string;
  description: string | null;
  city: string | null;
  state: string | null;
  event_time: string | null;
  created_at: string | null;
  organizer_username: string | null;
  image_path: string | null;
  status: string | null;

  event_types: string[] | null;
  is_accessible: boolean | null;
  accessibility_features: string[] | null;
};

type PageProps = {
  searchParams?: Promise<{
    page?: string; // "1", "2", ...
  }>;
};

export const metadata: Metadata = {
  title: "Events | Local Assembly",
  description: "Browse more civic events across the United States.",
  alternates: { canonical: "https://localassembly.org/events" },
  robots: { index: true, follow: true },
};

function clampPage(n: number) {
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

export default async function EventsPage({ searchParams }: PageProps) {
  noStore();

  const sp = (await searchParams) ?? {};
  const page = clampPage(Number(sp.page ?? "1"));

  const from = (page - 1) * PER_PAGE;
  const to = from + PER_PAGE - 1;

  const { data, error, count } = await supabase
    .from("protests")
    .select(
      "id,title,description,city,state,event_time,created_at,organizer_username,image_path,status,event_types,is_accessible,accessibility_features",
      { count: "exact" }
    )
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .range(from, to);

  const protests = (data ?? []) as ProtestRow[];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const prevPage = page > 1 ? page - 1 : null;
  const nextPage = page < totalPages ? page + 1 : null;

  return (
    <>
      <PageHeader
        title="Browse Events"
        subtitle="More listings from across the U.S. This platform is neutral and does not endorse any listing."
        imageUrl="/images/home-hero.jpg"
      />

      <main style={{ maxWidth: 980, margin: "0 auto", padding: 24 }}>
        <header style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0 }}>All events</h1>
            <p style={{ marginTop: 8, color: "#444" }}>
              Page {page} of {totalPages}
            </p>
          </div>

          <nav style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <Link href="/">Home</Link>
            <Link href="/create">Create</Link>
          </nav>
        </header>

        {error ? (
          <p style={{ marginTop: 16, color: "crimson" }}>Database error: {error.message}</p>
        ) : null}

        <section
          style={{
            marginTop: 16,
            display: "grid",
            gap: 14,
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          }}
        >
          {protests.length === 0 ? (
            <p style={{ gridColumn: "1 / -1" }}>No listings found.</p>
          ) : (
            protests.map((p) => (
              <ProtestCard
                key={p.id}
                protest={{
                  id: p.id,
                  title: p.title,
                  description: p.description ?? "",
                  city: p.city,
                  state: p.state,
                  event_time: p.event_time,
                  image_path: p.image_path,
                }}
              />
            ))
          )}
        </section>

        <div
          style={{
            marginTop: 22,
            display: "flex",
            justifyContent: "center",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {prevPage ? (
            <Link
              href={`/events?page=${prevPage}`}
              style={{
                display: "inline-block",
                padding: "10px 14px",
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.18)",
                background: "white",
                color: "black",
                fontWeight: 800,
                textDecoration: "none",
              }}
            >
              Previous
            </Link>
          ) : null}

          {nextPage ? (
            <Link
              href={`/events?page=${nextPage}`}
              style={{
                display: "inline-block",
                padding: "10px 14px",
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.18)",
                background: "white",
                color: "black",
                fontWeight: 800,
                textDecoration: "none",
              }}
            >
              Next
            </Link>
          ) : null}
        </div>

        <div style={{ marginTop: 16, display: "grid", justifyItems: "center" }}>
          <a
            href="https://www.localassembly.org/email-your-congressperson"
            style={{
              display: "inline-block",
              padding: "12px 18px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.18)",
              background: "red",
              color: "white",
              fontWeight: 900,
              textDecoration: "none",
              textAlign: "center",
            }}
          >
            Email Your Congressperson
          </a>
        </div>
      </main>
    </>
  );
}