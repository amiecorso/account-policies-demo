"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import "./theme.css";

interface TerminalLayoutProps {
  children: React.ReactNode;
}

function BlinkingCursor() {
  return <span className="term-blink" style={{ color: "var(--term-green)" }}>█</span>;
}

function SystemClock() {
  const [time, setTime] = useState("");

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const h = now.getUTCHours().toString().padStart(2, "0");
      const m = now.getUTCMinutes().toString().padStart(2, "0");
      const s = now.getUTCSeconds().toString().padStart(2, "0");
      setTime(`${h}:${m}:${s}Z`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span style={{ color: "var(--term-cyan)" }}>
      {time || "00:00:00Z"}
    </span>
  );
}

export function TerminalLayout({ children }: TerminalLayoutProps) {
  const pathname = usePathname();

  const navItems = [
    { label: "MORPHO_LEND", href: "/" },
    { label: "MOIRAI_DELEGATE", href: "/moirai-delegate" },
  ];

  return (
    <div
      className="theme-terminal crt-overlay"
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--term-bg)",
        color: "var(--term-text)",
        fontFamily: "var(--term-font)",
      }}
    >
      {/* ── Header ───────────────────────────────────────── */}
      <header
        className="term-flicker"
        style={{
          borderBottom: "1px solid var(--term-border-solid)",
          backgroundColor: "var(--term-surface)",
        }}
      >
        {/* Top bar: branding */}
        <div
          style={{
            maxWidth: "860px",
            margin: "0 auto",
            padding: "10px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {/* Logo mark */}
            <span
              style={{
                color: "var(--term-green)",
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.15em",
                textShadow: "0 0 12px rgba(0,255,65,0.6)",
              }}
            >
              ╔══╗
            </span>
            <div>
              <span
                style={{
                  color: "var(--term-green)",
                  fontSize: "13px",
                  fontWeight: 700,
                  letterSpacing: "0.2em",
                  textShadow: "0 0 10px rgba(0,255,65,0.5)",
                }}
              >
                &gt; ACCOUNT_POLICIES
              </span>
              <BlinkingCursor />
            </div>
          </div>

          {/* Right: version badge */}
          <div
            style={{
              fontSize: "9px",
              color: "var(--term-text-muted)",
              letterSpacing: "0.12em",
              textAlign: "right",
            }}
          >
            <span
              className="term-blink-slow"
              style={{ color: "var(--term-green)", marginRight: "6px" }}
            >
              ●
            </span>
            AGENT ONLINE
          </div>
        </div>

        {/* System info bar */}
        <div
          style={{
            borderTop: "1px solid var(--term-border-hard)",
            backgroundColor: "#020208",
          }}
        >
          <div
            style={{
              maxWidth: "860px",
              margin: "0 auto",
              padding: "4px 24px",
              display: "flex",
              alignItems: "center",
              gap: "24px",
              fontSize: "10px",
              color: "var(--term-text-muted)",
              letterSpacing: "0.1em",
            }}
          >
            <span>SYS: ACCOUNT_POLICIES_v0.1</span>
            <span style={{ color: "var(--term-border-solid)" }}>│</span>
            <span>CHAIN: BASE_SEPOLIA</span>
            <span style={{ color: "var(--term-border-solid)" }}>│</span>
            <span>STATUS: <span style={{ color: "var(--term-green)" }}>ONLINE</span></span>
            <span style={{ color: "var(--term-border-solid)" }}>│</span>
            <span>UTC: <SystemClock /></span>
          </div>
        </div>

        {/* Navigation */}
        <div
          style={{
            borderTop: "1px solid var(--term-border-hard)",
          }}
        >
          <nav
            style={{
              maxWidth: "860px",
              margin: "0 auto",
              padding: "0 24px",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <span
              style={{
                fontSize: "10px",
                color: "var(--term-text-muted)",
                marginRight: "8px",
                letterSpacing: "0.1em",
              }}
            >
              &gt;
            </span>
            {navItems.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: "inline-block",
                    padding: "8px 14px",
                    fontSize: "11px",
                    letterSpacing: "0.15em",
                    fontWeight: isActive ? 700 : 500,
                    textDecoration: "none",
                    border: "1px solid",
                    borderColor: isActive
                      ? "var(--term-green)"
                      : "var(--term-border-solid)",
                    color: isActive
                      ? "var(--term-green)"
                      : "var(--term-text-muted)",
                    backgroundColor: isActive
                      ? "rgba(0,255,65,0.06)"
                      : "transparent",
                    marginTop: "8px",
                    marginBottom: "8px",
                    transition: "all 0.1s ease",
                    textShadow: isActive
                      ? "0 0 8px rgba(0,255,65,0.5)"
                      : "none",
                    boxShadow: isActive
                      ? "0 0 8px rgba(0,255,65,0.15)"
                      : "none",
                  }}
                >
                  [ {item.label} ]
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* ── Main content ─────────────────────────────────── */}
      <main
        style={{
          maxWidth: "860px",
          margin: "0 auto",
          padding: "32px 24px 80px",
        }}
      >
        {/* Page-level prompt prefix */}
        <div
          style={{
            fontSize: "10px",
            color: "var(--term-text-muted)",
            letterSpacing: "0.1em",
            marginBottom: "24px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span style={{ color: "var(--term-green)" }}>$</span>
          <span>
            session_init --chain base-sepolia --mode agent-authorization
          </span>
          <BlinkingCursor />
        </div>

        {children}
      </main>

      {/* ── Footer ───────────────────────────────────────── */}
      <footer
        style={{
          borderTop: "1px solid var(--term-border-hard)",
          backgroundColor: "#020208",
          padding: "12px 24px",
          textAlign: "center",
          fontSize: "10px",
          color: "var(--term-text-dim)",
          letterSpacing: "0.1em",
        }}
      >
        // ACCOUNT_POLICIES_DEMO | BASE_SEPOLIA | ALL_TRANSACTIONS_SIMULATED_ONLY
      </footer>
    </div>
  );
}
