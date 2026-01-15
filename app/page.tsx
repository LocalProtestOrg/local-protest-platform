import PageHeader from "@/components/PageHeader";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export const revalidate = 0;

export default async function HomePage() {
  const { data: protests } = await supabase
    .from("protests")
    .select("id,title,description,city,state,event_time,organizer_username")
    .order("created_at", { ascending: false });

  return (
    <>
      <PageHeader
  title="Local Assembly"
  subtitle="A neutral, community-submitted directory of public demonstrations and civic gatherings."
  imageUrl="https://images.unsplash.com/photo-1520975922284-8b456906c813?auto=format&fit=crop&w=2000&q=80"
/>


      <main style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
        <section style={{ marginBottom: 32 }}>
          <p style={{ fontSize: 18, color: "#444", maxWidth: 700 }}>
            Local Assembly provides a public listing of organized civic gatherings.
            Listings are created and moderated by organizers. This platform does not
            endorse or oppose any event.
          </p>

          <div style={{ marginTop: 20, display: "flex", gap: 12 }}>
            <Link href="/create">Create a Listing</Link>
            <Link href="/login">Organizer Login</Link>
          </div>
        </section>

        <section style={{ display: "grid", gap: 16 }}>
          {(protests ?? []).map((p) => (
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
              <p style={{ marginTop: 6 }}>{p.description}</p>

              <p style={{ marginTop: 8, color: "#555" }}>
                {p.city ?? "—"}, {p.state ?? "—"}
              </p>

              <p style={{ marginTop: 4, color: "#555" }}>
                Organizer: <strong>@{p.organizer_username ?? "unknown"}</strong>
              </p>

              <Link href={`/protest/${p.id}`} style={{ marginTop: 8, display: "inline-block" }}>
                View details →
              </Link>
            </article>
          ))}
        </section>
      </main>
    </>
  );
}

      </section>

      <footer style={{ marginTop: 32, color: "#666", fontSize: 13 }}>
        Community note: Comments are public. The organizer moderates comments for each listing.
      </footer>
    </main>
  );
}
