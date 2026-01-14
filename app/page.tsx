import Link from "next/link";
import { supabase } from "@/lib/supabase";

export const revalidate = 0;

export default async function HomePage() {
  const { data: protests, error } = await supabase
    .from("protests")
    .select("id,title,description,city,state,event_time,created_at,organizer_username")
    .order("event_time", { ascending: true, nullsLast: true })
    .order("created_at", { ascending: false });

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>Local Protest Listings</h1>
        <nav style={{ display: "flex", gap: 12 }}>
          <Link href="/create">Create</Link>
          <Link href="/login">Login</Link>
        </nav>
      </header>

      <p style={{ marginTop: 12, color: "#444" }}>
        A neutral directory of organized public demonstrations. The platform does not endorse listings.
      </p>

      {error && (
        <p style={{ marginTop: 16, color: "crimson" }}>
          Database error: {error.message}
        </p>
      )}

      <section style={{ marginTop: 24, display: "grid", gap: 14 }}>
        {(protests ?? []).length === 0 ? (
          <p>No listings yet.</p>
        ) : (
          protests?.map((p) => (
            <article
              key={p.id}
              style={{
                border: "1px solid #e5e5e5",
                borderRadius: 12,
                padding: 16,
                background: "white",
              }}
            >
              <h2 style={{ fontSize: 18, fontWeight: 800 }}>{p.title}</h2>
              <p style={{ marginTop: 8 }}>{p.description}</p>

              <p style={{ marginTop: 8, color: "#555" }}>
                {p.city ?? "—"}, {p.state ?? "—"}
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
      </section>

      <footer style={{ marginTop: 32, color: "#666", fontSize: 13 }}>
        Community note: Comments are public. The organizer moderates comments for each listing.
      </footer>
    </main>
  );
}
