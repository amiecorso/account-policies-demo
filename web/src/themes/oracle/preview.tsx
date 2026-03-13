'use client';

import React, { useState } from 'react';
import { OracleLayout } from './Layout';
import {
  OracleCard,
  OracleButton,
  OracleStatusBadge,
  OracleSectionHeader,
  OracleAddressDisplay,
  OracleDivider,
  OracleInput,
  OracleSelect,
  OracleBanner,
} from './components';
import './theme.css';

/* ── Mock data ─────────────────────────────────────────────── */
const MOCK_WALLET = '0xAbCd3F2a9e87B0014f28C1dE3A5c7F9042610001';
const MOCK_EXECUTOR = '0xDeFa4B8c1E92F004c5Aa7D0e8B3924C7F2310002';

const MOCK_POLICIES = [
  {
    id: '0x7f3a2b1c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a',
    name: 'Treasury Operations',
    asset: 'USDC',
    limit: '5,000',
    status: 'active' as const,
    validUntil: '2026-06-30',
    nonce: 3,
  },
  {
    id: '0x2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b',
    name: 'DeFi Rebalancer',
    asset: 'USDC',
    limit: '10,000',
    status: 'active' as const,
    validUntil: '2026-09-15',
    nonce: 11,
  },
];

/* ── View states ───────────────────────────────────────────── */
type ViewState = 'default' | 'install-form' | 'execute-loading' | 'execute-success';

/* ============================================================
   OraclePreview — self-contained, no real data/API calls
   ============================================================ */
export function OraclePreview() {
  const [view, setView] = useState<ViewState>('default');
  const [selectedPolicy, setSelectedPolicy] = useState(MOCK_POLICIES[0].id);
  const [installAsset, setInstallAsset] = useState('USDC');
  const [installLimit, setInstallLimit] = useState('');
  const [installRecipient, setInstallRecipient] = useState('');
  const [executeAmount, setExecuteAmount] = useState('');

  return (
    <OracleLayout activePage="moirai">
      {/* ── Scene control bar ──────────────────────────────── */}
      <div
        style={{
          marginBottom: 32,
          padding: '14px 20px',
          background: 'rgba(42,42,107,0.2)',
          borderRadius: 10,
          border: '1px dashed rgba(42,42,107,0.5)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontSize: '0.7rem',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--oracle-text-dim)',
            marginRight: 8,
          }}
        >
          Preview state:
        </span>
        {(
          [
            ['default', 'Default'],
            ['install-form', 'Install Form'],
            ['execute-loading', 'Loading'],
            ['execute-success', 'Success'],
          ] as [ViewState, string][]
        ).map(([state, label]) => (
          <button
            key={state}
            onClick={() => setView(state)}
            style={{
              padding: '5px 12px',
              borderRadius: 6,
              border: '1px solid',
              borderColor: view === state ? 'var(--oracle-gold)' : 'var(--oracle-border)',
              background: view === state ? 'rgba(212,168,83,0.12)' : 'transparent',
              color: view === state ? 'var(--oracle-gold)' : 'var(--oracle-text-muted)',
              fontSize: '0.75rem',
              fontWeight: 600,
              letterSpacing: '0.04em',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Page intro ─────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <h1
          className="oracle-heading"
          style={{ fontSize: '1.625rem', fontWeight: 700, marginBottom: 8, lineHeight: 1.2 }}
        >
          Moirai Delegate
        </h1>
        <p style={{ color: 'var(--oracle-text-muted)', fontSize: '0.9375rem', lineHeight: 1.6 }}>
          Grant a trusted delegate authority to execute transactions within policy bounds —
          woven and enforced by the Fates.
        </p>
      </div>

      {/* ── Wallet card ────────────────────────────────────── */}
      <OracleCard style={{ marginBottom: 24 }}>
        <OracleSectionHeader>Connected Wallet</OracleSectionHeader>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 20,
          }}
        >
          <OracleAddressDisplay address={MOCK_WALLET} label="Smart Wallet" />
          <OracleAddressDisplay address={MOCK_EXECUTOR} label="Delegate Executor" />
        </div>
      </OracleCard>

      {/* ── Installed policies ─────────────────────────────── */}
      <OracleCard style={{ marginBottom: 24 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 20,
          }}
        >
          <OracleSectionHeader style={{ marginBottom: 0, flex: 1 }}>
            Installed Policies
          </OracleSectionHeader>
          {view !== 'install-form' && (
            <OracleButton
              variant="secondary"
              onClick={() => setView('install-form')}
              style={{ marginLeft: 16, flexShrink: 0 }}
            >
              + Install Policy
            </OracleButton>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {MOCK_POLICIES.map((policy, i) => (
            <PolicyRow
              key={policy.id}
              policy={policy}
              selected={selectedPolicy === policy.id}
              onSelect={() => setSelectedPolicy(policy.id)}
              delay={i * 80}
            />
          ))}
        </div>
      </OracleCard>

      {/* ── Install Policy form (view: install-form) ────────── */}
      {view === 'install-form' && (
        <OracleCard
          style={{ marginBottom: 24, borderColor: 'var(--oracle-violet-deep)' }}
          className="oracle-animate-fade-up"
        >
          <OracleSectionHeader>Install New Policy</OracleSectionHeader>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <OracleSelect
                label="Asset"
                value={installAsset}
                onChange={e => setInstallAsset(e.target.value)}
              >
                <option value="ETH">ETH</option>
                <option value="USDC">USDC</option>
                <option value="MIGGLES">MIGGLES</option>
              </OracleSelect>
              <OracleInput
                label="Spend limit"
                type="number"
                placeholder="e.g. 5000"
                value={installLimit}
                onChange={e => setInstallLimit(e.target.value)}
              />
            </div>
            <OracleInput
              label="Recipient address (0x…)"
              type="text"
              placeholder="0x…"
              value={installRecipient}
              onChange={e => setInstallRecipient(e.target.value)}
            />

            <OracleBanner variant="info">
              The policy will be bound to your smart wallet. You can uninstall it at any time.
            </OracleBanner>

            <div style={{ display: 'flex', gap: 12 }}>
              <OracleButton
                variant="primary"
                onClick={() => setView('default')}
                style={{ flex: 1 }}
              >
                Approve &amp; Install
              </OracleButton>
              <OracleButton
                variant="secondary"
                onClick={() => setView('default')}
              >
                Cancel
              </OracleButton>
            </div>
          </div>
        </OracleCard>
      )}

      {/* ── Execute panel ──────────────────────────────────── */}
      <OracleCard>
        <OracleSectionHeader>Execute Transaction</OracleSectionHeader>

        {view === 'execute-success' ? (
          <SuccessState onReset={() => setView('default')} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Policy selector */}
            <div>
              <span className="oracle-label">Active policy</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {MOCK_POLICIES.map(policy => (
                  <label
                    key={policy.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 14px',
                      borderRadius: 8,
                      border: '1px solid',
                      borderColor:
                        selectedPolicy === policy.id
                          ? 'var(--oracle-gold-dim)'
                          : 'var(--oracle-border)',
                      background:
                        selectedPolicy === policy.id
                          ? 'rgba(212,168,83,0.06)'
                          : 'rgba(8,8,16,0.4)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onClick={() => setSelectedPolicy(policy.id)}
                  >
                    <div
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        border: '2px solid',
                        borderColor:
                          selectedPolicy === policy.id
                            ? 'var(--oracle-gold)'
                            : 'var(--oracle-border)',
                        background:
                          selectedPolicy === policy.id
                            ? 'var(--oracle-gold)'
                            : 'transparent',
                        flexShrink: 0,
                        transition: 'all 0.2s',
                        boxShadow:
                          selectedPolicy === policy.id
                            ? '0 0 8px rgba(212,168,83,0.5)'
                            : 'none',
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          color:
                            selectedPolicy === policy.id
                              ? 'var(--oracle-text)'
                              : 'var(--oracle-text-muted)',
                        }}
                      >
                        {policy.name}
                      </div>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--oracle-text-dim)',
                          marginTop: 2,
                          fontFamily: 'var(--oracle-font-mono)',
                        }}
                      >
                        Limit: {policy.limit} {policy.asset} · Nonce #{policy.nonce}
                      </div>
                    </div>
                    <OracleStatusBadge status={policy.status} />
                  </label>
                ))}
              </div>
            </div>

            <OracleDivider />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <OracleInput
                label="Amount"
                type="number"
                placeholder="0.00"
                value={executeAmount}
                onChange={e => setExecuteAmount(e.target.value)}
              />
              <OracleInput
                label="Recipient"
                type="text"
                placeholder="0x…"
              />
            </div>

            <OracleInput
              label="Deadline (Unix timestamp)"
              type="number"
              placeholder="e.g. 1775000000"
            />

            <OracleButton
              variant="primary"
              loading={view === 'execute-loading'}
              onClick={() => {
                setView('execute-loading');
                setTimeout(() => setView('execute-success'), 2500);
              }}
              fullWidth
            >
              {view === 'execute-loading' ? 'Signing & Broadcasting…' : 'Sign & Execute'}
            </OracleButton>
          </div>
        )}
      </OracleCard>

      {/* ── Footer ornament ────────────────────────────────── */}
      <footer
        style={{
          marginTop: 56,
          paddingTop: 20,
          borderTop: '1px solid rgba(42,42,107,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
        }}
      >
        <div
          style={{
            height: 1,
            flex: 1,
            background: 'linear-gradient(to right, transparent, rgba(42,42,107,0.4))',
          }}
        />
        <span
          style={{
            fontFamily: 'var(--oracle-font-heading)',
            fontSize: '0.6875rem',
            letterSpacing: '0.16em',
            color: 'var(--oracle-text-dim)',
            textTransform: 'uppercase',
          }}
        >
          ◆ The Fates Watch ◆
        </span>
        <div
          style={{
            height: 1,
            flex: 1,
            background: 'linear-gradient(to left, transparent, rgba(42,42,107,0.4))',
          }}
        />
      </footer>
    </OracleLayout>
  );
}

/* ── PolicyRow sub-component ───────────────────────────────── */
interface PolicyRowProps {
  policy: (typeof MOCK_POLICIES)[0];
  selected: boolean;
  onSelect: () => void;
  delay?: number;
}

function PolicyRow({ policy, selected, onSelect, delay = 0 }: PolicyRowProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        border: '1px solid',
        borderColor: selected ? 'var(--oracle-gold-dim)' : 'var(--oracle-border)',
        borderRadius: 10,
        background: selected ? 'rgba(212,168,83,0.04)' : 'rgba(8,8,16,0.5)',
        transition: 'all 0.2s',
        animation: `oracle-fade-up 0.35s ${delay}ms ease both`,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '14px 18px',
          gap: 14,
          cursor: 'pointer',
        }}
        onClick={() => { onSelect(); setExpanded(e => !e); }}
      >
        {/* Expand chevron */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          style={{
            flexShrink: 0,
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
            color: 'var(--oracle-text-muted)',
          }}
        >
          <path d="M5 3L9 7L5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>

        {/* Policy name */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: '0.9375rem',
              fontWeight: 600,
              color: selected ? 'var(--oracle-text)' : 'var(--oracle-text-muted)',
              transition: 'color 0.2s',
            }}
          >
            {policy.name}
          </div>
          <div
            style={{
              fontSize: '0.75rem',
              color: 'var(--oracle-text-dim)',
              fontFamily: 'var(--oracle-font-mono)',
              marginTop: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {policy.id.slice(0, 18)}…
          </div>
        </div>

        {/* Limit chip */}
        <div
          style={{
            fontSize: '0.8125rem',
            fontWeight: 600,
            color: 'var(--oracle-gold)',
            fontFamily: 'var(--oracle-font-mono)',
            background: 'rgba(212,168,83,0.08)',
            border: '1px solid rgba(212,168,83,0.2)',
            borderRadius: 6,
            padding: '3px 10px',
            flexShrink: 0,
          }}
        >
          {policy.limit} {policy.asset}
        </div>

        <OracleStatusBadge status={policy.status} />
      </div>

      {/* Expanded detail panel */}
      {expanded && (
        <div
          style={{
            borderTop: '1px solid rgba(42,42,107,0.4)',
            padding: '16px 18px',
            background: 'rgba(13,13,34,0.6)',
            animation: 'oracle-fade-up 0.2s ease both',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 16,
              marginBottom: 16,
            }}
          >
            <DetailField label="Asset" value={policy.asset} />
            <DetailField label="Spend Limit" value={`${policy.limit} ${policy.asset}`} mono />
            <DetailField label="Valid Until" value={policy.validUntil} />
          </div>
          <OracleButton
            variant="destructive"
            style={{ fontSize: '0.75rem', padding: '7px 16px' }}
          >
            Uninstall Policy
          </OracleButton>
        </div>
      )}
    </div>
  );
}

function DetailField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="oracle-label" style={{ marginBottom: 4 }}>{label}</div>
      <div
        style={{
          fontSize: '0.875rem',
          color: 'var(--oracle-text)',
          fontFamily: mono ? 'var(--oracle-font-mono)' : undefined,
        }}
      >
        {value}
      </div>
    </div>
  );
}

/* ── Success State ─────────────────────────────────────────── */
function SuccessState({ onReset }: { onReset: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 20,
        padding: '24px 0',
        animation: 'oracle-glow-in 0.5s ease both',
      }}
    >
      {/* Animated success ring */}
      <div style={{ position: 'relative', width: 72, height: 72 }}>
        {/* Outer glow ring */}
        <div
          style={{
            position: 'absolute',
            inset: -6,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(212,168,83,0.2) 0%, transparent 70%)',
            animation: 'oracle-pulse 2s ease-in-out infinite',
          }}
        />
        {/* Circle */}
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            border: '2px solid rgba(212,168,83,0.4)',
            background: 'rgba(212,168,83,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path
              d="M8 16L13 21L24 11"
              stroke="#d4a853"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="30"
              strokeDashoffset="0"
              style={{ animation: 'oracle-check-draw 0.4s 0.2s ease both' }}
            />
          </svg>
        </div>
      </div>

      <div style={{ textAlign: 'center' }}>
        <h3
          className="oracle-heading"
          style={{ fontSize: '1.125rem', marginBottom: 6, color: 'var(--oracle-gold)' }}
        >
          Transaction Woven
        </h3>
        <p style={{ color: 'var(--oracle-text-muted)', fontSize: '0.875rem', maxWidth: 360 }}>
          The delegate has executed your transaction within the policy&apos;s bounds.
          The thread has been cast.
        </p>
      </div>

      {/* Mock tx hash */}
      <div
        style={{
          width: '100%',
          padding: '12px 16px',
          background: 'rgba(8,8,16,0.6)',
          border: '1px solid rgba(42,42,107,0.5)',
          borderRadius: 8,
        }}
      >
        <div className="oracle-label" style={{ marginBottom: 6 }}>Transaction Hash</div>
        <div
          style={{
            fontFamily: 'var(--oracle-font-mono)',
            fontSize: '0.8rem',
            color: 'var(--oracle-violet)',
            wordBreak: 'break-all',
          }}
        >
          0x3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, width: '100%' }}>
        <OracleButton variant="secondary" onClick={onReset} fullWidth>
          Execute Another
        </OracleButton>
        <OracleButton
          variant="primary"
          onClick={() => {}}
          fullWidth
        >
          View on Explorer
        </OracleButton>
      </div>
    </div>
  );
}
