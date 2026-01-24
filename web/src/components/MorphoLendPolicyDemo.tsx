'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Hex } from 'viem';
import { getAddress, isAddress, parseAbiItem } from 'viem';
import { useAccount, useSignTypedData, useWriteContract } from 'wagmi';

import { deployed } from '../contracts/addresses';
import { policyManagerAbi } from '../contracts/abi';
import { baseSepoliaPublicClient } from '../lib/baseSepolia';
import {
  encodeMorphoLendPolicyConfig,
  hashPolicyConfig,
  type RecurringAllowanceLimit,
} from '../lib/morphoLendPolicyEncoding';

type InstalledPolicy = {
  policyId: Hex;
  txHash?: Hex;
};

type StoredPolicy = {
  chainId: number;
  account: `0x${string}`;
  policyId: Hex;
  policy: `0x${string}`;
  policyConfig: Hex;
  installTxHash?: Hex;
};

type PolicyStatus = {
  installed: boolean;
  revoked: boolean;
  validAfter: number;
  validUntil: number;
};

const DEFAULT_FROM_BLOCK = BigInt(process.env.NEXT_PUBLIC_POLICY_EVENTS_FROM_BLOCK ?? '0');

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function freshNonce(): string {
  // MorphoLendPolicy enforces one-time-use nonces per policyId.
  // Use a high-resolution time component + randomness to avoid accidental reuse.
  return String(
    BigInt(Date.now()) * BigInt(1_000_000) + BigInt(Math.floor(Math.random() * 1_000_000)),
  );
}

function txUrl(hash: string): string {
  const chainId = deployed.chainId;
  const origin =
    chainId === 84532
      ? 'https://sepolia.basescan.org'
      : chainId === 8453
        ? 'https://basescan.org'
        : 'https://sepolia.basescan.org';
  return `${origin}/tx/${hash}`;
}

export function MorphoLendPolicyDemo() {
  const { address: account } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();
  const { signTypedDataAsync } = useSignTypedData();
  const [installPending, setInstallPending] = useState(false);
  const [executePending, setExecutePending] = useState(false);
  const [revokePending, setRevokePending] = useState(false);

  const [vault, setVault] = useState(
    process.env.NEXT_PUBLIC_DEMO_USDC_VAULT_ADDRESS ?? '',
  );
  const [executor, setExecutor] = useState(process.env.NEXT_PUBLIC_EXECUTOR_ADDRESS ?? '');
  const [allowance, setAllowance] = useState('1000000');
  const [period, setPeriod] = useState('86400');
  const [start, setStart] = useState(String(nowSeconds()));
  const [end, setEnd] = useState(String(nowSeconds() + 60 * 60 * 24 * 30));
  const [salt, setSalt] = useState(() =>
    String(
      BigInt(nowSeconds()) * BigInt(1_000_000) + BigInt(Math.floor(Math.random() * 1_000_000)),
    ),
  );

  const [installed, setInstalled] = useState<InstalledPolicy[]>([]);
  const [selectedPolicyId, setSelectedPolicyId] = useState<Hex | null>(null);
  const [storedPolicies, setStoredPolicies] = useState<Record<string, StoredPolicy>>({});
  const [policyStatus, setPolicyStatus] = useState<Record<string, PolicyStatus>>({});
  const [executeAssets, setExecuteAssets] = useState('0');
  const [executeNonce, setExecuteNonce] = useState(() => freshNonce());
  const [executeResult, setExecuteResult] = useState<{
    text: string;
    txHash?: Hex;
    details?: unknown;
    debug?: unknown;
  } | null>(null);
  const [sessionPolicyConfigs, setSessionPolicyConfigs] = useState<Record<string, Hex>>({});

  const canInstall = !!account && isAddress(vault) && isAddress(executor);

  const policyConfig = useMemo(() => {
    if (!canInstall) return null;
    const limit: RecurringAllowanceLimit = {
      allowance: BigInt(allowance || '0'),
      period: Number(period || '0'),
      start: Number(start || '0'),
      end: Number(end || '0'),
    };
    return encodeMorphoLendPolicyConfig({
      executor: getAddress(executor),
      vault: getAddress(vault),
      depositLimit: limit,
    });
  }, [allowance, canInstall, end, executor, period, start, vault]);

  useEffect(() => {
    if (!account) {
      setInstalled([]);
      setSelectedPolicyId(null);
      return;
    }

    let cancelled = false;
    async function load() {
      const acct = getAddress(account!);
      const logs = await baseSepoliaPublicClient.getLogs({
        address: deployed.policyManager,
        event: parseAbiItem(
          'event PolicyInstalled(bytes32 indexed policyId,address indexed account,address indexed policy)',
        ),
        args: { account: acct, policy: deployed.morphoLendPolicy },
        fromBlock: DEFAULT_FROM_BLOCK,
        toBlock: 'latest',
      });

      if (cancelled) return;
      const next = logs
        .map((l) => ({
          policyId: l.args.policyId as Hex,
          txHash: l.transactionHash as Hex | undefined,
        }))
        .reverse();
      setInstalled(next);
      if (!selectedPolicyId && next[0]) setSelectedPolicyId(next[0].policyId);
    }

    load().catch(() => {
      if (!cancelled) setInstalled([]);
    });

    return () => {
      cancelled = true;
    };
  }, [account, selectedPolicyId]);

  useEffect(() => {
    if (!account) {
      setStoredPolicies({});
      return;
    }
    let cancelled = false;
    async function loadStored() {
      const res = await fetch(
        `/api/policies?account=${encodeURIComponent(account)}&chainId=${deployed.chainId}`,
      );
      const json = (await res.json()) as { policies?: StoredPolicy[] };
      if (cancelled) return;
      const map: Record<string, StoredPolicy> = {};
      for (const p of json.policies ?? []) map[p.policyId.toLowerCase()] = p;
      setStoredPolicies(map);
    }
    loadStored().catch(() => {
      if (!cancelled) setStoredPolicies({});
    });
    return () => {
      cancelled = true;
    };
  }, [account]);

  useEffect(() => {
    if (!account) {
      setPolicyStatus({});
      return;
    }
    let cancelled = false;
    async function loadStatus() {
      if (installed.length === 0) {
        setPolicyStatus({});
        return;
      }
      const next: Record<string, PolicyStatus> = {};
      await Promise.all(
        installed.map(async (p) => {
          try {
            const [isInstalled, isRevoked, _acct, vAfter, vUntil] =
              (await baseSepoliaPublicClient.readContract({
                address: deployed.policyManager,
                abi: policyManagerAbi,
                functionName: 'getPolicyRecord',
                args: [deployed.morphoLendPolicy, p.policyId],
              })) as [boolean, boolean, `0x${string}`, bigint, bigint];
            next[p.policyId.toLowerCase()] = {
              installed: isInstalled,
              revoked: isRevoked,
              validAfter: Number(vAfter),
              validUntil: Number(vUntil),
            };
          } catch {
            // ignore
          }
        }),
      );
      if (!cancelled) setPolicyStatus(next);
    }
    loadStatus().catch(() => {
      if (!cancelled) setPolicyStatus({});
    });
    return () => {
      cancelled = true;
    };
  }, [account, installed]);

  async function onInstall() {
    if (!account || !policyConfig) return;
    if (installPending) return;
    setInstallPending(true);

    const binding = {
      account: getAddress(account),
      policy: deployed.morphoLendPolicy,
      validAfter: BigInt(start || '0'),
      validUntil: BigInt(end || '0'),
      salt: BigInt(salt || '0'),
      policyConfigHash: hashPolicyConfig(policyConfig),
    } as const;

    try {
      const policyId = (await baseSepoliaPublicClient.readContract({
        address: deployed.policyManager,
        abi: policyManagerAbi,
        functionName: 'getPolicyId',
        args: [binding],
      })) as Hex;

      // Ask the user to sign the binding, then have the app's executor broadcast the install tx.
      // This gives us a stable tx hash we can link to, and matches `installPolicyWithSignature`.
      const userSig = await signTypedDataAsync({
        domain: {
          name: 'Policy Manager',
          version: '1',
          chainId: deployed.chainId,
          verifyingContract: deployed.policyManager,
        },
        primaryType: 'PolicyBinding',
        types: {
          PolicyBinding: [
            { name: 'account', type: 'address' },
            { name: 'policy', type: 'address' },
            { name: 'policyConfigHash', type: 'bytes32' },
            { name: 'validAfter', type: 'uint40' },
            { name: 'validUntil', type: 'uint40' },
            { name: 'salt', type: 'uint256' },
          ],
        },
        message: {
          account: binding.account,
          policy: binding.policy,
          policyConfigHash: binding.policyConfigHash,
          validAfter: binding.validAfter,
          validUntil: binding.validUntil,
          salt: binding.salt,
        },
      });

      const res = await fetch('/api/morpho/install', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          binding: {
            account: binding.account,
            policy: binding.policy,
            validAfter: String(binding.validAfter),
            validUntil: String(binding.validUntil),
            salt: String(binding.salt),
            policyConfigHash: binding.policyConfigHash,
          },
          policyConfig,
          userSig,
        }),
      });

    const json = (await res.json()) as { hash?: Hex; error?: string; details?: unknown; debug?: unknown };
      if (!res.ok || !json.hash) {
      setExecuteResult({ text: json.error ?? 'Install failed', details: json.details, debug: json.debug });
        return;
      }

      setSessionPolicyConfigs((prev) => ({ ...prev, [policyId.toLowerCase()]: policyConfig }));
      // Optimistically add to the installed list so the user can execute immediately
      // (RPC log indexing can lag, and fromBlock config can hide new installs if mis-set).
      setInstalled((prev) => {
        const key = policyId.toLowerCase();
        if (prev.some((p) => p.policyId.toLowerCase() === key)) return prev;
        return [{ policyId, txHash: json.hash }, ...prev];
      });
      setSelectedPolicyId(policyId);
      setExecuteResult({ text: `Installed policy ${policyId}`, txHash: json.hash });

      // Persist config so we can execute later without prompting.
      await fetch('/api/policies', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'upsert',
          chainId: deployed.chainId,
          account: binding.account,
          policyId,
          policy: deployed.morphoLendPolicy,
          policyConfig,
          binding: {
            validAfter: String(binding.validAfter),
            validUntil: String(binding.validUntil),
            salt: String(binding.salt),
            policyConfigHash: binding.policyConfigHash,
          },
          installTxHash: json.hash,
        }),
      });
    } finally {
      setInstallPending(false);
    }
  }

  async function onRevoke(policyId: Hex) {
    if (!account) return;
    if (revokePending) return;
    setRevokePending(true);
    try {
      const hash = await writeContractAsync({
        address: deployed.policyManager,
        abi: policyManagerAbi,
        functionName: 'revokePolicy',
        args: [deployed.morphoLendPolicy, policyId],
      });
      setExecuteResult({ text: `Revoked policy ${policyId}`, txHash: hash });
    } finally {
      setRevokePending(false);
    }
  }

  async function onExecute(policyId: Hex) {
    if (!account) return;
    if (executePending) return;
    let policyConfigHex = sessionPolicyConfigs[policyId.toLowerCase()];
    if (!policyConfigHex) {
      const stored = storedPolicies[policyId.toLowerCase()];
      if (stored?.policyConfig) {
        policyConfigHex = stored.policyConfig;
        setSessionPolicyConfigs((prev) => ({ ...prev, [policyId.toLowerCase()]: policyConfigHex! }));
      }
    }
    if (!policyConfigHex) {
      policyConfigHex = prompt('Paste the policyConfig hex for this policyId (required):') as Hex | null;
    }

    if (!policyConfigHex) return;

    setExecutePending(true);
    try {
      setExecuteResult(null);
      const res = await fetch('/api/morpho/execute', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          account,
          policyId,
          policyConfig: policyConfigHex,
          assets: executeAssets,
          nonce: executeNonce,
        }),
      });

      const json = (await res.json()) as { hash?: string; error?: string; details?: unknown; debug?: unknown };
      if (!res.ok || !json.hash) {
        setExecuteResult({ text: json.error ?? 'Execution failed', details: json.details, debug: json.debug });
        return;
      }

      setSessionPolicyConfigs((prev) => ({ ...prev, [policyId.toLowerCase()]: policyConfigHex }));
      setExecuteResult({ text: 'Executed', txHash: json.hash as Hex });
      setExecuteNonce(freshNonce());
    } finally {
      setExecutePending(false);
    }
  }

  const selectedConfig = selectedPolicyId
    ? sessionPolicyConfigs[selectedPolicyId.toLowerCase()]
    : undefined;
  const selectedStored = selectedPolicyId ? storedPolicies[selectedPolicyId.toLowerCase()] : undefined;

  useEffect(() => {
    if (!selectedPolicyId) return;
    const key = selectedPolicyId.toLowerCase();
    if (sessionPolicyConfigs[key]) return;
    const stored = storedPolicies[key];
    if (!stored?.policyConfig) return;
    // Hydrate in-memory cache so execute flows don't need to branch on storage source.
    setSessionPolicyConfigs((prev) => ({ ...prev, [key]: stored.policyConfig }));
  }, [selectedPolicyId, sessionPolicyConfigs, storedPolicies]);

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-lg font-semibold">1) Configure + install Morpho lend policy</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Install is a wallet-signed transaction (no typed-data signing required yet). This demo
          keeps the policyConfig in memory only (refreshing the page will forget it).
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Vault address</span>
            <input
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-black"
              value={vault}
              onChange={(e) => setVault(e.target.value)}
              placeholder="0x..."
            />
            {process.env.NEXT_PUBLIC_DEMO_USDC_ADDRESS ? (
              <span className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
                Demo USDC: {process.env.NEXT_PUBLIC_DEMO_USDC_ADDRESS}
              </span>
            ) : null}
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Executor address (app)</span>
            <input
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-black"
              value={executor}
              onChange={(e) => setExecutor(e.target.value)}
              placeholder="0x..."
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">
              Allowance (raw units, uint160)
            </span>
            <input
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-black"
              value={allowance}
              onChange={(e) => setAllowance(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Period (seconds, uint48)</span>
            <input
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-black"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Start (unix seconds, uint48)</span>
            <input
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-black"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">End (unix seconds, uint48)</span>
            <input
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-black"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
        </div>

        <div className="mt-3 flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Salt (uint256)</span>
            <div className="flex gap-2">
              <input
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-black"
                value={salt}
                onChange={(e) => setSalt(e.target.value)}
              />
              <button
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
                onClick={() =>
                  setSalt(
                    String(
                      BigInt(nowSeconds()) * BigInt(1_000_000) + BigInt(Math.floor(Math.random() * 1_000_000)),
                    ),
                  )
                }
                type="button"
              >
                Randomize
              </button>
            </div>
          </label>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            disabled={!canInstall || isPending || installPending || executePending || revokePending}
            onClick={onInstall}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {installPending ? 'Installing…' : 'Sign + install policy (app tx)'}
          </button>
          <div className="text-xs text-zinc-600 dark:text-zinc-400">
            <div>PolicyManager: {deployed.policyManager}</div>
            <div>Policy: {deployed.morphoLendPolicy}</div>
          </div>
        </div>

        {policyConfig ? (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-zinc-600 dark:text-zinc-400">
              Show encoded policyConfig (bytes)
            </summary>
            <pre className="mt-2 overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs dark:border-zinc-800 dark:bg-black">
              {policyConfig}
            </pre>
          </details>
        ) : null}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-lg font-semibold">2) Installed policies (indexed from events)</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Policy IDs are discoverable via events; policy configs are not recoverable on-chain today. Use “Execute lend”
          here to trigger an execution from the app’s executor wallet (no user signature).
        </p>

        {!account ? (
          <div className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">Connect a wallet.</div>
        ) : installed.length === 0 ? (
          <div className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            No installs found for this wallet (from block {String(DEFAULT_FROM_BLOCK)}).
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <label className="text-sm text-zinc-600 dark:text-zinc-400">Select policyId</label>
              <select
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-black"
                value={selectedPolicyId ?? ''}
                onChange={(e) => setSelectedPolicyId(e.target.value as Hex)}
              >
                {installed.map((p) => (
                  <option key={p.policyId} value={p.policyId}>
                    {p.policyId}
                  </option>
                ))}
              </select>
            </div>

            {selectedPolicyId ? (
              <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                <div className="text-sm">
                  <span className="font-medium">policyId</span>: {selectedPolicyId}
                </div>
                {policyStatus[selectedPolicyId.toLowerCase()] ? (
                  <div className="text-sm">
                    <span className="font-medium">status</span>:{' '}
                    {policyStatus[selectedPolicyId.toLowerCase()].revoked
                      ? 'revoked'
                      : policyStatus[selectedPolicyId.toLowerCase()].installed
                        ? 'installed'
                        : 'unknown'}
                    <span className="text-zinc-600 dark:text-zinc-400">
                      {' '}
                      (validAfter={policyStatus[selectedPolicyId.toLowerCase()].validAfter || 0}, validUntil=
                      {policyStatus[selectedPolicyId.toLowerCase()].validUntil || 0})
                    </span>
                  </div>
                ) : null}
                <div className="text-sm">
                  <span className="font-medium">policyConfig</span>:{' '}
                  {selectedConfig ? (
                    <span className="text-zinc-600 dark:text-zinc-400">available in session</span>
                  ) : selectedStored?.policyConfig ? (
                    <span className="text-zinc-600 dark:text-zinc-400">available from local store</span>
                  ) : (
                    <span className="text-amber-700 dark:text-amber-400">
                      missing in session (will load from local store or prompt)
                    </span>
                  )}
                </div>

                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <button
                    onClick={() => onRevoke(selectedPolicyId)}
                    disabled={isPending || installPending || executePending || revokePending}
                    className="rounded-lg border border-zinc-200 px-4 py-2 text-sm dark:border-zinc-800"
                  >
                    {revokePending ? 'Revoking…' : 'Revoke (wallet tx)'}
                  </button>
                  <button
                    onClick={() => onExecute(selectedPolicyId)}
                    disabled={isPending || installPending || revokePending || executePending}
                    className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                  >
                    {executePending ? 'Executing…' : 'Execute lend (app tx)'}
                  </button>
                </div>

                <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-zinc-600 dark:text-zinc-400">assets (uint256)</span>
                    <input
                      className="rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-black"
                      value={executeAssets}
                      onChange={(e) => setExecuteAssets(e.target.value)}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-zinc-600 dark:text-zinc-400">nonce (uint256)</span>
                    <input
                      className="rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-black"
                      value={executeNonce}
                      onChange={(e) => setExecuteNonce(e.target.value)}
                    />
                  </label>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {executeResult ? (
          <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-800 dark:bg-black">
            <div>{executeResult.text}</div>
            {executeResult.txHash ? (
              <a
                className="mt-2 inline-block text-sm text-blue-600 underline dark:text-blue-400"
                href={txUrl(executeResult.txHash)}
                target="_blank"
                rel="noreferrer"
              >
                View transaction
              </a>
            ) : null}
            {executeResult.details || executeResult.debug ? (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-zinc-600 dark:text-zinc-400">
                  Show error details
                </summary>
                <pre className="mt-2 overflow-x-auto rounded-lg border border-zinc-200 bg-white p-3 text-xs dark:border-zinc-800 dark:bg-black">
                  {JSON.stringify(
                    { details: executeResult.details, debug: executeResult.debug },
                    null,
                    2,
                  )}
                </pre>
              </details>
            ) : null}
          </div>
        ) : null}
      </section>

      {/* Intentionally omitted: protocol ergonomics notes. */}
    </div>
  );
}

