"use client";

import React from "react";
import "./theme.css";

export interface BrutalistLayoutProps {
  children: React.ReactNode;
  /** Currently active nav item (used to highlight the yellow indicator) */
  activeNav?: "morpho-lend" | "moirai-delegate";
  /** Optional additional className on the root element */
  className?: string;
}

interface NavItem {
  id: "morpho-lend" | "moirai-delegate";
  label: string;
  href: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: "morpho-lend", label: "Morpho Lend", href: "/" },
  { id: "moirai-delegate", label: "Moirai Delegate", href: "/moirai-delegate" },
];

/**
 * BrutalistLayout
 *
 * Outer shell for Theme 3 "Brutalist Clarity — The Policy Brief".
 * Renders a stark black header with Bebas Neue wordmark and yellow
 * active-nav underline, then centres content in a cream column.
 */
export function BrutalistLayout({
  children,
  activeNav = "moirai-delegate",
  className = "",
}: BrutalistLayoutProps) {
  return (
    <div
      className={`theme-brutalist${className ? ` ${className}` : ""}`}
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--brut-bg)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ── HEADER ── */}
      <header className="brut-header">
        <div className="brut-header-inner">
          {/* Wordmark */}
          <div className="brut-wordmark">ACCOUNT&nbsp;POLICIES</div>

          {/* Nav */}
          <nav style={{ display: "flex", alignItems: "stretch", flex: 1 }}>
            {NAV_ITEMS.map((item) => (
              <a
                key={item.id}
                href={item.href}
                className={`brut-nav-item${activeNav === item.id ? " active" : ""}`}
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* Right slot — protocol tag */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              paddingLeft: 20,
              borderLeft: "1px solid rgba(255,255,255,0.15)",
            }}
          >
            <span
              style={{
                fontFamily: "var(--brut-font-body)",
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.3)",
              }}
            >
              Base Sepolia
            </span>
          </div>
        </div>
      </header>

      {/* ── BODY ── */}
      <main
        style={{
          flex: 1,
          maxWidth: 1200,
          width: "100%",
          margin: "0 auto",
          padding: "48px 24px 96px",
        }}
      >
        {children}
      </main>

      {/* ── FOOTER ── */}
      <footer
        style={{
          borderTop: "var(--brut-rule)",
          backgroundColor: "var(--brut-surface)",
          padding: "16px 24px",
        }}
      >
        <div
          style={{
            maxWidth: 960,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <span className="brut-doc-watermark">
            Account Policies — Policy Brief v1.0 — Base Sepolia 84532
          </span>
          <span className="brut-doc-watermark">
            All policy executions are final and recorded on-chain.
          </span>
        </div>
      </footer>
    </div>
  );
}
