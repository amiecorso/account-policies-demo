import { NextResponse } from 'next/server';
import { baseSepolia } from 'viem/chains';
import { createWalletClient, getAddress, http, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import { deployed } from '../../../../contracts/addresses';
import { policyManagerAbi } from '../../../../contracts/abi';

type BindingBody = {
  account: `0x${string}`;
  policy: `0x${string}`;
  validAfter: string; // decimal string -> bigint
  validUntil: string; // decimal string -> bigint
  salt: string; // decimal string -> bigint
  policyConfigHash: Hex;
};

type Body = {
  binding: BindingBody;
  policyConfig: Hex;
  userSig: Hex;
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<Body>;
    const binding = body.binding;
    const policyConfig = body.policyConfig as Hex | undefined;
    const userSig = body.userSig as Hex | undefined;

    if (!binding || !policyConfig || !userSig) {
      return NextResponse.json(
        { error: 'Missing required fields: binding, policyConfig, userSig' },
        { status: 400 },
      );
    }

    const executorKey = requireEnv('EXECUTOR_PRIVATE_KEY') as Hex;
    const rpcUrl = requireEnv('BASE_SEPOLIA_RPC_URL');

    const executor = privateKeyToAccount(executorKey);
    const client = createWalletClient({
      chain: baseSepolia,
      account: executor,
      transport: http(rpcUrl),
    });

    const hash = await client.writeContract({
      address: deployed.policyManager,
      abi: policyManagerAbi,
      functionName: 'installPolicyWithSignature',
      args: [
        {
          account: getAddress(binding.account),
          policy: getAddress(binding.policy),
          validAfter: BigInt(binding.validAfter),
          validUntil: BigInt(binding.validUntil),
          salt: BigInt(binding.salt),
          policyConfigHash: binding.policyConfigHash,
        },
        policyConfig,
        userSig,
      ],
    });

    return NextResponse.json({ hash });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

