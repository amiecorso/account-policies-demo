import { baseSepolia } from 'viem/chains';
import { createPublicClient, http } from 'viem';

export const baseSepoliaRpcUrl =
  process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL ?? 'https://sepolia.base.org';

export const baseSepoliaPublicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(baseSepoliaRpcUrl),
});

