import { NextResponse } from 'next/server';
import { baseSepolia } from 'viem/chains';
import {
  createWalletClient,
  getAddress,
  http,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import { deployed } from '../../../../contracts/addresses';
import { policyManagerAbi } from '../../../../contracts/abi';
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

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export async function POST(req: Request) {
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

    const hash = await client.writeContract({
      address: deployed.policyManager,
      abi: policyManagerAbi,
      functionName: 'execute',
      args: [deployed.morphoLendPolicy, policyId, policyConfig, policyData],
    });

    return NextResponse.json({ hash });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

