"use client";

import { useState, useEffect } from "react";
import { TerminalLayout } from "./Layout";
import {
  TerminalCard,
  TerminalButton,
  TerminalStatusBadge,
  TerminalSectionHeader,
  TerminalAddressDisplay,
  TerminalInput,
  TerminalDataRow,
  TerminalDivider,
  BrailleSpinner,
} from "./components";

/* ================================================================
   TERMINAL THEME — SELF-CONTAINED PREVIEW
   All mock data. No real blockchain calls.
   ================================================================ */

// ── Mock data ─────────────────────────────────────────────────────

const MOCK_WALLET = "0xAbCdEf1234567890aBcDeF1234567890AbCdEf12";
const MOCK_EXECUTOR = "0xDeFgAbCd5678901234567890aBcDeF56789012ef";
const MOCK_TX_HASH =
  "0x7f3a9c2e8b1d4f6a0e5c9d2b7f3a9c2e8b1d4f6a0e5c9d2b7f3a9c2e8b1d4f6a";

const MOCK_POLICIES = [
  {
    id: "0x1a2b3c4d5e6f7890",
    name: "TREASURY_OPS",
    limit: "5,000",
    asset: "USDC",
    nonce: 42,
    status: "online" as const,
    executor: MOCK_EXECUTOR,
    installBlock: 38_676_186,
  },
  {
    id: "0xdeadbeefcafe1234",
    name: "DEFI_REBALANCER",
    limit: "10,000",
    asset: "USDC",
    nonce: 7,
    status: "pending" as const,
    executor: MOCK_EXECUTOR,
    installBlock: 38_680_001,
  },
];

// ── View types ────────────────────────────────────────────────────

type PreviewView = "policies" | "install" | "executing" | "confirmed";

// ── Main Preview ──────────────────────────────────────────────────

export function TerminalPreview() {
  const [view, setView] = useState<PreviewView>("policies");
  const [installName, setInstallName] = useState("MY_AGENT_POLICY");
  const [installLimit, setInstallLimit] = useState("2500");
  const [installExecutor, setInstallExecutor] = useState(MOCK_EXECUTOR);
  const [txLogLines, setTxLogLines] = useState<string[]>([]);

  // Simulate tx log lines appearing during "executing" state
  useEffect(() => {
    if (view !== "executing") {
      setTxLogLines([]);
      return;
    }

    const lines = [
      "  > signing EIP-712 typed data...",
      "  > broadcasting to mempool...",
      "  > waiting for inclusion...",
      "  > block 38_691_042 — tx landed",
      "  > verifying policy constraints...",
    ];

    let i = 0;
    const id = setInterval(() => {
      if (i < lines.length) {
        setTxLogLines((prev) => [...prev, lines[i]]);
        i++;
      } else {
        clearInterval(id);
        setTimeout(() => setView("confirmed"), 600);
      }
    }, 700);

    return () => clearInterval(id);
  }, [view]);

  return (
    <TerminalLayout>
      {/* ── Controls ─────────────────────────────────── */}
      <div
        style={{
          marginBottom: "24px",
          display: "flex",
          gap: "8px",
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontSize: "10px",
            color: "var(--term-text-muted)",
            letterSpacing: "0.1em",
            alignSelf: "center",
            marginRight: "4px",
          }}
        >
          // DEMO_STATE:
        </span>
        {(
          [
            { key: "policies", label: "POLICIES" },
            { key: "install", label: "INSTALL_FORM" },
            { key: "executing", label: "EXECUTING" },
            { key: "confirmed", label: "TX_CONFIRMED" },
          ] as { key: PreviewView; label: string }[]
        ).map((item) => (
          <TerminalButton
            key={item.key}
            variant={view === item.key ? "primary" : "ghost"}
            onClick={() => setView(item.key)}
            style={{ fontSize: "10px", padding: "4px 12px" }}
          >
            {item.label}
          </TerminalButton>
        ))}
      </div>

      {/* ── Wallet Status Bar ─────────────────────────── */}
      <TerminalCard style={{ marginBottom: "20px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            <TerminalStatusBadge status="online" label="WALLET CONNECTED" />
            <TerminalAddressDisplay address={MOCK_WALLET} label="account" />
          </div>
          <div
            style={{
              fontSize: "10px",
              color: "var(--term-text-muted)",
              letterSpacing: "0.1em",
            }}
          >
            CHAIN: BASE_SEPOLIA (84532)
          </div>
        </div>
      </TerminalCard>

      {/* ── Views ─────────────────────────────────────── */}
      {view === "policies" && <PoliciesView onInstall={() => setView("install")} />}
      {view === "install" && (
        <InstallView
          name={installName}
          setName={setInstallName}
          limit={installLimit}
          setLimit={setInstallLimit}
          executor={installExecutor}
          setExecutor={setInstallExecutor}
          onSubmit={() => setView("executing")}
          onCancel={() => setView("policies")}
        />
      )}
      {view === "executing" && <ExecutingView logLines={txLogLines} />}
      {view === "confirmed" && (
        <ConfirmedView
          txHash={MOCK_TX_HASH}
          onReset={() => setView("policies")}
        />
      )}
    </TerminalLayout>
  );
}

// ── Policies View ─────────────────────────────────────────────────

function PoliciesView({ onInstall }: { onInstall: () => void }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <TerminalSectionHeader
          title="INSTALLED_POLICIES"
          lineNumber={1}
          style={{ marginBottom: 0, flex: 1 }}
        />
        <TerminalButton variant="primary" onClick={onInstall}>
          + INSTALL_POLICY
        </TerminalButton>
      </div>

      {/* Output header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 120px 100px 80px",
          gap: "8px",
          padding: "6px 12px",
          backgroundColor: "#020208",
          borderBottom: "1px solid var(--term-border-hard)",
          fontSize: "9px",
          letterSpacing: "0.15em",
          color: "var(--term-text-muted)",
        }}
      >
        <span>POLICY_NAME</span>
        <span>POLICY_ID</span>
        <span>SPEND_LIMIT</span>
        <span>STATUS</span>
        <span>NONCE</span>
      </div>

      {MOCK_POLICIES.map((policy, idx) => (
        <div key={policy.id} className="term-slide-in" style={{ animationDelay: `${idx * 80}ms` }}>
          {/* Row */}
          <div
            className="term-card"
            style={{ cursor: "pointer" }}
            onClick={() =>
              setExpandedId(expandedId === policy.id ? null : policy.id)
            }
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 120px 100px 80px",
                gap: "8px",
                padding: "12px 16px",
                alignItems: "center",
                fontSize: "12px",
              }}
            >
              <span style={{ color: "var(--term-green)", fontWeight: 700 }}>
                {policy.name}
              </span>
              <span
                style={{
                  color: "var(--term-cyan)",
                  fontSize: "11px",
                  letterSpacing: "0.02em",
                }}
              >
                {policy.id.slice(0, 10)}...
              </span>
              <span style={{ color: "var(--term-pink)", fontWeight: 700 }}>
                {policy.limit} {policy.asset}
              </span>
              <TerminalStatusBadge status={policy.status} />
              <span style={{ color: "var(--term-text-muted)" }}>
                #{policy.nonce}
              </span>
            </div>

            {/* Expanded detail */}
            {expandedId === policy.id && (
              <div
                className="term-fade-in"
                style={{
                  borderTop: "1px solid var(--term-border-hard)",
                  padding: "16px",
                  backgroundColor: "#020208",
                }}
              >
                <TerminalSectionHeader
                  title="POLICY_DETAILS"
                  prefix=">"
                  lineNumber={idx + 10}
                />
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <TerminalDataRow label="policy_id" value={policy.id} accent="cyan" />
                  <TerminalDataRow
                    label="spend_limit"
                    value={`${policy.limit} ${policy.asset}`}
                    accent="pink"
                  />
                  <TerminalDataRow
                    label="executor"
                    value={
                      <TerminalAddressDisplay address={policy.executor} />
                    }
                    accent="cyan"
                  />
                  <TerminalDataRow
                    label="install_block"
                    value={policy.installBlock.toLocaleString()}
                    accent="muted"
                  />
                  <TerminalDataRow
                    label="current_nonce"
                    value={`#${policy.nonce}`}
                    accent="muted"
                  />
                </div>
                <TerminalDivider />
                <div style={{ display: "flex", gap: "8px" }}>
                  <TerminalButton variant="ghost" style={{ fontSize: "10px" }}>
                    VIEW_EXECUTIONS
                  </TerminalButton>
                  <TerminalButton
                    variant="destructive"
                    style={{ fontSize: "10px" }}
                  >
                    UNINSTALL
                  </TerminalButton>
                </div>
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Empty state hint */}
      <div
        style={{
          padding: "12px 16px",
          fontSize: "11px",
          color: "var(--term-text-muted)",
          letterSpacing: "0.1em",
          borderLeft: "2px solid var(--term-border-solid)",
        }}
      >
        // Click any row to expand policy details. Run INSTALL_POLICY to add a new
        agent authorization.
      </div>
    </div>
  );
}

// ── Install View ──────────────────────────────────────────────────

interface InstallViewProps {
  name: string;
  setName: (v: string) => void;
  limit: string;
  setLimit: (v: string) => void;
  executor: string;
  setExecutor: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

function InstallView({
  name,
  setName,
  limit,
  setLimit,
  executor,
  setExecutor,
  onSubmit,
  onCancel,
}: InstallViewProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <TerminalSectionHeader
        title="INSTALL_POLICY"
        lineNumber={1}
        prefix="//"
      />

      {/* Command context */}
      <div
        style={{
          padding: "10px 14px",
          backgroundColor: "#020208",
          borderLeft: "2px solid var(--term-green)",
          fontSize: "11px",
          color: "var(--term-text-muted)",
          lineHeight: "1.7",
          letterSpacing: "0.05em",
        }}
      >
        <div>
          <span style={{ color: "var(--term-green)" }}>$ </span>
          policy install --type moirai-delegate --chain base-sepolia
        </div>
        <div style={{ paddingLeft: "14px" }}>
          Provisioning autonomous agent with bounded execution authority.
        </div>
        <div style={{ paddingLeft: "14px", color: "var(--term-text-dim)" }}>
          All transactions subject to policy constraints enforced on-chain.
        </div>
      </div>

      <TerminalCard title="POLICY_CONFIGURATION">
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <TerminalInput
            label="Policy Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="MY_AGENT_POLICY"
            hint="Identifier for this policy instance"
          />
          <TerminalInput
            label="Spend Limit (USDC)"
            type="number"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            placeholder="1000"
            hint="Maximum per-execution spend ceiling — enforced on-chain"
          />
          <TerminalInput
            label="Executor Address"
            value={executor}
            onChange={(e) => setExecutor(e.target.value)}
            placeholder="0x..."
            hint="Agent EOA authorized to submit executions"
          />

          <TerminalDivider label="preview" />

          {/* Live preview of policy config */}
          <div
            style={{
              padding: "12px",
              backgroundColor: "#020208",
              fontSize: "11px",
              color: "var(--term-text-muted)",
              lineHeight: "1.7",
              fontFamily: "var(--term-font)",
            }}
          >
            <div style={{ marginBottom: "6px", color: "var(--term-green)", letterSpacing: "0.1em" }}>
              // POLICY_CONFIG_PREVIEW
            </div>
            <TerminalDataRow label="policy_name" value={name || "—"} />
            <TerminalDataRow
              label="spend_limit"
              value={limit ? `${parseInt(limit).toLocaleString()} USDC` : "—"}
              accent="pink"
            />
            <TerminalDataRow
              label="executor"
              value={
                executor ? (
                  <TerminalAddressDisplay address={executor} />
                ) : (
                  "—"
                )
              }
              accent="cyan"
            />
            <TerminalDataRow
              label="policy_type"
              value="MoiraiDelegate_v4"
              accent="muted"
            />
          </div>
        </div>
      </TerminalCard>

      <div style={{ display: "flex", gap: "12px" }}>
        <TerminalButton variant="primary" onClick={onSubmit}>
          AUTHORIZE &amp; INSTALL
        </TerminalButton>
        <TerminalButton variant="ghost" onClick={onCancel}>
          CANCEL
        </TerminalButton>
      </div>
    </div>
  );
}

// ── Executing View ────────────────────────────────────────────────

function ExecutingView({ logLines }: { logLines: string[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <TerminalSectionHeader
        title="EXECUTING_TRANSACTION"
        lineNumber={1}
        prefix="//"
      />

      <TerminalCard title="TX_STATUS" glowing>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "32px 16px",
            gap: "20px",
          }}
        >
          {/* Large braille spinner */}
          <div
            style={{
              fontSize: "48px",
              color: "var(--term-cyan)",
              textShadow: "0 0 20px rgba(0,212,255,0.8)",
              lineHeight: 1,
            }}
          >
            <BrailleSpinner fps={12} />
          </div>

          <div
            style={{
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            <div
              style={{
                fontSize: "14px",
                fontWeight: 700,
                letterSpacing: "0.25em",
                color: "var(--term-cyan)",
                textShadow: "0 0 12px rgba(0,212,255,0.6)",
              }}
            >
              AWAITING AUTHORIZATION
            </div>
            <div
              style={{
                fontSize: "11px",
                color: "var(--term-text-muted)",
                letterSpacing: "0.1em",
              }}
            >
              broadcasting signed EIP-712 execution to Base Sepolia
            </div>
          </div>
        </div>

        <TerminalDivider label="tx_log" />

        {/* Live log output */}
        <div
          style={{
            backgroundColor: "#020208",
            padding: "12px",
            minHeight: "120px",
            fontSize: "11px",
            lineHeight: "1.8",
            letterSpacing: "0.05em",
          }}
        >
          {logLines.length === 0 && (
            <span style={{ color: "var(--term-text-dim)" }}>
              // waiting for tx submission...
            </span>
          )}
          {logLines.map((line, i) => (
            <div
              key={i}
              className="term-slide-in"
              style={{
                color:
                  line.includes("landed")
                    ? "var(--term-green)"
                    : "var(--term-text-muted)",
                animationDelay: `0ms`,
              }}
            >
              {line}
            </div>
          ))}
          {logLines.length > 0 && logLines.length < 5 && (
            <span
              style={{ color: "var(--term-green)" }}
              className="term-blink"
            >
              _
            </span>
          )}
        </div>
      </TerminalCard>

      <div
        style={{
          fontSize: "10px",
          color: "var(--term-text-muted)",
          letterSpacing: "0.1em",
        }}
      >
        // Policy constraints enforced on-chain. Do not close this window.
      </div>
    </div>
  );
}

// ── Confirmed View ────────────────────────────────────────────────

function ConfirmedView({
  txHash,
  onReset,
}: {
  txHash: string;
  onReset: () => void;
}) {
  return (
    <div
      className="term-fade-in"
      style={{ display: "flex", flexDirection: "column", gap: "20px" }}
    >
      <TerminalSectionHeader
        title="TX_CONFIRMED"
        lineNumber={1}
        prefix="//"
      />

      <TerminalCard title="EXECUTION_RESULT" glowing>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "20px",
          }}
        >
          {/* Success banner */}
          <div
            style={{
              textAlign: "center",
              padding: "24px",
              borderBottom: "1px solid var(--term-border-hard)",
            }}
          >
            <div
              style={{
                fontSize: "32px",
                color: "var(--term-green)",
                textShadow: "0 0 30px rgba(0,255,65,0.8)",
                marginBottom: "12px",
                letterSpacing: "0.15em",
                fontWeight: 700,
              }}
            >
              ✓ POLICY ACTIVE
            </div>
            <div
              style={{
                fontSize: "11px",
                color: "var(--term-text-muted)",
                letterSpacing: "0.12em",
              }}
            >
              Agent authorized. Policy constraints enforced on-chain.
            </div>
          </div>

          {/* TX details */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <TerminalDataRow
              label="result"
              value="POLICY_INSTALLED"
              accent="green"
            />
            <TerminalDataRow
              label="block"
              value="38,691,042"
              accent="muted"
            />
            <TerminalDataRow
              label="tx_hash"
              value={
                <span
                  style={{
                    color: "var(--term-cyan)",
                    fontSize: "11px",
                    letterSpacing: "0.02em",
                  }}
                >
                  {txHash.slice(0, 20)}...{txHash.slice(-8)}
                </span>
              }
              accent="cyan"
            />
            <TerminalDataRow
              label="gas_used"
              value="142,813"
              accent="muted"
            />
            <TerminalDataRow
              label="policy_status"
              value={<TerminalStatusBadge status="online" />}
              accent="green"
            />
          </div>

          <TerminalDivider />

          {/* ASCII art success */}
          <div
            style={{
              padding: "10px",
              backgroundColor: "#020208",
              fontSize: "10px",
              color: "var(--term-green-muted)",
              lineHeight: "1.5",
              letterSpacing: "0.05em",
            }}
          >
            <div>// AGENT AUTHORIZATION COMPLETE</div>
            <div>// The autonomous agent may now execute within bounds:</div>
            <div style={{ paddingLeft: "14px", color: "var(--term-text-muted)" }}>
              — spend_limit: 2,500 USDC per execution
            </div>
            <div style={{ paddingLeft: "14px", color: "var(--term-text-muted)" }}>
              — authorized_executor: {MOCK_EXECUTOR.slice(0, 10)}...
            </div>
            <div style={{ paddingLeft: "14px", color: "var(--term-text-muted)" }}>
              — enforced by: PolicyManager (Base Sepolia)
            </div>
          </div>

          <div style={{ display: "flex", gap: "12px" }}>
            <TerminalButton variant="primary" onClick={onReset}>
              VIEW_ALL_POLICIES
            </TerminalButton>
            <TerminalButton variant="ghost">
              BASESCAN_TX ↗
            </TerminalButton>
          </div>
        </div>
      </TerminalCard>
    </div>
  );
}
