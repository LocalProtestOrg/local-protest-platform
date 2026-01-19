"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Props = {
  title?: string;
  subtitle?: string;
  placeholder?: string;
};

export default function HeroSearch({
  title = "Find a local event",
  subtitle = "Search by title, city, state, or organizer. This platform is neutral and does not endorse listings.",
  placeholder = "Search events (e.g. rally, Houston, TX, @organizer)…",
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const initialQ = params.get("q") ?? "";
  const [q, setQ] = useState(initialQ);

  // keep input in sync if user navigates back/forward
  useEffect(() => setQ(initialQ), [initialQ]);

  const hasQuery = useMemo(() => q.trim().length > 0, [q]);

  function apply(nextQ: string) {
    const sp = new URLSearchParams(params.toString());
    const clean = nextQ.trim();

    if (clean) sp.set("q", clean);
    else sp.delete("q");

    router.push(`${pathname}?${sp.toString()}`);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    apply(q);
  }

  function clear() {
    setQ("");
    apply("");
  }

  return (
    <section
      style={{
        border: "1px solid #e5e5e5",
        borderRadius: 16,
        padding: 18,
        background: "white",
      }}
    >
      <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900 }}>{title}</h1>
      <p style={{ marginTop: 8, color: "#444", maxWidth: 720 }}>{subtitle}</p>

      <form onSubmit={onSubmit} style={{ marginTop: 14, display: "flex", gap: 10 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          aria-label="Search events"
          style={{
            flex: 1,
            padding: "12px 12px",
            borderRadius: 12,
            border: "1px solid #ddd",
            outline: "none",
          }}
        />

        <button
          type="submit"
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid #111",
            background: "#111",
            color: "white",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Search
        </button>

        {hasQuery && (
          <button
            type="button"
            onClick={clear}
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid #ddd",
              background: "white",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Clear
          </button>
        )}
      </form>
    </section>
  );
}
