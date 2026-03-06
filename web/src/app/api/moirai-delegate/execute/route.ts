import { NextResponse } from 'next/server';
import { baseSepolia } from 'viem/chains';
import {
  BaseError,
  ContractFunctionRevertedError,
  type Abi,
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
  type Hex,
  encodeAbiParameters,
  keccak256,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import { deployed } from '../../../../contracts/addresses';
import { policyManagerAbi, moiraiDelegateAbi } from '../../../../contracts/abi';
import {
  decodeMoiraiDelegatePolicyConfig,
  encodeDelegateExecutionData,
  hashPolicyConfig,
} from '../../../../lib/moiraiDelegateEncoding';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;

type Body = {
  account: `0x${string}`;
  policyId: Hex;
  policyConfig: Hex;
  nonce: string;
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function jsonSafe(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = jsonSafe(v);
    return out;
  }
  return value;
}

const MOIRAI_DELEGATE_DOMAIN = {
  name: 'Moirai Delegate',
  version: '1',
  chainId: baseSepolia.id,
} as const;

export async function POST(req: Request) {
  let debug: Record<string, unknown> | undefined;

  try {
    const body = (await req.json()) as Partial<Body>;
    const account = getAddress(body.account ?? ZERO_ADDRESS);
    const policyId = body.policyId as Hex | undefined;
    const policyConfig = body.policyConfig as Hex | undefined;
    const nonce = body.nonce ? BigInt(body.nonce) : undefined;

    if (!policyId || !policyConfig || nonce === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: policyId, policyConfig, nonce' },
        { status: 400 },
      );
    }

    const executorKey = requireEnv('EXECUTOR_PRIVATE_KEY') as Hex;
    const rpcUrl = requireEnv('BASE_SEPOLIA_RPC_URL');

    const executorAccount = privateKeyToAccount(executorKey);
    const policyConfigHash = hashPolicyConfig(policyConfig);
    const deadline = BigInt(0);

    const decodedCfg = decodeMoiraiDelegatePolicyConfig(policyConfig);

    if (getAddress(decodedCfg.executor) !== getAddress(executorAccount.address)) {
      return NextResponse.json(
        {
          error: `policyConfig executor mismatch: config=${decodedCfg.executor} server=${executorAccount.address}. Set executor to the app's executor address when configuring the policy.`,
        },
        { status: 400 },
      );
    }

    const domain = {
      ...MOIRAI_DELEGATE_DOMAIN,
      verifyingContract: deployed.moiraiDelegatePolicy,
    };

    // If a consensusSigner is configured and matches the executor, sign the ConsensusApproval.
    // In this demo the executor doubles as the consensus signer.
    let consensusSignature: Hex = '0x';
    if (
      decodedCfg.consensusSigner !== ZERO_ADDRESS &&
      getAddress(decodedCfg.consensusSigner) === getAddress(executorAccount.address)
    ) {
      consensusSignature = await executorAccount.signTypedData({
        domain,
        primaryType: 'ConsensusApproval',
        types: {
          ConsensusApproval: [
            { name: 'policyId', type: 'bytes32' },
            { name: 'account', type: 'address' },
            { name: 'policyConfigHash', type: 'bytes32' },
          ],
        },
        message: {
          policyId,
          account,
          policyConfigHash,
        },
      });
    }

    // actionData = abi.encode(DelegateExecution{consensusSignature})
    const actionData = encodeAbiParameters(
      [{ type: 'tuple', components: [{ name: 'consensusSignature', type: 'bytes' }] }],
      [{ consensusSignature }],
    );

    // executionDataHash = keccak256(abi.encode(keccak256(actionData), nonce, deadline))
    const executionDataHash = keccak256(
      encodeAbiParameters(
        [
          { name: 'actionDataHash', type: 'bytes32' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
        [keccak256(actionData), nonce, deadline],
      ),
    );

    const executorSignature = await executorAccount.signTypedData({
      domain,
      primaryType: 'Execution',
      types: {
        Execution: [
          { name: 'policyId', type: 'bytes32' },
          { name: 'account', type: 'address' },
          { name: 'policyConfigHash', type: 'bytes32' },
          { name: 'executionDataHash', type: 'bytes32' },
        ],
      },
      message: {
        policyId,
        account,
        policyConfigHash,
        executionDataHash,
      },
    });

    const executionData = encodeDelegateExecutionData({
      nonce,
      deadline,
      executorSignature,
      consensusSignature,
    });

    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(rpcUrl),
    });

    const policyActiveNow = (await publicClient.readContract({
      address: deployed.policyManager,
      abi: policyManagerAbi,
      functionName: 'isPolicyActiveNow',
      args: [deployed.moiraiDelegatePolicy, policyId],
    })) as boolean;

    debug = {
      policyManager: deployed.policyManager,
      policy: deployed.moiraiDelegatePolicy,
      account,
      policyId,
      executor: decodedCfg.executor,
      target: decodedCfg.target,
      value: decodedCfg.value.toString(),
      unlockTimestamp: decodedCfg.unlockTimestamp.toString(),
      consensusSigner: decodedCfg.consensusSigner,
      nonce: nonce.toString(),
      policyActiveNow,
    };

    // Merge PolicyManager + MoiraiDelegate ABIs so viem can decode policy-specific custom errors.
    const simulateAbi: Abi = [...(policyManagerAbi as Abi), ...(moiraiDelegateAbi as Abi)];

    await publicClient.simulateContract({
      address: deployed.policyManager,
      abi: simulateAbi,
      functionName: 'execute',
      args: [deployed.moiraiDelegatePolicy, policyId, policyConfig, executionData],
      account: executorAccount,
    });

    const client = createWalletClient({
      chain: baseSepolia,
      account: executorAccount,
      transport: http(rpcUrl),
    });

    const hash = await client.writeContract({
      address: deployed.policyManager,
      abi: policyManagerAbi,
      functionName: 'execute',
      args: [deployed.moiraiDelegatePolicy, policyId, policyConfig, executionData],
    });

    return NextResponse.json({ hash });
  } catch (err) {
    // Try to surface a decoded contract revert with a user-friendly message.
    let message: string;
    let details: Record<string, unknown> | undefined;

    if (err instanceof BaseError) {
      const revert = err.walk((e) => e instanceof ContractFunctionRevertedError);
      if (revert instanceof ContractFunctionRevertedError) {
        const errorName = revert.data?.errorName;
        const errorArgs = revert.data?.args;
        details = { errorName, args: errorArgs };
        switch (errorName) {
          case 'TimelockNotMet': {
            const [current, unlock] = (errorArgs ?? []) as [bigint, bigint];
            const unlockDate = new Date(Number(unlock) * 1000).toLocaleString();
            message = `Timelock not yet met — unlock time is ${unlockDate} (current: ${current}, required: ${unlock}).`;
            break;
          }
          case 'InvalidConsensusSignature':
            message = 'Invalid consensus signature — the consensus signer approval is invalid.';
            break;
          case 'NoConditionSpecified':
            message = 'No condition specified in the policy config.';
            break;
          case 'ZeroTarget':
            message = 'Policy config has a zero target address.';
            break;
          default:
            message = errorName
              ? `Contract reverted: ${errorName}`
              : err.shortMessage;
        }
      } else {
        message =
          err.metaMessages && err.metaMessages.length > 0
            ? err.metaMessages.join('\n')
            : err.shortMessage;
        details = { shortMessage: err.shortMessage, details: err.details, metaMessages: err.metaMessages };
      }
    } else {
      message = err instanceof Error ? err.message : String(err);
    }

    return NextResponse.json(
      {
        error: message,
        details: details ? (jsonSafe(details) as Record<string, unknown>) : undefined,
        debug: debug ? (jsonSafe(debug) as Record<string, unknown>) : undefined,
      },
      { status: 500 },
    );
  }
}
