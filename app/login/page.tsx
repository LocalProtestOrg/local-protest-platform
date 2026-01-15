"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function signUp() {
    setMsg("");
    setBusy(true);

    try {
      if (!username.trim()) {
        setMsg("Please choose a username.");
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (error) {
        setMsg(error.message);
        return;
      }

      const userId = data.user?.id;
      if (!userId) {
        setMsg("Account created. Please check your email to verify, then log in.");
        setMode("login");
        return;
      }

      // Create profile row (RLS must allow insert for the user)
      const { error: profileErr } = await supabase
        .from("profiles")
        .insert({ id: userId, username: username.trim() });

      if (profileErr) {
        setMsg(profileErr.message);
        return;
      }

      router.push("/create");
    } catch (e: any) {
      setMsg(e?.message || "Sign up failed.");
    } finally {
      setBusy(false);
    }
  }

  async function logIn() {
    setMsg("");
    setBusy(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setMsg(error.message);
        return;
      }

      router.push("/create");
    } catch (e: any) {
      setMsg(e?.message || "Login failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Organizer Access"
        subtitle="Log in to create and manage public listings. Your username is the only public organizer identifier."
        imageUrl="/images/login-hero.jpg"
      />

      <main style={{ maxWidth: 520, margin: "0 auto", padding: 24 }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Link href="/">← Back</Link>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => setMode("signup")}
              disabled={busy}
              style={{ fontWeight: mode === "signup" ? 800 : 400 }}
            >
              Sign up
            </button>
            <button
              type="button"
              onClick={() => setMode("login")}
              disabled={busy}
              style={{ fontWeight: mode === "login" ? 800 : 400 }}
            >
              Log in
            </button>
          </div>
        </header>

        <h1 style={{ fontSize: 28, fontWeight: 800, marginTop: 18 }}>
          {mode === "signup" ? "Create account" : "Log in"}
        </h1>

        <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
          {mode === "signup" && (
            <input
              placeholder="Username (public)"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          )}

          <input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />

          <input
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />

          {mode === "signup" ? (
            <button type="button" onClick={signUp} disabled={busy}>
              {busy ? "Creating..." : "Sign up"}
            </button>
          ) : (
            <button type="button" onClick={logIn} disabled={busy}>
              {busy ? "Logging in..." : "Log in"}
            </button>
          )}

          {msg && <p style={{ color: "#b00020", marginTop: 6 }}>{msg}</p>}

          <p style={{ marginTop: 10, color: "#666", fontSize: 13, lineHeight: 1.4 }}>
            Note: Comments are public. Organizers moderate comments on their own listings.
          </p>
        </div>
      </main>
    </>
  );
}
