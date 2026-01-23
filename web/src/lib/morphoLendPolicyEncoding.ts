import { encodeAbiParameters, keccak256, type Hex } from 'viem';

export type RecurringAllowanceLimit = {
  allowance: bigint; // uint160
  period: number; // uint48
  start: number; // uint48 (unix seconds)
  end: number; // uint48 (unix seconds)
};

export function encodeMorphoLendPolicyConfig(input: {
  executor: `0x${string}`;
  vault: `0x${string}`;
  depositLimit: RecurringAllowanceLimit;
}): Hex {
  return encodeAbiParameters(
    [
      {
        type: 'tuple',
        components: [
          { name: 'executor', type: 'address' },
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
        executor: input.executor,
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
}

export function hashPolicyConfig(policyConfig: Hex): Hex {
  return keccak256(policyConfig);
}

export function encodeMorphoLendPolicyData(input: {
  assets: bigint; // uint256
  nonce: bigint; // uint256
  signature: Hex; // bytes
}): Hex {
  return encodeAbiParameters(
    [
      {
        type: 'tuple',
        components: [
          {
            name: 'data',
            type: 'tuple',
            components: [
              { name: 'assets', type: 'uint256' },
              { name: 'nonce', type: 'uint256' },
            ],
          },
          { name: 'signature', type: 'bytes' },
        ],
      },
    ],
    [
      {
        data: { assets: input.assets, nonce: input.nonce },
        signature: input.signature,
      },
    ],
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

