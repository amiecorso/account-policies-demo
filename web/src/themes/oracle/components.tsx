'use client';

import React, { useState, useCallback } from 'react';
import './theme.css';

/* ============================================================
   OracleCard
   Dark indigo card with gold border glow on hover
   ============================================================ */
interface OracleCardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  noPadding?: boolean;
}

export function OracleCard({ title, children, className = '', style, noPadding }: OracleCardProps) {
  return (
    <div
      className={`oracle-card oracle-animate-fade-up ${className}`}
      style={style}
    >
      {title && (
        <>
          <OracleSectionHeader>{title}</OracleSectionHeader>
        </>
      )}
      <div style={noPadding ? { margin: '-24px' } : undefined}>
        {children}
      </div>
    </div>
  );
}

/* ============================================================
   OracleButton
   primary = gold glow  |  secondary = violet outline  |  destructive = red
   ============================================================ */
interface OracleButtonProps {
  variant?: 'primary' | 'secondary' | 'destructive';
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  type?: 'button' | 'submit' | 'reset';
  style?: React.CSSProperties;
  fullWidth?: boolean;
}

export function OracleButton({
  variant = 'primary',
  disabled,
  loading,
  onClick,
  children,
  type = 'button',
  style,
  fullWidth,
}: OracleButtonProps) {
  const variantClass = {
    primary: 'oracle-btn-primary',
    secondary: 'oracle-btn-secondary',
    destructive: 'oracle-btn-destructive',
  }[variant];

  return (
    <button
      type={type}
      className={`oracle-btn ${variantClass}`}
      disabled={disabled || loading}
      onClick={onClick}
      style={{ width: fullWidth ? '100%' : undefined, ...style }}
    >
      {loading && (
        <span
          className={`oracle-spinner${variant !== 'primary' ? ' oracle-spinner-violet' : ''}`}
          style={{ width: 15, height: 15 }}
        />
      )}
      {children}
    </button>
  );
}

/* ============================================================
   OracleStatusBadge
   Glowing pill badges for status
   ============================================================ */
type BadgeStatus = 'active' | 'inactive' | 'pending' | 'error';

interface OracleStatusBadgeProps {
  status: BadgeStatus;
  label?: string;
}

const BADGE_LABELS: Record<BadgeStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
  pending: 'Pending',
  error: 'Error',
};

export function OracleStatusBadge({ status, label }: OracleStatusBadgeProps) {
  const badgeClass = {
    active: 'oracle-badge-active',
    inactive: 'oracle-badge-inactive',
    pending: 'oracle-badge-pending',
    error: 'oracle-badge-error',
  }[status];

  return (
    <span className={`oracle-badge ${badgeClass}`}>
      <span className="oracle-badge-dot" />
      {label ?? BADGE_LABELS[status]}
    </span>
  );
}

/* ============================================================
   OracleSectionHeader
   ◆ Title ◆ style with extending line
   ============================================================ */
interface OracleSectionHeaderProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export function OracleSectionHeader({ children, style }: OracleSectionHeaderProps) {
  return (
    <div className="oracle-section-header" style={style}>
      <span className="oracle-section-header-diamond">◆</span>
      <span className="oracle-section-header-title">{children}</span>
      <span className="oracle-section-header-diamond">◆</span>
      <div className="oracle-section-header-line" />
    </div>
  );
}

/* ============================================================
   OracleAddressDisplay
   Hex address in cream mono with copy affordance
   ============================================================ */
interface OracleAddressDisplayProps {
  address: string;
  label?: string;
  shorten?: boolean;
}

function shortenAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function OracleAddressDisplay({ address, label, shorten = true }: OracleAddressDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // fallback — select text manually
    }
  }, [address]);

  return (
    <div>
      {label && (
        <span className="oracle-label">{label}</span>
      )}
      <div className="oracle-address">
        <span className="oracle-mono" style={{ fontSize: '0.8125rem' }}>
          {shorten ? shortenAddress(address) : address}
        </span>
        <button
          className="oracle-address-copy"
          onClick={handleCopy}
          title={copied ? 'Copied!' : 'Copy address'}
          aria-label="Copy address"
        >
          {copied ? (
            /* Checkmark */
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path
                d="M2.5 7L5.5 10L11.5 4"
                stroke="#74c69d"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="40"
                strokeDashoffset="0"
                style={{ animation: 'oracle-check-draw 0.25s ease' }}
              />
            </svg>
          ) : (
            /* Copy icon */
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <rect x="4" y="4" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
              <path
                d="M10 4V3a1 1 0 00-1-1H3a1 1 0 00-1 1v6a1 1 0 001 1h1"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   OracleDivider — utility
   ============================================================ */
export function OracleDivider({ style }: { style?: React.CSSProperties }) {
  return <div className="oracle-divider" style={style} />;
}

/* ============================================================
   OracleInput — utility
   ============================================================ */
interface OracleInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function OracleInput({ label, id, ...props }: OracleInputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div>
      {label && (
        <label htmlFor={inputId} className="oracle-label">{label}</label>
      )}
      <input id={inputId} className="oracle-input" {...props} />
    </div>
  );
}

/* ============================================================
   OracleSelect — utility
   ============================================================ */
interface OracleSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export function OracleSelect({ label, id, children, ...props }: OracleSelectProps) {
  const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div>
      {label && (
        <label htmlFor={selectId} className="oracle-label">{label}</label>
      )}
      <select id={selectId} className={`oracle-input oracle-select`} {...props}>
        {children}
      </select>
    </div>
  );
}

/* ============================================================
   OracleBanner — utility
   ============================================================ */
interface OracleBannerProps {
  variant: 'success' | 'error' | 'info';
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export function OracleBanner({ variant, children, style }: OracleBannerProps) {
  const cls = {
    success: 'oracle-banner-success',
    error: 'oracle-banner-error',
    info: 'oracle-banner-info',
  }[variant];

  const icon = {
    success: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden style={{ flexShrink: 0, marginTop: 1 }}>
        <circle cx="8" cy="8" r="7" stroke="#74c69d" strokeWidth="1.5" />
        <path d="M5 8.5L7 10.5L11 6" stroke="#74c69d" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    error: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden style={{ flexShrink: 0, marginTop: 1 }}>
        <circle cx="8" cy="8" r="7" stroke="#fca5a5" strokeWidth="1.5" />
        <path d="M5.5 5.5L10.5 10.5M10.5 5.5L5.5 10.5" stroke="#fca5a5" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    info: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden style={{ flexShrink: 0, marginTop: 1 }}>
        <circle cx="8" cy="8" r="7" stroke="#8b8aad" strokeWidth="1.5" />
        <path d="M8 7.5V11M8 5.5V5" stroke="#8b8aad" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  }[variant];

  return (
    <div className={`oracle-banner ${cls}`} style={style}>
      {icon}
      <div>{children}</div>
    </div>
  );
}
