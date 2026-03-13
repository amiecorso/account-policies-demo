import { NextResponse } from 'next/server';
import { baseSepolia } from 'viem/chains';
import {
  BaseError,
  ContractFunctionRevertedError,
  type Abi,
  createPublicClient,
  createWalletClient,
  formatUnits,
  getAddress,
  http,
  type Hex,
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

    // Sign the execution intent. The executor's signature over Execution+ExecutionData
    // serves as both the authorization and (when consensusSigner == executor) the consensus approval.
    // actionData is empty — MoiraiDelegate does not use policy-specific action data.
    const executorSignature = await executorAccount.signTypedData({
      domain,
      primaryType: 'Execution',
      types: {
        Execution: [
          { name: 'policyId', type: 'bytes32' },
          { name: 'account', type: 'address' },
          { name: 'policyConfigHash', type: 'bytes32' },
          { name: 'executionData', type: 'ExecutionData' },
        ],
        ExecutionData: [
          { name: 'actionData', type: 'bytes' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
      },
      message: {
        policyId,
        account,
        policyConfigHash,
        executionData: {
          actionData: '0x' as Hex,
          nonce,
          deadline,
        },
      },
    });

    const executionData = encodeDelegateExecutionData({
      nonce,
      deadline,
      executorSignature,
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

    const accountCode = await publicClient.getCode({ address: account });
    if (!accountCode || accountCode === '0x') {
      return NextResponse.json(
        {
          error: `Smart wallet (${account}) is not yet deployed on-chain. The account must be deployed before a policy can be executed — send a transaction from it (e.g. fund it via the wallet app) to trigger deployment.`,
        },
        { status: 400 },
      );
    }

    if (decodedCfg.value > BigInt(0)) {
      const balance = await publicClient.getBalance({ address: account });
      if (balance < decodedCfg.value) {
        return NextResponse.json(
          {
            error: `Insufficient ETH balance: account has ${formatUnits(balance, 18)} ETH but policy requires ${formatUnits(decodedCfg.value, 18)} ETH. Fund the account (${account}) before executing.`,
          },
          { status: 400 },
        );
      }
    }

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
          case 'UnlockTimestampNotReached': {
            const [current, unlock] = (errorArgs ?? []) as [bigint, bigint];
            const unlockDate = new Date(Number(unlock) * 1000).toLocaleString();
            message = `Timelock not yet met — unlock time is ${unlockDate} (current: ${current}, required: ${unlock}).`;
            break;
          }
          case 'AlreadyExecuted':
            message = 'This policy instance has already been executed. Uninstall the policy to reset it.';
            break;
          case 'Unauthorized':
            message = 'Unauthorized: executor signature is invalid or the caller is not authorized.';
            break;
          case 'SignatureExpired': {
            const [current, deadline] = (errorArgs ?? []) as [bigint, bigint];
            message = `Executor signature has expired (current: ${current}, deadline: ${deadline}).`;
            break;
          }
          case 'ExecutionNonceAlreadyUsed': {
            const [, nonce] = (errorArgs ?? []) as [unknown, bigint];
            message = `Execution nonce ${nonce} has already been used. Use a fresh nonce.`;
            break;
          }
          case 'PolicyConfigHashMismatch':
            message = 'Policy config hash mismatch — the provided policyConfig does not match what was stored at install time.';
            break;
          case 'NoConditionSpecified':
            message = 'No condition specified in the policy config.';
            break;
          case 'FailedCall':
            message = 'The delegated call failed. Likely causes: (1) the smart wallet is not yet deployed on-chain (counterfactual address), or (2) insufficient balance for the send. Ensure the account is deployed and funded.';
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
