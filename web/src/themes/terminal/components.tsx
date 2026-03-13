"use client";

import {
  type ReactNode,
  type InputHTMLAttributes,
  type ButtonHTMLAttributes,
  useState,
  useEffect,
} from "react";
import "./theme.css";

/* ================================================================
   TERMINAL THEME — COMPONENT LIBRARY
   Cyberpunk Agent Authorization UI Kit
   ================================================================ */

// ── Types ─────────────────────────────────────────────────────────

export type ButtonVariant = "primary" | "destructive" | "ghost";
export type StatusType = "online" | "offline" | "pending" | "error";

// ── TerminalCard ──────────────────────────────────────────────────

interface TerminalCardProps {
  title?: string;
  children: ReactNode;
  className?: string;
  glowing?: boolean;
  style?: React.CSSProperties;
}

export function TerminalCard({
  title,
  children,
  glowing = false,
  style,
}: TerminalCardProps) {
  return (
    <div
      className={glowing ? "term-card-glow term-pulse-glow" : "term-card"}
      style={{
        borderRadius: 0,
        overflow: "hidden",
        ...style,
      }}
    >
      {/* Title bar */}
      {title && (
        <div
          style={{
            borderBottom: "1px solid var(--term-border-solid)",
            backgroundColor: "#020208",
            padding: "6px 16px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          {/* Corner decorations */}
          <span style={{ color: "var(--term-green)", fontSize: "10px", opacity: 0.6 }}>
            ╔
          </span>
          <span
            style={{
              flex: 1,
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.2em",
              color: "var(--term-green)",
              textShadow: "0 0 8px rgba(0,255,65,0.4)",
            }}
          >
            {/* Top border line with title */}
            ══ {title.toUpperCase()} ══
          </span>
          <span style={{ color: "var(--term-green)", fontSize: "10px", opacity: 0.6 }}>
            ╗
          </span>
        </div>
      )}

      {/* Content */}
      <div style={{ padding: "20px" }}>{children}</div>
    </div>
  );
}

// ── TerminalButton ────────────────────────────────────────────────

interface TerminalButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: ReactNode;
  loading?: boolean;
}

const BRAILLE_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export function TerminalButton({
  variant = "primary",
  children,
  loading,
  disabled,
  style,
  ...rest
}: TerminalButtonProps) {
  const variantClass =
    variant === "primary"
      ? "term-btn-primary"
      : variant === "destructive"
        ? "term-btn-destructive"
        : "term-btn-ghost";

  return (
    <button
      className={`term-btn ${variantClass}`}
      disabled={disabled || loading}
      style={{
        padding: "8px 20px",
        fontSize: "11px",
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        borderRadius: 0,
        ...style,
      }}
      {...rest}
    >
      {loading && (
        <BrailleSpinner
          style={{
            color:
              variant === "destructive"
                ? "var(--term-pink)"
                : variant === "ghost"
                  ? "var(--term-text-muted)"
                  : "var(--term-green)",
          }}
        />
      )}
      {children}
    </button>
  );
}

// ── BrailleSpinner ────────────────────────────────────────────────

interface BrailleSpinnerProps {
  style?: React.CSSProperties;
  fps?: number;
}

export function BrailleSpinner({ style, fps = 10 }: BrailleSpinnerProps) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const id = setInterval(
      () => setFrame((f) => (f + 1) % BRAILLE_FRAMES.length),
      1000 / fps
    );
    return () => clearInterval(id);
  }, [fps]);

  return (
    <span style={{ display: "inline-block", ...style }}>
      {BRAILLE_FRAMES[frame]}
    </span>
  );
}

// ── TerminalStatusBadge ───────────────────────────────────────────

interface TerminalStatusBadgeProps {
  status: StatusType;
  label?: string;
  className?: string;
}

const STATUS_CONFIG: Record<
  StatusType,
  { color: string; label: string; blink: boolean; glow: string }
> = {
  online: {
    color: "var(--term-green)",
    label: "ONLINE",
    blink: true,
    glow: "0 0 6px rgba(0,255,65,0.6)",
  },
  offline: {
    color: "var(--term-text-muted)",
    label: "OFFLINE",
    blink: false,
    glow: "none",
  },
  pending: {
    color: "var(--term-cyan)",
    label: "PENDING",
    blink: true,
    glow: "0 0 6px rgba(0,212,255,0.6)",
  },
  error: {
    color: "var(--term-pink)",
    label: "ERROR",
    blink: true,
    glow: "0 0 6px rgba(255,0,110,0.6)",
  },
};

export function TerminalStatusBadge({ status, label }: TerminalStatusBadgeProps) {
  const cfg = STATUS_CONFIG[status];
  const displayLabel = label ?? cfg.label;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        fontSize: "11px",
        letterSpacing: "0.12em",
        color: cfg.color,
        fontFamily: "var(--term-font)",
      }}
    >
      <span
        className={cfg.blink ? "term-blink-slow" : undefined}
        style={{
          fontSize: "8px",
          textShadow: cfg.glow,
        }}
      >
        ●
      </span>
      {displayLabel}
    </span>
  );
}

// ── TerminalSectionHeader ─────────────────────────────────────────

interface TerminalSectionHeaderProps {
  title: string;
  lineNumber?: number;
  prefix?: "//" | ">" | "#" | "--";
  style?: React.CSSProperties;
}

export function TerminalSectionHeader({
  title,
  lineNumber,
  prefix = "//",
  style,
}: TerminalSectionHeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: "10px",
        marginBottom: "12px",
        ...style,
      }}
    >
      {lineNumber !== undefined && (
        <span
          style={{
            fontSize: "10px",
            color: "var(--term-text-dim)",
            minWidth: "28px",
            textAlign: "right",
            letterSpacing: "0.05em",
            userSelect: "none",
          }}
        >
          {String(lineNumber).padStart(3, "0")}
        </span>
      )}
      <span
        style={{
          fontSize: "10px",
          color: "var(--term-green-muted)",
          fontWeight: 500,
        }}
      >
        {prefix}
      </span>
      <span
        style={{
          fontSize: "11px",
          fontWeight: 700,
          letterSpacing: "0.2em",
          color: "var(--term-text)",
          textTransform: "uppercase",
        }}
      >
        {title}
      </span>
      {/* Trailing line */}
      <div
        style={{
          flex: 1,
          height: "1px",
          background:
            "linear-gradient(to right, var(--term-border-solid), transparent)",
          opacity: 0.5,
          marginLeft: "4px",
        }}
      />
    </div>
  );
}

// ── TerminalAddressDisplay ────────────────────────────────────────

interface TerminalAddressDisplayProps {
  address: string;
  label?: string;
  copyable?: boolean;
  style?: React.CSSProperties;
}

function truncateAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}████...████${addr.slice(-4)}`;
}

export function TerminalAddressDisplay({
  address,
  label,
  style,
}: TerminalAddressDisplayProps) {
  return (
    <div
      style={{
        display: "inline-flex",
        flexDirection: "column",
        gap: "2px",
        fontFamily: "var(--term-font)",
        ...style,
      }}
    >
      {label && (
        <span
          style={{
            fontSize: "9px",
            letterSpacing: "0.15em",
            color: "var(--term-text-muted)",
            textTransform: "uppercase",
          }}
        >
          {label}
        </span>
      )}
      <span
        title={address}
        style={{
          fontSize: "12px",
          letterSpacing: "0.05em",
          color: "var(--term-cyan)",
          cursor: "default",
        }}
      >
        {truncateAddress(address)}
      </span>
    </div>
  );
}

// ── TerminalInput ─────────────────────────────────────────────────

interface TerminalInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export function TerminalInput({
  label,
  hint,
  error,
  style,
  ...rest
}: TerminalInputProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      {label && (
        <label
          style={{
            fontSize: "10px",
            letterSpacing: "0.15em",
            color: error ? "var(--term-pink)" : "var(--term-text-muted)",
            textTransform: "uppercase",
            fontFamily: "var(--term-font)",
          }}
        >
          {error ? `// ERR: ${label}` : `// ${label}`}
        </label>
      )}
      <input
        className="term-input"
        style={{
          width: "100%",
          padding: "8px 12px",
          fontSize: "12px",
          letterSpacing: "0.05em",
          borderRadius: 0,
          borderColor: error ? "var(--term-pink)" : undefined,
          boxShadow: error
            ? "0 0 0 1px var(--term-pink), 0 0 8px var(--term-pink-glow)"
            : undefined,
          ...style,
        }}
        {...rest}
      />
      {hint && !error && (
        <span
          style={{
            fontSize: "9px",
            color: "var(--term-text-muted)",
            letterSpacing: "0.1em",
          }}
        >
          // {hint}
        </span>
      )}
      {error && (
        <span
          style={{
            fontSize: "9px",
            color: "var(--term-pink)",
            letterSpacing: "0.1em",
          }}
        >
          ! {error}
        </span>
      )}
    </div>
  );
}

// ── TerminalDataRow ───────────────────────────────────────────────
// Utility for key-value terminal output lines

interface TerminalDataRowProps {
  label: string;
  value: ReactNode;
  accent?: "green" | "cyan" | "pink" | "muted";
}

export function TerminalDataRow({
  label,
  value,
  accent = "green",
}: TerminalDataRowProps) {
  const accentColor =
    accent === "cyan"
      ? "var(--term-cyan)"
      : accent === "pink"
        ? "var(--term-pink)"
        : accent === "muted"
          ? "var(--term-text-muted)"
          : "var(--term-green)";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: "0",
        fontSize: "12px",
        lineHeight: "1.8",
        fontFamily: "var(--term-font)",
      }}
    >
      <span
        style={{
          color: "var(--term-text-muted)",
          minWidth: "180px",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </span>
      <span style={{ color: "var(--term-text-muted)", marginRight: "8px" }}>
        :
      </span>
      <span style={{ color: accentColor, letterSpacing: "0.03em" }}>
        {value}
      </span>
    </div>
  );
}

// ── TerminalDivider ───────────────────────────────────────────────

export function TerminalDivider({ label }: { label?: string }) {
  if (!label) {
    return (
      <div
        style={{
          height: "1px",
          background:
            "linear-gradient(to right, transparent, var(--term-border-solid), transparent)",
          margin: "16px 0",
        }}
      />
    );
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        margin: "16px 0",
        fontSize: "9px",
        color: "var(--term-text-muted)",
        letterSpacing: "0.15em",
      }}
    >
      <div
        style={{
          flex: 1,
          height: "1px",
          background: "var(--term-border-solid)",
        }}
      />
      <span>── {label.toUpperCase()} ──</span>
      <div
        style={{
          flex: 1,
          height: "1px",
          background: "var(--term-border-solid)",
        }}
      />
    </div>
  );
}

// ── TerminalSelect ────────────────────────────────────────────────

interface TerminalSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

export function TerminalSelect({ label, options, style, ...rest }: TerminalSelectProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      {label && (
        <label
          style={{
            fontSize: "10px",
            letterSpacing: "0.15em",
            color: "var(--term-text-muted)",
            textTransform: "uppercase",
            fontFamily: "var(--term-font)",
          }}
        >
          // {label}
        </label>
      )}
      <select
        className="term-input"
        style={{
          width: "100%",
          padding: "8px 12px",
          fontSize: "12px",
          letterSpacing: "0.05em",
          borderRadius: 0,
          appearance: "none",
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2300ff41' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 10px center",
          cursor: "pointer",
          ...style,
        }}
        {...rest}
      >
        {options.map((opt) => (
          <option
            key={opt.value}
            value={opt.value}
            style={{ backgroundColor: "var(--term-bg)", color: "var(--term-text)" }}
          >
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
