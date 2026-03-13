import { NextResponse } from 'next/server';
import type { Hex } from 'viem';
import { getAddress } from 'viem';

import { deployed } from '../../../contracts/addresses';
import { deletePolicy, listPolicies, upsertPolicy } from '../../../lib/policyStore.server';

type UpsertBody = {
  action?: 'upsert' | 'delete';
  chainId?: number;
  account: `0x${string}`;
  policyId: Hex;
  policy?: `0x${string}`;
  policyConfig?: Hex;
  binding?: {
    validAfter: string;
    validUntil: string;
    salt: string;
    policyConfigHash: Hex;
  };
  installTxHash?: Hex;
  uninstalled?: boolean;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const account = url.searchParams.get('account');
  const chainId = Number(url.searchParams.get('chainId') ?? deployed.chainId);
  if (!account) return NextResponse.json({ error: 'Missing account' }, { status: 400 });

  const rows = await listPolicies({ chainId, account: getAddress(account) });
  return NextResponse.json({ policies: rows });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as UpsertBody;
    const action = body.action ?? 'upsert';
    const chainId = body.chainId ?? deployed.chainId;
    const account = getAddress(body.account);
    const policyId = body.policyId;

    if (action === 'delete') {
      const ok = await deletePolicy({ chainId, account, policyId });
      return NextResponse.json({ deleted: ok });
    }

    if (!body.policy || !body.policyConfig || !body.binding) {
      return NextResponse.json(
        { error: 'Missing required fields for upsert: policy, policyConfig, binding' },
        { status: 400 },
      );
    }

    const saved = await upsertPolicy({
      chainId,
      account,
      policyId,
      policy: getAddress(body.policy),
      policyConfig: body.policyConfig,
      binding: body.binding,
      installTxHash: body.installTxHash,
      uninstalled: body.uninstalled,
    });

    return NextResponse.json({ policy: saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

