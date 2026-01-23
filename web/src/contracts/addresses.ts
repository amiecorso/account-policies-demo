export const deployed = {
  chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 84532),
  publicERC6492Validator:
    (process.env.NEXT_PUBLIC_PUBLIC_ERC6492_VALIDATOR_ADDRESS ||
      '0x0000000000000000000000000000000000000000') as `0x${string}`,
  policyManager:
    (process.env.NEXT_PUBLIC_POLICY_MANAGER_ADDRESS ||
      '0x0000000000000000000000000000000000000000') as `0x${string}`,
  morphoLendPolicy:
    (process.env.NEXT_PUBLIC_MORPHO_LEND_POLICY_ADDRESS ||
      '0x0000000000000000000000000000000000000000') as `0x${string}`,
} as const;

