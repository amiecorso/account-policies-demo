import { decodeAbiParameters, encodeAbiParameters, keccak256, type Hex } from 'viem';

export type RecurringAllowanceLimit = {
  allowance: bigint; // uint160
  period: number; // uint48
  start: number; // uint48 (unix seconds)
  end: number; // uint48 (unix seconds)
};

export function encodeMorphoLendPolicyConfig(input: {
  account: `0x${string}`;
  executor: `0x${string}`;
  vault: `0x${string}`;
  depositLimit: RecurringAllowanceLimit;
}): Hex {
  // Canonical AOAPolicy encoding:
  // policyConfig = abi.encode(AOAConfig{account, executor}, abi.encode(MorphoConfig{vault, depositLimit}))
  const policySpecificConfig = encodeAbiParameters(
    [
      {
        type: 'tuple',
        components: [
          { name: 'vault', type: 'address' },
          {
            name: 'depositLimit',
            type: 'tuple',
            components: [
              { name: 'allowance', type: 'uint160' },
              { name: 'period', type: 'uint48' },
              { name: 'start', type: 'uint48' },
              { name: 'end', type: 'uint48' },
            ],
          },
        ],
      },
    ],
    [
      {
        vault: input.vault,
        depositLimit: {
          allowance: input.depositLimit.allowance,
          period: input.depositLimit.period,
          start: input.depositLimit.start,
          end: input.depositLimit.end,
        },
      },
    ],
  );

  return encodeAbiParameters(
    [
      {
        name: 'aoa',
        type: 'tuple',
        components: [
          { name: 'account', type: 'address' },
          { name: 'executor', type: 'address' },
        ],
      },
      { name: 'policySpecificConfig', type: 'bytes' },
    ],
    [{ account: input.account, executor: input.executor }, policySpecificConfig],
  );
}

export function hashPolicyConfig(policyConfig: Hex): Hex {
  return keccak256(policyConfig);
}

export function decodeMorphoLendPolicyConfig(policyConfig: Hex): {
  account: `0x${string}`;
  executor: `0x${string}`;
  vault: `0x${string}`;
  depositLimit: {
    allowance: bigint;
    period: bigint;
    start: bigint;
    end: bigint;
  };
} {
  const [aoa, policySpecificConfig] = decodeAbiParameters(
    [
      {
        name: 'aoa',
        type: 'tuple',
        components: [
          { name: 'account', type: 'address' },
          { name: 'executor', type: 'address' },
        ],
      },
      { name: 'policySpecificConfig', type: 'bytes' },
    ],
    policyConfig,
  ) as unknown as [
    { account: `0x${string}`; executor: `0x${string}` },
    Hex,
  ];

  const [morpho] = decodeAbiParameters(
    [
      {
        type: 'tuple',
        components: [
          { name: 'vault', type: 'address' },
          {
            name: 'depositLimit',
            type: 'tuple',
            components: [
              { name: 'allowance', type: 'uint160' },
              { name: 'period', type: 'uint48' },
              { name: 'start', type: 'uint48' },
              { name: 'end', type: 'uint48' },
            ],
          },
        ],
      },
    ],
    policySpecificConfig,
  ) as unknown as [
    {
      vault: `0x${string}`;
      depositLimit: { allowance: bigint; period: bigint; start: bigint; end: bigint };
    },
  ];

  return {
    account: aoa.account,
    executor: aoa.executor,
    vault: morpho.vault,
    depositLimit: morpho.depositLimit,
  };
}

export function encodeMorphoLendPolicyData(input: {
  assets: bigint; // uint256
  nonce: bigint; // uint256
  signature: Hex; // bytes
}): Hex {
  // Canonical AOAPolicy encoding:
  // policyData = abi.encode(bytes actionData, bytes signature)
  // where actionData = abi.encode(LendData{assets, nonce})
  const actionData = encodeAbiParameters(
    [
      {
        type: 'tuple',
        components: [
          { name: 'assets', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
        ],
      },
    ],
    [{ assets: input.assets, nonce: input.nonce }],
  );

  return encodeAbiParameters(
    [
      { name: 'actionData', type: 'bytes' },
      { name: 'signature', type: 'bytes' },
    ],
    [actionData, input.signature],
  );
}

export function hashLendData(input: { assets: bigint; nonce: bigint }): Hex {
  const encoded = encodeAbiParameters(
    [
      { name: 'assets', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
    ],
    [input.assets, input.nonce],
  );
  return keccak256(encoded);
}

