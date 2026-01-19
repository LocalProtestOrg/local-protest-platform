"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { EVENT_TYPES, ACCESSIBILITY_FEATURES } from "@/lib/eventOptions";

function toggleInList(list: string[], value: string) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export default function CreatePage() {
  const router = useRouter();
  const [imageFile, setImageFile] = useState<File | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState("");
  const [stateVal, setStateVal] = useState("");
  const [eventTime, setEventTime] = useState(""); // ISO-ish from input
  const [msg, setMsg] = useState("");

  // NEW: event types + accessibility
  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [isAccessible, setIsAccessible] = useState(false);
  const [accessibilityFeatures, setAccessibilityFeatures] = useState<string[]>([]);

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

    // Optional: require at least one event type
    if (eventTypes.length === 0) {
      setMsg("Please select at least one event type.");
      return;
    }

    // If user says accessible, require at least one feature (optional rule)
    if (isAccessible && accessibilityFeatures.length === 0) {
      setMsg("If the event is accessible, please select at least one accessibility feature.");
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

        // NEW FIELDS
        event_types: eventTypes,
        is_accessible: isAccessible,
        accessibility_features: isAccessible ? accessibilityFeatures : [],
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

          {/* EVENT TYPES */}
          <section
            style={{
              marginTop: 8,
              padding: 14,
              border: "1px solid #e5e5e5",
              borderRadius: 12,
              background: "white",
            }}
          >
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>Event types</h3>
            <p style={{ marginTop: 8, color: "#555", fontSize: 13 }}>
              Select all that apply.
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 10,
                marginTop: 10,
              }}
            >
              {EVENT_TYPES.map((t) => (
                <label key={t} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <input
                    type="checkbox"
                    checked={eventTypes.includes(t)}
                    onChange={() => setEventTypes((prev) => toggleInList(prev, t))}
                  />
                  <span>{t}</span>
                </label>
              ))}
            </div>

            <p style={{ marginTop: 10, color: "#666", fontSize: 12 }}>
              Selected: {eventTypes.length}
            </p>
          </section>

          {/* ACCESSIBILITY */}
          <section
            style={{
              marginTop: 6,
              padding: 14,
              border: "1px solid #e5e5e5",
              borderRadius: 12,
              background: "white",
            }}
          >
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>Accessibility</h3>

            <label style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12 }}>
              <input
                type="checkbox"
                checked={isAccessible}
                onChange={(e) => {
                  const next = e.target.checked;
                  setIsAccessible(next);
                  if (!next) setAccessibilityFeatures([]);
                }}
              />
              <span style={{ fontWeight: 700 }}>ADA / accessible accommodations available</span>
            </label>

            {isAccessible && (
              <>
                <p style={{ marginTop: 10, color: "#555", fontSize: 13 }}>
                  Select accessibility features available at this event.
                </p>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                    gap: 10,
                    marginTop: 10,
                  }}
                >
                  {ACCESSIBILITY_FEATURES.map((f) => (
                    <label key={f} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <input
                        type="checkbox"
                        checked={accessibilityFeatures.includes(f)}
                        onChange={() =>
                          setAccessibilityFeatures((prev) => toggleInList(prev, f))
                        }
                      />
                      <span>{f}</span>
                    </label>
                  ))}
                </div>

                <p style={{ marginTop: 10, color: "#666", fontSize: 12 }}>
                  Selected: {accessibilityFeatures.length}
                </p>
              </>
            )}
          </section>

          {/* IMAGE */}
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
