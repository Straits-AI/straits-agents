/**
 * Embedded Wallet - Server-side custodial wallet for frictionless payments
 * Uses AES-256-GCM encryption for private key storage in D1
 * Payments via ERC-4337 Smart Account + Custom UsdcPaymaster (self-bundled)
 */

import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import {
  createPublicClient,
  http,
  parseUnits,
  encodeFunctionData,
  parseAbi,
  type Address,
  type Hex,
  custom,
} from "viem";
import { arbitrumSepolia } from "viem/chains";
import { toSafeSmartAccount } from "permissionless/accounts";
import { createSmartAccountClient } from "permissionless";
import { entryPoint07Address } from "viem/account-abstraction";
import {
  DEFAULT_GAS_LIMITS,
  getGasPrice,
  getPaymasterFields,
  packUserOperation,
  submitUserOperation,
  waitForUserOperationReceipt,
} from "./bundler";
import { SAFE_ADDRESSES, USDC_ADDRESS, getChainById, getChainConfig, type SupportedChainId } from "./smart-account/config";
import { encrypt, decrypt } from "./encryption";

const ERC20_ABI = [
  {
    type: "function" as const,
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view" as const,
  },
] as const;

/**
 * Generate an embedded wallet keypair and encrypt the private key.
 * Returns the EOA address and encrypted private key.
 * The caller should use getSmartAccountAddress() to derive the Safe address to store.
 */
export async function generateEmbeddedWallet(
  secret: string
): Promise<{ address: string; encryptedPrivateKey: string }> {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);

  const encryptedPrivateKey = await encrypt(privateKey, secret, "wallet");

  return {
    address: account.address,
    encryptedPrivateKey,
  };
}

/**
 * Decrypt a private key from storage
 */
export async function decryptPrivateKey(
  encrypted: string,
  secret: string
): Promise<`0x${string}`> {
  const plaintext = await decrypt(encrypted, secret, "wallet");
  return plaintext as `0x${string}`;
}

/**
 * Derive the Safe smart account address from a private key.
 * This is deterministic — same private key always yields the same Safe address.
 * Safe addresses are the same across all EVM chains (deterministic CREATE2).
 * Used at registration time to store the correct address that users will fund.
 */
export async function getSmartAccountAddress(
  privateKey: `0x${string}`,
  chainId: SupportedChainId = 421614,
): Promise<Address> {
  const signer = privateKeyToAccount(privateKey);
  const chain = getChainById(chainId);

  const publicClient = createPublicClient({
    chain,
    transport: http(),
  });

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

  return safeAccount.address;
}


/**
 * Send a USDC transfer via ERC-4337 Smart Account with custom UsdcPaymaster.
 * Uses createSmartAccountClient from permissionless to properly handle Safe
 * initialization (ERC-7579 launchpad). Self-bundles via direct handleOps.
 */
export async function sendUsdcViaPaymaster(
  encryptedPrivateKey: string,
  secret: string,
  recipient: Address,
  amountCents: number,
  relayerPrivateKey: string,
  paymasterAddress: string,
  chainId: SupportedChainId = 421614,
): Promise<{ hash: string; onChain: true; logs: string[] } | { hash: null; logs: string[] }> {
  const logs: string[] = [];
  try {
    const chain = getChainById(chainId);
    const chainConfig = getChainConfig(chainId);
    const usdcAddress = chainConfig.usdcAddress;
    const chainIdHex = "0x" + chainId.toString(16);

    logs.push(`Chain: ${chainConfig.name} (${chainId})`);
    logs.push("Decrypting key");
    const privateKey = await decryptPrivateKey(encryptedPrivateKey, secret);
    const signer = privateKeyToAccount(privateKey);
    logs.push(`Signer: ${signer.address}`);

    const publicClient = createPublicClient({
      chain,
      transport: http(),
    });

    logs.push("Creating Safe account");
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
    logs.push(`Safe: ${safeAccount.address}`);

    // Check USDC balance
    const usdcBalance = await publicClient.readContract({
      address: usdcAddress,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [safeAccount.address],
    });
    const amountUnits = parseUnits((amountCents / 100).toString(), 6);
    logs.push(`Balance: ${usdcBalance}, need: ${amountUnits}`);

    if (usdcBalance < amountUnits) {
      logs.push("FAIL: Insufficient USDC");
      return { hash: null, logs };
    }

    // Create a custom bundler transport that self-bundles via handleOps
    logs.push("Creating smart account client");
    const smartAccountClient = createSmartAccountClient({
      account: safeAccount,
      chain,
      // Custom bundler transport: intercepts sendUserOperation and calls handleOps directly
      bundlerTransport: custom({
        async request({ method, params }: { method: string; params?: any[] }) {
          if (method === "eth_sendUserOperation") {
            const [userOp, entryPoint] = params as [any, string];
            logs.push(`Bundler: eth_sendUserOperation`);
            const packedOp = packUserOperation(userOp);
            const txHash = await submitUserOperation(relayerPrivateKey as Hex, [packedOp], chain);
            logs.push(`Bundler: txHash=${txHash}`);
            // Return a userOpHash (use txHash as proxy)
            return txHash;
          }
          if (method === "eth_estimateUserOperationGas") {
            return {
              callGasLimit: DEFAULT_GAS_LIMITS.callGasLimit,
              verificationGasLimit: DEFAULT_GAS_LIMITS.verificationGasLimit,
              preVerificationGas: DEFAULT_GAS_LIMITS.preVerificationGas,
              paymasterVerificationGasLimit: DEFAULT_GAS_LIMITS.paymasterVerificationGasLimit,
              paymasterPostOpGasLimit: DEFAULT_GAS_LIMITS.paymasterPostOpGasLimit,
            };
          }
          if (method === "eth_getUserOperationReceipt") {
            const [hash] = params as [string];
            const receipt = await publicClient.getTransactionReceipt({ hash: hash as Hex });
            return {
              success: receipt.status === "success",
              receipt: { transactionHash: receipt.transactionHash, status: receipt.status === "success" ? "0x1" : "0x0" },
            };
          }
          if (method === "eth_supportedEntryPoints") {
            return [entryPoint07Address];
          }
          if (method === "eth_chainId") {
            return chainIdHex;
          }
          throw new Error(`Unsupported method: ${method}`);
        },
      }),
      // Custom paymaster
      paymaster: {
        async getPaymasterData() {
          return getPaymasterFields(paymasterAddress as Address);
        },
        async getPaymasterStubData() {
          return getPaymasterFields(paymasterAddress as Address);
        },
      },
      userOperation: {
        estimateFeesPerGas: async () => {
          return await getGasPrice(publicClient as any);
        },
      },
    } as any);

    // Build the calls: approve paymaster + transfer to recipient
    const approvalAmount = parseUnits("10", 6);
    const calls = [
      {
        to: usdcAddress,
        value: 0n,
        data: encodeFunctionData({
          abi: parseAbi(["function approve(address spender, uint256 amount) returns (bool)"]),
          functionName: "approve",
          args: [paymasterAddress as Address, approvalAmount],
        }),
      },
      {
        to: usdcAddress,
        value: 0n,
        data: encodeFunctionData({
          abi: parseAbi(["function transfer(address to, uint256 amount) returns (bool)"]),
          functionName: "transfer",
          args: [recipient, amountUnits],
        }),
      },
    ];

    logs.push("Sending UserOp via smart account client");
    const txHash = await smartAccountClient.sendUserOperation({ calls } as any);
    logs.push(`UserOp sent: ${txHash}`);

    // Wait for receipt
    logs.push("Waiting for receipt");
    const receipt = await waitForUserOperationReceipt(publicClient, txHash as Hex);

    if (receipt.receipt.status !== "success") {
      logs.push("FAIL: tx reverted");
      return { hash: null, logs };
    }

    logs.push("SUCCESS: Payment on-chain!");
    return { hash: txHash as string, onChain: true, logs };
  } catch (error) {
    logs.push(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
    return { hash: null, logs };
  }
}
