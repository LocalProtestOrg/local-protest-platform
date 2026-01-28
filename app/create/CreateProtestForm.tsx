"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type FormState = {
  title: string;
  description: string;
  city: string;
  state: string;
  event_time: string; // datetime-local value
  event_types: string[];
  is_accessible: boolean;
  accessibility_features: string[];
};

const EVENT_TYPES = [
  "Protest",
  "Rally",
  "Town Hall",
  "Voter Registration",
  "Community Meeting",
  "March",
  "Boycott",
  "Teach-In",
];

const ACCESS_FEATURES = [
  "Wheelchair accessible",
  "ASL interpreter",
  "Captioning",
  "Quiet area",
  "Accessible restroom",
  "Seating available",
  "Parking nearby",
  "Public transit access",
];

function normalizeStateCode(input: string) {
  return input.trim().toUpperCase().slice(0, 2);
}

function safeFileName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_");
}

export default function CreateProtestForm() {
  const router = useRouter();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [coverFile, setCoverFile] = useState<File | null>(null);

  const [form, setForm] = useState<FormState>({
    title: "",
    description: "",
    city: "",
    state: "",
    event_time: "",
    event_types: [],
    is_accessible: false,
    accessibility_features: [],
  });

  const canSubmit = useMemo(() => {
    if (busy) return false;
    if (!form.title.trim()) return false;
    if (!form.city.trim()) return false;
    if (!normalizeStateCode(form.state)) return false;
    return true;
  }, [busy, form]);

  function toggleArrayValue(arr: string[], value: string) {
    return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
  }

  async function ensureLoggedIn() {
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session?.user) return null;
    return session.user;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);

    setBusy(true);
    try {
      const user = await ensureLoggedIn();
      if (!user) {
        router.push("/login");
        return;
      }

      const title = form.title.trim();
      const city = form.city.trim();
      const state = normalizeStateCode(form.state);

      if (!title || !city || !state) {
        setError("Please fill in Title, City, and State.");
        return;
      }

      // Organizer username: try user metadata, otherwise a fallback
      const organizer_username =
        (user.user_metadata?.username as string | undefined) ||
        (user.email ? user.email.split("@")[0] : null);

      // Insert first to get an id
      const { data: inserted, error: insertErr } = await supabase
        .from("protests")
        .insert({
          title,
          description: form.description.trim() || null,
          city,
          state,
          event_time: form.event_time ? new Date(form.event_time).toISOString() : null,
          organizer_username,
          user_id: user.id,
          status: "active",
          event_types: form.event_types.length ? form.event_types : null,
          is_accessible: form.is_accessible,
          accessibility_features: form.accessibility_features.length
            ? form.accessibility_features
            : null,
        })
        .select("id")
        .single();

      if (insertErr) throw insertErr;

      const protestId = inserted.id as string;

      // Optional cover image upload
      if (coverFile) {
        const path = `${user.id}/${protestId}/${Date.now()}-${safeFileName(coverFile.name)}`;

        const { error: uploadErr } = await supabase.storage
          .from("protest-images")
          .upload(path, coverFile, {
            cacheControl: "3600",
            upsert: true,
            contentType: coverFile.type || "image/jpeg",
          });

        if (uploadErr) throw uploadErr;

        const { error: updateErr } = await supabase
          .from("protests")
          .update({ image_path: path })
          .eq("id", protestId);

        if (updateErr) throw updateErr;
      }

      setOk("Created! Redirecting...");
      router.push(`/protest/${protestId}`);
    } catch (err: any) {
      setError(err?.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ marginTop: 16 }}>
      <div
        style={{
          border: "1px solid rgba(0,0,0,0.12)",
          borderRadius: 14,
          padding: 16,
          background: "white",
        }}
      >
        <div style={{ display: "grid", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 700 }}>Title *</span>
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Example: City Hall Community Meeting"
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.18)",
              }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 700 }}>Description</span>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="What is it, where is it happening, what should people know?"
              rows={5}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.18)",
                resize: "vertical",
              }}
            />
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 12 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontWeight: 700 }}>City *</span>
              <input
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                placeholder="Minneapolis"
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.18)",
                }}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontWeight: 700 }}>State *</span>
              <input
                value={form.state}
                onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                placeholder="MN"
                maxLength={2}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.18)",
                  textTransform: "uppercase",
                }}
              />
            </label>
          </div>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 700 }}>Event time</span>
            <input
              type="datetime-local"
              value={form.event_time}
              onChange={(e) => setForm((f) => ({ ...f, event_time: e.target.value }))}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.18)",
                width: "fit-content",
              }}
            />
          </label>

          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 700 }}>Event type</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {EVENT_TYPES.map((t) => (
                <label key={t} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={form.event_types.includes(t)}
                    onChange={() =>
                      setForm((f) => ({ ...f, event_types: toggleArrayValue(f.event_types, t) }))
                    }
                  />
                  <span>{t}</span>
                </label>
              ))}
            </div>
          </div>

          <div
            style={{
              borderTop: "1px solid rgba(0,0,0,0.08)",
              paddingTop: 12,
              display: "grid",
              gap: 10,
            }}
          >
            <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={form.is_accessible}
                onChange={(e) => setForm((f) => ({ ...f, is_accessible: e.target.checked }))}
              />
              <span style={{ fontWeight: 700 }}>This event is accessible</span>
            </label>

            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontWeight: 700 }}>Accessibility features</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {ACCESS_FEATURES.map((t) => (
                  <label key={t} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={form.accessibility_features.includes(t)}
                      onChange={() =>
                        setForm((f) => ({
                          ...f,
                          accessibility_features: toggleArrayValue(f.accessibility_features, t),
                        }))
                      }
                    />
                    <span>{t}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 700 }}>Cover image (optional)</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
            />
          </label>

          {error ? <p style={{ margin: 0, color: "crimson" }}>{error}</p> : null}
          {ok ? <p style={{ margin: 0, color: "green" }}>{ok}</p> : null}

          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              marginTop: 6,
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.18)",
              background: canSubmit ? "black" : "rgba(0,0,0,0.25)",
              color: "white",
              fontWeight: 800,
              cursor: canSubmit ? "pointer" : "not-allowed",
              width: "fit-content",
            }}
          >
            {busy ? "Creating..." : "Create listing"}
          </button>

          <p style={{ margin: "6px 0 0", color: "#666", fontSize: 13 }}>
            If you are not logged in, you will be sent to Login.
          </p>
        </div>
      </div>
    </form>
  );
}