"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useParams } from "next/navigation";
import PageHeader from "@/components/PageHeader";

type Protest = {
  id: string;
  user_id: string | null;
  organizer_username: string | null;
  title: string;
  description: string;
  city: string | null;
  state: string | null;
  event_time: string | null;
  created_at: string;
};

type CommentRow = {
  id: string;
  protest_id: string;
  author_name: string;
  body: string;
  status: "visible" | "hidden";
  created_at: string;
};

export default function ProtestDetailPage() {
  const params = useParams<{ id: string }>();
  const protestId = params.id;

  const [protest, setProtest] = useState<Protest | null>(null);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  const [isOrganizer, setIsOrganizer] = useState(false);

  const [authorName, setAuthorName] = useState("");
  const [body, setBody] = useState("");
  const [msg, setMsg] = useState("");

  const visibleComments = useMemo(
    () => comments.filter((c) => c.status === "visible"),
    [comments]
  );

  const hiddenComments = useMemo(
    () => comments.filter((c) => c.status === "hidden"),
    [comments]
  );

  useEffect(() => {
    (async () => {
      setLoading(true);

      const { data: authData } = await supabase.auth.getUser();
      const uid = authData.user?.id ?? null;
      setViewerUserId(uid);

      const { data: p, error: pErr } = await supabase
        .from("protests")
        .select("*")
        .eq("id", protestId)
        .single();

      if (pErr) {
        setMsg(pErr.message);
        setLoading(false);
        return;
      }

      const protestRow = p as Protest;
      setProtest(protestRow);
      setIsOrganizer(!!uid && protestRow.user_id === uid);

      const { data: c } = await supabase
        .from("comments")
        .select("*")
        .eq("protest_id", protestId)
        .order("created_at", { ascending: true });

      setComments((c as CommentRow[]) ?? []);
      setLoading(false);
    })();
  }, [protestId]);

  async function refreshComments() {
    const { data: c } = await supabase
      .from("comments")
      .select("*")
      .eq("protest_id", protestId)
      .order("created_at", { ascending: true });

    setComments((c as CommentRow[]) ?? []);
  }

  async function postComment() {
    setMsg("");
    if (!authorName.trim() || !body.trim()) {
      setMsg("Name and comment are required.");
      return;
    }

    const { error } = await supabase.from("comments").insert({
      protest_id: protestId,
      organizer_user_id: protest?.user_id ?? null,
      author_name: authorName.trim(),
      body: body.trim(),
      status: "visible",
    });

    if (error) return setMsg(error.message);

    setAuthorName("");
    setBody("");
    await refreshComments();
  }

  async function setCommentStatus(commentId: string, status: "visible" | "hidden") {
    setMsg("");
    const { error } = await supabase.from("comments").update({ status }).eq("id", commentId);
    if (error) return setMsg(error.message);
    await refreshComments();
  }

  async function deleteComment(commentId: string) {
    setMsg("");
    const { error } = await supabase.from("comments").delete().eq("id", commentId);
    if (error) return setMsg(error.message);
    await refreshComments();
  }

  if (loading) return <main style={{ padding: 24 }}>Loading…</main>;
  if (!protest) return <main style={{ padding: 24 }}>Not found. {msg}</main>;

  const locationLine =
    (protest.city && protest.state) ? `${protest.city}, ${protest.state}` :
    (protest.city ? protest.city : (protest.state ? protest.state : "Location not provided"));

  const timeLine = protest.event_time ? new Date(protest.event_time).toLocaleString() : null;

  return (
    <>
      <PageHeader
        title={protest.title}
        subtitle={timeLine ? `${locationLine} • ${timeLine}` : locationLine}
        imageUrl="/images/peaceful-protest.jpg"
      />

      <main style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
        <header style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
          <Link href="/">← Back</Link>
          <div style={{ display: "flex", gap: 12 }}>
            <Link href="/create">Create</Link>
            <Link href="/login">Login</Link>
          </div>
        </header>

        <p style={{ marginTop: 14, color: "#444" }}>{protest.description}</p>

        <p style={{ marginTop: 10, color: "#444" }}>
          Organizer: <strong>@{protest.organizer_username ?? "unknown"}</strong>
        </p>

        <hr style={{ margin: "24px 0" }} />

        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800 }}>Comments</h2>
          <p style={{ marginTop: 8, color: "#444" }}>
            Public comments are permitted. Organizers are responsible for moderating their post’s comments.
          </p>

          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            <input
              placeholder="Your name (public)"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
            />
            <textarea
              placeholder="Comment"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
            />
            <button onClick={postComment}>Post comment</button>
            {msg && <p style={{ color: "#b00020" }}>{msg}</p>}
          </div>

          <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
            {visibleComments.length === 0 ? (
              <p>No comments yet.</p>
            ) : (
              visibleComments.map((c) => (
                <article
                  key={c.id}
                  style={{
                    border: "1px solid #e5e5e5",
                    borderRadius: 12,
                    padding: 12,
                    background: "white",
                  }}
                >
                  <p style={{ fontWeight: 700, margin: 0 }}>{c.author_name}</p>
                  <p style={{ marginTop: 6 }}>{c.body}</p>

                  {isOrganizer && (
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <button onClick={() => setCommentStatus(c.id, "hidden")}>Hide</button>
                      <button onClick={() => deleteComment(c.id)}>Delete</button>
                    </div>
                  )}
                </article>
              ))
            )}
          </div>

          {isOrganizer && (
            <>
              <hr style={{ margin: "24px 0" }} />
              <h3 style={{ fontSize: 16, fontWeight: 800 }}>Hidden comments (Organizer view)</h3>

              <div style={{ marginTop: 10, display: "grid", gap: 12 }}>
                {hiddenComments.length === 0 ? (
                  <p>None.</p>
                ) : (
                  hiddenComments.map((c) => (
                    <article
                      key={c.id}
                      style={{
                        border: "1px solid #ddd",
                        borderRadius: 12,
                        padding: 12,
                        background: "white",
                      }}
                    >
                      <p style={{ fontWeight: 700, margin: 0 }}>{c.author_name} (hidden)</p>
                      <p style={{ marginTop: 6 }}>{c.body}</p>

                      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                        <button onClick={() => setCommentStatus(c.id, "visible")}>Unhide</button>
                        <button onClick={() => deleteComment(c.id)}>Delete</button>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}
