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
    page?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Events | Local Assembly",
  description: "Browse more civic events across the United States.",
  alternates: { canonical: "https://www.localassembly.org/events" },
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

      <main className="mx-auto max-w-[980px] px-4 py-6 md:px-6">
        <header>
          <h1 className="m-0 text-[26px] font-black md:text-[28px]">All events</h1>
          <p className="mt-2 text-sm text-neutral-700 md:text-base">
            Page {page} of {totalPages}
          </p>
        </header>

        {error ? (
          <p className="mt-4 text-sm text-red-700">Database error: {error.message}</p>
        ) : null}

        {/* Mobile: 1 column (stacked). Desktop: 3 columns. */}
        <section className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          {protests.length === 0 ? (
            <p className="md:col-span-3">No listings found.</p>
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

        {/* Pagination (same behavior as before) */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {prevPage ? (
            <Link
              href={`/events?page=${prevPage}`}
              className="inline-block rounded-xl border border-black/20 bg-white px-4 py-2 font-extrabold text-black no-underline"
            >
              Previous
            </Link>
          ) : null}

          {nextPage ? (
            <Link
              href={`/events?page=${nextPage}`}
              className="inline-block rounded-xl border border-black/20 bg-white px-4 py-2 font-extrabold text-black no-underline"
            >
              Next
            </Link>
          ) : null}
        </div>

        <div className="mt-6 grid justify-items-center">
          <a
            href="https://www.localassembly.org/email-your-congressperson"
            className="inline-block rounded-xl border border-black/20 bg-red-600 px-5 py-3 text-center font-black text-white no-underline"
            style={{ color: "white" }}
          >
            Email Your Congressperson
          </a>
        </div>
      </main>
    </>
  );
}