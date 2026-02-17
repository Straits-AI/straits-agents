/**
 * Self-Bundler JSON-RPC API
 *
 * Implements ERC-4337 bundler methods for client-side SDK (permissionless).
 * Used as bundlerTransport in createSmartAccountClient.
 *
 * Security: eth_sendUserOperation requires authentication and is rate-limited.
 */

import { NextResponse } from "next/server";
import { getEnv, getKV } from "@/lib/db";
import { getSession } from "@/lib/auth";
import {
  ENTRYPOINT_ADDRESS,
  ENTRYPOINT_ABI,
  DEFAULT_GAS_LIMITS,
  packUserOperation,
  submitUserOperation,
  createChainClient,
  type JsonRpcUserOp,
} from "@/lib/bundler";
import { isSupportedChain, getChainById, type SupportedChainId } from "@/lib/smart-account/config";
import { type Hex, toHex } from "viem";

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number | string;
  method: string;
  params?: unknown[];
}

function jsonRpcSuccess(id: number | string, result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id, result });
}

function jsonRpcError(id: number | string, code: number, message: string) {
  return NextResponse.json({ jsonrpc: "2.0", id, error: { code, message } });
}

// Rate limit: max UserOps per user per minute
const BUNDLER_RATE_LIMIT_PER_MIN = 10;

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const chainIdParam = parseInt(searchParams.get("chainId") || "421614", 10);
    const chainId: SupportedChainId = isSupportedChain(chainIdParam) ? chainIdParam : 421614;
    const chain = getChainById(chainId);

    const body = (await req.json()) as JsonRpcRequest;
    const { id, method, params } = body;

    switch (method) {
      case "eth_sendUserOperation": {
        // Require authentication for gas-spending operations
        const session = await getSession();
        if (!session) {
          return jsonRpcError(id, -32000, "Authentication required");
        }

        // Rate limit per user
        const kv = await getKV();
        const rateLimitKey = `bundler_rl:${session.userId}`;
        const currentCount = parseInt(await kv.get(rateLimitKey) || "0", 10);
        if (currentCount >= BUNDLER_RATE_LIMIT_PER_MIN) {
          return jsonRpcError(id, -32005, "Rate limit exceeded. Try again in 1 minute.");
        }
        await kv.put(rateLimitKey, String(currentCount + 1), { expirationTtl: 60 });

        const env = await getEnv();
        if (!env.RELAYER_PRIVATE_KEY) {
          return jsonRpcError(id, -32000, "Relayer not configured");
        }

        const [userOp, entryPointArg] = params as [JsonRpcUserOp, string];
        if (entryPointArg.toLowerCase() !== ENTRYPOINT_ADDRESS.toLowerCase()) {
          return jsonRpcError(id, -32602, "Unsupported EntryPoint");
        }

        // Pack and submit
        const packedOp = packUserOperation(userOp);
        const txHash = await submitUserOperation(
          env.RELAYER_PRIVATE_KEY as Hex,
          [packedOp],
          chain,
        );

        // Compute userOpHash for return value
        const publicClient = createChainClient(chainId);
        const userOpHash = await publicClient.readContract({
          address: ENTRYPOINT_ADDRESS,
          abi: ENTRYPOINT_ABI,
          functionName: "getUserOpHash",
          args: [{
            sender: packedOp.sender,
            nonce: packedOp.nonce,
            initCode: packedOp.initCode,
            callData: packedOp.callData,
            accountGasLimits: packedOp.accountGasLimits,
            preVerificationGas: packedOp.preVerificationGas,
            gasFees: packedOp.gasFees,
            paymasterAndData: packedOp.paymasterAndData,
            signature: packedOp.signature,
          }],
        });

        // Store mapping: userOpHash -> txHash (1hr TTL)
        await kv.put(`userop:${userOpHash}`, txHash, { expirationTtl: 3600 });

        return jsonRpcSuccess(id, userOpHash);
      }

      case "eth_estimateUserOperationGas": {
        // Read-only: no auth required
        return jsonRpcSuccess(id, {
          callGasLimit: toHex(DEFAULT_GAS_LIMITS.callGasLimit),
          verificationGasLimit: toHex(DEFAULT_GAS_LIMITS.verificationGasLimit),
          preVerificationGas: toHex(DEFAULT_GAS_LIMITS.preVerificationGas),
          paymasterVerificationGasLimit: toHex(DEFAULT_GAS_LIMITS.paymasterVerificationGasLimit),
          paymasterPostOpGasLimit: toHex(DEFAULT_GAS_LIMITS.paymasterPostOpGasLimit),
        });
      }

      case "eth_getUserOperationReceipt": {
        // Read-only: no auth required
        const [userOpHash] = params as [string];

        const kv = await getKV();
        const txHash = await kv.get(`userop:${userOpHash}`);
        if (!txHash) {
          return jsonRpcSuccess(id, null);
        }

        const publicClient = createChainClient(chainId);
        try {
          const receipt = await publicClient.getTransactionReceipt({
            hash: txHash as Hex,
          });

          return jsonRpcSuccess(id, {
            userOpHash,
            entryPoint: ENTRYPOINT_ADDRESS,
            sender: receipt.from,
            nonce: "0x0",
            success: receipt.status === "success",
            actualGasCost: toHex(receipt.gasUsed * receipt.effectiveGasPrice),
            actualGasUsed: toHex(receipt.gasUsed),
            receipt: {
              transactionHash: receipt.transactionHash,
              blockHash: receipt.blockHash,
              blockNumber: toHex(receipt.blockNumber),
              status: receipt.status === "success" ? "0x1" : "0x0",
            },
          });
        } catch {
          // Transaction not yet mined
          return jsonRpcSuccess(id, null);
        }
      }

      case "eth_getUserOperationByHash": {
        // Read-only: no auth required
        const [opHash] = params as [string];
        const kv = await getKV();
        const txHash = await kv.get(`userop:${opHash}`);
        if (!txHash) {
          return jsonRpcSuccess(id, null);
        }
        return jsonRpcSuccess(id, {
          userOperationHash: opHash,
          transactionHash: txHash,
          entryPoint: ENTRYPOINT_ADDRESS,
        });
      }

      case "eth_supportedEntryPoints": {
        return jsonRpcSuccess(id, [ENTRYPOINT_ADDRESS]);
      }

      case "eth_chainId": {
        return jsonRpcSuccess(id, "0x" + chainId.toString(16));
      }

      default:
        return jsonRpcError(id, -32601, `Method not found: ${method}`);
    }
  } catch (error) {
    console.error("Bundler API error:", error);
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32603,
          message: "Internal error",
        },
      },
      { status: 500 }
    );
  }
}
