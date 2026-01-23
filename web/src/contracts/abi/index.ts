import PolicyManagerAbi from './PolicyManager.abi.json';
import MorphoLendPolicyAbi from './MorphoLendPolicy.abi.json';
import PublicERC6492ValidatorAbi from './PublicERC6492Validator.abi.json';

import type { Abi } from 'viem';

export const policyManagerAbi = PolicyManagerAbi as Abi;
export const morphoLendPolicyAbi = MorphoLendPolicyAbi as Abi;
export const publicERC6492ValidatorAbi = PublicERC6492ValidatorAbi as Abi;

