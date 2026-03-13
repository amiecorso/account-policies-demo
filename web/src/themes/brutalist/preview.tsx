"use client";

import React, { useState, useEffect } from "react";
import {
  encodeFunctionData,
  getAddress,
  parseAbiItem,
  parseEther,
  parseUnits,
  type Hex,
} from "viem";
import { useAccount, useConnect, useDisconnect, useWriteContract } from "wagmi";
import { baseSepoliaPublicClient } from "../../lib/baseSepolia";
import { deployed, tokens } from "../../contracts/addresses";
import {
  buildDelegateConfigFromSend,
  encodeMoiraiDelegatePolicyConfig,
  hashPolicyConfig,
  type Asset,
} from "../../lib/moiraiDelegateEncoding";
import { policyManagerAbi } from "../../contracts/abi";
import { BrutalistLayout } from "./Layout";
import {
  BrutalistCard,
  BrutalistButton,
  BrutalistStatusBadge,
  BrutalistSectionHeader,
  BrutalistAddressDisplay,
  BrutalistDataRow,
  BrutalistField,
  BrutalistDivider,
  BrutalistPolicyItem,
} from "./components";
import { MOIRAI_DELEGATE_SOURCE } from "./moiraiDelegateSource";
import "./theme.css";

/* ─────────────────────────────────────────────────────────────────────────
   Mock data
   ───────────────────────────────────────────────────────────────────────── */

const MOCK = {
  wallet: "0xAbCdEf0123456789AbCdEf0123456789AbCd1234",
  chainId: 84532,
  chainLabel: "Base Sepolia",
  executor: process.env.NEXT_PUBLIC_EXECUTOR_ADDRESS ?? "",
  mockTxHash:
    "0x3a9f2b8c1e4d0a7f6b5e3c2d1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2",
};

/* ─────────────────────────────────────────────────────────────────────────
   Helpers
   ───────────────────────────────────────────────────────────────────────── */

const isValidAddress = (a: string) => /^0x[0-9a-fA-F]{40}$/.test(a);
const nowSeconds = () => Math.floor(Date.now() / 1000);

const DELAY_OFFSETS = [
  { label: "+10s", delta: 10 },
  { label: "+45s", delta: 45 },
  { label: "+90s", delta: 90 },
  { label: "+24h", delta: 60 * 60 * 24 },
];

/* ─────────────────────────────────────────────────────────────────────────
   Minimal Coinbase Smart Wallet ABI (execute only)
   ───────────────────────────────────────────────────────────────────────── */

const coinbaseSmartWalletAbi = [
  {
    type: "function",
    name: "execute",
    inputs: [
      { name: "target", type: "address" },
      { name: "value", type: "uint256" },
      { name: "data", type: "bytes" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
] as const;

/* ─────────────────────────────────────────────────────────────────────────
   Tx URL helper
   ───────────────────────────────────────────────────────────────────────── */

function txUrl(hash: string): string {
  const origin =
    deployed.chainId === 8453
      ? "https://basescan.org"
      : "https://sepolia.basescan.org";
  return `${origin}/tx/${hash}`;
}

/* ─────────────────────────────────────────────────────────────────────────
   Solidity tokenizer — lightweight regex, no external dependency
   ───────────────────────────────────────────────────────────────────────── */

type SolToken =
  | "comment"
  | "string"
  | "keyword"
  | "natspec"
  | "number"
  | "default";

const SOL_KEYWORDS = new Set([
  "pragma",
  "import",
  "using",
  "contract",
  "library",
  "interface",
  "abstract",
  "struct",
  "enum",
  "mapping",
  "event",
  "error",
  "modifier",
  "constructor",
  "function",
  "returns",
  "return",
  "if",
  "else",
  "for",
  "while",
  "do",
  "break",
  "continue",
  "revert",
  "emit",
  "delete",
  "new",
  "this",
  "is",
  "memory",
  "storage",
  "calldata",
  "internal",
  "external",
  "public",
  "private",
  "override",
  "virtual",
  "view",
  "pure",
  "payable",
  "immutable",
  "constant",
  "bytes32",
  "bytes4",
  "bytes",
  "address",
  "uint256",
  "uint128",
  "uint8",
  "uint",
  "int256",
  "int128",
  "int8",
  "int",
  "bool",
  "string",
  "true",
  "false",
]);

// Matches (in priority order): block comments, line comments, string literals, identifiers, numbers
const SOL_RE =
  /(\/\*\*[\s\S]*?\*\/|\/\/\/[^\n]*|\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b[a-zA-Z_$][a-zA-Z0-9_$]*\b|\b\d+\b)/g;

function tokenizeSolidity(
  src: string,
): Array<{ type: SolToken; text: string }> {
  const out: Array<{ type: SolToken; text: string }> = [];
  let last = 0;
  for (const m of src.matchAll(SOL_RE)) {
    const { 0: text, index = 0 } = m;
    if (index > last)
      out.push({ type: "default", text: src.slice(last, index) });
    const type: SolToken =
      text.startsWith("/**") || text.startsWith("///")
        ? "natspec"
        : text.startsWith("//") || text.startsWith("/*")
          ? "comment"
          : text.startsWith('"') || text.startsWith("'")
            ? "string"
            : /^\d/.test(text)
              ? "number"
              : SOL_KEYWORDS.has(text)
                ? "keyword"
                : "default";
    out.push({ type, text });
    last = index + text.length;
  }
  if (last < src.length) out.push({ type: "default", text: src.slice(last) });
  return out;
}

const SOL_TOKEN_STYLE: Record<SolToken, React.CSSProperties> = {
  comment: { color: "#888", fontStyle: "italic" },
  natspec: { color: "#6a9955", fontStyle: "italic" },
  string: { color: "#166534" },
  keyword: { color: "#0057ff", fontWeight: 700 },
  number: { color: "#e11d48" },
  default: {},
};

/* ─────────────────────────────────────────────────────────────────────────
   ImplementationRow — collapsible contract source in §1
   ───────────────────────────────────────────────────────────────────────── */

function ImplementationRow() {
  const [open, setOpen] = useState(false);
  const tokens = open ? tokenizeSolidity(MOIRAI_DELEGATE_SOURCE) : null;
  return (
    <div>
      <div
        className="brut-data-row"
        onClick={() => setOpen((v) => !v)}
        style={{ cursor: "pointer", userSelect: "none" }}
      >
        <span className="brut-data-key">Implementation</span>
        <span
          className="brut-data-value"
          style={{ display: "flex", alignItems: "center", gap: 8 }}
        >
          MoiraiDelegate.sol
          <span style={{ fontSize: 10, opacity: 0.6 }}>{open ? "▼" : "▶"}</span>
        </span>
      </div>
      {open && tokens && (
        <pre
          style={{
            fontFamily: "var(--brut-font-mono)",
            fontSize: 12,
            lineHeight: 1.6,
            background: "#1e1e1e",
            border: "var(--brut-rule)",
            padding: "16px",
            margin: "0 0 8px",
            overflowX: "auto",
            whiteSpace: "pre",
            color: "#d4d4d4",
            maxHeight: 480,
            overflowY: "auto",
          }}
        >
          <code>
            {tokens.map((tok, i) => (
              <span key={i} style={SOL_TOKEN_STYLE[tok.type]}>
                {tok.text}
              </span>
            ))}
          </code>
        </pre>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   State machine
   ───────────────────────────────────────────────────────────────────────── */

type DemoView = "document" | "install" | "execute";
type AsyncState = "idle" | "loading" | "success";

/* ─────────────────────────────────────────────────────────────────────────
   Section §1 — PARTIES
   ───────────────────────────────────────────────────────────────────────── */

function PartiesSection({ activeAccount }: { activeAccount?: string }) {
  const displayAddress = activeAccount ?? MOCK.wallet;
  return (
    <section className="brut-clause brut-fade-in">
      <BrutalistSectionHeader
        sectionNumber="01"
        label="Section 1"
        title="PARTIES"
      />
      <hr className="brut-hr" style={{ marginBottom: 0 }} />

      <BrutalistCard style={{ marginTop: 0, borderTop: "none" }}>
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}
        >
          {/* Principal */}
          <div
            style={{ padding: "20px 24px", borderRight: "var(--brut-rule)" }}
          >
            <div
              style={{
                fontFamily: "var(--brut-font-body)",
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "var(--brut-muted)",
                marginBottom: 8,
              }}
            >
              Principal (Smart Wallet)
            </div>
            <div style={{ marginBottom: 4 }}>
              <BrutalistAddressDisplay
                address={displayAddress}
                truncate={false}
              />
            </div>
            <div
              style={{
                fontFamily: "var(--brut-font-body)",
                fontSize: 14,
                color: "var(--brut-muted)",
                marginTop: 6,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <BrutalistStatusBadge status="active" label="CONNECTED" />
              <span
                style={{ letterSpacing: "0.12em", textTransform: "uppercase" }}
              >
                {MOCK.chainLabel}
              </span>
            </div>
          </div>

          {/* Agent */}
          <div style={{ padding: "20px 24px" }}>
            <div
              style={{
                fontFamily: "var(--brut-font-body)",
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "var(--brut-muted)",
                marginBottom: 8,
              }}
            >
              Authorized Agent (Executor)
            </div>
            <div style={{ marginBottom: 4 }}>
              <BrutalistAddressDisplay
                address={MOCK.executor}
                truncate={false}
              />
            </div>
            <div
              style={{
                fontFamily: "var(--brut-font-body)",
                fontSize: 14,
                color: "var(--brut-muted)",
                marginTop: 6,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <BrutalistStatusBadge status="active" label="DELEGATED" />
            </div>
          </div>
        </div>

        <BrutalistDivider />

        <div style={{ padding: "16px 4px 4px" }}>
          <BrutalistDataRow label="Chain ID" value={MOCK.chainId} />
          <BrutalistDataRow label="Protocol" value="Moirai Delegate v1" />
          <BrutalistDataRow
            label="Document"
            value="Policy Brief — Active Policies Agreement"
          />
          <ImplementationRow />
        </div>
      </BrutalistCard>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   StoredPolicyRecord — shared type used by §2 and §4
   ───────────────────────────────────────────────────────────────────────── */

type StoredPolicyRecord = {
  policyId: string;
  policy: string;
  policyConfig: string;
  createdAtMs: number;
  uninstalled?: boolean;
  installTxHash?: string;
  binding?: { validAfter: string; validUntil: string; salt: string };
};

/* ─────────────────────────────────────────────────────────────────────────
   useInstalledPolicies — shared hook for §2 and §4
   Fetches on-chain PolicyInstalled logs + server policy store, merges them.
   ───────────────────────────────────────────────────────────────────────── */

function useInstalledPolicies(activeAccount?: string) {
  const [policies, setPolicies] = useState<StoredPolicyRecord[]>([]);
  const [loadState, setLoadState] = useState<
    "idle" | "loading" | "loaded" | "error"
  >("idle");

  const DEFAULT_FROM_BLOCK = BigInt(
    (process.env.NEXT_PUBLIC_POLICY_EVENTS_FROM_BLOCK ?? "0").split(/\s/)[0],
  );

  useEffect(() => {
    if (!activeAccount) {
      setPolicies([]);
      setLoadState("idle");
      return;
    }
    let cancelled = false;
    setLoadState("loading");

    async function loadPolicies() {
      const [logsResult, storeResult] = await Promise.allSettled([
        baseSepoliaPublicClient.getLogs({
          address: deployed.policyManager,
          event: parseAbiItem(
            "event PolicyInstalled(bytes32 indexed policyId,address indexed account,address indexed policy)",
          ),
          args: { account: activeAccount as `0x${string}` },
          fromBlock: DEFAULT_FROM_BLOCK,
          toBlock: "latest",
        }),
        fetch(
          `/api/policies?account=${encodeURIComponent(activeAccount!)}&chainId=${deployed.chainId}`,
        ).then((r) => r.json() as Promise<{ policies?: StoredPolicyRecord[] }>),
      ]);

      const onChain: StoredPolicyRecord[] =
        logsResult.status === "fulfilled"
          ? logsResult.value
              .filter(
                (l) =>
                  (l.args.policy as string).toLowerCase() ===
                  deployed.moiraiDelegatePolicy.toLowerCase(),
              )
              .map((l) => ({
                policyId: l.args.policyId as string,
                policy: l.args.policy as string,
                policyConfig: "",
                createdAtMs: 0,
                installTxHash: l.transactionHash ?? undefined,
              }))
              .reverse()
          : [];

      const stored: StoredPolicyRecord[] =
        storeResult.status === "fulfilled"
          ? (storeResult.value.policies ?? []).filter(
              (p) =>
                p.policy.toLowerCase() ===
                deployed.moiraiDelegatePolicy.toLowerCase(),
            )
          : [];

      if (
        logsResult.status === "rejected" &&
        storeResult.status === "rejected"
      ) {
        throw new Error("Both sources failed");
      }

      const deduped = new Map<string, StoredPolicyRecord>();
      for (const p of onChain) deduped.set(p.policyId.toLowerCase(), p);
      for (const p of stored) {
        const key = p.policyId.toLowerCase();
        const existing = deduped.get(key);
        deduped.set(key, { ...existing, ...p });
      }

      if (cancelled) return;
      setPolicies(Array.from(deduped.values()));
      setLoadState("loaded");
    }

    loadPolicies().catch(() => {
      if (!cancelled) setLoadState("error");
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAccount]);

  return { policies, loadState };
}

/* ─────────────────────────────────────────────────────────────────────────
   Section §2 — ACTIVE POLICIES
   ───────────────────────────────────────────────────────────────────────── */

function ActivePoliciesSection({
  onNavigate,
  activeAccount,
  onNavigateToExecute,
}: {
  onNavigate: (v: DemoView) => void;
  activeAccount?: string;
  onNavigateToExecute: (policyId: string) => void;
}) {
  const { policies, loadState } = useInstalledPolicies(activeAccount);
  return (
    <section className="brut-clause brut-fade-in">
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <BrutalistSectionHeader
          sectionNumber="02"
          label="Section 2"
          title="ACTIVE POLICIES"
          style={{ paddingBottom: 0, flex: 1 }}
        />
        <div style={{ paddingBottom: 16 }}>
          <BrutalistButton
            variant="secondary"
            onClick={() => onNavigate("install")}
            style={{ fontSize: 14, padding: "10px 18px" }}
          >
            + INSTALL POLICY
          </BrutalistButton>
        </div>
      </div>

      <hr className="brut-hr" style={{ marginBottom: 0 }} />

      <BrutalistCard style={{ borderTop: "none", overflowX: "auto" }}>
        {!activeAccount ? (
          /* Not connected — prompt to connect */
          <div style={{ padding: "56px 24px", textAlign: "center" }}>
            <div
              style={{
                fontFamily: "var(--brut-font-display)",
                fontSize: 56,
                letterSpacing: "0.06em",
                color: "var(--brut-faint)",
                opacity: 0.35,
                lineHeight: 1,
                marginBottom: 20,
              }}
            >
              —
            </div>
            <div
              style={{
                fontFamily: "var(--brut-font-body)",
                fontSize: 14,
                color: "var(--brut-muted)",
                letterSpacing: "0.04em",
              }}
            >
              Connect a wallet to view installed policies.
            </div>
          </div>
        ) : loadState === "loading" ? (
          /* Loading */
          <div
            style={{
              fontFamily: "var(--brut-font-body)",
              fontSize: 14,
              color: "var(--brut-muted)",
              padding: "32px 24px",
              textAlign: "center",
            }}
          >
            Loading policies…
          </div>
        ) : loadState === "error" ? (
          /* Error */
          <div
            style={{
              fontFamily: "var(--brut-font-body)",
              fontSize: 14,
              color: "var(--brut-red)",
              padding: "20px 24px",
            }}
          >
            Failed to load policies.
          </div>
        ) : policies.length === 0 ? (
          /* Empty state — truly no policies */
          <div style={{ padding: "56px 24px", textAlign: "center" }}>
            <div
              style={{
                fontFamily: "var(--brut-font-display)",
                fontSize: 56,
                letterSpacing: "0.06em",
                color: "var(--brut-faint)",
                opacity: 0.35,
                lineHeight: 1,
                marginBottom: 20,
              }}
            >
              —
            </div>
            <div
              style={{
                fontFamily: "var(--brut-font-body)",
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--brut-muted)",
                marginBottom: 8,
              }}
            >
              No Policies Installed
            </div>
            <div
              style={{
                fontFamily: "var(--brut-font-body)",
                fontSize: 14,
                color: "var(--brut-faint)",
                lineHeight: 1.6,
                maxWidth: 340,
                margin: "0 auto 24px",
              }}
            >
              Install a Moirai Delegate policy to grant the agent permission to
              execute transfers on your behalf.
            </div>
            <BrutalistButton
              variant="primary"
              onClick={() => onNavigate("install")}
            >
              INSTALL YOUR FIRST POLICY
            </BrutalistButton>
          </div>
        ) : (
          /* Policy list */
          <div style={{ padding: "4px 0" }}>
            {policies.map((p, i) => (
              <BrutalistPolicyItem
                key={p.policyId}
                index={i + 1}
                name={`${p.policyId.slice(0, 10)}…${p.policyId.slice(-6)}`}
                limit={
                  p.createdAtMs
                    ? new Date(p.createdAtMs).toLocaleDateString()
                    : "—"
                }
                unit=""
                status={p.uninstalled ? "inactive" : "active"}
                action={
                  !p.uninstalled && (
                    <BrutalistButton
                      variant="secondary"
                      onClick={() => onNavigateToExecute(p.policyId)}
                      style={{ fontSize: 12, padding: "6px 12px" }}
                    >
                      EXECUTE →
                    </BrutalistButton>
                  )
                }
              />
            ))}
          </div>
        )}
      </BrutalistCard>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Section §3 — INSTALL POLICY
   ───────────────────────────────────────────────────────────────────────── */

function InstallPolicySection({
  onBack,
  activeAccount,
  subAccountAddress,
  onInstallSuccess,
}: {
  onBack: () => void;
  activeAccount?: string;
  subAccountAddress: `0x${string}` | null;
  onInstallSuccess: (policyId: string) => void;
}) {
  // Transaction to delegate
  const [selectedAsset, setSelectedAsset] = useState<Asset>("ETH");
  const [amount, setAmount] = useState("0.00001");
  const [recipient, setRecipient] = useState(
    "0xBa057Cf252568f6658aE3822fAA4dcC0D326bD85",
  );

  // Policy conditions (at least one required)
  const [unlockTimestamp, setUnlockTimestamp] = useState("0");
  const [consensusSigner, setConsensusSigner] = useState("");

  // Policy binding
  const [executor, setExecutor] = useState(
    process.env.NEXT_PUBLIC_EXECUTOR_ADDRESS ?? "",
  );
  const [validAfter, setValidAfter] = useState("0");
  const [validUntil, setValidUntil] = useState(() =>
    String(Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60),
  );
  const [salt, setSalt] = useState(() =>
    String(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)),
  );

  const [installState, setInstallState] = useState<AsyncState>("idle");
  const [installError, setInstallError] = useState<string | null>(null);

  const { writeContractAsync } = useWriteContract();

  const canInstall =
    isValidAddress(executor) &&
    isValidAddress(recipient) &&
    parseFloat(amount) > 0 &&
    (Number(unlockTimestamp) > 0 || isValidAddress(consensusSigner));

  const handleInstall = async () => {
    if (!activeAccount) return;
    setInstallState("loading");
    setInstallError(null);

    try {
      // 1. Build policyConfig from form inputs
      const tokenAddress =
        selectedAsset === "USDC"
          ? tokens.usdc
          : selectedAsset === "MIGGLES"
            ? tokens.miggles
            : undefined;
      const rawAmount =
        selectedAsset === "ETH"
          ? parseEther(amount)
          : parseUnits(amount, selectedAsset === "USDC" ? 6 : 18);

      const { target, value, callData } = buildDelegateConfigFromSend({
        asset: selectedAsset,
        recipient: getAddress(recipient as `0x${string}`),
        amount: rawAmount,
        tokenAddress,
      });

      const ZERO =
        "0x0000000000000000000000000000000000000000" as `0x${string}`;
      // MoiraiDelegate requires executor == consensusSigner in the encoded config.
      // For time-delay-only (no consensus signer), both must be address(0).
      const effectiveConsensusSigner =
        consensusSigner && isValidAddress(consensusSigner)
          ? getAddress(consensusSigner as `0x${string}`)
          : ZERO;
      const policyConfig = encodeMoiraiDelegatePolicyConfig({
        executor: effectiveConsensusSigner,
        target,
        value,
        callData,
        unlockTimestamp: BigInt(unlockTimestamp || "0"),
        consensusSigner: effectiveConsensusSigner,
      });

      // 2. Build binding
      const binding = {
        account: getAddress(activeAccount as `0x${string}`),
        policy: deployed.moiraiDelegatePolicy,
        validAfter: BigInt(validAfter || "0"),
        validUntil: BigInt(validUntil || "0"),
        salt: BigInt(salt || "0"),
        policyConfig,
      } as const;

      // 3. Pre-calculate policyId
      const policyId = (await baseSepoliaPublicClient.readContract({
        address: deployed.policyManager,
        abi: policyManagerAbi,
        functionName: "getPolicyId",
        args: [binding],
      })) as Hex;

      // 4. Install — via subAccount.execute if sub-account is available
      const hash = subAccountAddress
        ? await writeContractAsync({
            address: subAccountAddress,
            abi: coinbaseSmartWalletAbi,
            functionName: "execute",
            args: [
              deployed.policyManager,
              BigInt(0),
              encodeFunctionData({
                abi: policyManagerAbi,
                functionName: "install",
                args: [binding],
              }),
            ],
          })
        : await writeContractAsync({
            address: deployed.policyManager,
            abi: policyManagerAbi,
            functionName: "install",
            args: [binding],
          });

      // 5. Persist to store (fire-and-forget)
      fetch("/api/policies", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "upsert",
          chainId: deployed.chainId,
          account: binding.account,
          policyId,
          policy: deployed.moiraiDelegatePolicy,
          policyConfig,
          binding: {
            validAfter: String(binding.validAfter),
            validUntil: String(binding.validUntil),
            salt: String(binding.salt),
            policyConfigHash: hashPolicyConfig(policyConfig),
          },
          installTxHash: hash,
        }),
      });

      // 6. Success → navigate to execute with new policy pre-selected
      onInstallSuccess(policyId);
    } catch (e) {
      setInstallError(e instanceof Error ? e.message : String(e));
      setInstallState("idle");
    }
  };

  const randomizeSalt = () =>
    setSalt(String(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)));

  return (
    <section className="brut-clause brut-fade-in">
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <BrutalistSectionHeader
          sectionNumber="03"
          label="Stage a deferred transfer that the executor can carry out once the conditions below are met."
          title="INSTALL POLICY"
          style={{ paddingBottom: 0, flex: 1 }}
        />
        <div style={{ paddingBottom: 16 }}>
          <BrutalistButton
            variant="secondary"
            onClick={onBack}
            style={{ fontSize: 14, padding: "10px 18px" }}
          >
            ← BACK
          </BrutalistButton>
        </div>
      </div>

      <hr className="brut-hr" style={{ marginBottom: 0 }} />

      <BrutalistCard style={{ borderTop: "none" }}>
        {/* Legal preamble */}
        <div
          style={{
            background: "var(--brut-bg)",
            border: "var(--brut-rule-thin)",
            padding: "14px 16px",
            marginBottom: 24,
          }}
        >
          <p
            style={{
              fontFamily: "var(--brut-font-body)",
              fontSize: 14,
              lineHeight: 1.65,
              color: "var(--brut-muted)",
              margin: 0,
            }}
          >
            By installing this policy, the Principal stages a specific transfer
            to be executed at a future time. The exact asset, amount, and
            recipient are fixed at install. The Authorized Agent may trigger the
            transfer only after all conditions defined herein are satisfied.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* ─ Transaction to Delegate ─ */}
          <BrutalistDivider label="Transaction to Delegate" />

          <BrutalistField label="Asset" htmlFor="asset">
            <select
              id="asset"
              className="brut-select"
              value={selectedAsset}
              onChange={(e) =>
                setSelectedAsset(e.target.value as "ETH" | "USDC" | "MIGGLES")
              }
            >
              <option value="ETH">ETH</option>
              <option value="USDC">USDC</option>
              <option value="MIGGLES">MIGGLES</option>
            </select>
          </BrutalistField>

          <BrutalistField
            label={`Amount (${selectedAsset})`}
            htmlFor="install-amount"
            hint="Exact amount to transfer. Locked at install — cannot be changed without reinstalling."
          >
            <input
              id="install-amount"
              className="brut-input"
              type="text"
              placeholder="e.g. 0.00001"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </BrutalistField>

          <BrutalistField
            label="Recipient Address"
            htmlFor="install-recipient"
            hint="Exact destination address. Locked at install."
          >
            <input
              id="install-recipient"
              className="brut-input"
              type="text"
              placeholder="0x..."
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
            />
          </BrutalistField>

          {/* ─ Policy Conditions ─ */}
          <BrutalistDivider label="Execution Conditions — at least one required" />

          <BrutalistField
            label="Unlock Timestamp"
            htmlFor="unlock-ts"
            hint="Earliest Unix timestamp (seconds) at which the transfer may be executed. Set to 0 to omit a time delay."
          >
            {/* Quick-pick delay buttons */}
            <div
              style={{
                display: "flex",
                gap: 6,
                flexWrap: "wrap",
                marginBottom: 8,
              }}
            >
              {DELAY_OFFSETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() =>
                    setUnlockTimestamp(String(nowSeconds() + p.delta))
                  }
                  style={{
                    fontFamily: "var(--brut-font-body)",
                    fontSize: 14,
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    border: "2px solid var(--brut-border)",
                    background: "transparent",
                    color: "var(--brut-text)",
                    padding: "5px 12px",
                    cursor: "pointer",
                    borderRadius: 0,
                    transition: "background 0.1s, color 0.1s",
                  }}
                >
                  {p.label}
                </button>
              ))}
              {unlockTimestamp !== "0" && (
                <button
                  type="button"
                  onClick={() => setUnlockTimestamp("0")}
                  style={{
                    fontFamily: "var(--brut-font-body)",
                    fontSize: 14,
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    border: "2px solid var(--brut-faint)",
                    background: "transparent",
                    color: "var(--brut-faint)",
                    padding: "5px 12px",
                    cursor: "pointer",
                    borderRadius: 0,
                  }}
                >
                  CLEAR
                </button>
              )}
            </div>
            <input
              id="unlock-ts"
              className="brut-input"
              type="text"
              placeholder="0"
              value={unlockTimestamp}
              onChange={(e) => setUnlockTimestamp(e.target.value)}
            />
            {Number(unlockTimestamp) > 0 && (
              <div
                style={{
                  fontFamily: "var(--brut-font-mono)",
                  fontSize: 14,
                  color: "var(--brut-blue)",
                  letterSpacing: "0.04em",
                  marginTop: 2,
                }}
              >
                ↳ {new Date(Number(unlockTimestamp) * 1000).toLocaleString()}
              </div>
            )}
          </BrutalistField>

          <BrutalistField
            label="Consensus Signer"
            htmlFor="consensus-signer"
            hint="Address that must match the executor to co-authorize execution. Leave blank if using time delay only. Use 'USE EXECUTOR' to require the standard executor as co-signer."
          >
            <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
              <button
                type="button"
                onClick={() => setConsensusSigner(executor)}
                disabled={!isValidAddress(executor)}
                style={{
                  fontFamily: "var(--brut-font-body)",
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  border: "2px solid var(--brut-border)",
                  background: "transparent",
                  color: "var(--brut-text)",
                  padding: "4px 10px",
                  cursor: "pointer",
                  borderRadius: 0,
                  opacity: isValidAddress(executor) ? 1 : 0.4,
                }}
              >
                USE EXECUTOR
              </button>
              {consensusSigner && (
                <button
                  type="button"
                  onClick={() => setConsensusSigner("")}
                  style={{
                    fontFamily: "var(--brut-font-body)",
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    border: "2px solid var(--brut-faint)",
                    background: "transparent",
                    color: "var(--brut-faint)",
                    padding: "4px 10px",
                    cursor: "pointer",
                    borderRadius: 0,
                  }}
                >
                  CLEAR
                </button>
              )}
            </div>
            <input
              id="consensus-signer"
              className="brut-input"
              type="text"
              placeholder="0x... (optional — leave blank to use timelock only)"
              value={consensusSigner}
              onChange={(e) => setConsensusSigner(e.target.value)}
            />
          </BrutalistField>

          {/* ─ Policy Binding ─ */}
          <BrutalistDivider label="Policy Binding" />

          <BrutalistField
            label="Executor Address"
            htmlFor="executor-addr"
            hint="Wallet authorised to trigger the staged transfer once conditions are met."
          >
            <input
              id="executor-addr"
              className="brut-input"
              type="text"
              placeholder="0x..."
              value={executor}
              onChange={(e) => setExecutor(e.target.value)}
            />
          </BrutalistField>

          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
          >
            <BrutalistField label="Valid After (unix)" htmlFor="valid-after">
              <input
                id="valid-after"
                className="brut-input"
                type="text"
                placeholder="0"
                value={validAfter}
                onChange={(e) => setValidAfter(e.target.value)}
              />
            </BrutalistField>
            <BrutalistField label="Valid Until (unix)" htmlFor="valid-until">
              <input
                id="valid-until"
                className="brut-input"
                type="text"
                placeholder="unix seconds"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </BrutalistField>
          </div>

          <BrutalistField
            label="Salt"
            htmlFor="install-salt"
            hint="Unique nonce for this policy configuration."
          >
            <div style={{ display: "flex", gap: 8 }}>
              <input
                id="install-salt"
                className="brut-input"
                type="text"
                value={salt}
                onChange={(e) => setSalt(e.target.value)}
                style={{ flex: 1 }}
              />
              <BrutalistButton
                variant="secondary"
                onClick={randomizeSalt}
                style={{
                  whiteSpace: "nowrap",
                  padding: "11px 16px",
                  fontSize: 14,
                }}
              >
                ↺ RANDOMIZE
              </BrutalistButton>
            </div>
          </BrutalistField>

          {/* ─ Transaction Preview ─ */}
          <BrutalistDivider label="Transaction Preview" />

          <div style={{ padding: "0 4px" }}>
            <BrutalistDataRow
              label="Policy Contract"
              value="MoiraiDelegate v1"
            />
            <BrutalistDataRow
              label="Principal"
              value={
                <BrutalistAddressDisplay
                  address={activeAccount ?? MOCK.wallet}
                />
              }
            />
            <BrutalistDataRow label="Asset" value={selectedAsset} />
            <BrutalistDataRow label="Amount" value={amount || "—"} />
            <BrutalistDataRow
              label="Recipient"
              value={
                isValidAddress(recipient) ? (
                  <BrutalistAddressDisplay address={recipient} />
                ) : (
                  <span style={{ color: "var(--brut-faint)" }}>—</span>
                )
              }
            />
            <BrutalistDataRow
              label="Network"
              value={`${MOCK.chainLabel} (${MOCK.chainId})`}
            />
          </div>

          <BrutalistButton
            variant="primary"
            fullWidth
            loading={installState === "loading"}
            disabled={!canInstall}
            onClick={handleInstall}
          >
            INSTALL POLICY — SIGN &amp; SUBMIT
          </BrutalistButton>

          {installError && (
            <div
              style={{
                background: "#fff0f0",
                border: "2px solid var(--brut-red)",
                padding: "12px 16px",
              }}
              className="brut-fade-in"
            >
              <div
                style={{
                  fontFamily: "var(--brut-font-body)",
                  fontSize: 14,
                  color: "var(--brut-red)",
                }}
              >
                {installError}
              </div>
            </div>
          )}
        </div>
      </BrutalistCard>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Section §4 — EXECUTE TRANSFER
   ───────────────────────────────────────────────────────────────────────── */

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      onClick={handleCopy}
      title="Copy to clipboard"
      className="whitespace-nowrap"
      style={{
        background: "none",
        border: "1px solid var(--brut-faint)",
        borderRadius: 2,
        cursor: "pointer",
        padding: "1px 5px",
        fontFamily: "var(--brut-font-body)",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.1em",
        color: copied ? "var(--brut-green)" : "var(--brut-muted)",
        transition: "color 0.15s",
        lineHeight: 1.6,
      }}
    >
      {copied ? "COPIED" : "COPY"}
    </button>
  );
}

function freshNonce() {
  return String(
    BigInt(Date.now()) * BigInt(1_000_000) +
      BigInt(Math.floor(Math.random() * 1_000_000)),
  );
}

function ExecuteTransferSection({
  onBack,
  activeAccount,
  preselectedPolicyId,
  subAccountAddress,
}: {
  onBack: () => void;
  activeAccount?: string;
  preselectedPolicyId?: string;
  subAccountAddress?: `0x${string}` | null;
}) {
  const { policies, loadState } = useInstalledPolicies(activeAccount);
  const [selectedPolicyId, setSelectedPolicyId] = useState<string>("");
  const [execState, setExecState] = useState<AsyncState>("idle");
  const [execResult, setExecResult] = useState<{
    txHash?: string;
    error?: string;
  } | null>(null);
  const [nonce, setNonce] = useState(freshNonce);
  const [uninstallState, setUninstallState] = useState<AsyncState>("idle");
  const [uninstallResult, setUninstallResult] = useState<{
    txHash?: string;
    error?: string;
  } | null>(null);
  const [localUninstalledIds, setLocalUninstalledIds] = useState<Set<string>>(
    () => new Set(),
  );
  const { writeContractAsync } = useWriteContract();

  // Auto-select the preselected or first policy once policies are loaded
  useEffect(() => {
    if (policies.length > 0) {
      setSelectedPolicyId(
        (prev) => prev || preselectedPolicyId || policies[0].policyId,
      );
    }
  }, [policies, preselectedPolicyId]);

  // Clear exec result when account changes
  useEffect(() => {
    setExecResult(null);
  }, [activeAccount]);

  // Merge optimistic local-uninstall flags into the policy list
  const effectivePolicies = policies.map((p) =>
    localUninstalledIds.has(p.policyId.toLowerCase())
      ? { ...p, uninstalled: true }
      : p,
  );

  const selectedPolicy = effectivePolicies.find(
    (p) => p.policyId.toLowerCase() === selectedPolicyId.toLowerCase(),
  );

  const handleUninstall = async () => {
    if (!selectedPolicy || !activeAccount || selectedPolicy.uninstalled) return;
    setUninstallState("loading");
    setUninstallResult(null);
    try {
      const policyConfigHex = (selectedPolicy.policyConfig ?? "0x") as Hex;
      const uninstallArgs = [
        {
          binding: {
            account: getAddress(activeAccount as `0x${string}`),
            policy: deployed.moiraiDelegatePolicy,
            policyConfig: policyConfigHex,
            validAfter: BigInt(selectedPolicy.binding?.validAfter ?? 0),
            validUntil: BigInt(selectedPolicy.binding?.validUntil ?? 0),
            salt: BigInt(selectedPolicy.binding?.salt ?? 0),
          },
          policy: deployed.moiraiDelegatePolicy,
          policyId: selectedPolicy.policyId as Hex,
          policyConfig: policyConfigHex,
          uninstallData: "0x" as Hex,
        },
      ] as const;

      const hash = subAccountAddress
        ? await writeContractAsync({
            address: subAccountAddress,
            abi: coinbaseSmartWalletAbi,
            functionName: "execute",
            args: [
              deployed.policyManager,
              BigInt(0),
              encodeFunctionData({
                abi: policyManagerAbi,
                functionName: "uninstall",
                args: uninstallArgs,
              }),
            ],
          })
        : await writeContractAsync({
            address: deployed.policyManager,
            abi: policyManagerAbi,
            functionName: "uninstall",
            args: uninstallArgs,
          });

      // Optimistic local update
      setLocalUninstalledIds((prev) => {
        const next = new Set(prev);
        next.add(selectedPolicy.policyId.toLowerCase());
        return next;
      });

      // Fire-and-forget persist
      fetch("/api/policies", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "upsert",
          chainId: deployed.chainId,
          account: getAddress(activeAccount as `0x${string}`),
          policyId: selectedPolicy.policyId,
          policy: selectedPolicy.policy,
          policyConfig: selectedPolicy.policyConfig,
          binding: selectedPolicy.binding,
          uninstalled: true,
        }),
      });

      setUninstallResult({ txHash: hash });
      setUninstallState("success");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const isRejection =
        msg.toLowerCase().includes("rejected") ||
        msg.toLowerCase().includes("cancelled") ||
        msg.toLowerCase().includes("denied");
      if (!isRejection) setUninstallResult({ error: msg });
      setUninstallState("idle");
    }
  };

  const handleExecute = async () => {
    if (!selectedPolicy || !activeAccount) return;
    setExecState("loading");
    setExecResult(null);
    try {
      const res = await fetch("/api/moirai-delegate/execute", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          account: activeAccount,
          policyId: selectedPolicy.policyId,
          policyConfig: selectedPolicy.policyConfig,
          nonce,
        }),
      });
      const json = (await res.json()) as { hash?: string; error?: string };
      if (!res.ok || !json.hash) {
        setExecResult({ error: json.error ?? "Execution failed" });
        setExecState("idle");
      } else {
        setExecResult({ txHash: json.hash });
        setExecState("success");
        setNonce(freshNonce());
      }
    } catch (e) {
      setExecResult({ error: e instanceof Error ? e.message : String(e) });
      setExecState("idle");
    }
  };

  return (
    <section className="brut-clause brut-fade-in">
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <BrutalistSectionHeader
          sectionNumber="04"
          label="Section 4"
          title="EXECUTE TRANSFER"
          style={{ paddingBottom: 0, flex: 1 }}
        />
        <div style={{ paddingBottom: 16 }}>
          <BrutalistButton
            variant="secondary"
            onClick={onBack}
            style={{ fontSize: 14, padding: "10px 18px" }}
          >
            ← BACK
          </BrutalistButton>
        </div>
      </div>

      <hr className="brut-hr" style={{ marginBottom: 0 }} />

      {/* Description */}
      <div
        style={{
          fontFamily: "var(--brut-font-body)",
          fontSize: 14,
          color: "var(--brut-muted)",
          lineHeight: 1.65,
          padding: "16px 0 4px",
        }}
      >
        Triggers the staged transfer. The executor carries out the pre-defined
        transaction — no user action is needed at this step. Conditions (time
        delay, co-signer) are enforced by the policy contract.
      </div>

      {/* Two-column layout */}
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 420px", gap: 20 }}
      >
        {/* Left — execution form */}
        <BrutalistCard
          label="Execution Order"
          title="AUTHORIZE &amp; EXECUTE"
          style={{ borderTop: "none" }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {!activeAccount ? (
              <div
                style={{
                  fontFamily: "var(--brut-font-body)",
                  fontSize: 14,
                  color: "var(--brut-muted)",
                  padding: "24px 0",
                  textAlign: "center",
                }}
              >
                Connect a wallet to view installed policies.
              </div>
            ) : loadState === "loading" ? (
              <div
                style={{
                  fontFamily: "var(--brut-font-body)",
                  fontSize: 14,
                  color: "var(--brut-muted)",
                  padding: "24px 0",
                  textAlign: "center",
                }}
              >
                Loading policies…
              </div>
            ) : loadState === "error" ? (
              <div
                style={{
                  fontFamily: "var(--brut-font-body)",
                  fontSize: 14,
                  color: "var(--brut-red)",
                  padding: "12px 0",
                }}
              >
                Failed to load policies.
              </div>
            ) : effectivePolicies.length === 0 ? (
              <div
                style={{
                  fontFamily: "var(--brut-font-body)",
                  fontSize: 14,
                  color: "var(--brut-muted)",
                  padding: "12px 0",
                }}
              >
                No MoiraiDelegate installs found for this wallet.
              </div>
            ) : (
              <>
                <BrutalistField label="Policy" htmlFor="exec-policy-select">
                  <select
                    id="exec-policy-select"
                    className="brut-select"
                    value={selectedPolicyId}
                    onChange={(e) => {
                      setSelectedPolicyId(e.target.value);
                      setExecResult(null);
                      setExecState("idle");
                      setNonce(freshNonce());
                      setUninstallResult(null);
                      setUninstallState("idle");
                    }}
                  >
                    {effectivePolicies.map((p) => (
                      <option key={p.policyId} value={p.policyId}>
                        {p.policyId.slice(0, 10)}…{p.policyId.slice(-6)}
                        {" — "}
                        {new Date(p.createdAtMs).toLocaleString()}
                        {p.uninstalled ? " (uninstalled)" : ""}
                      </option>
                    ))}
                  </select>
                </BrutalistField>

                <BrutalistButton
                  variant="primary"
                  fullWidth
                  loading={execState === "loading"}
                  disabled={
                    !selectedPolicy ||
                    execState === "loading"
                  }
                  onClick={handleExecute}
                >
                  AUTHORIZE EXECUTION — SIGN
                </BrutalistButton>

                {execResult?.error && (
                  <div
                    style={{
                      background: "#fff0f0",
                      border: "2px solid var(--brut-red)",
                      padding: "12px 16px",
                    }}
                    className="brut-fade-in"
                  >
                    <div
                      style={{
                        fontFamily: "var(--brut-font-body)",
                        fontSize: 14,
                        fontWeight: 700,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        color: "var(--brut-red)",
                        marginBottom: 6,
                      }}
                    >
                      Execution Failed
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--brut-font-mono)",
                        fontSize: 14,
                        color: "var(--brut-red)",
                        lineHeight: 1.5,
                        wordBreak: "break-word",
                      }}
                    >
                      {execResult.error}
                    </div>
                  </div>
                )}

                {execState === "success" && execResult?.txHash && (
                  <div
                    style={{
                      background: "#dcfce7",
                      border: "2px solid var(--brut-green)",
                      padding: "12px 16px",
                    }}
                    className="brut-fade-in"
                  >
                    <div
                      style={{
                        fontFamily: "var(--brut-font-body)",
                        fontSize: 14,
                        fontWeight: 700,
                        letterSpacing: "0.16em",
                        textTransform: "uppercase",
                        color: "var(--brut-green)",
                        marginBottom: 4,
                      }}
                    >
                      Transfer Executed
                    </div>
                    <a
                      href={txUrl(execResult.txHash)}
                      target="_blank"
                      rel="noreferrer"
                      className="brut-tx-hash"
                      style={{
                        textAlign: "left",
                        color: "var(--brut-green)",
                        textDecoration: "underline",
                        wordBreak: "break-all",
                      }}
                    >
                      {execResult.txHash.slice(0, 18)}…
                    </a>
                  </div>
                )}

                {/* ─ Uninstall ─ */}
                {!selectedPolicy?.uninstalled && (
                  <>
                    <BrutalistDivider />
                    <BrutalistButton
                      variant="destructive"
                      fullWidth
                      loading={uninstallState === "loading"}
                      disabled={uninstallState === "loading"}
                      onClick={handleUninstall}
                    >
                      CANCEL TRANSACTION — UNINSTALL POLICY
                    </BrutalistButton>
                  </>
                )}

                {uninstallResult?.error && (
                  <div
                    style={{
                      background: "#fff0f0",
                      border: "2px solid var(--brut-red)",
                      padding: "12px 16px",
                    }}
                    className="brut-fade-in"
                  >
                    <div
                      style={{
                        fontFamily: "var(--brut-font-body)",
                        fontSize: 14,
                        fontWeight: 700,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        color: "var(--brut-red)",
                        marginBottom: 6,
                      }}
                    >
                      Uninstall Failed
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--brut-font-mono)",
                        fontSize: 14,
                        color: "var(--brut-red)",
                        lineHeight: 1.5,
                        wordBreak: "break-word",
                      }}
                    >
                      {uninstallResult.error}
                    </div>
                  </div>
                )}

                {uninstallState === "success" && uninstallResult?.txHash && (
                  <div
                    style={{
                      background: "#fff0f0",
                      border: "2px solid var(--brut-red)",
                      padding: "12px 16px",
                    }}
                    className="brut-fade-in"
                  >
                    <div
                      style={{
                        fontFamily: "var(--brut-font-body)",
                        fontSize: 14,
                        fontWeight: 700,
                        letterSpacing: "0.16em",
                        textTransform: "uppercase",
                        color: "var(--brut-red)",
                        marginBottom: 4,
                      }}
                    >
                      Policy Uninstalled
                    </div>
                    <a
                      href={txUrl(uninstallResult.txHash)}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        fontFamily: "var(--brut-font-mono)",
                        fontSize: 14,
                        color: "var(--brut-red)",
                        textDecoration: "underline",
                        wordBreak: "break-all",
                      }}
                    >
                      {uninstallResult.txHash.slice(0, 18)}…
                    </a>
                  </div>
                )}
              </>
            )}
          </div>
        </BrutalistCard>

        {/* Right — policy details */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <BrutalistCard label="Policy Details" style={{ borderTop: "none" }}>
            {selectedPolicy ? (
              <>
                <BrutalistDataRow
                  label="Policy ID"
                  value={
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "var(--brut-font-mono)",
                          fontSize: 14,
                        }}
                      >
                        {selectedPolicy.policyId.slice(0, 10)}…
                        {selectedPolicy.policyId.slice(-8)}
                      </span>
                      <CopyButton text={selectedPolicy.policyId} />
                    </span>
                  }
                />
                <BrutalistDataRow
                  label="Installed"
                  value={new Date(selectedPolicy.createdAtMs).toLocaleString()}
                />
                {selectedPolicy.installTxHash && (
                  <BrutalistDataRow
                    label="Install Tx"
                    value={
                      <a
                        href={txUrl(selectedPolicy.installTxHash)}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          fontFamily: "var(--brut-font-mono)",
                          fontSize: 14,
                          color: "var(--brut-text)",
                          textDecoration: "underline",
                          wordBreak: "break-all",
                        }}
                      >
                        {selectedPolicy.installTxHash.slice(0, 10)}…
                        {selectedPolicy.installTxHash.slice(-6)}
                      </a>
                    }
                  />
                )}
                <BrutalistDataRow
                  label="Account"
                  value={(() => {
                    const addr = activeAccount ?? MOCK.wallet;
                    const origin = deployed.chainId === 8453
                      ? 'https://basescan.org'
                      : 'https://sepolia.basescan.org';
                    return (
                      <a
                        href={`${origin}/address/${addr}`}
                        target="_blank"
                        rel="noreferrer"
                        className="brut-address"
                        title={addr}
                        style={{ textDecoration: 'underline', color: 'inherit' }}
                      >
                        {addr.slice(0, 10)}…{addr.slice(-8)}
                      </a>
                    );
                  })()}
                />
                <BrutalistDataRow
                  label="Status"
                  value={
                    <BrutalistStatusBadge
                      status={
                        selectedPolicy.uninstalled ? "inactive" : "active"
                      }
                      label={
                        selectedPolicy.uninstalled ? "UNINSTALLED" : "ACTIVE"
                      }
                    />
                  }
                />
                {selectedPolicy.binding && (
                  <>
                    <BrutalistDataRow
                      label="Valid Until"
                      value={
                        Number(selectedPolicy.binding.validUntil) > 0
                          ? new Date(
                              Number(selectedPolicy.binding.validUntil) * 1000,
                            ).toLocaleDateString()
                          : "—"
                      }
                    />
                  </>
                )}
                <BrutalistDataRow label="Network" value={MOCK.chainLabel} />
              </>
            ) : (
              <div
                style={{
                  fontFamily: "var(--brut-font-body)",
                  fontSize: 14,
                  color: "var(--brut-faint)",
                  padding: "12px 0",
                }}
              >
                Select a policy above.
              </div>
            )}
          </BrutalistCard>

          <div
            style={{
              border: "1px solid var(--brut-faint)",
              padding: "12px 14px",
            }}
          >
            <p
              style={{
                fontFamily: "var(--brut-font-body)",
                fontSize: 14,
                lineHeight: 1.6,
                color: "var(--brut-faint)",
                margin: 0,
              }}
            >
              Execution is signed by the Authorized Agent and verified on-chain
              by the Policy Manager contract. All actions are final and
              non-reversible.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Nav tab controls
   ───────────────────────────────────────────────────────────────────────── */

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  num: string;
}

function TabButton({ active, onClick, children, num }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: "var(--brut-font-body)",
        fontSize: 14,
        fontWeight: 700,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        border: "var(--brut-rule)",
        borderBottom: active
          ? "3px solid var(--brut-yellow)"
          : "var(--brut-rule)",
        background: active ? "var(--brut-surface)" : "transparent",
        color: active ? "var(--brut-text)" : "var(--brut-muted)",
        padding: "10px 20px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginRight: -3,
        position: "relative",
        zIndex: active ? 2 : 1,
        transition: "background 0.1s, color 0.1s",
      }}
    >
      <span
        style={{
          fontFamily: "var(--brut-font-display)",
          fontSize: 16,
          color: active ? "var(--brut-blue)" : "var(--brut-faint)",
          lineHeight: 1,
        }}
      >
        §{num}
      </span>
      {children}
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   BrutalistPreview — root export
   ───────────────────────────────────────────────────────────────────────── */

export function BrutalistPreview() {
  const [view, setView] = useState<DemoView>("document");
  const [freshPolicyId, setFreshPolicyId] = useState<string>("");

  function handleInstallSuccess(policyId: string) {
    setFreshPolicyId(policyId);
    setView("execute");
  }

  function handleNavigateToExecute(policyId: string) {
    setFreshPolicyId(policyId);
    setView("execute");
  }

  // ── Wallet state ──────────────────────────────────────────────────────────
  const { address: account, connector, status } = useAccount();
  const { connectors, connectAsync, isPending: connectPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [subAccountAddress, setSubAccountAddress] = useState<
    `0x${string}` | null
  >(null);
  const [connectError, setConnectError] = useState<string | null>(null);

  const isConnected = status === "connected" && !!account;
  const activeAccount: string | undefined = subAccountAddress ?? account;

  const baseAccountConnector =
    connectors.find((c) => c.id === "baseAccount") ?? connectors[0];

  useEffect(() => {
    let cancelled = false;
    async function fetchSubAccount() {
      if (!isConnected || !account || !connector) {
        setSubAccountAddress(null);
        return;
      }
      try {
        const provider = (await connector.getProvider()) as {
          request: (args: {
            method: string;
            params?: unknown[];
          }) => Promise<unknown>;
        };
        const response = (await provider.request({
          method: "wallet_getSubAccounts",
          params: [{ account, domain: window.location.origin }],
        })) as { subAccounts: Array<{ address: `0x${string}` }> };
        if (!cancelled)
          setSubAccountAddress(response.subAccounts?.[0]?.address ?? null);
      } catch {
        if (!cancelled) setSubAccountAddress(null);
      }
    }
    fetchSubAccount();
    return () => {
      cancelled = true;
    };
  }, [isConnected, account, connector]);

  return (
    <BrutalistLayout activeNav="moirai-delegate">
      {/* ── Document title block ── */}
      <div style={{ marginBottom: 40 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            marginBottom: 4,
            flexWrap: "wrap",
          }}
        >
          <h1
            style={{
              fontFamily: "var(--brut-font-display)",
              fontSize: "clamp(36px, 7vw, 72px)",
              letterSpacing: "0.04em",
              color: "var(--brut-text)",
              lineHeight: 1,
              margin: 0,
            }}
          >
            POLICY BRIEF
          </h1>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: 4,
            }}
          >
            <span
              style={{
                fontFamily: "var(--brut-font-body)",
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--brut-muted)",
              }}
            >
              Document No.
            </span>
            <span
              style={{
                fontFamily: "var(--brut-font-mono)",
                fontSize: 14,
                color: "var(--brut-text)",
              }}
            >
              AP-2026-0001
            </span>
          </div>
        </div>

        <div
          style={{
            height: 6,
            background: "var(--brut-blue)",
            marginBottom: 8,
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <p
            style={{
              fontFamily: "var(--brut-font-body)",
              fontSize: 14,
              color: "var(--brut-muted)",
              margin: 0,
              letterSpacing: "0.02em",
            }}
          >
            Moirai Delegate Policy Agreement — Active Delegation Schedule
          </p>
          <span
            style={{
              fontFamily: "var(--brut-font-mono)",
              fontSize: 14,
              color: "var(--brut-faint)",
              letterSpacing: "0.06em",
            }}
          >
            2026-03-13
          </span>
        </div>
      </div>

      {/* ── Wallet connect ── */}
      <div
        style={{
          border: "var(--brut-rule)",
          padding: "14px 20px",
          marginBottom: 24,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        {isConnected && account ? (
          <>
            <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
              <div>
                <div
                  style={{
                    fontFamily: "var(--brut-font-body)",
                    fontSize: 14,
                    fontWeight: 700,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "var(--brut-muted)",
                    marginBottom: 4,
                  }}
                >
                  Universal
                </div>
                <BrutalistAddressDisplay address={account} truncate={false} />
              </div>
              {subAccountAddress && (
                <div>
                  <div
                    style={{
                      fontFamily: "var(--brut-font-body)",
                      fontSize: 14,
                      fontWeight: 700,
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      color: "var(--brut-muted)",
                      marginBottom: 4,
                    }}
                  >
                    Sub Account
                  </div>
                  <BrutalistAddressDisplay
                    address={subAccountAddress}
                    truncate={false}
                  />
                </div>
              )}
            </div>
            <BrutalistButton
              variant="secondary"
              onClick={() => disconnect()}
              style={{ padding: "8px 16px", fontSize: 14 }}
            >
              DISCONNECT
            </BrutalistButton>
          </>
        ) : (
          <>
            <div
              style={{
                fontFamily: "var(--brut-font-body)",
                fontSize: 14,
                color: "var(--brut-muted)",
                letterSpacing: "0.04em",
              }}
            >
              Connect a Coinbase Smart Wallet to install or execute policies.
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: 6,
              }}
            >
              <BrutalistButton
                variant="primary"
                loading={connectPending}
                disabled={!baseAccountConnector || connectPending}
                onClick={async () => {
                  if (!baseAccountConnector) return;
                  setConnectError(null);
                  try {
                    await connectAsync({ connector: baseAccountConnector });
                  } catch (e) {
                    setConnectError(e instanceof Error ? e.message : String(e));
                  }
                }}
                style={{ padding: "8px 20px", fontSize: 14 }}
              >
                CONNECT SMART WALLET
              </BrutalistButton>
              {connectError && (
                <span
                  style={{
                    fontFamily: "var(--brut-font-body)",
                    fontSize: 14,
                    color: "var(--brut-red)",
                  }}
                >
                  {connectError}
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Section tab controls ── */}
      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          marginBottom: -3,
          position: "relative",
          zIndex: 3,
          flexWrap: "wrap",
          gap: 0,
        }}
      >
        <TabButton
          num="1–2"
          active={view === "document"}
          onClick={() => setView("document")}
        >
          Parties &amp; Policies
        </TabButton>
        <TabButton
          num="3"
          active={view === "install"}
          onClick={() => setView("install")}
        >
          Install Policy
        </TabButton>
        <TabButton
          num="4"
          active={view === "execute"}
          onClick={() => setView("execute")}
        >
          Execute Transfer
        </TabButton>
      </div>

      {/* ── Thick rule that aligns with tabs ── */}
      <div
        style={{
          borderTop: "var(--brut-rule)",
          marginBottom: 32,
          position: "relative",
          zIndex: 2,
        }}
      />

      {/* ── Section views ── */}
      {view === "document" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 48 }}>
          <PartiesSection activeAccount={activeAccount} />
          <ActivePoliciesSection
            onNavigate={setView}
            activeAccount={activeAccount}
            onNavigateToExecute={handleNavigateToExecute}
          />

          {/* Footer stamp area */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              paddingTop: 24,
              borderTop: "var(--brut-rule)",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: "var(--brut-font-display)",
                  fontSize: 24,
                  letterSpacing: "0.1em",
                  color: "var(--brut-muted)",
                  border: "3px solid var(--brut-muted)",
                  padding: "4px 16px",
                  display: "inline-block",
                  transform: "rotate(-1.5deg)",
                  lineHeight: 1,
                }}
              >
                PENDING
              </div>
            </div>
            <div
              style={{
                fontFamily: "var(--brut-font-body)",
                fontSize: 14,
                color: "var(--brut-muted)",
                maxWidth: 380,
                lineHeight: 1.5,
              }}
            >
              No policies are currently installed. Install a Moirai Delegate
              policy to begin authorizing agent executions on Base Sepolia.
            </div>
          </div>
        </div>
      )}

      {view === "install" && (
        <InstallPolicySection
          onBack={() => setView("document")}
          activeAccount={activeAccount}
          subAccountAddress={subAccountAddress}
          onInstallSuccess={handleInstallSuccess}
        />
      )}

      {view === "execute" && (
        <ExecuteTransferSection
          onBack={() => setView("document")}
          activeAccount={activeAccount}
          preselectedPolicyId={freshPolicyId}
          subAccountAddress={subAccountAddress}
        />
      )}
    </BrutalistLayout>
  );
}
