"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAccount, useWalletClient, usePublicClient } from "wagmi";
import type { Address, Hash } from "viem";
import { parseUnits } from "viem";
import {
  createSafeSmartAccountClient,
  encodeErc20Transfer,
  encodeErc20Approve,
  type SmartAccountClientResult,
} from "@/lib/smart-account/client";
import {
  isSupportedChain,
  getChainConfig,
  type SupportedChainId,
} from "@/lib/smart-account/config";
import type { UserOperationCall, UserOperationReceipt } from "@/lib/smart-account/types";

export interface UseSmartAccountReturn {
  // Addresses
  eoaAddress: Address | undefined;
  smartAccountAddress: Address | null;

  // State
  isConnected: boolean;
  isSmartAccountReady: boolean;
  isDeployed: boolean;
  isLoading: boolean;
  error: Error | null;

  // Chain info
  chainId: number | undefined;
  isChainSupported: boolean;

  // Actions
  sendUserOperation: (calls: UserOperationCall[]) => Promise<UserOperationReceipt>;
  sendErc20Transfer: (
    tokenAddress: Address,
    to: Address,
    amount: bigint
  ) => Promise<UserOperationReceipt>;
  sendErc20Approve: (
    tokenAddress: Address,
    spender: Address,
    amount: bigint
  ) => Promise<UserOperationReceipt>;
  withdrawToEoa: (
    tokenAddress: Address,
    amount: bigint
  ) => Promise<UserOperationReceipt>;

  // Utils
  getExplorerUrl: (txHash: Hash) => string;
  refreshSmartAccount: () => Promise<void>;
}

export function useSmartAccount(): UseSmartAccountReturn {
  const { address: eoaAddress, isConnected, chainId } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const [smartAccountClient, setSmartAccountClient] =
    useState<SmartAccountClientResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Check if chain is supported
  const isChainSupported = useMemo(
    () => chainId !== undefined && isSupportedChain(chainId),
    [chainId]
  );

  // Initialize smart account when wallet connects
  const initSmartAccount = useCallback(async () => {
    if (!walletClient || !chainId || !isChainSupported) {
      setSmartAccountClient(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await createSafeSmartAccountClient({
        signer: walletClient,
        chainId: chainId as SupportedChainId,
      });

      setSmartAccountClient(result);
    } catch (err) {
      console.error("Failed to initialize smart account:", err);
      setError(err instanceof Error ? err : new Error("Failed to initialize smart account"));
      setSmartAccountClient(null);
    } finally {
      setIsLoading(false);
    }
  }, [walletClient, chainId, isChainSupported]);

  // Auto-initialize when wallet connects
  useEffect(() => {
    if (isConnected && walletClient && isChainSupported) {
      initSmartAccount();
    } else {
      setSmartAccountClient(null);
    }
  }, [isConnected, walletClient, isChainSupported, initSmartAccount]);

  // Send UserOperation
  const sendUserOperation = useCallback(
    async (calls: UserOperationCall[]): Promise<UserOperationReceipt> => {
      if (!smartAccountClient) {
        throw new Error("Smart account not initialized");
      }

      const { smartAccountClient: client } = smartAccountClient;

      // Prepend USDC approval for paymaster when paymaster is configured
      let finalCalls = calls;
      if (chainId && isSupportedChain(chainId)) {
        const config = getChainConfig(chainId as SupportedChainId);
        if (config.paymasterAddress) {
          const approveCall = encodeErc20Approve(
            config.usdcAddress,
            config.paymasterAddress,
            parseUnits("10", 6) // generous approval for gas fee
          );
          finalCalls = [approveCall, ...calls];
        }
      }

      // Send the user operation
      const userOpHash = await client.sendUserOperation({
        calls: finalCalls,
      });

      // Wait for the receipt
      const receipt = await client.waitForUserOperationReceipt({
        hash: userOpHash,
      });

      return {
        userOpHash,
        transactionHash: receipt.receipt.transactionHash,
        success: receipt.success,
        actualGasUsed: receipt.actualGasUsed,
        actualGasCost: receipt.actualGasCost,
      };
    },
    [smartAccountClient]
  );

  // Convenience: Send ERC20 transfer
  const sendErc20Transfer = useCallback(
    async (
      tokenAddress: Address,
      to: Address,
      amount: bigint
    ): Promise<UserOperationReceipt> => {
      const call = encodeErc20Transfer(tokenAddress, to, amount);
      return sendUserOperation([call]);
    },
    [sendUserOperation]
  );

  // Convenience: Send ERC20 approve
  const sendErc20Approve = useCallback(
    async (
      tokenAddress: Address,
      spender: Address,
      amount: bigint
    ): Promise<UserOperationReceipt> => {
      const call = encodeErc20Approve(tokenAddress, spender, amount);
      return sendUserOperation([call]);
    },
    [sendUserOperation]
  );

  // Withdraw: Send tokens from smart account back to EOA
  const withdrawToEoa = useCallback(
    async (
      tokenAddress: Address,
      amount: bigint
    ): Promise<UserOperationReceipt> => {
      if (!eoaAddress) {
        throw new Error("No EOA address to withdraw to");
      }
      return sendErc20Transfer(tokenAddress, eoaAddress, amount);
    },
    [eoaAddress, sendErc20Transfer]
  );

  // Withdraw all: Send all tokens of a type back to EOA
  const withdrawAllToEoa = useCallback(
    async (tokenAddress: Address): Promise<UserOperationReceipt> => {
      if (!eoaAddress || !smartAccountClient?.smartAccountAddress) {
        throw new Error("Addresses not available");
      }
      // Note: Need to fetch balance first via publicClient
      // For now, user should specify amount
      throw new Error("Use withdrawToEoa with specific amount");
    },
    [eoaAddress, smartAccountClient?.smartAccountAddress]
  );

  // Get explorer URL for transaction
  const getExplorerUrl = useCallback(
    (txHash: Hash): string => {
      if (!chainId || !isSupportedChain(chainId)) {
        return `https://etherscan.io/tx/${txHash}`;
      }
      const config = getChainConfig(chainId);
      return `${config.explorerUrl}/tx/${txHash}`;
    },
    [chainId]
  );

  return {
    // Addresses
    eoaAddress,
    smartAccountAddress: smartAccountClient?.smartAccountAddress ?? null,

    // State
    isConnected,
    isSmartAccountReady: !!smartAccountClient,
    isDeployed: smartAccountClient?.isDeployed ?? false,
    isLoading,
    error,

    // Chain info
    chainId,
    isChainSupported,

    // Actions
    sendUserOperation,
    sendErc20Transfer,
    sendErc20Approve,
    withdrawToEoa,

    // Utils
    getExplorerUrl,
    refreshSmartAccount: initSmartAccount,
  };
}
