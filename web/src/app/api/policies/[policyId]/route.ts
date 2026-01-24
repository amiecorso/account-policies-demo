import { NextResponse } from 'next/server';
import type { Hex } from 'viem';
import { getAddress } from 'viem';

import { deployed } from '../../../../contracts/addresses';
import { deletePolicy, getPolicy } from '../../../../lib/policyStore.server';

export async function GET(req: Request, ctx: { params: Promise<{ policyId: string }> }) {
  const { policyId } = await ctx.params;
  const url = new URL(req.url);
  const account = url.searchParams.get('account');
  const chainId = Number(url.searchParams.get('chainId') ?? deployed.chainId);
  if (!account) return NextResponse.json({ error: 'Missing account' }, { status: 400 });

  const row = await getPolicy({
    chainId,
    account: getAddress(account),
    policyId: policyId as Hex,
  });

  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ policy: row });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ policyId: string }> }) {
  const { policyId } = await ctx.params;
  const url = new URL(req.url);
  const account = url.searchParams.get('account');
  const chainId = Number(url.searchParams.get('chainId') ?? deployed.chainId);
  if (!account) return NextResponse.json({ error: 'Missing account' }, { status: 400 });

  const ok = await deletePolicy({
    chainId,
    account: getAddress(account),
    policyId: policyId as Hex,
  });
  return NextResponse.json({ deleted: ok });
}

