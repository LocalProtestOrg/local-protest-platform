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

  // Moderation fields
  status: string; // "active" | "under_review" | "hidden"
  report_count: number;
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

const COMMENT_COOLDOWN_SECONDS = 20;

// Local public fallbacks (confirmed working on your site)
const FALLBACK_LOCAL = "/images/fallback.jpg";
const DEFAULT_LOCAL = "/images/default-protest.jpeg";

/**
 * Resolve image_path into a real <img src>.
 * Supports:
 *  - Full URLs: https://...
 *  - Local public paths: /images/...
 *  - Relative local paths stored in DB: images/fallback.jpg -> /images/fallback.jpg
 *  - Legacy filenames stored in DB: fallback.jpg -> /images/fallback.jpg
 *  - Supabase Storage object paths: protests/<id>/cover.jpg -> getPublicUrl(...)
 */
function resolveImageSrc(image_path: string | null) {
  const p = (image_path ?? "").trim();
  if (!p) return DEFAULT_LOCAL;

  if (p.startsWith("http://") || p.startsWith("https://")) return p;
  if (p.startsWith("/")) return p;
  if (p.startsWith("images/")) return "/" + p;

  if (p === "fallback.jpg") return FALLBACK_LOCAL;
  if (p === "default-protest.jpeg") return DEFAULT_LOCAL;
  if (p === "default-protest.jpg") return "/images/default-protest.jpg";

  return supabase.storage.from("protest-images").getPublicUrl(p).data.publicUrl;
}

function commentCooldownKey(protestId: string) {
  return `la:last_comment_ts:${protestId}`;
}

function secondsRemaining(protestId: string) {
  const raw = localStorage.getItem(commentCooldownKey(protestId));
  const last = raw ? Number(raw) : 0;
  const now = Date.now();
  const diff = Math.floor((now - last) / 1000);
  return Math.max(0, COMMENT_COOLDOWN_SECONDS - diff);
}

function violatesStandards(text: string) {
  const t = (text || "").toLowerCase();
  const banned = ["kill yourself", "gas the", "lynch", "rape", "nazi", "kkk"];
  return banned.some((w) => t.includes(w));
}

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

  // Replace image (organizer-only)
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Comment cooldown
  const [cooldownLeft, setCooldownLeft] = useState(0);

  // Report listing
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [reportMsg, setReportMsg] = useState("");
  const [reporting, setReporting] = useState(false);

  const visibleComments = useMemo(
    () => comments.filter((c) => c.status === "visible"),
    [comments]
  );

  const hiddenComments = useMemo(
    () => comments.filter((c) => c.status === "hidden"),
    [comments]
  );

  useEffect(() => {
    if (!protestId) return;

    (async () => {
      setLoading(true);
      setMsg("");

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
        setProtest(null);
        setComments([]);
        setLoading(false);
        return;
      }

      const protestRow = p as Protest;
      setProtest(protestRow);

      const organizer = !!uid && protestRow.user_id === uid;
      setIsOrganizer(organizer);

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

      try {
        const remaining = secondsRemaining(protestId);
        setCooldownLeft(remaining);
      } catch {
        // ignore localStorage failures
      }

      setLoading(false);
    })();
  }, [protestId]);

  useEffect(() => {
    if (cooldownLeft <= 0) return;
    const t = setInterval(() => setCooldownLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldownLeft]);

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

      const { data: p, error: pErr } = await supabase
        .from("protests")
        .select("*")
        .eq("id", protestId)
        .single();

      if (pErr) {
        setMsg("Image updated, but refresh failed: " + pErr.message);
        return;
      }

      setProtest(p as Protest);
      setNewImageFile(null);
      setMsg("Cover image updated.");
    } finally {
      setUploadingImage(false);
    }
  }

  async function postComment() {
    setMsg("");

    try {
      const remaining = secondsRemaining(protestId);
      if (remaining > 0) {
        setCooldownLeft(remaining);
        setMsg(`Please wait ${remaining}s before posting another comment.`);
        return;
      }
    } catch {
      // ignore localStorage failure
    }

    if (!authorName.trim() || !body.trim()) {
      setMsg("Name and comment are required.");
      return;
    }

    if (violatesStandards(body) || violatesStandards(authorName)) {
      setMsg("This comment appears to violate community standards. Please revise.");
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

    try {
      localStorage.setItem(commentCooldownKey(protestId), String(Date.now()));
      setCooldownLeft(COMMENT_COOLDOWN_SECONDS);
    } catch {
      // ignore localStorage failure
    }

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

  async function submitReport() {
    setReportMsg("");
    setMsg("");

    if (!reportReason.trim()) {
      setReportMsg("Please select a reason.");
      return;
    }

    try {
      setReporting(true);

      const { error } = await supabase.from("reports").insert({
        protest_id: protestId,
        reason: reportReason.trim(),
        details: reportDetails.trim() || null,
      });

      if (error) {
        setReportMsg(error.message);
        return;
      }

      setReportMsg("Thank you. Your report has been submitted.");
      setReportReason("");
      setReportDetails("");
    } finally {
      setReporting(false);
    }
  }

  if (loading) return <main style={{ padding: 24 }}>Loading…</main>;
  if (!protest) return <main style={{ padding: 24 }}>Not found. {msg}</main>;

  // Public cannot view under_review/hidden listings
  if (protest.status !== "active" && !isOrganizer) {
    return (
      <main style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
        <Link href="/">← Back</Link>
        <h1 style={{ marginTop: 18, fontSize: 24, fontWeight: 800 }}>Listing unavailable</h1>
        <p style={{ marginTop: 10, color: "#444" }}>
          This listing is currently unavailable or under review.
        </p>
      </main>
    );
  }

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

  // ✅ Resolve to local/remote/storage URL
  const baseImageUrl = resolveImageSrc(protest.image_path);

  // Cache-bust so freshly uploaded covers show up
  const imageUrl = baseImageUrl
    ? `${baseImageUrl}${baseImageUrl.includes("?") ? "&" : "?"}v=${encodeURIComponent(
        protest.image_path || ""
      )}&t=${Date.now()}`
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

        {/* Organizer status banner */}
        {isOrganizer && protest.status !== "active" && (
          <div
            style={{
              marginTop: 14,
              padding: 12,
              borderRadius: 12,
              border: "1px solid #f0c36d",
              background: "#fff7e6",
              color: "#5a3b00",
            }}
          >
            <strong>Status:</strong> {protest.status.replace("_", " ")}
            {typeof protest.report_count === "number" ? ` • Reports: ${protest.report_count}` : null}
            <div style={{ marginTop: 6, fontSize: 13 }}>
              This listing is hidden from the public while it is under review.
            </div>
          </div>
        )}

        {imageUrl && (
          <img
            src={imageUrl}
            alt={GLOBAL_ALT}
            style={{
              width: "100%",
              borderRadius: 12,
              marginTop: 16,
              border: "1px solid #e5e5e5",
              background: "white",
              display: "block",
            }}
            onError={(e) => {
              const img = e.currentTarget;
              // Final safety: if anything fails, show local default
              if (img.src.endsWith(DEFAULT_LOCAL)) return;
              img.src = DEFAULT_LOCAL;
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

        {/* Report listing */}
        <section
          style={{
            marginTop: 16,
            padding: 14,
            border: "1px solid #e5e5e5",
            borderRadius: 12,
            background: "white",
          }}
        >
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Report this listing</h3>
          <p style={{ marginTop: 8, color: "#555", fontSize: 13 }}>
            Use this form to flag spam, unsafe content, or non-event posts. This platform is neutral and does not endorse listings.
          </p>

          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            <select value={reportReason} onChange={(e) => setReportReason(e.target.value)}>
              <option value="">Select a reason…</option>
              <option value="Spam / scam">Spam / scam</option>
              <option value="Harassment / hate">Harassment / hate</option>
              <option value="Violence / threats">Violence / threats</option>
              <option value="False / misleading event">False / misleading event</option>
              <option value="Other">Other</option>
            </select>

            <textarea
              placeholder="Optional details (what happened / what to review)"
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
              rows={3}
            />

            <button onClick={submitReport} disabled={reporting || !reportReason}>
              {reporting ? "Submitting..." : "Submit report"}
            </button>

            {reportMsg && (
              <p style={{ color: reportMsg.startsWith("Thank") ? "green" : "#b00020" }}>
                {reportMsg}
              </p>
            )}
          </div>
        </section>

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

            <button onClick={postComment} disabled={cooldownLeft > 0}>
              {cooldownLeft > 0 ? `Please wait (${cooldownLeft}s)` : "Post comment"}
            </button>

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
                      <p style={{ fontWeight: 700, margin: 0 }}>
                        {c.author_name} (hidden)
                      </p>
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
