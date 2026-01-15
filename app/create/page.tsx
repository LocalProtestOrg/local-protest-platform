"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";

export default function CreatePage() {
  const router = useRouter();
  const [imageFile, setImageFile] = useState<File | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState("");
  const [stateVal, setStateVal] = useState("");
  const [eventTime, setEventTime] = useState(""); // ISO-ish from input
  const [msg, setMsg] = useState("");

  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;

      if (!uid) {
        router.push("/login");
        return;
      }

      setUserId(uid);

      const { data: prof } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", uid)
        .single();

      setUsername((prof as any)?.username ?? null);
    })();
  }, [router]);

  async function createListing() {
  setMsg("");

  if (!title.trim() || !description.trim()) {
    setMsg("Title and description are required.");
    return;
  }

  if (!userId) {
    setMsg("You must be logged in.");
    return;
  }

  // Simple client-side image checks (recommended)
  if (imageFile) {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(imageFile.type)) {
      setMsg("Image must be a JPG, PNG, or WEBP file.");
      return;
    }
    const maxBytes = 5 * 1024 * 1024; // 5MB
    if (imageFile.size > maxBytes) {
      setMsg("Image is too large (max 5MB).");
      return;
    }
  }

  const event_time_value = eventTime ? new Date(eventTime).toISOString() : null;

  // 1) Create the protest row first
  const { data: created, error: createErr } = await supabase
    .from("protests")
    .insert({
      user_id: userId,
      organizer_username: username ?? "unknown",
      title: title.trim(),
      description: description.trim(),
      city: city.trim() || null,
      state: stateVal.trim() || null,
      event_time: event_time_value,
    })
    .select("id")
    .single();

  if (createErr) {
    setMsg(createErr.message);
    return;
  }

  const protestId = (created as any)?.id as string;

  // 2) Upload image (optional)
  if (imageFile) {
    const ext =
      imageFile.type === "image/png"
        ? "png"
        : imageFile.type === "image/webp"
        ? "webp"
        : "jpg";

    const filePath = `protests/${protestId}/cover.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("protest-images")
      .upload(filePath, imageFile, {
        upsert: true,
        cacheControl: "3600",
        contentType: imageFile.type,
      });

    if (uploadErr) {
      setMsg("Listing created, but image upload failed: " + uploadErr.message);
      router.push("/protest/" + protestId);
      return;
    }

    // 3) Save image path on the protest row
    const { error: updateErr } = await supabase
      .from("protests")
      .update({ image_path: filePath })
      .eq("id", protestId);

    if (updateErr) {
      setMsg("Listing created, but saving image path failed: " + updateErr.message);
      router.push("/protest/" + protestId);
      return;
    }
  }

  router.push("/protest/" + protestId);
}


  return (
    <>
      <PageHeader
        title="Create a Listing"
        subtitle="Post a public event for your local community. You are responsible for moderating comments on your listing."
        imageUrl="/images/home-hero.jpg"
      />

      <main style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
        <header style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
          <Link href="/">← Back</Link>
          <div style={{ display: "flex", gap: 12 }}>
            <Link href="/login">Login</Link>
          </div>
        </header>

        <h1 style={{ fontSize: 26, fontWeight: 900, marginTop: 16 }}>New Listing</h1>

        <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
          <input
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <textarea
            placeholder="Description (what, where to meet, what to bring, accessibility notes, etc.)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={6}
          />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 10 }}>
            <input
              placeholder="City"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
            <input
              placeholder="State"
              value={stateVal}
              onChange={(e) => setStateVal(e.target.value)}
              maxLength={2}
            />
          </div>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ color: "#444", fontSize: 13 }}>Event time (optional)</span>
            <input
              type="datetime-local"
              value={eventTime}
              onChange={(e) => setEventTime(e.target.value)}
            />
          </label>
<label style={{ display: "grid", gap: 6 }}>
  <span style={{ color: "#444", fontSize: 13 }}>Cover image (optional)</span>
  <input
    type="file"
    accept="image/png,image/jpeg,image/webp"
    onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
  />
</label>

          <button onClick={createListing} style={{ marginTop: 6 }}>
            Publish listing
          </button>

          {msg && <p style={{ color: "#b00020" }}>{msg}</p>}
        </div>

        <p style={{ marginTop: 18, color: "#666", fontSize: 13 }}>
          Tip: Use clear language and include safety/accessibility details when possible.
        </p>
      </main>
    </>
  );
}
