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
  moiraiDelegatePolicy:
    (process.env.NEXT_PUBLIC_MOIRAI_DELEGATE_POLICY_ADDRESS ||
      '0x0000000000000000000000000000000000000000') as `0x${string}`,
} as const;

export const tokens = {
  usdc: (process.env.NEXT_PUBLIC_BASE_SEPOLIA_USDC_ADDRESS ||
    '0x036CbD53842c5426634e7929541eC2318f3dCF7e') as `0x${string}`,
  miggles: (process.env.NEXT_PUBLIC_BASE_SEPOLIA_MIGGLES_ADDRESS ||
    '0x0734c6E50dDA3190381859B2652da36823FC11F9') as `0x${string}`,
} as const;

