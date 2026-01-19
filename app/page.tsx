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
  image_path: string | null;
  status: string | null;
};

const GLOBAL_ALT =
  "Peaceful protest gathering around the nation unite for a common cause.";

const FALLBACK_LOCAL = "/images/default-protest.jpeg"; // <-- matches what you committed

function resolveImageSrc(image_path: string | null) {
  if (!image_path) return FALLBACK_LOCAL;

  const p = image_path.trim();
  if (!p) return FALLBACK_LOCAL;

  // Full URL already
  if (p.startsWith("http://") || p.startsWith("https://")) return p;

  // Local public file (served from /public)
  if (p.startsWith("/")) return p;

  // Otherwise treat as Supabase Storage object path
  return supabase.storage.from("protest-images").getPublicUrl(p).data.publicUrl;
}

export default async function HomePage() {
  const { data, error } = await supabase
    .from("protests")
    .select(
      "id,title,description,city,state,event_time,created_at,organizer_username,image_path,status"
    )
    .eq("status", "active")
    .order("created_at", { ascending: false });

  const protests = (data ?? []) as ProtestRow[];

  return (
    <>
      <PageHeader
        title="Local Assembly"
        subtitle="A neutral, community-submitted directory of public demonstrations and civic gatherings."
        imageUrl="/images/home-hero.jpg"
      />

      <main style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>
              Browse listings
            </h1>
            <p style={{ marginTop: 8, color: "#444", maxWidth: 720 }}>
              Listings are created by organizers. This platform does not endorse
              or oppose any event.
            </p>
          </div>

          <nav style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <Link href="/create">Create</Link>
            <Link href="/login">Login</Link>
          </nav>
        </header>

        {error ? (
          <p style={{ marginTop: 16, color: "crimson" }}>
            Database error: {error.message}
          </p>
        ) : null}

        <div style={{ marginTop: 24, display: "grid", gap: 14 }}>
          {protests.length === 0 ? (
            <p>No listings yet.</p>
          ) : (
            protests.map((p) => {
              const href = "/protest/" + p.id;
              const when = p.event_time
                ? new Date(p.event_time).toLocaleString()
                : "";
              const location = (p.city ?? "—") + ", " + (p.state ?? "—");
              const thumbUrl = resolveImageSrc(p.image_path);

              return (
                <article
                  key={p.id}
                  style={{
                    border: "1px solid #e5e5e5",
                    borderRadius: 12,
                    overflow: "hidden",
                    background: "white",
                  }}
                >
                  <img
                    src={thumbUrl}
                    alt={GLOBAL_ALT}
                    style={{
                      width: "100%",
                      height: 220,
                      objectFit: "cover",
                      display: "block",
                      background: "#f3f3f3",
                    }}
                    loading="lazy"
                    onError={(e) => {
                      // If Storage URL 404s or is blocked, fall back to local image
                      const img = e.currentTarget;
                      if (img.src.endsWith(FALLBACK_LOCAL)) return;
                      img.src = FALLBACK_LOCAL;
                    }}
                  />

                  <div style={{ padding: 16 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
                      {p.title}
                    </h2>

                    {p.description ? (
                      <p style={{ marginTop: 8 }}>
                        {p.description.length > 160
                          ? p.description.slice(0, 160) + "…"
                          : p.description}
                      </p>
                    ) : null}

                    <p style={{ marginTop: 8, color: "#555" }}>
                      {location}
                      {when ? " • " + when : ""}
                    </p>

                    <p style={{ marginTop: 6, color: "#555" }}>
                      Organizer:{" "}
                      <strong>@{p.organizer_username ?? "unknown"}</strong>
                    </p>

                    <Link
                      href={href}
                      style={{ display: "inline-block", marginTop: 10 }}
                    >
                      View details →
                    </Link>
                  </div>
                </article>
              );
            })
          )}
        </div>

        <footer style={{ marginTop: 32, color: "#666", fontSize: 13 }}>
          Community note: Comments are public. The organizer moderates comments
          for each listing.
        </footer>
      </main>
    </>
  );
}
