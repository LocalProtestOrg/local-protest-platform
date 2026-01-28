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

function toggleArrayValue(arr: string[], value: string) {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
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

      const organizer_username =
        (user.user_metadata?.username as string | undefined) ||
        (user.email ? user.email.split("@")[0] : null);

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
          accessibility_features: form.accessibility_features.length ? form.accessibility_features : null,
        })
        .select("id")
        .single();

      if (insertErr) throw insertErr;

      const protestId = inserted.id as string;

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
    <form onSubmit={onSubmit} className="mt-4">
      <div className="rounded-2xl border border-black/10 bg-white p-4">
        <div className="grid gap-4">
          <label className="grid gap-2">
            <span className="font-bold">Title *</span>
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Example: City Hall Community Meeting"
              className="w-full rounded-xl border border-black/20 px-3 py-2 text-sm"
            />
          </label>

          <label className="grid gap-2">
            <span className="font-bold">Description</span>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="What is it, where is it happening, what should people know?"
              rows={5}
              className="w-full resize-y rounded-xl border border-black/20 px-3 py-2 text-sm"
            />
          </label>

          {/* City/State: stacks on mobile, fixed state width on md+ */}
          <div className="grid gap-4 md:grid-cols-[1fr_120px]">
            <label className="grid gap-2">
              <span className="font-bold">City *</span>
              <input
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                placeholder="Minneapolis"
                className="w-full rounded-xl border border-black/20 px-3 py-2 text-sm"
              />
            </label>

            <label className="grid gap-2">
              <span className="font-bold">State *</span>
              <input
                value={form.state}
                onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                placeholder="MN"
                maxLength={2}
                className="w-full rounded-xl border border-black/20 px-3 py-2 text-sm uppercase"
              />
            </label>
          </div>

          <label className="grid gap-2">
            <span className="font-bold">Event time</span>
            <input
              type="datetime-local"
              value={form.event_time}
              onChange={(e) => setForm((f) => ({ ...f, event_time: e.target.value }))}
              className="w-full rounded-xl border border-black/20 px-3 py-2 text-sm md:w-fit"
            />
          </label>

          {/* Event type: use grid so labels never jumble on mobile */}
          <div className="grid gap-2">
            <div className="font-bold">Event type</div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {EVENT_TYPES.map((t) => {
                const checked = form.event_types.includes(t);
                return (
                  <label
                    key={t}
                    className="flex items-start gap-3 rounded-xl border border-black/10 bg-white p-3"
                  >
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 shrink-0"
                      checked={checked}
                      onChange={() =>
                        setForm((f) => ({
                          ...f,
                          event_types: toggleArrayValue(f.event_types, t),
                        }))
                      }
                    />
                    <span className="text-sm font-medium leading-5 text-neutral-900">{t}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Accessibility */}
          <div className="grid gap-3 border-t border-black/10 pt-4">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 shrink-0"
                checked={form.is_accessible}
                onChange={(e) => setForm((f) => ({ ...f, is_accessible: e.target.checked }))}
              />
              <span className="font-bold leading-5">This event is accessible</span>
            </label>

            <div
              className={[
                "grid gap-2",
                form.is_accessible ? "" : "opacity-50 pointer-events-none select-none",
              ].join(" ")}
            >
              <div className="font-bold">Accessibility features</div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {ACCESS_FEATURES.map((t) => {
                  const checked = form.accessibility_features.includes(t);
                  return (
                    <label
                      key={t}
                      className="flex items-start gap-3 rounded-xl border border-black/10 bg-white p-3"
                    >
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 shrink-0"
                        checked={checked}
                        onChange={() =>
                          setForm((f) => ({
                            ...f,
                            accessibility_features: toggleArrayValue(f.accessibility_features, t),
                          }))
                        }
                      />
                      <span className="text-sm font-medium leading-5 text-neutral-900">{t}</span>
                    </label>
                  );
                })}
              </div>

              {!form.is_accessible ? (
                <p className="text-xs text-neutral-600">
                  Turn on “This event is accessible” to choose features.
                </p>
              ) : null}
            </div>
          </div>

          <label className="grid gap-2">
            <span className="font-bold">Cover image (optional)</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm"
            />
          </label>

          {error ? <p className="m-0 text-sm text-red-600">{error}</p> : null}
          {ok ? <p className="m-0 text-sm text-green-700">{ok}</p> : null}

          <button
            type="submit"
            disabled={!canSubmit}
            className={[
              "mt-1 inline-flex w-fit items-center justify-center rounded-xl border border-black/20 px-4 py-3 text-sm font-extrabold",
              canSubmit ? "bg-black text-white" : "bg-black/20 text-white cursor-not-allowed",
            ].join(" ")}
          >
            {busy ? "Creating..." : "Create listing"}
          </button>

          <p className="m-0 text-xs text-neutral-600">
            If you are not logged in, you will be sent to Login.
          </p>
        </div>
      </div>
    </form>
  );
}