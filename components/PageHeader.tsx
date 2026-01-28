"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  imageUrl: string;
  showText?: boolean; // optional, default true
};

const DEFAULT_ALT = "Peaceful protest gathering around the nation unite for a common cause.";

export default function PageHeader({
  title,
  subtitle,
  imageUrl,
  showText = true,
}: PageHeaderProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!open) return;
      const target = e.target as Node | null;
      if (menuRef.current && target && !menuRef.current.contains(target)) {
        setOpen(false);
      }
    }

    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const ariaLabel = DEFAULT_ALT;

  return (
    <section
      aria-label={ariaLabel}
      style={{
        width: "100%",
        height: 280,
        backgroundColor: "#d9d9d9",
        backgroundImage: `url("${imageUrl}")`,
        backgroundRepeat: "no-repeat",
        backgroundSize: "cover",
        backgroundPosition: "center center",
        position: "relative",
      }}
    >
      {/* Hidden image for accessibility */}
      <img
        src={imageUrl}
        alt={ariaLabel}
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

      {/* Dark overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.45)",
          pointerEvents: "none",
        }}
      />

      {/* Dropdown menu */}
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
          type="button"
          aria-haspopup="true"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
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
            role="menu"
            aria-label="Site menu"
            style={{
              marginTop: 10,
              minWidth: 220,
              background: "white",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.14)",
              boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
              overflow: "hidden",
            }}
          >
            <MenuItem href="/login" onPick={() => setOpen(false)}>
              Login
            </MenuItem>
            <MenuItem href="/email-your-congressperson" onPick={() => setOpen(false)}>
              Email Your Congressperson
            </MenuItem>
            <MenuItem href="/create" onPick={() => setOpen(false)}>
              Create Event
            </MenuItem>
            <MenuItem href="/know-your-rights" onPick={() => setOpen(false)}>
              Know Your Rights
            </MenuItem>
          </div>
        ) : null}
      </div>

      {/* Hero text */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          height: "100%",
          display: "flex",
          alignItems: "center",
        }}
      >
        <div style={{ maxWidth: 900, margin: "0 auto", padding: 24, color: "white" }}>
          {showText ? (
            <>
              <h1 style={{ fontSize: 38, fontWeight: 800, margin: 0 }}>{title}</h1>
              {subtitle ? (
                <p style={{ fontSize: 18, marginTop: 10, maxWidth: 700, lineHeight: 1.4 }}>
                  {subtitle}
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function MenuItem({
  href,
  children,
  onPick,
}: {
  href: string;
  children: React.ReactNode;
  onPick: () => void;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onPick}
      style={{
        display: "block",
        padding: "12px 14px",
        textDecoration: "none",
        color: "#111",
        fontWeight: 700,
        borderBottom: "1px solid rgba(0,0,0,0.06)",
      }}
    >
      {children}
    </Link>
  );
}