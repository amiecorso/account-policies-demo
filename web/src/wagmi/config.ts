import { cookieStorage, createConfig, createStorage, http } from 'wagmi';
import { baseSepolia } from 'viem/chains';
import { baseAccount } from 'wagmi/connectors';

const rpcUrl = process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL ?? 'https://sepolia.base.org';
const walletUrl =
  process.env.NEXT_PUBLIC_BASE_ACCOUNT_WALLET_URL ??
  process.env.NEXT_PUBLIC_COINBASE_KEYS_URL ??
  'https://keys.coinbase.com/connect';

export function getWagmiConfig() {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.log('[demo] BaseAccount walletUrl =', walletUrl);
  }
  return createConfig({
    chains: [baseSepolia],
    connectors: [
      baseAccount({
        appName: 'Account Policies Demo',
        preference: {
          options: 'smartWalletOnly',
          walletUrl,
        },
      }),
    ],
    storage: createStorage({
      storage: cookieStorage,
    }),
    ssr: true,
    transports: {
      [baseSepolia.id]: http(rpcUrl),
    },
  });
}

declare module 'wagmi' {
  interface Register {
    config: ReturnType<typeof getWagmiConfig>;
  }
}

