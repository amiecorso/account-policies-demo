import { NextResponse } from 'next/server';

// triggerUninstall was removed in MoiraiDelegate v4.
// Uninstall is now account-initiated only via PolicyManager.uninstall (wallet transaction).
export async function POST() {
  return NextResponse.json(
    { error: 'triggerUninstall is not supported in this version of MoiraiDelegate. Use the wallet to uninstall the policy directly.' },
    { status: 410 },
  );
}
