import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { supabase } from "@/lib/supabase";

export const revalidate = 0;

type ProtestRow = {
  id: string;
  title: string;
  description: string | null;
  city: string | null;
  state: string | null;
  event_time: string | null;
  created_at: string | null;
  organizer_username: string | null;
};

export default async function HomePage() {
  const { data, error } = await supabase
    .from("protests")
    .select("id,title,description,city,state,event_time,created_at,organizer_username")
    .order("created_at", { ascending: false });

  const protests = (data ?? []) as ProtestRow[];

  return (
    <>
      <PageHeader
  title="Local Assembly"
  subtitle="A neutral, community-submitted directory of public demonstrations and civic gatherings."
  imageUrl="/images/homepage-hero.jpg"
/>


      <main style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
        <header style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>Browse listings</h1>
            <p style={{ marginTop: 8, color: "#444", maxWidth: 720 }}>
              Listings are created by organizers. This platform does not endorse or oppose any event.
            </p>
          </div>

          <nav style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <Link href="/create">Create</Link>
            <Link href="/login">Login</Link>
          </nav>
        </header>

        {error ? (
          <p style={{ marginTop: 16, color: "crimson" }}>Database error: {error.message}</p>
        ) : null}

        <div style={{ marginTop: 24, display: "grid", gap: 14 }}>
          {protests.length === 0 ? (
            <p>No listings yet.</p>
          ) : (
            protests.map((p) => (
              <article
                key={p.id}
                style={{
                  border: "1px solid #e5e5e5",
                  borderRadius: 12,
                  padding: 16,
                  background: "white",
                }}
              >
                <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>{p.title}</h2>

                {p.description ? <p style={{ marginTop: 8 }}>{p.description}</p> : null}

                <p style={{ marginTop: 8, color: "#555" }}>
                  {(p.city ?? "—")}, {(p.state ?? "—")}
                  {p.event_time ? ` • ${new Date(p.event_time).toLocaleString()}` : ""}
                </p>

                <p style={{ marginTop: 6, color: "#555" }}>
                  Organizer: <strong>@{p.organizer_username ?? "unknown"}</strong>
                </p>

                <Link href={`/protest/${p.id}`} style={{ display: "inline-block", marginTop: 10 }}>
                  View details →
                </Link>
              </article>
            ))
          )}
        </div>

        <footer style={{ marginTop: 32, color: "#666", fontSize: 13 }}>
          Community note: Comments are public. The organizer moderates comments for each listing.
        </footer>
      </main>
    </>
  );
}
