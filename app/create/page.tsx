"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { EVENT_TYPES, ACCESSIBILITY_FEATURES } from "@/lib/eventOptions";

export default function CreatePage() {
  const router = useRouter();
  const [imageFile, setImageFile] = useState<File | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState("");
  const [stateVal, setStateVal] = useState("");
  const [eventTime, setEventTime] = useState(""); // ISO-ish from input
  const [msg, setMsg] = useState("");

  // ✅ NEW: event type + accessibility
  const [eventType, setEventType] = useState<string>(""); // single selection, stored as [eventType]
  const [isAccessible, setIsAccessible] = useState(false);
  const [accessFeatures, setAccessFeatures] = useState<string[]>([]);

  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);

  // If any accessibility feature is selected, force isAccessible true
  useEffect(() => {
    if (accessFeatures.length > 0) setIsAccessible(true);
  }, [accessFeatures]);

  const accessibilityHint = useMemo(() => {
    if (!isAccessible) return "Mark this event accessible if accommodations are available.";
    if (accessFeatures.length === 0) return "Select accessibility features below (recommended).";
    return `${accessFeatures.length} accessibility feature(s) selected.`;
  }, [isAccessible, accessFeatures.length]);

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

  function toggleAccessFeature(feature: string) {
    setAccessFeatures((prev) => {
      if (prev.includes(feature)) return prev.filter((f) => f !== feature);
      return [...prev, feature].sort((a, b) => a.localeCompare(b));
    });
  }

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

    // Optional: require event type (recommended for future filters)
    if (!eventType) {
      setMsg("Please choose a type of event.");
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

    // ✅ Store event_types as text[]; for now one selection -> [eventType]
    const event_types_value = eventType ? [eventType] : [];

    // ✅ accessibility_features should be an array (text[] or jsonb)
    const accessibility_features_value = isAccessible ? accessFeatures : [];

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

        // ✅ NEW FIELDS
        event_types: event_types_value,
        is_accessible: isAccessible,
        accessibility_features: accessibility_features_value,
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
          <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />

          <textarea
            placeholder="Description (what, where to meet, what to bring, accessibility notes, etc.)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={6}
          />

          {/* ✅ NEW: Event Type */}
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ color: "#444", fontSize: 13 }}>Type of event</span>
            <select value={eventType} onChange={(e) => setEventType(e.target.value)}>
              <option value="">Select a type…</option>
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 10 }}>
            <input placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
            <input
              placeholder="State"
              value={stateVal}
              onChange={(e) => setStateVal(e.target.value)}
              maxLength={2}
            />
          </div>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ color: "#444", fontSize: 13 }}>Event time (optional)</span>
            <input type="datetime-local" value={eventTime} onChange={(e) => setEventTime(e.target.value)} />
          </label>

          {/* ✅ NEW: Accessibility */}
          <section
            style={{
              marginTop: 4,
              padding: 12,
              border: "1px solid #e5e5e5",
              borderRadius: 12,
              background: "white",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 800 }}>Accessibility</div>
                <div style={{ marginTop: 4, color: "#555", fontSize: 13 }}>{accessibilityHint}</div>
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={isAccessible}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIsAccessible(checked);
                    if (!checked) setAccessFeatures([]);
                  }}
                />
                <span style={{ fontSize: 13, color: "#333" }}>Accessible</span>
              </label>
            </div>

            {isAccessible && (
              <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                <div style={{ fontSize: 13, color: "#444", fontWeight: 700 }}>
                  Accessibility features (select all that apply)
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {ACCESSIBILITY_FEATURES.map((f) => {
                    const checked = accessFeatures.includes(f);
                    return (
                      <label
                        key={f}
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                          padding: 8,
                          borderRadius: 10,
                          border: "1px solid #eee",
                          background: checked ? "#f7f7ff" : "white",
                          cursor: "pointer",
                        }}
                      >
                        <input type="checkbox" checked={checked} onChange={() => toggleAccessFeature(f)} />
                        <span style={{ fontSize: 13, color: "#333" }}>{f}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

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
