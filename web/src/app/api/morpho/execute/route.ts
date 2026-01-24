import { NextResponse } from 'next/server';
import { baseSepolia } from 'viem/chains';
import {
  BaseError,
  decodeAbiParameters,
  erc20Abi,
  type Abi,
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import { deployed } from '../../../../contracts/addresses';
import {
  morphoLendPolicyAbi,
  policyManagerAbi,
  recurringAllowanceErrorsAbi,
} from '../../../../contracts/abi';
import {
  encodeMorphoLendPolicyData,
  hashLendData,
  hashPolicyConfig,
} from '../../../../lib/morphoLendPolicyEncoding';

type Body = {
  account: `0x${string}`;
  policyId: Hex;
  policyConfig: Hex;
  assets: string; // decimal string -> bigint
  nonce: string; // decimal string -> bigint
};

type DecodedPolicyConfig = {
  executor: `0x${string}`;
  vault: `0x${string}`;
  depositLimit: {
    allowance: bigint;
    period: bigint;
    start: bigint;
    end: bigint;
  };
};

function jsonSafe(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = jsonSafe(v);
    return out;
  }
  return value;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export async function POST(req: Request) {
  let debug:
    | (Record<string, unknown> & {
        policyActiveNow?: boolean;
        vaultAsset?: `0x${string}`;
        token?: `0x${string}`;
        walletBalance?: bigint;
        walletAllowance?: bigint;
      })
    | undefined;

  try {
    const body = (await req.json()) as Partial<Body>;
    const account = getAddress(body.account ?? '0x0000000000000000000000000000000000000000');
    const policyId = body.policyId as Hex | undefined;
    const policyConfig = body.policyConfig as Hex | undefined;
    const assets = body.assets ? BigInt(body.assets) : undefined;
    const nonce = body.nonce ? BigInt(body.nonce) : undefined;

    if (!policyId || !policyConfig || assets === undefined || nonce === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: policyId, policyConfig, assets, nonce, account' },
        { status: 400 },
      );
    }

    const executorKey = requireEnv('EXECUTOR_PRIVATE_KEY') as Hex;
    const rpcUrl = requireEnv('BASE_SEPOLIA_RPC_URL');

    const executor = privateKeyToAccount(executorKey);
    const policyConfigHash = hashPolicyConfig(policyConfig);
    const policyDataHash = hashLendData({ assets, nonce });

    const signature = await executor.signTypedData({
      domain: {
        name: 'Morpho Lend Policy',
        version: '1',
        chainId: baseSepolia.id,
        verifyingContract: deployed.morphoLendPolicy,
      },
      primaryType: 'Execution',
      types: {
        Execution: [
          { name: 'policyId', type: 'bytes32' },
          { name: 'account', type: 'address' },
          { name: 'policyConfigHash', type: 'bytes32' },
          { name: 'policyDataHash', type: 'bytes32' },
        ],
      },
      message: {
        policyId,
        account,
        policyConfigHash,
        policyDataHash,
      },
    });

    const policyData = encodeMorphoLendPolicyData({
      assets,
      nonce,
      signature,
    });

    const client = createWalletClient({
      chain: baseSepolia,
      account: executor,
      transport: http(rpcUrl),
    });

    // Preflight to surface useful revert reasons (viem can often decode custom errors here).
    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(rpcUrl),
    });

    // Decode config so we can include useful debug info on failure.
    const [{ executor: cfgExecutor, vault: cfgVault }] = decodeAbiParameters(
      [
        {
          type: 'tuple',
          components: [
            { name: 'executor', type: 'address' },
            { name: 'vault', type: 'address' },
            {
              name: 'depositLimit',
              type: 'tuple',
              components: [
                { name: 'allowance', type: 'uint160' },
                { name: 'period', type: 'uint48' },
                { name: 'start', type: 'uint48' },
                { name: 'end', type: 'uint48' },
              ],
            },
          ],
        },
      ],
      policyConfig,
    ) as unknown as [DecodedPolicyConfig];

    debug = {
      policyManager: deployed.policyManager,
      policy: deployed.morphoLendPolicy,
      account,
      policyId,
      executor: cfgExecutor,
      vault: cfgVault,
      assets: assets.toString(),
      nonce: nonce.toString(),
      policyActiveNow: (await publicClient.readContract({
        address: deployed.policyManager,
        abi: policyManagerAbi,
        functionName: 'isPolicyActiveNow',
        args: [deployed.morphoLendPolicy, policyId],
      })) as boolean,
      vaultAsset: (await publicClient.readContract({
        address: getAddress(cfgVault),
        abi: [{ type: 'function', name: 'asset', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' }],
        functionName: 'asset',
        args: [],
      })) as `0x${string}`,
    } as const;

    const token = getAddress(debug.vaultAsset);
    const walletBalance = (await publicClient.readContract({
      address: token,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [account],
    })) as bigint;
    const walletAllowance = (await publicClient.readContract({
      address: token,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [account, getAddress(cfgVault)],
    })) as bigint;

    debug = {
      ...debug,
      token,
      walletBalance,
      walletAllowance,
    };

    // Add policy/library errors so viem can decode custom error selectors bubbling up through PolicyManager.execute.
    const simulateAbi: Abi = [
      ...(policyManagerAbi as Abi),
      ...(morphoLendPolicyAbi as Abi),
      ...(recurringAllowanceErrorsAbi as Abi),
    ];

    await publicClient.simulateContract({
      address: deployed.policyManager,
      abi: simulateAbi,
      functionName: 'execute',
      args: [deployed.morphoLendPolicy, policyId, policyConfig, policyData],
      account: executor,
    });

    const hash = await client.writeContract({
      address: deployed.policyManager,
      abi: policyManagerAbi,
      functionName: 'execute',
      args: [deployed.morphoLendPolicy, policyId, policyConfig, policyData],
    });

    return NextResponse.json({ hash });
  } catch (err) {
    const details =
      err instanceof BaseError
        ? {
            shortMessage: err.shortMessage,
            details: err.details,
            metaMessages: err.metaMessages,
          }
        : undefined;

    const message =
      err instanceof BaseError
        ? // Prefer metaMessages because this is where viem includes decoded custom errors like ExceededAllowance(...)
          (err.metaMessages && err.metaMessages.length > 0
            ? err.metaMessages.join('\n')
            : err.shortMessage)
        : err instanceof Error
          ? err.message
          : String(err);
    // Note: we intentionally do not log server-side to avoid leaking sensitive envs; return debug instead.
    return NextResponse.json(
      {
        error: message,
        details,
        debug: debug ? (jsonSafe(debug) as Record<string, unknown>) : undefined,
      },
      { status: 500 },
    );
  }
}

