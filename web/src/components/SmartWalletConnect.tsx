'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';

type SubAccount = {
  address: `0x${string}`;
  factory?: `0x${string}`;
  factoryData?: `0x${string}`;
};

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

type Props = {
  showSubAccount?: boolean;
};

export function SmartWalletConnect({ showSubAccount = false }: Props) {
  const { address, status, connector } = useAccount();
  const { connectors, connectAsync, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const [localError, setLocalError] = useState<string | null>(null);
  const [subAccount, setSubAccount] = useState<SubAccount | null>(null);
  const [subAccountPending, setSubAccountPending] = useState(false);

  const baseAccountConnector = useMemo(() => {
    return connectors.find((c) => c.id === 'baseAccount') ?? connectors[0];
  }, [connectors]);

  const isConnected = status === 'connected' && !!address;
  const walletUrl = process.env.NEXT_PUBLIC_BASE_ACCOUNT_WALLET_URL ?? '(unset)';

  // On connect, check for an existing sub account for this app domain.
  useEffect(() => {
    if (!isConnected || !address || !connector || !showSubAccount) {
      setSubAccount(null);
      return;
    }
    let cancelled = false;
    async function checkSubAccount() {
      try {
        const provider = (await connector!.getProvider()) as Eip1193Provider;
        const response = (await provider.request({
          method: 'wallet_getSubAccounts',
          params: [{ account: address, domain: window.location.origin }],
        })) as { subAccounts: SubAccount[] };
        if (!cancelled && response.subAccounts?.[0]) {
          setSubAccount(response.subAccounts[0]);
        }
      } catch {
        // Not supported or no sub accounts — stay null.
      }
    }
    checkSubAccount();
    return () => { cancelled = true; };
  }, [isConnected, address, connector, showSubAccount]);

  async function onCreateSubAccount() {
    if (!connector || subAccountPending) return;
    setSubAccountPending(true);
    setLocalError(null);
    try {
      const provider = (await connector.getProvider()) as Eip1193Provider;
      const result = (await provider.request({
        method: 'wallet_addSubAccount',
        params: [{ account: { type: 'create' } }],
      })) as SubAccount;
      setSubAccount(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const isRejection =
        msg.toLowerCase().includes('rejected') ||
        msg.toLowerCase().includes('cancelled') ||
        msg.toLowerCase().includes('denied');
      if (!isRejection) setLocalError(msg);
    } finally {
      setSubAccountPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {isConnected ? (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-col gap-1 text-sm text-zinc-600 dark:text-zinc-400">
              <div>
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                  Universal
                </span>
                <div className="font-mono">{address}</div>
              </div>
              {showSubAccount && subAccount ? (
                <div className="mt-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                    Sub account
                  </span>
                  <div className="font-mono">{subAccount.address}</div>
                </div>
              ) : null}
            </div>
            <button
              className="w-fit rounded-lg border border-zinc-200 px-4 py-2 text-sm dark:border-zinc-800"
              onClick={() => disconnect()}
              type="button"
            >
              Disconnect
            </button>
          </div>

          {showSubAccount && !subAccount ? (
            <button
              className="w-fit rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
              onClick={onCreateSubAccount}
              disabled={subAccountPending}
              type="button"
            >
              {subAccountPending ? 'Creating sub account…' : 'Create sub account'}
            </button>
          ) : null}
        </>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            className="w-fit rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            disabled={!baseAccountConnector || isPending}
            onClick={async () => {
              if (!baseAccountConnector) return;
              setLocalError(null);
              try {
                await connectAsync({ connector: baseAccountConnector });
              } catch (e) {
                setLocalError(e instanceof Error ? e.message : String(e));
              }
            }}
            type="button"
          >
            {isPending ? 'Connecting…' : 'Connect Smart Wallet'}
          </button>
          <div className="text-xs text-zinc-600 dark:text-zinc-400">
            Smart Wallet only (BaseAccount). walletUrl:{' '}
            <span className="font-mono">{walletUrl}</span>
          </div>
        </div>
      )}

      {localError || error ? (
        <div className="text-xs text-red-700 dark:text-red-400">
          {localError ?? error?.message}
        </div>
      ) : null}
    </div>
  );
}
