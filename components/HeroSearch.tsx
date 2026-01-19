"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { EVENT_TYPES, ACCESSIBILITY_FEATURES } from "@/lib/eventOptions";

type Props = {
  title?: string;
  subtitle?: string;
  placeholder?: string;
};

function uniqSorted(arr: string[]) {
  return Array.from(new Set(arr)).sort((a, b) => a.localeCompare(b));
}

function parseCsvParam(v: string | null) {
  if (!v) return [];
  return v
    .split(",")
    .map((s) => decodeURIComponent(s).trim())
    .filter(Boolean);
}

function csvParam(values: string[]) {
  // encode each item to safely handle commas/special chars
  return values.map((v) => encodeURIComponent(v)).join(",");
}

export default function HeroSearch({
  title = "Find a local event",
  subtitle = "Search by title, city, state, or organizer. This platform is neutral and does not endorse listings.",
  placeholder = "Search events (e.g. rally, Houston, TX, @organizer)…",
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // read initial values from URL
  const initialQ = params.get("q") ?? "";
  const initialTypes = parseCsvParam(params.get("types"));
  const initialFeatures = parseCsvParam(params.get("features"));
  const initialAccessible = params.get("accessible"); // "true" | "false" | null

  const [q, setQ] = useState(initialQ);

  // "any" | "true" | "false"
  const [accessible, setAccessible] = useState<"any" | "true" | "false">(
    initialAccessible === "true" ? "true" : initialAccessible === "false" ? "false" : "any"
  );

  const [selectedTypes, setSelectedTypes] = useState<string[]>(initialTypes);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>(initialFeatures);

  const [showFilters, setShowFilters] = useState(false);

  // keep state synced if user navigates back/forward
  useEffect(() => {
    setQ(initialQ);
    setSelectedTypes(initialTypes);
    setSelectedFeatures(initialFeatures);
    setAccessible(
      initialAccessible === "true" ? "true" : initialAccessible === "false" ? "false" : "any"
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQ, initialAccessible, params]);

  const hasAnyFilters = useMemo(() => {
    return (
      q.trim().length > 0 ||
      selectedTypes.length > 0 ||
      selectedFeatures.length > 0 ||
      accessible !== "any"
    );
  }, [q, selectedTypes, selectedFeatures, accessible]);

  function apply(next: {
    q?: string;
    types?: string[];
    features?: string[];
    accessible?: "any" | "true" | "false";
  }) {
    const sp = new URLSearchParams(params.toString());

    const cleanQ = (next.q ?? q).trim();
    const types = uniqSorted(next.types ?? selectedTypes);
    const features = uniqSorted(next.features ?? selectedFeatures);
    const acc = next.accessible ?? accessible;

    // q
    if (cleanQ) sp.set("q", cleanQ);
    else sp.delete("q");

    // types
    if (types.length) sp.set("types", csvParam(types));
    else sp.delete("types");

    // features
    if (features.length) sp.set("features", csvParam(features));
    else sp.delete("features");

    // accessible
    if (acc === "true" || acc === "false") sp.set("accessible", acc);
    else sp.delete("accessible");

    const qs = sp.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    apply({});
  }

  function clearAll() {
    setQ("");
    setSelectedTypes([]);
    setSelectedFeatures([]);
    setAccessible("any");
    // push cleared URL
    const sp = new URLSearchParams(params.toString());
    sp.delete("q");
    sp.delete("types");
    sp.delete("features");
    sp.delete("accessible");
    const qs = sp.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function toggleInList(list: string[], value: string) {
    if (list.includes(value)) return list.filter((x) => x !== value);
    return [...list, value];
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

      <form onSubmit={onSubmit} style={{ marginTop: 14, display: "grid", gap: 12 }}>
        {/* Search Row */}
        <div style={{ display: "flex", gap: 10 }}>
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
              whiteSpace: "nowrap",
            }}
          >
            Search
          </button>

          <button
            type="button"
            onClick={() => setShowFilters((s) => !s)}
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid #ddd",
              background: "white",
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
            aria-expanded={showFilters}
            aria-controls="hero-filters"
          >
            {showFilters ? "Hide filters" : "Filters"}
          </button>

          {hasAnyFilters && (
            <button
              type="button"
              onClick={clearAll}
              style={{
                padding: "12px 14px",
                borderRadius: 12,
                border: "1px solid #ddd",
                background: "white",
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Clear
            </button>
          )}
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div
            id="hero-filters"
            style={{
              border: "1px solid #eee",
              borderRadius: 14,
              padding: 14,
              background: "#fafafa",
              display: "grid",
              gap: 14,
            }}
          >
            {/* Accessible */}
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontWeight: 800 }}>ADA Accessibility</div>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="radio"
                    name="accessible"
                    checked={accessible === "any"}
                    onChange={() => setAccessible("any")}
                  />
                  Any
                </label>
                <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="radio"
                    name="accessible"
                    checked={accessible === "true"}
                    onChange={() => setAccessible("true")}
                  />
                  Accessible
                </label>
                <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="radio"
                    name="accessible"
                    checked={accessible === "false"}
                    onChange={() => setAccessible("false")}
                  />
                  Not accessible
                </label>
              </div>
            </div>

            {/* Event Types */}
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontWeight: 800 }}>Event types (match any)</div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 8,
                }}
              >
                {[...EVENT_TYPES].sort((a, b) => a.localeCompare(b)).map((t) => (
                  <label
                    key={t}
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "center",
                      padding: "8px 10px",
                      borderRadius: 12,
                      border: "1px solid #e6e6e6",
                      background: "white",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedTypes.includes(t)}
                      onChange={() => setSelectedTypes((prev) => toggleInList(prev, t))}
                    />
                    <span>{t}</span>
                  </label>
                ))}
              </div>

              {selectedTypes.length > 0 && (
                <div style={{ fontSize: 13, color: "#555" }}>
                  Selected: {uniqSorted(selectedTypes).join(", ")}
                </div>
              )}
            </div>

            {/* Accessibility Features */}
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontWeight: 800 }}>Accessibility features (match any)</div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: 8,
                }}
              >
                {[...ACCESSIBILITY_FEATURES].sort((a, b) => a.localeCompare(b)).map((f) => (
                  <label
                    key={f}
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "center",
                      padding: "8px 10px",
                      borderRadius: 12,
                      border: "1px solid #e6e6e6",
                      background: "white",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedFeatures.includes(f)}
                      onChange={() => setSelectedFeatures((prev) => toggleInList(prev, f))}
                    />
                    <span>{f}</span>
                  </label>
                ))}
              </div>

              {selectedFeatures.length > 0 && (
                <div style={{ fontSize: 13, color: "#555" }}>
                  Selected: {uniqSorted(selectedFeatures).join(", ")}
                </div>
              )}
            </div>

            {/* Apply Button */}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() =>
                  apply({
                    q,
                    types: selectedTypes,
                    features: selectedFeatures,
                    accessible,
                  })
                }
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid #111",
                  background: "#111",
                  color: "white",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Apply filters
              </button>
            </div>
          </div>
        )}
      </form>
    </section>
  );
}
