'use client';

import React from 'react';
import './theme.css';

/* ─────────────────────────────────────────────────────────────────────────
   BRUTALIST CLARITY — Shared Component Library
   ───────────────────────────────────────────────────────────────────────── */

// ─── BrutalistCard ──────────────────────────────────────────────────────────

export interface BrutalistCardProps {
  /** Section label (small ALL CAPS caption above title) */
  label?: string;
  /** Card title displayed in Bebas Neue */
  title?: string;
  /** Right-side slot in header (e.g. a badge) */
  headerRight?: React.ReactNode;
  /** Card body content */
  children: React.ReactNode;
  /** Additional inline style on the root */
  style?: React.CSSProperties;
  className?: string;
}

export function BrutalistCard({
  label,
  title,
  headerRight,
  children,
  style,
  className = '',
}: BrutalistCardProps) {
  const hasHeader = label || title || headerRight;

  return (
    <div
      className={`brut-card${className ? ` ${className}` : ''}`}
      style={style}
    >
      {hasHeader && (
        <div className="brut-card-header">
          <div>
            {label && <span className="brut-card-label">{label}</span>}
            {title && <div className="brut-card-title">{title}</div>}
          </div>
          {headerRight && <div>{headerRight}</div>}
        </div>
      )}

      <div className="brut-card-body">
        {children}
      </div>
    </div>
  );
}


// ─── BrutalistButton ─────────────────────────────────────────────────────────

export interface BrutalistButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'destructive';
  fullWidth?: boolean;
  /** Show a loading indicator */
  loading?: boolean;
  children: React.ReactNode;
}

export function BrutalistButton({
  variant = 'primary',
  fullWidth = false,
  loading = false,
  children,
  className = '',
  disabled,
  style,
  ...rest
}: BrutalistButtonProps) {
  const variantClass =
    variant === 'primary'     ? 'brut-btn-primary' :
    variant === 'destructive' ? 'brut-btn-destructive' :
                                'brut-btn-secondary';

  return (
    <button
      className={`brut-btn ${variantClass}${fullWidth ? ' brut-btn-full' : ''}${className ? ` ${className}` : ''}`}
      disabled={disabled || loading}
      style={style}
      {...rest}
    >
      {loading ? (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <LoadingDots />
          PROCESSING
        </span>
      ) : children}
    </button>
  );
}

function LoadingDots() {
  return (
    <span
      style={{
        display: 'inline-flex',
        gap: 3,
        alignItems: 'center',
      }}
      aria-hidden="true"
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 4,
            height: 4,
            borderRadius: '50%',
            background: 'currentColor',
            opacity: 0.9,
            animation: `brut-dot-blink 1.1s ${i * 0.18}s ease-in-out infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes brut-dot-blink {
          0%, 80%, 100% { transform: scale(1);   opacity: 0.9; }
          40%            { transform: scale(0.6); opacity: 0.4; }
        }
      `}</style>
    </span>
  );
}


// ─── BrutalistStatusBadge ────────────────────────────────────────────────────

export interface BrutalistStatusBadgeProps {
  status: 'active' | 'inactive' | 'pending' | 'error';
  label?: string;
}

const STATUS_LABELS: Record<BrutalistStatusBadgeProps['status'], string> = {
  active:   'ACTIVE',
  inactive: 'INACTIVE',
  pending:  'PENDING',
  error:    'ERROR',
};

export function BrutalistStatusBadge({ status, label }: BrutalistStatusBadgeProps) {
  return (
    <span className={`brut-badge brut-badge-${status}`}>
      {label ?? STATUS_LABELS[status]}
    </span>
  );
}


// ─── BrutalistSectionHeader ──────────────────────────────────────────────────

export interface BrutalistSectionHeaderProps {
  /** The big faded number shown behind the heading, e.g. "01" */
  sectionNumber: string;
  /** Small ALL CAPS label above the title */
  label: string;
  /** Main heading in Bebas Neue */
  title: string;
  style?: React.CSSProperties;
}

export function BrutalistSectionHeader({
  sectionNumber,
  label,
  title,
  style,
}: BrutalistSectionHeaderProps) {
  return (
    <div className="brut-section-header" style={style}>
      {/* Watermark number */}
      <span className="brut-section-num" aria-hidden="true">
        {sectionNumber}
      </span>
      {/* Content */}
      <span className="brut-section-label">{label}</span>
      <span className="brut-section-title">{title}</span>
    </div>
  );
}


// ─── BrutalistAddressDisplay ─────────────────────────────────────────────────

export interface BrutalistAddressDisplayProps {
  address: string;
  /** Show full address vs. truncated (e.g. 0xAbCd...1234) */
  truncate?: boolean;
  style?: React.CSSProperties;
}

export function BrutalistAddressDisplay({
  address,
  truncate = true,
  style,
}: BrutalistAddressDisplayProps) {
  const display = truncate && address.length > 12
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : address;

  return (
    <span
      className="brut-address"
      title={address}
      style={style}
    >
      {display}
    </span>
  );
}


// ─── BrutalistAmountDisplay ──────────────────────────────────────────────────

export interface BrutalistAmountDisplayProps {
  amount: string | number;
  unit?: string;
  style?: React.CSSProperties;
}

export function BrutalistAmountDisplay({
  amount,
  unit = 'USDC',
  style,
}: BrutalistAmountDisplayProps) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', ...style }}>
      <span className="brut-amount">{amount}</span>
      {unit && <span className="brut-amount-unit">{unit}</span>}
    </span>
  );
}


// ─── BrutalistDataRow ────────────────────────────────────────────────────────

export interface BrutalistDataRowProps {
  label: string;
  value: React.ReactNode;
}

export function BrutalistDataRow({ label, value }: BrutalistDataRowProps) {
  return (
    <div className="brut-data-row">
      <span className="brut-data-key">{label}</span>
      <span className="brut-data-value">{value}</span>
    </div>
  );
}


// ─── BrutalistField ──────────────────────────────────────────────────────────

export interface BrutalistFieldProps {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
  hint?: string;
}

export function BrutalistField({ label, htmlFor, children, hint }: BrutalistFieldProps) {
  return (
    <div className="brut-field">
      <label
        className="brut-label"
        htmlFor={htmlFor}
      >
        {label}
      </label>
      {children}
      {hint && (
        <span style={{
          fontFamily: 'var(--brut-font-body)',
          fontSize: 14,
          color: 'var(--brut-muted)',
          lineHeight: 1.4,
        }}>
          {hint}
        </span>
      )}
    </div>
  );
}


// ─── BrutalistDivider ────────────────────────────────────────────────────────

export function BrutalistDivider({ label }: { label?: string }) {
  if (label) {
    return (
      <div className="brut-divider-labeled">
        <span className="brut-divider-text">{label}</span>
      </div>
    );
  }
  return <hr className="brut-hr" />;
}


// ─── BrutalistPolicyItem ─────────────────────────────────────────────────────

export interface BrutalistPolicyItemProps {
  index: number;
  name: string;
  limit: string;
  unit?: string;
  executor?: string;
  status?: BrutalistStatusBadgeProps['status'];
  action?: React.ReactNode;
}

export function BrutalistPolicyItem({
  index,
  name,
  limit,
  unit = 'USDC',
  executor,
  status = 'active',
  action,
}: BrutalistPolicyItemProps) {
  const numStr = String(index).padStart(2, '0') + '.';

  return (
    <div className="brut-policy-item">
      <span className="brut-policy-num">{numStr}</span>

      <div className="brut-policy-body">
        <div className="brut-policy-name">{name}</div>
        <div className="brut-policy-meta" style={{ marginBottom: 6 }}>
          LIMIT&nbsp;&nbsp;
          <span style={{
            fontFamily: 'var(--brut-font-display)',
            fontSize: 18,
            color: 'var(--brut-text)',
            letterSpacing: '0.04em',
          }}>
            {limit}
          </span>
          &nbsp;{unit}
        </div>
        {executor && (
          <div className="brut-policy-meta">
            EXECUTOR&nbsp;&nbsp;<BrutalistAddressDisplay address={executor} />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
        <BrutalistStatusBadge status={status} />
        {action && <div>{action}</div>}
      </div>
    </div>
  );
}
