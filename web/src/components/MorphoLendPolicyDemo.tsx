'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Hex } from 'viem';
import { getAddress, isAddress, parseAbiItem } from 'viem';
import { useAccount, useWriteContract } from 'wagmi';

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

const DEFAULT_FROM_BLOCK = BigInt('36707209'); // deployment block from your logs

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export function MorphoLendPolicyDemo() {
  const { address: account } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();

  const [vault, setVault] = useState('');
  const [executor, setExecutor] = useState(process.env.NEXT_PUBLIC_EXECUTOR_ADDRESS ?? '');
  const [allowance, setAllowance] = useState('0');
  const [period, setPeriod] = useState('86400');
  const [start, setStart] = useState(String(nowSeconds()));
  const [end, setEnd] = useState(String(nowSeconds() + 60 * 60 * 24 * 30));
  const [validAfter, setValidAfter] = useState('0');
  const [validUntil, setValidUntil] = useState('0');
  const [salt, setSalt] = useState(() =>
    String(
      BigInt(nowSeconds()) * BigInt(1_000_000) + BigInt(Math.floor(Math.random() * 1_000_000)),
    ),
  );

  const [installed, setInstalled] = useState<InstalledPolicy[]>([]);
  const [selectedPolicyId, setSelectedPolicyId] = useState<Hex | null>(null);
  const [executeAssets, setExecuteAssets] = useState('0');
  const [executeNonce, setExecuteNonce] = useState(() => String(BigInt(nowSeconds())));
  const [executeResult, setExecuteResult] = useState<string | null>(null);
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

  async function onInstall() {
    if (!account || !policyConfig) return;

    const binding = {
      account: getAddress(account),
      policy: deployed.morphoLendPolicy,
      validAfter: BigInt(validAfter || '0'),
      validUntil: BigInt(validUntil || '0'),
      salt: BigInt(salt || '0'),
      policyConfigHash: hashPolicyConfig(policyConfig),
    } as const;

    const policyId = (await baseSepoliaPublicClient.readContract({
      address: deployed.policyManager,
      abi: policyManagerAbi,
      functionName: 'getPolicyId',
      args: [binding],
    })) as Hex;

    await writeContractAsync({
      address: deployed.policyManager,
      abi: policyManagerAbi,
      functionName: 'installPolicy',
      args: [binding, policyConfig],
    });

    setSessionPolicyConfigs((prev) => ({ ...prev, [policyId.toLowerCase()]: policyConfig }));
    setSelectedPolicyId(policyId);
    setExecuteResult(`Installed policy ${policyId}`);
  }

  async function onRevoke(policyId: Hex) {
    if (!account) return;
    await writeContractAsync({
      address: deployed.policyManager,
      abi: policyManagerAbi,
      functionName: 'revokePolicy',
      args: [deployed.morphoLendPolicy, policyId],
    });
    setExecuteResult(`Revoked policy ${policyId}`);
  }

  async function onExecute(policyId: Hex) {
    if (!account) return;
    const policyConfigHex =
      sessionPolicyConfigs[policyId.toLowerCase()] ??
      (prompt('Paste the policyConfig hex for this policyId (required):') as Hex | null);

    if (!policyConfigHex) return;

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

    const json = (await res.json()) as { hash?: string; error?: string };
    if (!res.ok || !json.hash) {
      setExecuteResult(json.error ?? 'Execution failed');
      return;
    }

    setSessionPolicyConfigs((prev) => ({ ...prev, [policyId.toLowerCase()]: policyConfigHex }));
    setExecuteResult(`Executed: ${json.hash}`);
  }

  const selectedConfig = selectedPolicyId
    ? sessionPolicyConfigs[selectedPolicyId.toLowerCase()]
    : undefined;

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

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Binding validAfter (uint40)</span>
            <input
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-black"
              value={validAfter}
              onChange={(e) => setValidAfter(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Binding validUntil (uint40)</span>
            <input
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-black"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
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
            disabled={!canInstall || isPending}
            onClick={onInstall}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Install policy
          </button>
          <div className="text-xs text-zinc-600 dark:text-zinc-400">
            PolicyManager: {deployed.policyManager} • Policy: {deployed.morphoLendPolicy}
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
          Policy IDs are discoverable via events; policy configs are not recoverable on-chain today.
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
                <div className="text-sm">
                  <span className="font-medium">policyConfig</span>:{' '}
                  {selectedConfig ? (
                    <span className="text-zinc-600 dark:text-zinc-400">available in session</span>
                  ) : (
                    <span className="text-amber-700 dark:text-amber-400">
                      missing in session (you’ll be prompted on execute)
                    </span>
                  )}
                </div>

                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <button
                    onClick={() => onRevoke(selectedPolicyId)}
                    className="rounded-lg border border-zinc-200 px-4 py-2 text-sm dark:border-zinc-800"
                  >
                    Revoke (wallet tx)
                  </button>
                  <button
                    onClick={() => onExecute(selectedPolicyId)}
                    className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                  >
                    Execute lend (app tx)
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
            {executeResult}
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-lg font-semibold">Protocol ergonomics gaps (worth adding getters)</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-600 dark:text-zinc-400">
          <li>
            No on-chain way to enumerate policies for an account (dashboard requires event indexing).
          </li>
          <li>
            MorphoLendPolicy stores only <code>configHash</code> internally; you can’t recover or even read
            it on-chain (UI must persist the config bytes off-chain).
          </li>
          <li>
            Recurring allowance usage (<code>spend</code> for the current period) has no getter, so the UI
            can’t show “remaining allowance” without adding a view function.
          </li>
        </ul>
      </section>
    </div>
  );
}

