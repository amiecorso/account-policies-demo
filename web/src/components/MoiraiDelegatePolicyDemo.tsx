'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Hex } from 'viem';
import { formatUnits, getAddress, isAddress, parseAbiItem, parseUnits } from 'viem';
import { useAccount, useWriteContract } from 'wagmi';

import { deployed, tokens } from '../contracts/addresses';
import { policyManagerAbi } from '../contracts/abi';
import { baseSepoliaPublicClient } from '../lib/baseSepolia';
import {
  buildDelegateConfigFromSend,
  encodeMoiraiDelegatePolicyConfig,
  hashPolicyConfig,
  type Asset,
} from '../lib/moiraiDelegateEncoding';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;
const DEFAULT_FROM_BLOCK = BigInt(process.env.NEXT_PUBLIC_POLICY_EVENTS_FROM_BLOCK ?? '0');

const ASSETS: { label: string; value: Asset; decimals: number; address?: `0x${string}` }[] = [
  { label: 'ETH', value: 'ETH', decimals: 18 },
  { label: 'USDC', value: 'USDC', decimals: 6, address: tokens.usdc },
  { label: 'MIGGLES', value: 'MIGGLES', decimals: 18, address: tokens.miggles },
];

type InstalledPolicy = {
  policyId: Hex;
  policy?: `0x${string}`;
  txHash?: Hex;
};

type StoredPolicy = {
  chainId: number;
  account: `0x${string}`;
  policyId: Hex;
  policy: `0x${string}`;
  policyConfig: Hex;
  binding?: {
    validAfter: string;
    validUntil: string;
    salt: string;
  };
  installTxHash?: Hex;
};

type PolicyStatus = {
  installed: boolean;
  uninstalled: boolean;
  validAfter: number;
  validUntil: number;
};

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function freshNonce(): string {
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

export function MoiraiDelegatePolicyDemo() {
  const { address: account } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();
  const [installPending, setInstallPending] = useState(false);
  const [executePending, setExecutePending] = useState(false);
  const [revokePending, setRevokePending] = useState(false);

  // policyConfig fields (excludes target/value/callData — built from send params)
  const [executor, setExecutor] = useState(process.env.NEXT_PUBLIC_EXECUTOR_ADDRESS ?? '');
  const [unlockTimestamp, setUnlockTimestamp] = useState('0');
  const [consensusSigner, setConsensusSigner] = useState('');
  const [validAfter, setValidAfter] = useState('0');
  const [validUntil, setValidUntil] = useState(String(nowSeconds() + 60 * 60 * 24 * 30));
  const [salt, setSalt] = useState(() =>
    String(BigInt(nowSeconds()) * BigInt(1_000_000) + BigInt(Math.floor(Math.random() * 1_000_000))),
  );

  // Send transaction params (component builds target/value/callData from these)
  const [selectedAsset, setSelectedAsset] = useState<Asset>('ETH');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');

  const [installed, setInstalled] = useState<InstalledPolicy[]>([]);
  const [selectedPolicyId, setSelectedPolicyId] = useState<Hex | null>(null);
  const [storedPolicies, setStoredPolicies] = useState<Record<string, StoredPolicy>>({});
  const [policyStatus, setPolicyStatus] = useState<Record<string, PolicyStatus>>({});
  const [executeNonce, setExecuteNonce] = useState(() => freshNonce());
  const [executeResult, setExecuteResult] = useState<{
    text: string;
    txHash?: Hex;
    details?: unknown;
    debug?: unknown;
  } | null>(null);
  const [sessionPolicyConfigs, setSessionPolicyConfigs] = useState<Record<string, Hex>>({});

  const assetMeta = ASSETS.find((a) => a.value === selectedAsset)!;

  const amountBigInt = useMemo(() => {
    try {
      return amount ? parseUnits(amount, assetMeta.decimals) : BigInt(0);
    } catch {
      return BigInt(0);
    }
  }, [amount, assetMeta.decimals]);

  const canInstall = useMemo(() => {
    if (!account) return false;
    if (!isAddress(executor)) return false;
    if (!isAddress(recipient)) return false;
    if (amountBigInt === BigInt(0)) return false;
    const hasTimelock = Number(unlockTimestamp) > 0;
    const hasConsensus = isAddress(consensusSigner) && consensusSigner !== ZERO_ADDRESS;
    return hasTimelock || hasConsensus;
  }, [account, executor, recipient, amountBigInt, unlockTimestamp, consensusSigner]);

  const policyConfig = useMemo(() => {
    if (!canInstall || !account) return null;
    try {
      const { target, value, callData } = buildDelegateConfigFromSend({
        asset: selectedAsset,
        recipient: getAddress(recipient),
        amount: amountBigInt,
        tokenAddress: assetMeta.address,
      });
      return encodeMoiraiDelegatePolicyConfig({
        executor: getAddress(executor),
        target,
        value,
        callData,
        unlockTimestamp: BigInt(unlockTimestamp || '0'),
        consensusSigner:
          isAddress(consensusSigner)
            ? getAddress(consensusSigner)
            : ZERO_ADDRESS,
      });
    } catch {
      return null;
    }
  }, [canInstall, account, selectedAsset, recipient, amountBigInt, executor, unlockTimestamp, consensusSigner, assetMeta.address]);

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
        args: { account: acct },
        fromBlock: DEFAULT_FROM_BLOCK,
        toBlock: 'latest',
      });
      if (cancelled) return;
      const next = logs
        .filter((l) => (l.args.policy as string).toLowerCase() === deployed.moiraiDelegatePolicy.toLowerCase())
        .map((l) => ({
          policyId: l.args.policyId as Hex,
          policy: getAddress(l.args.policy as `0x${string}`),
          txHash: l.transactionHash as Hex | undefined,
        }))
        .reverse();

      setInstalled((prev) => {
        if (next.length === 0) return prev;
        const map = new Map<string, InstalledPolicy>();
        for (const p of prev) map.set(p.policyId.toLowerCase(), p);
        for (const p of next) map.set(p.policyId.toLowerCase(), p);
        return Array.from(map.values());
      });
      if (!selectedPolicyId && next[0]) setSelectedPolicyId(next[0].policyId);
    }
    load().catch(() => {});
    return () => { cancelled = true; };
  }, [account, selectedPolicyId]);

  useEffect(() => {
    if (!account) { setStoredPolicies({}); return; }
    let cancelled = false;
    async function loadStored() {
      const res = await fetch(
        `/api/policies?account=${encodeURIComponent(account!)}&chainId=${deployed.chainId}`,
      );
      const json = (await res.json()) as { policies?: StoredPolicy[] };
      if (cancelled) return;
      const map: Record<string, StoredPolicy> = {};
      for (const p of json.policies ?? []) {
        if (p.policy?.toLowerCase() === deployed.moiraiDelegatePolicy.toLowerCase()) {
          map[p.policyId.toLowerCase()] = p;
        }
      }
      setStoredPolicies(map);
    }
    loadStored().catch(() => { if (!cancelled) setStoredPolicies({}); });
    return () => { cancelled = true; };
  }, [account]);

  useEffect(() => {
    if (!account) { setPolicyStatus({}); return; }
    let cancelled = false;
    async function loadStatus() {
      if (installed.length === 0) { setPolicyStatus({}); return; }
      const next: Record<string, PolicyStatus> = {};
      await Promise.all(
        installed.map(async (p) => {
          if (!p.policy) return;
          try {
            const [isInstalled, isUninstalled, _acct, vAfter, vUntil] =
              (await baseSepoliaPublicClient.readContract({
                address: deployed.policyManager,
                abi: policyManagerAbi,
                functionName: 'getPolicyRecord',
                args: [p.policy, p.policyId],
              })) as [boolean, boolean, `0x${string}`, bigint, bigint];
            void _acct;
            next[p.policyId.toLowerCase()] = {
              installed: isInstalled,
              uninstalled: isUninstalled,
              validAfter: Number(vAfter),
              validUntil: Number(vUntil),
            };
          } catch {}
        }),
      );
      if (!cancelled) setPolicyStatus(next);
    }
    loadStatus().catch(() => { if (!cancelled) setPolicyStatus({}); });
    return () => { cancelled = true; };
  }, [account, installed]);

  useEffect(() => {
    if (!selectedPolicyId) return;
    const key = selectedPolicyId.toLowerCase();
    if (sessionPolicyConfigs[key]) return;
    const stored = storedPolicies[key];
    if (!stored?.policyConfig) return;
    setSessionPolicyConfigs((prev) => ({ ...prev, [key]: stored.policyConfig }));
  }, [selectedPolicyId, sessionPolicyConfigs, storedPolicies]);

  async function onInstall() {
    if (!account || !policyConfig) return;
    if (installPending) return;
    setInstallPending(true);

    const binding = {
      account: getAddress(account),
      policy: deployed.moiraiDelegatePolicy,
      validAfter: BigInt(validAfter || '0'),
      validUntil: BigInt(validUntil || '0'),
      salt: BigInt(salt || '0'),
      policyConfig,
    } as const;

    try {
      const code = await baseSepoliaPublicClient.getBytecode({ address: deployed.policyManager });
      if (!code) {
        setExecuteResult({
          text: `No contract bytecode at PolicyManager ${deployed.policyManager}. Check NEXT_PUBLIC_POLICY_MANAGER_ADDRESS.`,
        });
        return;
      }

      const policyId = (await baseSepoliaPublicClient.readContract({
        address: deployed.policyManager,
        abi: policyManagerAbi,
        functionName: 'getPolicyId',
        args: [binding],
      })) as Hex;

      const hash = await writeContractAsync({
        address: deployed.policyManager,
        abi: policyManagerAbi,
        functionName: 'install',
        args: [binding],
      });

      setSessionPolicyConfigs((prev) => ({ ...prev, [policyId.toLowerCase()]: policyConfig }));
      setInstalled((prev) => {
        const key = policyId.toLowerCase();
        if (prev.some((p) => p.policyId.toLowerCase() === key)) return prev;
        return [{ policyId, policy: binding.policy, txHash: hash }, ...prev];
      });
      setSelectedPolicyId(policyId);
      setExecuteResult({ text: `Installed policy ${policyId}`, txHash: hash });

      await fetch('/api/policies', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'upsert',
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
    } finally {
      setInstallPending(false);
    }
  }

  async function onUninstall(input: { policyId: Hex; policy?: `0x${string}` }) {
    if (!account) return;
    if (revokePending) return;
    if (!input.policy) {
      setExecuteResult({ text: 'Missing policy address for this policyId.' });
      return;
    }
    setRevokePending(true);
    try {
      const key = input.policyId.toLowerCase();
      const storedCfg = storedPolicies[key];
      const policyConfigHex =
        sessionPolicyConfigs[key] ?? storedCfg?.policyConfig ?? ('0x' as Hex);

      const hash = await writeContractAsync({
        address: deployed.policyManager,
        abi: policyManagerAbi,
        functionName: 'uninstall',
        args: [
          {
            binding: {
              account: getAddress(account),
              policy: input.policy,
              policyConfig: policyConfigHex,
              validAfter: BigInt(storedCfg?.binding?.validAfter ?? 0),
              validUntil: BigInt(storedCfg?.binding?.validUntil ?? 0),
              salt: BigInt(storedCfg?.binding?.salt ?? 0),
            },
            policy: input.policy,
            policyId: input.policyId,
            policyConfig: policyConfigHex,
            uninstallData: '0x',
          },
        ],
      });
      setExecuteResult({ text: `Uninstalled policy ${input.policyId}`, txHash: hash });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isRejection =
        message.toLowerCase().includes('rejected') ||
        message.toLowerCase().includes('cancelled') ||
        message.toLowerCase().includes('denied');
      if (!isRejection) {
        setExecuteResult({ text: `Uninstall failed: ${message}` });
      }
    } finally {
      setRevokePending(false);
    }
  }

  async function onExecute(policyId: Hex) {
    if (!account) return;
    if (executePending) return;
    let policyConfigHex: Hex | undefined = sessionPolicyConfigs[policyId.toLowerCase()];
    if (!policyConfigHex) {
      const stored = storedPolicies[policyId.toLowerCase()];
      if (stored?.policyConfig) {
        policyConfigHex = stored.policyConfig;
        setSessionPolicyConfigs((prev) => ({ ...prev, [policyId.toLowerCase()]: policyConfigHex! }));
      }
    }
    if (!policyConfigHex) {
      policyConfigHex = (prompt('Paste the policyConfig hex for this policyId:') ?? undefined) as Hex | undefined;
    }
    if (!policyConfigHex) return;

    setExecutePending(true);
    try {
      setExecuteResult(null);
      const res = await fetch('/api/moirai-delegate/execute', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          account,
          policyId,
          policyConfig: policyConfigHex,
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

  const selectedConfig = selectedPolicyId ? sessionPolicyConfigs[selectedPolicyId.toLowerCase()] : undefined;
  const selectedStored = selectedPolicyId ? storedPolicies[selectedPolicyId.toLowerCase()] : undefined;
  const selectedInstalled = selectedPolicyId
    ? installed.find((p) => p.policyId.toLowerCase() === selectedPolicyId.toLowerCase())
    : undefined;

  const humanAmount = amount
    ? `${amount} ${selectedAsset}`
    : `0 ${selectedAsset}`;

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-lg font-semibold">1) Configure + install Moirai Delegate policy</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Delegates a fixed send transaction from your smart wallet, gated by a timelock and/or a
          consensus co-signer. The wallet signs an EIP-712 PolicyBinding; the app&apos;s executor
          broadcasts the install transaction.
        </p>

        <div className="mt-5">
          <h3 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Transaction to delegate</h3>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-500">
            Defines what the policy will execute — target, value, and calldata are pinned at install time.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm sm:col-span-1">
              <span className="text-zinc-600 dark:text-zinc-400">Asset</span>
              <select
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-black"
                value={selectedAsset}
                onChange={(e) => setSelectedAsset(e.target.value as Asset)}
              >
                {ASSETS.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
              {assetMeta.address ? (
                <span className="text-xs text-zinc-500 dark:text-zinc-500 font-mono break-all">
                  {assetMeta.address}
                </span>
              ) : null}
            </label>

            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="text-zinc-600 dark:text-zinc-400">
                Amount ({selectedAsset}, {assetMeta.decimals} decimals)
              </span>
              <input
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-black"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`e.g. 0.01`}
              />
              {amountBigInt > BigInt(0) ? (
                <span className="text-xs text-zinc-500 dark:text-zinc-500">
                  raw: {amountBigInt.toString()} ({formatUnits(amountBigInt, assetMeta.decimals)} {selectedAsset})
                </span>
              ) : null}
            </label>

            <label className="flex flex-col gap-1 text-sm sm:col-span-3">
              <span className="text-zinc-600 dark:text-zinc-400">Recipient address</span>
              <input
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-black"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="0x..."
              />
            </label>
          </div>
        </div>

        <div className="mt-5">
          <h3 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Policy conditions</h3>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-500">
            At least one of timelock or consensus signer must be set.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">
                Unlock timestamp (unix seconds, 0 = no timelock)
              </span>
              <input
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-black"
                value={unlockTimestamp}
                onChange={(e) => setUnlockTimestamp(e.target.value)}
                placeholder="0"
              />
              {Number(unlockTimestamp) > 0 ? (
                <span className="text-xs text-zinc-500 dark:text-zinc-500">
                  {new Date(Number(unlockTimestamp) * 1000).toLocaleString()}
                </span>
              ) : null}
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">
                Consensus signer (EOA, address(0) = none)
              </span>
              <input
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-black"
                value={consensusSigner}
                onChange={(e) => setConsensusSigner(e.target.value)}
                placeholder="0x... or leave blank"
              />
              {executor && consensusSigner === '' ? (
                <button
                  type="button"
                  className="mt-1 self-start text-xs text-blue-600 underline dark:text-blue-400"
                  onClick={() => setConsensusSigner(executor)}
                >
                  Use executor address
                </button>
              ) : null}
            </label>
          </div>
        </div>

        <div className="mt-5">
          <h3 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Policy binding</h3>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
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
              <span className="text-zinc-600 dark:text-zinc-400">Valid after (unix seconds, uint40)</span>
              <input
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-black"
                value={validAfter}
                onChange={(e) => setValidAfter(e.target.value)}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">Valid until (unix seconds, uint40)</span>
              <input
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-black"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </label>

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
                        BigInt(nowSeconds()) * BigInt(1_000_000) +
                          BigInt(Math.floor(Math.random() * 1_000_000)),
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
        </div>

        {!canInstall && account ? (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400">
            {!isAddress(executor)
              ? 'Enter a valid executor address.'
              : !isAddress(recipient)
                ? 'Enter a valid recipient address.'
                : amountBigInt === BigInt(0)
                  ? 'Enter a non-zero amount.'
                  : 'Set at least one condition: unlock timestamp > 0, or a consensus signer address.'}
          </div>
        ) : null}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            disabled={!canInstall || isPending || installPending || executePending || revokePending}
            onClick={onInstall}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {installPending ? 'Installing…' : 'Install policy (wallet tx)'}
          </button>
          <div className="text-xs text-zinc-600 dark:text-zinc-400">
            <div>PolicyManager: {deployed.policyManager}</div>
            <div>Policy: {deployed.moiraiDelegatePolicy}</div>
          </div>
        </div>

        {policyConfig ? (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-zinc-600 dark:text-zinc-400">
              Show encoded policyConfig (bytes)
            </summary>
            <div className="mt-2 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-black dark:text-zinc-400">
              <div><span className="font-medium">Send:</span> {humanAmount} → {recipient || '(no recipient)'}</div>
              <div><span className="font-medium">Timelock:</span> {Number(unlockTimestamp) > 0 ? new Date(Number(unlockTimestamp) * 1000).toLocaleString() : 'none'}</div>
              <div><span className="font-medium">Consensus signer:</span> {(consensusSigner && consensusSigner !== ZERO_ADDRESS) ? consensusSigner : 'none'}</div>
            </div>
            <pre className="mt-2 overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs dark:border-zinc-800 dark:bg-black">
              {policyConfig}
            </pre>
          </details>
        ) : null}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-lg font-semibold">2) Installed Moirai Delegate policies</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Execute triggers the delegated send. The executor signs the execution intent; if a
          consensus signer equals the executor address, the executor also signs the ConsensusApproval.
        </p>

        {!account ? (
          <div className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">Connect a wallet.</div>
        ) : installed.length === 0 ? (
          <div className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            No MoiraiDelegate installs found for this wallet (from block {String(DEFAULT_FROM_BLOCK)}).
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
                  <span className="font-medium">policyId</span>:{' '}
                  <span className="font-mono text-xs break-all">{selectedPolicyId}</span>
                </div>
                {selectedInstalled?.txHash ? (
                  <div className="text-sm">
                    <span className="font-medium">install tx</span>:{' '}
                    <a
                      href={txUrl(selectedInstalled.txHash)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-blue-600 underline dark:text-blue-400"
                    >
                      {selectedInstalled.txHash.slice(0, 18)}…
                    </a>
                  </div>
                ) : null}
                {policyStatus[selectedPolicyId.toLowerCase()] ? (
                  <div className="text-sm">
                    <span className="font-medium">status</span>:{' '}
                    {policyStatus[selectedPolicyId.toLowerCase()].uninstalled
                      ? 'uninstalled'
                      : policyStatus[selectedPolicyId.toLowerCase()].installed
                        ? 'installed'
                        : 'unknown'}
                    <span className="text-zinc-600 dark:text-zinc-400">
                      {' '}(validAfter={policyStatus[selectedPolicyId.toLowerCase()].validAfter},
                      validUntil={policyStatus[selectedPolicyId.toLowerCase()].validUntil})
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
                      missing — will prompt on execute
                    </span>
                  )}
                </div>

                <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                    <span className="text-zinc-600 dark:text-zinc-400">Execution nonce (uint256)</span>
                    <div className="flex gap-2">
                      <input
                        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-black"
                        value={executeNonce}
                        onChange={(e) => setExecuteNonce(e.target.value)}
                      />
                      <button
                        type="button"
                        className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
                        onClick={() => setExecuteNonce(freshNonce())}
                      >
                        Refresh
                      </button>
                    </div>
                  </label>
                </div>

                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <button
                    onClick={() => {
                      if (!selectedInstalled) return;
                      void onUninstall({ policyId: selectedInstalled.policyId, policy: selectedInstalled.policy });
                    }}
                    disabled={isPending || installPending || executePending || revokePending}
                    className="rounded-lg border border-zinc-200 px-4 py-2 text-sm dark:border-zinc-800"
                  >
                    {revokePending ? 'Uninstalling…' : 'Uninstall (wallet tx)'}
                  </button>
                  <button
                    onClick={() => onExecute(selectedPolicyId)}
                    disabled={isPending || installPending || revokePending || executePending}
                    className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                  >
                    {executePending ? 'Executing…' : 'Execute send (app tx)'}
                  </button>
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
                  {JSON.stringify({ details: executeResult.details, debug: executeResult.debug }, null, 2)}
                </pre>
              </details>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
