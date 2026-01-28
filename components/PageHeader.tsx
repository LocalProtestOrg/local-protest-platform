"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export default function PageHeader({
  title,
  subtitle,
  imageUrl,
}: {
  title: string;
  subtitle?: string;
  imageUrl: string;
}) {
  const ALT_TEXT =
    "Peaceful protest gathering around the nation unite for a common cause.";

  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <section
      aria-label={ALT_TEXT}
      style={{
        width: "100%",
        height: 280,
        backgroundColor: "#d9d9d9", // fallback if image fails
        backgroundImage: `url("${imageUrl}")`,
        backgroundRepeat: "no-repeat",
        backgroundSize: "cover",
        backgroundPosition: "center center",
        position: "relative",
      }}
    >
      {/* Accessible alt text for screen readers */}
      <img
        src={imageUrl}
        alt={ALT_TEXT}
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          overflow: "hidden",
          clip: "rect(0 0 0 0)",
          whiteSpace: "nowrap",
          pointerEvents: "none",
        }}
      />

      {/* Dark overlay (visual only) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.45)",
          pointerEvents: "none",
        }}
      />

      {/* Dropdown Menu (top-right) */}
      <div
        ref={menuRef}
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          zIndex: 2,
        }}
      >
        <button
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="true"
          aria-expanded={open}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.45)",
            background: "rgba(0,0,0,0.55)",
            color: "white",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          Menu ▾
        </button>

        {open ? (
          <div
            style={{
              position: "absolute",
              right: 0,
              top: "110%",
              minWidth: 280,
              background: "white",
              color: "black",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.15)",
              boxShadow: "0 10px 25px rgba(0,0,0,0.18)",
              overflow: "hidden",
              zIndex: 999,
            }}
          >
            <MenuItem href="/login" label="Login" onSelect={() => setOpen(false)} />
            <MenuItem
              href="https://www.localassembly.org/email-your-congressperson"
              label="Email Your Congressperson"
              onSelect={() => setOpen(false)}
              external
            />
            <MenuItem href="/create" label="Create Event" onSelect={() => setOpen(false)} />
            <MenuItem href="/know-your-rights" label="Know Your Rights" onSelect={() => setOpen(false)} />
          </div>
        ) : null}
      </div>

      {/* Content */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          height: "100%",
          display: "flex",
          alignItems: "center",
        }}
      >
        <div
          style={{
            maxWidth: 900,
            margin: "0 auto",
            padding: 24,
            color: "white",
          }}
        >
          <h1 style={{ fontSize: 38, fontWeight: 800, margin: 0 }}>{title}</h1>

          {subtitle && (
            <p
              style={{
                fontSize: 18,
                marginTop: 10,
                maxWidth: 700,
                lineHeight: 1.4,
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function MenuItem({
  href,
  label,
  onSelect,
  external,
}: {
  href: string;
  label: string;
  onSelect: () => void;
  external?: boolean;
}) {
  const itemStyle: React.CSSProperties = {
    display: "block",
    padding: "12px 16px",
    fontWeight: 700,
    textDecoration: "none",
    color: "black",
  };

  if (external) {
    return (
      <a
        href={href}
        onClick={onSelect}
        style={itemStyle}
      >
        {label}
      </a>
    );
  }

  return (
    <Link
      href={href}
      onClick={onSelect}
      style={itemStyle}
    >
      {label}
    </Link>
  );
}