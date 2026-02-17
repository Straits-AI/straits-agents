import type { Address, Hash, Hex } from "viem";

export interface SmartAccountConfig {
  chainId: number;
  bundlerUrl: string;
  paymasterAddress?: Address;
  entryPointAddress: Address;
}

export interface SmartAccountState {
  address: Address | null;
  isDeployed: boolean;
  isLoading: boolean;
  error: Error | null;
}

export interface UserOperationCall {
  to: Address;
  value: bigint;
  data: Hex;
}

export interface UserOperationReceipt {
  userOpHash: Hash;
  transactionHash: Hash;
  success: boolean;
  actualGasUsed: bigint;
  actualGasCost: bigint;
}


export interface ChainConfig {
  name: string;
  bundlerUrl: string;
  paymasterAddress?: Address;
  usdcAddress: Address;
  explorerUrl: string;
}
