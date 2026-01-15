"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [msg, setMsg] = useState("");

  async function signUp() {
    setMsg("");
    try {
      if (!username.trim()) return setMsg("Please choose a username.");

      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) return setMsg(error.message);

      const userId = data.user?.id;
      if (userId) {
        const { error: profileErr } = await supabase
          .from("profiles")
          .insert({ id: userId, username: username.trim() });

        if (profileErr) return setMsg(profileErr.message);
      }

      router.push("/create");
    } catch (e: any) {
      setMsg(e?.message || "Sign up failed.");
    }
  }

  async function logIn() {
    setMsg("");
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return setMsg(error.message);
      router.push("/create");
    } catch (e: any) {
      setMsg(e?.message || "Login failed.");
    }
  }

  return (
    <>
      <PageHeader
  title="Organizer Access"
  subtitle="Create and manage public listings responsibly."
  imageUrl="https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=2000&q=80"
/>


      <main style={{ maxWidth: 520, margin: "0 auto", padding: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700 }}>
          {mode === "signup" ? "Create account" : "Log in"}
        </h1>

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={() => setMode("signup")}>Sign up</button>
          <button onClick={() => setMode("login")}>Log in</button>
        </div>

        <div style={{ display: "grid", gap: 10, marginTop: 18 }}>
          {mode === "signup" && (
            <input
              placeholder="Username (public)"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          )}

          <input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {mode === "signup" ? (
            <button onClick={signUp}>Sign up</button>
          ) : (
            <button onClick={logIn}>Log in</button>
          )}

          {msg && <p style={{ color: "#b00020" }}>{msg}</p>}
        </div>
      </main>
    </>
  );
}
