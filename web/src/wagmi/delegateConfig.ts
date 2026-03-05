import { cookieStorage, createConfig, createStorage, http } from 'wagmi';
import { baseSepolia } from 'viem/chains';
import { baseAccount } from 'wagmi/connectors';

const rpcUrl = process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL ?? 'https://sepolia.base.org';

// Configure with subAccount support from the Coinbase wallet SDK.
// Set NEXT_PUBLIC_BASE_ACCOUNT_WALLET_URL to point at your sub-account-enabled wallet URL
// and adjust the preference options below as needed.
const walletUrl =
  process.env.NEXT_PUBLIC_BASE_ACCOUNT_WALLET_URL ?? 'https://keys.coinbase.com/connect';

export function getDelegateWagmiConfig() {
  return createConfig({
    chains: [baseSepolia],
    connectors: [
      baseAccount({
        appName: 'Account Policies Demo – Delegate',
        preference: {
          options: 'smartWalletOnly',
          walletUrl,
          // TODO: add sub-account specific options here, e.g.:
          // keysUrl: '...',
        },
      }),
    ],
    storage: createStorage({ storage: cookieStorage }),
    ssr: true,
    transports: {
      [baseSepolia.id]: http(rpcUrl),
    },
  });
}

declare module 'wagmi' {
  interface Register {
    config: ReturnType<typeof getDelegateWagmiConfig>;
  }
}
