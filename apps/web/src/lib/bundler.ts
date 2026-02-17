/**
 * Self-Bundling Core Logic
 *
 * Custom self-bundling via direct EntryPoint.handleOps calls.
 * Used by both the embedded wallet (server-side) and /api/bundler (client-side SDK).
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hex,
  type PublicClient,
  type Hash,
  type Chain,
  concat,
  pad,
  toHex,
  parseAbi,
  decodeEventLog,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia } from "viem/chains";
import { ENTRYPOINT_ADDRESS_V07, getChainById, type SupportedChainId } from "./smart-account/config";

export const ENTRYPOINT_ADDRESS: Address = ENTRYPOINT_ADDRESS_V07;

export const ENTRYPOINT_ABI = parseAbi([
  "function handleOps((address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, bytes paymasterAndData, bytes signature)[] ops, address payable beneficiary)",
  "function getNonce(address sender, uint192 key) view returns (uint256)",
  "function getUserOpHash((address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, bytes paymasterAndData, bytes signature) userOp) view returns (bytes32)",
  "function balanceOf(address account) view returns (uint256)",
  "function depositTo(address account) payable",
  "event UserOperationEvent(bytes32 indexed userOpHash, address indexed sender, address indexed paymaster, uint256 nonce, bool success, uint256 actualGasCost, uint256 actualGasUsed)",
]);

// Conservative gas limits for testnet
export const DEFAULT_GAS_LIMITS = {
  callGasLimit: 500_000n,
  verificationGasLimit: 500_000n,
  preVerificationGas: 100_000n,
  paymasterVerificationGasLimit: 100_000n,
  paymasterPostOpGasLimit: 100_000n,
};

/**
 * Get current gas prices with 20% buffer
 */
export async function getGasPrice(publicClient: PublicClient) {
  const [gasPrice, maxPriorityFeePerGas] = await Promise.all([
    publicClient.getGasPrice(),
    publicClient.estimateMaxPriorityFeePerGas().catch(() => 100_000_000n), // 0.1 gwei fallback
  ]);

  // Add 20% buffer
  const bufferedMaxFee = (gasPrice * 120n) / 100n;
  const bufferedPriority = (maxPriorityFeePerGas * 120n) / 100n;

  return {
    maxFeePerGas: bufferedMaxFee,
    maxPriorityFeePerGas: bufferedPriority,
  };
}

/**
 * Get paymaster fields for a custom paymaster
 */
export function getPaymasterFields(paymasterAddress: Address) {
  return {
    paymaster: paymasterAddress,
    paymasterVerificationGasLimit: DEFAULT_GAS_LIMITS.paymasterVerificationGasLimit,
    paymasterPostOpGasLimit: DEFAULT_GAS_LIMITS.paymasterPostOpGasLimit,
    paymasterData: "0x" as Hex,
  };
}

/**
 * Pack a 128-bit value into the high or low 16 bytes of a bytes32
 */
function packUint128Pair(high: bigint, low: bigint): Hex {
  const highHex = pad(toHex(high), { size: 16 });
  const lowHex = pad(toHex(low), { size: 16 });
  return concat([highHex, lowHex]);
}

/**
 * Represents a JSON-RPC format UserOp (unpacked fields)
 */
export interface JsonRpcUserOp {
  sender: Address;
  nonce: Hex;
  factory?: Address;
  factoryData?: Hex;
  callData: Hex;
  callGasLimit: Hex;
  verificationGasLimit: Hex;
  preVerificationGas: Hex;
  maxFeePerGas: Hex;
  maxPriorityFeePerGas: Hex;
  paymaster?: Address;
  paymasterVerificationGasLimit?: Hex;
  paymasterPostOpGasLimit?: Hex;
  paymasterData?: Hex;
  signature: Hex;
}

/**
 * Represents the packed on-chain UserOp format
 */
export interface PackedUserOp {
  sender: Address;
  nonce: bigint;
  initCode: Hex;
  callData: Hex;
  accountGasLimits: Hex;
  preVerificationGas: bigint;
  gasFees: Hex;
  paymasterAndData: Hex;
  signature: Hex;
}

/**
 * Convert a JSON-RPC UserOp to the packed format for handleOps
 */
export function packUserOperation(op: JsonRpcUserOp): PackedUserOp {
  // Pack initCode: factory + factoryData (or empty)
  const initCode: Hex = op.factory && op.factoryData
    ? concat([op.factory, op.factoryData])
    : "0x";

  // Pack accountGasLimits: verificationGasLimit (16 bytes) || callGasLimit (16 bytes)
  const accountGasLimits = packUint128Pair(
    BigInt(op.verificationGasLimit),
    BigInt(op.callGasLimit)
  );

  // Pack gasFees: maxPriorityFeePerGas (16 bytes) || maxFeePerGas (16 bytes)
  const gasFees = packUint128Pair(
    BigInt(op.maxPriorityFeePerGas),
    BigInt(op.maxFeePerGas)
  );

  // Pack paymasterAndData: paymaster (20 bytes) || pmVerGas (16 bytes) || pmPostOpGas (16 bytes) || pmData
  let paymasterAndData: Hex = "0x";
  if (op.paymaster) {
    const pmVerGas = pad(toHex(BigInt(op.paymasterVerificationGasLimit || "0x0")), { size: 16 });
    const pmPostGas = pad(toHex(BigInt(op.paymasterPostOpGasLimit || "0x0")), { size: 16 });
    const pmData = op.paymasterData || "0x";
    paymasterAndData = concat([
      op.paymaster,
      pmVerGas,
      pmPostGas,
      ...(pmData !== "0x" ? [pmData as Hex] : []),
    ]);
  }

  return {
    sender: op.sender,
    nonce: BigInt(op.nonce),
    initCode,
    callData: op.callData,
    accountGasLimits,
    preVerificationGas: BigInt(op.preVerificationGas),
    gasFees,
    paymasterAndData,
    signature: op.signature,
  };
}

/**
 * Submit packed UserOps to EntryPoint via handleOps from a relayer EOA
 */
export async function submitUserOperation(
  relayerPrivateKey: Hex,
  packedOps: PackedUserOp[],
  chain?: Chain,
  rpcUrl?: string,
): Promise<Hash> {
  const relayerAccount = privateKeyToAccount(relayerPrivateKey);

  const walletClient = createWalletClient({
    account: relayerAccount,
    chain: chain || arbitrumSepolia,
    transport: http(rpcUrl),
  });

  const hash = await walletClient.writeContract({
    address: ENTRYPOINT_ADDRESS,
    abi: ENTRYPOINT_ABI,
    functionName: "handleOps",
    args: [
      packedOps.map((op) => ({
        sender: op.sender,
        nonce: op.nonce,
        initCode: op.initCode,
        callData: op.callData,
        accountGasLimits: op.accountGasLimits,
        preVerificationGas: op.preVerificationGas,
        gasFees: op.gasFees,
        paymasterAndData: op.paymasterAndData,
        signature: op.signature,
      })),
      relayerAccount.address, // beneficiary receives gas refund
    ],
    gas: 2_000_000n, // generous gas limit for handleOps
  });

  return hash;
}

/**
 * Wait for a handleOps transaction and parse UserOperationEvent logs
 */
export async function waitForUserOperationReceipt(
  publicClient: PublicClient,
  txHash: Hash,
) {
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
    timeout: 60_000,
  });

  // Parse UserOperationEvent from logs
  const userOpEvents = receipt.logs
    .map((log) => {
      try {
        return decodeEventLog({
          abi: ENTRYPOINT_ABI,
          data: log.data,
          topics: log.topics,
        });
      } catch {
        return null;
      }
    })
    .filter((e): e is NonNullable<typeof e> => e?.eventName === "UserOperationEvent");

  return {
    receipt,
    userOpEvents,
  };
}

/**
 * Create a public client for a supported chain
 */
export function createChainClient(chainId: SupportedChainId, rpcUrl?: string): PublicClient {
  const chain = getChainById(chainId);
  return createPublicClient({
    chain,
    transport: http(rpcUrl),
  }) as PublicClient;
}

/**
 * Create a public client for Arbitrum Sepolia (backward compat alias)
 */
export function createArbitrumSepoliaClient(rpcUrl?: string): PublicClient {
  return createChainClient(421614, rpcUrl);
}
