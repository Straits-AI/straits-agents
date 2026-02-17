import {
  createPublicClient,
  http,
  type Address,
  type Chain,
  type WalletClient,
  type Transport,
  type Account,
  encodeFunctionData,
  parseAbi,
} from "viem";
import { createSmartAccountClient } from "permissionless";
import { toSafeSmartAccount } from "permissionless/accounts";
import { entryPoint07Address } from "viem/account-abstraction";
import {
  SAFE_ADDRESSES,
  getChainById,
  getChainConfig,
  isSupportedChain,
  type SupportedChainId,
} from "./config";
import type { UserOperationCall } from "./types";
import { getGasPrice, getPaymasterFields } from "@/lib/bundler";

export interface CreateSmartAccountClientParams {
  signer: WalletClient<Transport, Chain, Account>;
  chainId: SupportedChainId;
}

export interface SmartAccountClientResult {
  smartAccountClient: ReturnType<typeof createSmartAccountClient>;
  smartAccountAddress: Address;
  isDeployed: boolean;
}

/**
 * Creates a Safe smart account client for ERC-4337 operations
 */
export async function createSafeSmartAccountClient({
  signer,
  chainId,
}: CreateSmartAccountClientParams): Promise<SmartAccountClientResult> {
  if (!isSupportedChain(chainId)) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }

  const chain = getChainById(chainId);
  const config = getChainConfig(chainId);

  // Create public client for chain reads
  const publicClient = createPublicClient({
    chain,
    transport: http(),
  });

  // Create Safe smart account
  const safeAccount = await toSafeSmartAccount({
    client: publicClient,
    owners: [signer],
    version: "1.4.1",
    entryPoint: {
      address: entryPoint07Address,
      version: "0.7",
    },
    safe4337ModuleAddress: SAFE_ADDRESSES.safe4337Module,
  });

  // Check if account is deployed
  const code = await publicClient.getCode({ address: safeAccount.address });
  const isDeployed = code !== undefined && code !== "0x";

  // Resolve bundler URL: relative paths need the origin for HTTP transport
  const bundlerUrl = config.bundlerUrl.startsWith("/")
    ? `${typeof window !== "undefined" ? window.location.origin : ""}${config.bundlerUrl}`
    : config.bundlerUrl;

  // Create smart account client with custom paymaster + self-bundler
  const smartAccountClient = createSmartAccountClient({
    account: safeAccount,
    chain,
    bundlerTransport: http(bundlerUrl),
    paymaster: config.paymasterAddress
      ? {
          getPaymasterData: async () => getPaymasterFields(config.paymasterAddress!),
          getPaymasterStubData: async () => getPaymasterFields(config.paymasterAddress!),
        }
      : undefined,
    userOperation: {
      estimateFeesPerGas: async () => {
        return await getGasPrice(publicClient as any);
      },
    },
  } as any);

  return {
    smartAccountClient,
    smartAccountAddress: safeAccount.address,
    isDeployed,
  };
}

/**
 * Encode calls for batch execution
 */
export function encodeCalls(calls: UserOperationCall[]): UserOperationCall[] {
  return calls;
}

/**
 * Encode ERC20 transfer call
 */
export function encodeErc20Transfer(
  tokenAddress: Address,
  to: Address,
  amount: bigint
): UserOperationCall {
  const data = encodeFunctionData({
    abi: parseAbi(["function transfer(address to, uint256 amount) returns (bool)"]),
    functionName: "transfer",
    args: [to, amount],
  });

  return {
    to: tokenAddress,
    value: BigInt(0),
    data,
  };
}

/**
 * Encode ERC20 approve call
 */
export function encodeErc20Approve(
  tokenAddress: Address,
  spender: Address,
  amount: bigint
): UserOperationCall {
  const data = encodeFunctionData({
    abi: parseAbi(["function approve(address spender, uint256 amount) returns (bool)"]),
    functionName: "approve",
    args: [spender, amount],
  });

  return {
    to: tokenAddress,
    value: BigInt(0),
    data,
  };
}
