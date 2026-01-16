"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import PageHeader from "@/components/PageHeader";

type ProtestRow = {
  id: string;
  title: string;
  description: string | null;
  city: string | null;
  state: string | null;
  event_time: string | null;
  created_at: string | null;
  organizer_username: string | null;
  image_path: string | null;

  status: string;
  report_count: number;
  last_reported_at: string | null;
};

type ReportRow = {
  id: string;
  protest_id: string;
  reason: string;
  details: string | null;
  created_at: string;
};

const GLOBAL_ALT =
  "Peaceful protest gathering around the nation unite for a common cause.";

function formatWhen(ts: string | null) {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [authMsg, setAuthMsg] = useState("");
  const [msg, setMsg] = useState("");

  const [protests, setProtests] = useState<ProtestRow[]>([]);
  const [reportsByProtest, setReportsByProtest] = useState<Record<string, ReportRow[]>>({});

  const [statusFilter, setStatusFilter] = useState<"under_review" | "hidden" | "active" | "all">(
    "under_review"
  );

  const filtered = useMemo(() => {
    if (statusFilter === "all") return protests;
    return protests.filter((p) => p.status === statusFilter);
  }, [protests, statusFilter]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setAuthMsg("");
      setMsg("");

      // Must be logged in
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        setAuthMsg("You must be logged in to access admin.");
        setLoading(false);
        return;
      }

      // Admin check (RLS-backed). This will only return rows if you're an admin.
      const { data: adminRows, error: adminErr } = await supabase.from("admins").select("user_id").limit(1);
      if (adminErr) {
        setAuthMsg("Admin check failed: " + adminErr.message);
        setLoading(false);
        return;
      }
      if (!adminRows || adminRows.length === 0) {
        setAuthMsg("Access denied. Your account is not an admin.");
        setLoading(false);
        return;
      }

      await loadAll();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAll() {
    setMsg("");

    const { data: p, error: pErr } = await supabase
      .from("protests")
      .select(
        "id,title,description,city,state,event_time,created_at,organizer_username,image_path,status,report_count,last_reported_at"
      )
      .order("last_reported_at", { ascending: false });

    if (pErr) {
      setMsg("Failed to load protests: " + pErr.message);
      setProtests([]);
      setReportsByProtest({});
      return;
    }

    const rows = (p ?? []) as ProtestRow[];
    setProtests(rows);

    const ids = rows.map((r) => r.id);
    if (ids.length === 0) {
      setReportsByProtest({});
      return;
    }

    // Load reports for these protests (admin-only select policy)
    const { data: r, error: rErr } = await supabase
      .from("reports")
      .select("id,protest_id,reason,details,created_at")
      .in("protest_id", ids)
      .order("created_at", { ascending: false });

    if (rErr) {
      setMsg("Loaded protests, but failed to load reports: " + rErr.message);
      setReportsByProtest({});
      return;
    }

    const grouped: Record<string, ReportRow[]> = {};
    for (const rep of (r ?? []) as ReportRow[]) {
      if (!grouped[rep.protest_id]) grouped[rep.protest_id] = [];
      grouped[rep.protest_id].push(rep);
    }
    setReportsByProtest(grouped);
  }

  async function setProtestStatus(protestId: string, status: "active" | "under_review" | "hidden") {
    setMsg("");

    const { error } = await supabase.from("protests").update({ status }).eq("id", protestId);
    if (error) {
      setMsg(error.message);
      return;
    }

    await loadAll();
    setMsg(`Updated status to "${status}".`);
  }

  async function signOut() {
    await supabase.auth.signOut();
    location.href = "/login";
  }

  if (loading) return <main style={{ padding: 24 }}>Loading…</main>;

  if (authMsg) {
    return (
      <main style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900 }}>Admin</h1>
        <p style={{ marginTop: 10, color: "#b00020" }}>{authMsg}</p>
        <p style={{ marginTop: 10 }}>
          <Link href="/login">Go to login</Link>
        </p>
      </main>
    );
  }

  return (
    <>
      <PageHeader title="Admin Review" subtitle="Approve or hide listings under review." imageUrl="/images/home-hero.jpg" />

      <main style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
        <header style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
          <Link href="/">← Back</Link>
          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={loadAll}>Refresh</button>
            <button onClick={signOut}>Sign out</button>
          </div>
        </header>

        <div style={{ marginTop: 16, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <strong>Filter:</strong>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
            <option value="under_review">Under review</option>
            <option value="hidden">Hidden</option>
            <option value="active">Active</option>
            <option value="all">All</option>
          </select>
          <span style={{ color: "#555" }}>
            Showing {filtered.length} of {protests.length}
          </span>
        </div>

        {msg ? <p style={{ marginTop: 12, color: "#555" }}>{msg}</p> : null}

        <div style={{ marginTop: 18, display: "grid", gap: 14 }}>
          {filtered.length === 0 ? (
            <p>No listings in this filter.</p>
          ) : (
            filtered.map((p) => {
              const reports = reportsByProtest[p.id] ?? [];
              const location = `${p.city ?? "—"}, ${p.state ?? "—"}`;
              const when = p.event_time ? new Date(p.event_time).toLocaleString() : "";

              const thumbUrl = p.image_path
                ? supabase.storage.from("protest-images").getPublicUrl(p.image_path).data.publicUrl
                : "/images/default-protest.jpg";

              return (
                <article
                  key={p.id}
                  style={{
                    border: "1px solid #e5e5e5",
                    borderRadius: 12,
                    overflow: "hidden",
                    background: "white",
                  }}
                >
                  <img
                    src={thumbUrl}
                    alt={GLOBAL_ALT}
                    style={{ width: "100%", height: 220, objectFit: "cover", display: "block" }}
                  />

                  <div style={{ padding: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div>
                        <h2 style={{ fontSize: 18, fontWeight: 900, margin: 0 }}>{p.title}</h2>
                        <p style={{ marginTop: 8, color: "#555" }}>
                          {location}
                          {when ? " • " + when : ""}
                        </p>
                        <p style={{ marginTop: 6, color: "#555" }}>
                          Organizer: <strong>@{p.organizer_username ?? "unknown"}</strong>
                        </p>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 13, color: "#555" }}>
                          <div>
                            <strong>Status:</strong> {p.status}
                          </div>
                          <div>
                            <strong>Reports:</strong> {p.report_count ?? 0}
                          </div>
                          <div>
                            <strong>Last:</strong> {formatWhen(p.last_reported_at)}
                          </div>
                        </div>

                        <div style={{ marginTop: 10, display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                          <button onClick={() => setProtestStatus(p.id, "active")}>Approve</button>
                          <button onClick={() => setProtestStatus(p.id, "hidden")}>Hide</button>
                          <Link href={`/protest/${p.id}`} style={{ alignSelf: "center" }}>
                            Open →
                          </Link>
                        </div>
                      </div>
                    </div>

                    {p.description ? (
                      <p style={{ marginTop: 10 }}>
                        {p.description.length > 240 ? p.description.slice(0, 240) + "…" : p.description}
                      </p>
                    ) : null}

                    <div style={{ marginTop: 14, borderTop: "1px solid #eee", paddingTop: 12 }}>
                      <h3 style={{ fontSize: 15, fontWeight: 900, margin: 0 }}>
                        Reports ({reports.length})
                      </h3>

                      {reports.length === 0 ? (
                        <p style={{ marginTop: 8, color: "#666" }}>No reports found for this listing.</p>
                      ) : (
                        <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                          {reports.slice(0, 10).map((r) => (
                            <div key={r.id} style={{ border: "1px solid #eee", borderRadius: 10, padding: 10 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                                <strong>{r.reason}</strong>
                                <span style={{ color: "#666", fontSize: 13 }}>{formatWhen(r.created_at)}</span>
                              </div>
                              {r.details ? <p style={{ marginTop: 6 }}>{r.details}</p> : null}
                            </div>
                          ))}
                          {reports.length > 10 ? (
                            <p style={{ color: "#666", fontSize: 13 }}>Showing newest 10 reports.</p>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </main>
    </>
  );
}
