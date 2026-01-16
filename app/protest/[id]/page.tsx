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
  image_path: string | null;
};

type CommentRow = {
  id: string;
  protest_id: string;
  author_name: string;
  body: string;
  status: "visible" | "hidden";
  created_at: string;
};

const GLOBAL_ALT =
  "Peaceful protest gathering around the nation unite for a common cause.";

export default function ProtestDetailPage() {
  const params = useParams<{ id: string }>();
  const protestId = params.id;

  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

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
      setMsg("");

      // Who is viewing?
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData.user?.id ?? null;
      setViewerUserId(uid);

      // Load protest
      const { data: p, error: pErr } = await supabase
        .from("protests")
        .select("*")
        .eq("id", protestId)
        .single();

      if (pErr) {
        setMsg(pErr.message);
        setProtest(null);
        setLoading(false);
        return;
      }

      const protestRow = p as Protest;
      setProtest(protestRow);

      // Organizer check
      setIsOrganizer(!!uid && protestRow.user_id === uid);

      // Load comments
      const { data: c, error: cErr } = await supabase
        .from("comments")
        .select("*")
        .eq("protest_id", protestId)
        .order("created_at", { ascending: true });

      if (cErr) {
        setMsg(cErr.message);
        setComments([]);
      } else {
        setComments((c as CommentRow[]) ?? []);
      }

      setLoading(false);
    })();
  }, [protestId]);

  async function refreshComments() {
    const { data: c, error } = await supabase
      .from("comments")
      .select("*")
      .eq("protest_id", protestId)
      .order("created_at", { ascending: true });

    if (error) {
      setMsg(error.message);
      return;
    }

    setComments((c as CommentRow[]) ?? []);
  }

  async function replaceCoverImage() {
  setMsg("");

  if (!isOrganizer) {
    setMsg("Only the organizer can replace the image.");
    return;
  }

  if (!newImageFile) {
    setMsg("Please choose an image file first.");
    return;
  }

  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(newImageFile.type)) {
    setMsg("Image must be a JPG, PNG, or WEBP file.");
    return;
  }

  const maxBytes = 5 * 1024 * 1024; // 5MB
  if (newImageFile.size > maxBytes) {
    setMsg("Image is too large (max 5MB).");
    return;
  }

  try {
    setUploadingImage(true);

    // Always use one consistent path so it truly replaces (no duplicates / fewer cache issues)
const filePath = `protests/${protestId}/cover.jpg`;


    const { error: uploadErr } = await supabase.storage
      .from("protest-images")
      .upload(filePath, newImageFile, {
        upsert: true,
        cacheControl: "3600",
        contentType: newImageFile.type,
      });

    if (uploadErr) {
      setMsg(uploadErr.message);
      return;
    }

    const { error: updateErr } = await supabase
      .from("protests")
      .update({ image_path: filePath })
      .eq("id", protestId);

    if (updateErr) {
      setMsg(updateErr.message);
      return;
    }

    // Refresh the protest row so the UI updates right away
    const { data: p, error: pErr } = await supabase
      .from("protests")
      .select("*")
      .eq("id", protestId)
      .single();

    if (pErr) {
      setMsg("Image updated, but refresh failed: " + pErr.message);
      return;
    }

    setProtest(p as any);
    setNewImageFile(null);
    setMsg("Cover image updated.");
  } finally {
    setUploadingImage(false);
  }
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

    const { error } = await supabase
      .from("comments")
      .update({ status })
      .eq("id", commentId);

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
    protest.city && protest.state
      ? `${protest.city}, ${protest.state}`
      : protest.city
      ? protest.city
      : protest.state
      ? protest.state
      : "Location not provided";

  const timeLine = protest.event_time ? new Date(protest.event_time).toLocaleString() : null;

  const headerSubtitle = timeLine ? `${locationLine} • ${timeLine}` : locationLine;

  const uploadedImageUrl = protest.image_path
  ? supabase.storage.from("protest-images").getPublicUrl(protest.image_path).data.publicUrl +
    `?v=${encodeURIComponent(protest.created_at ?? Date.now().toString())}`
  : null;

  return (
    <>
      <PageHeader title={protest.title} subtitle={headerSubtitle} imageUrl="/images/protest-hero.jpg" />

      <main style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
        <header style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
          <Link href="/">← Back</Link>
          <div style={{ display: "flex", gap: 12 }}>
            <Link href="/create">Create</Link>
            <Link href="/login">Login</Link>
          </div>
        </header>

        {/* Organizer-uploaded cover image (optional) */}
        {uploadedImageUrl && (
          <img
            src={uploadedImageUrl}
            alt={GLOBAL_ALT}
            style={{
              width: "100%",
              borderRadius: 12,
              marginTop: 16,
              border: "1px solid #e5e5e5",
              background: "white",
            }}
          />
        )}
{isOrganizer && (
  <section
    style={{
      marginTop: 18,
      padding: 14,
      border: "1px solid #e5e5e5",
      borderRadius: 12,
      background: "white",
    }}
  >
    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Replace cover image</h3>
    <p style={{ marginTop: 8, color: "#555", fontSize: 13 }}>
      Choose a new image to replace the current cover image for this listing.
    </p>

    <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(e) => setNewImageFile(e.target.files?.[0] ?? null)}
      />

      <button onClick={replaceCoverImage} disabled={uploadingImage || !newImageFile}>
        {uploadingImage ? "Uploading..." : "Replace image"}
      </button>
    </div>
  </section>
)}

        <p style={{ marginTop: 14 }}>{protest.description}</p>

        <p style={{ marginTop: 10, color: "#444" }}>
          Organizer: <strong>@{protest.organizer_username ?? "unknown"}</strong>
        </p>

        <hr style={{ margin: "24px 0" }} />

        <section>
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
        </section>
      </main>
    </>
  );
}
