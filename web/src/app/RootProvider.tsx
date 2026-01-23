'use client';

import { ReactNode } from 'react';
import { base, baseSepolia } from 'viem/chains';
import { OnchainKitProvider } from '@coinbase/onchainkit';
import '@coinbase/onchainkit/styles.css';

export function RootProvider({ children }: { children: ReactNode }) {
  const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 84532);
  const chain = chainId === baseSepolia.id ? baseSepolia : base;

  return (
    <OnchainKitProvider
      apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY}
      chain={chain}
      config={{
        appearance: { mode: 'auto' },
        wallet: { display: 'modal', preference: 'smartWalletOnly' },
      }}
    >
      {children}
    </OnchainKitProvider>
  );
}

