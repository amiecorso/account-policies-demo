import { decodeAbiParameters, encodeAbiParameters, encodeFunctionData, erc20Abi, keccak256, type Hex } from 'viem';

export type DelegateConfig = {
  target: `0x${string}`;
  value: bigint;
  callData: Hex;
  unlockTimestamp: bigint;
  consensusSigner: `0x${string}`;
};

export type Asset = 'ETH' | 'USDC' | 'MIGGLES';

export type SendParams = {
  asset: Asset;
  recipient: `0x${string}`;
  amount: bigint;
  tokenAddress?: `0x${string}`;
};

export function buildDelegateConfigFromSend(params: SendParams): Pick<DelegateConfig, 'target' | 'value' | 'callData'> {
  if (params.asset === 'ETH') {
    return {
      target: params.recipient,
      value: params.amount,
      callData: '0x',
    };
  }

  if (!params.tokenAddress) throw new Error('tokenAddress required for ERC20 sends');

  return {
    target: params.tokenAddress,
    value: BigInt(0),
    callData: encodeFunctionData({
      abi: erc20Abi,
      functionName: 'transfer',
      args: [params.recipient, params.amount],
    }),
  };
}

export function encodeMoiraiDelegatePolicyConfig(input: {
  executor: `0x${string}`;
  target: `0x${string}`;
  value: bigint;
  callData: Hex;
  unlockTimestamp: bigint;
  consensusSigner: `0x${string}`;
}): Hex {
  const policySpecificConfig = encodeAbiParameters(
    [
      {
        type: 'tuple',
        components: [
          { name: 'target', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'callData', type: 'bytes' },
          { name: 'unlockTimestamp', type: 'uint256' },
          { name: 'consensusSigner', type: 'address' },
        ],
      },
    ],
    [
      {
        target: input.target,
        value: input.value,
        callData: input.callData,
        unlockTimestamp: input.unlockTimestamp,
        consensusSigner: input.consensusSigner,
      },
    ],
  );

  return encodeAbiParameters(
    [
      {
        name: 'aoa',
        type: 'tuple',
        components: [{ name: 'executor', type: 'address' }],
      },
      { name: 'policySpecificConfig', type: 'bytes' },
    ],
    [{ executor: input.executor }, policySpecificConfig],
  );
}

export function decodeMoiraiDelegatePolicyConfig(policyConfig: Hex): {
  executor: `0x${string}`;
  target: `0x${string}`;
  value: bigint;
  callData: Hex;
  unlockTimestamp: bigint;
  consensusSigner: `0x${string}`;
} {
  const [aoa, policySpecificConfigRaw] = decodeAbiParameters(
    [
      {
        name: 'aoa',
        type: 'tuple',
        components: [{ name: 'executor', type: 'address' }],
      },
      { name: 'policySpecificConfig', type: 'bytes' },
    ],
    policyConfig,
  ) as unknown as [{ executor: `0x${string}` }, Hex];

  const [cfg] = decodeAbiParameters(
    [
      {
        type: 'tuple',
        components: [
          { name: 'target', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'callData', type: 'bytes' },
          { name: 'unlockTimestamp', type: 'uint256' },
          { name: 'consensusSigner', type: 'address' },
        ],
      },
    ],
    policySpecificConfigRaw,
  ) as unknown as [DelegateConfig];

  return {
    executor: aoa.executor,
    target: cfg.target,
    value: cfg.value,
    callData: cfg.callData as Hex,
    unlockTimestamp: cfg.unlockTimestamp,
    consensusSigner: cfg.consensusSigner,
  };
}

export function hashPolicyConfig(policyConfig: Hex): Hex {
  return keccak256(policyConfig);
}

export function encodeDelegateExecutionData(input: {
  nonce: bigint;
  deadline: bigint;
  executorSignature: Hex;
}): Hex {
  return encodeAbiParameters(
    [
      {
        name: 'aoaExecutionData',
        type: 'tuple',
        components: [
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
          { name: 'signature', type: 'bytes' },
        ],
      },
      { name: 'actionData', type: 'bytes' },
    ],
    [
      {
        nonce: input.nonce,
        deadline: input.deadline,
        signature: input.executorSignature,
      },
      '0x',
    ],
  );
}

