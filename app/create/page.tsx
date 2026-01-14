"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function CreatePage() {
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string>("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState("");
  const [stateUS, setStateUS] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const u = data.user;

      if (!u) {
        router.push("/login");
        return;
      }

      setUserId(u.id);

      // fetch public username
      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", u.id)
        .single();

      if (profileErr) {
        setMsg(profileErr.message);
      } else {
        setUsername(profile?.username ?? "");
      }

      setReady(true);
    })();
  }, [router]);

  async function submit() {
    setMsg("");
    if (!title.trim() || !description.trim()) {
      setMsg("Title and description are required.");
      return;
    }
    if (!userId) {
      setMsg("You must be logged in.");
      return;
    }

    const { data, error } = await supabase
      .from("protests")
      .insert({
        user_id: userId,
        organizer_username: username || null,
        title: title.trim(),
        description: description.trim(),
        city: city.trim() || null,
        state: stateUS.trim() || null,
        event_time: eventTime ? new Date(eventTime).toISOString() : null,
      })
      .select("id")
      .single();

    if (error) return setMsg(error.message);

    router.push(`/protest/${data.id}`);
  }

  async function logOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  if (!ready) return <main style={{ padding: 24 }}>Loading…</main>;

  return (
    <main style={{ maxWidth: 700, margin: "0 auto", padding: 24 }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <Link href="/">← Home</Link>
        <button onClick={logOut}>Log out</button>
      </header>

      <h1 style={{ fontSize: 28, fontWeight: 800, marginTop: 12 }}>Create a protest listing</h1>
      <p style={{ marginTop: 8, color: "#444" }}>
        Public organizer shown as: <strong>@{username || "username"}</strong>
      </p>

      <div style={{ display: "grid", gap: 10, marginTop: 18 }}>
        <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea
          placeholder="Description (neutral event info, guidelines, what to expect)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={6}
        />

        <div style={{ display: "flex", gap: 10 }}>
          <input placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
          <input placeholder="State" value={stateUS} onChange={(e) => setStateUS(e.target.value)} />
        </div>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ color: "#444" }}>Event date/time (optional)</span>
          <input type="datetime-local" value={eventTime} onChange={(e) => setEventTime(e.target.value)} />
        </label>

        <button onClick={submit}>Publish</button>
        {msg && <p style={{ color: "#b00020" }}>{msg}</p>}
      </div>
    </main>
  );
}
