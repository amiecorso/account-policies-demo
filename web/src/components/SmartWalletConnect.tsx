'use client';

import { useMemo } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';

export function SmartWalletConnect() {
  const { address, status } = useAccount();
  const { connectors, connectAsync, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();

  const baseAccountConnector = useMemo(() => {
    // Our wagmi config only registers `baseAccount`, but be defensive.
    return connectors.find((c) => c.id === 'baseAccount') ?? connectors[0];
  }, [connectors]);

  const isConnected = status === 'connected' && !!address;

  return (
    <div className="flex flex-col gap-3">
      {isConnected ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            Connected: <span className="font-mono">{address}</span>
          </div>
          <button
            className="w-fit rounded-lg border border-zinc-200 px-4 py-2 text-sm dark:border-zinc-800"
            onClick={() => disconnect()}
            type="button"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            className="w-fit rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            disabled={!baseAccountConnector || isPending}
            onClick={async () => {
              if (!baseAccountConnector) return;
              await connectAsync({ connector: baseAccountConnector });
            }}
            type="button"
          >
            {isPending ? 'Connecting…' : 'Connect Smart Wallet'}
          </button>
          <div className="text-xs text-zinc-600 dark:text-zinc-400">
            Smart Wallet only (uses your configured BaseAccount walletUrl).
          </div>
        </div>
      )}

      {error ? (
        <div className="text-xs text-red-700 dark:text-red-400">{error.message}</div>
      ) : null}
    </div>
  );
}

