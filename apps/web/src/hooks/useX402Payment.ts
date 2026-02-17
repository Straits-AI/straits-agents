"use client";

import { useState, useCallback } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits, type Address } from "viem";
import { useSmartAccountContext } from "@/providers/SmartAccountProvider";
import { useAuthContext } from "@/providers/AuthProvider";
import { getChainConfig, isSupportedChain } from "@/lib/smart-account/config";


// USDC ABI for transfer function (used for EOA fallback)
const USDC_ABI = [
  {
    type: "function",
    name: "transfer",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

export interface X402PaymentRequired {
  status: 402;
  paymentDetails: {
    amount: number; // Amount in cents (1 USDC = 100 cents)
    currency: "USDC";
    recipient: string;
    description: string;
    expiresAt: string;
  };
  paymentId: string;
}

export interface PaymentState {
  isProcessing: boolean;
  error: string | null;
  transactionHash: string | null;
  paymentId: string | null;
  isConfirmed: boolean;
  useSmartAccount: boolean;
}

export function useX402Payment() {
  const { address: eoaAddress, chainId } = useAccount();
  const {
    smartAccountAddress,
    isSmartAccountReady,
    sendErc20Transfer,
    getExplorerUrl,
  } = useSmartAccountContext();
  const { hasEmbeddedWallet, embeddedBalance, refetch: refetchAuth } = useAuthContext();

  const [paymentState, setPaymentState] = useState<PaymentState>({
    isProcessing: false,
    error: null,
    transactionHash: null,
    paymentId: null,
    isConfirmed: false,
    useSmartAccount: false,
  });

  // EOA fallback
  const { writeContractAsync, data: txHash } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Get the active address (smart account or EOA)
  const activeAddress = smartAccountAddress || eoaAddress;

  // Check if response is a 402 payment required
  const isPaymentRequired = useCallback((response: Response): boolean => {
    return response.status === 402;
  }, []);

  // Parse 402 response
  const parsePaymentRequired = useCallback(async (response: Response): Promise<X402PaymentRequired | null> => {
    if (response.status !== 402) return null;
    try {
      return await response.json();
    } catch {
      return null;
    }
  }, []);

  // Execute payment via Smart Account (ERC-4337)
  const executeSmartAccountPayment = useCallback(
    async (
      paymentRequired: X402PaymentRequired,
      sessionId: string,
      agentId: string
    ): Promise<{ success: boolean; transactionHash?: string; error?: string }> => {
      if (!smartAccountAddress || !chainId) {
        return { success: false, error: "Smart account not ready" };
      }

      if (!isSupportedChain(chainId)) {
        return { success: false, error: `Chain ${chainId} not supported` };
      }

      const config = getChainConfig(chainId);
      const usdcAddress = config.usdcAddress;

      setPaymentState({
        isProcessing: true,
        error: null,
        transactionHash: null,
        paymentId: paymentRequired.paymentId,
        isConfirmed: false,
        useSmartAccount: true,
      });

      try {
        // Convert cents to USDC (6 decimals)
        const amountInUsdcUnits = parseUnits(
          (paymentRequired.paymentDetails.amount / 100).toString(),
          6
        );

        // Execute via smart account (UserOperation)
        const receipt = await sendErc20Transfer(
          usdcAddress,
          paymentRequired.paymentDetails.recipient as Address,
          amountInUsdcUnits
        );

        // Record payment in backend
        const recordResponse = await fetch("/api/payments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentId: paymentRequired.paymentId,
            payerAddress: smartAccountAddress,
            amount: paymentRequired.paymentDetails.amount,
            chainId,
            transactionHash: receipt.transactionHash,
            sessionId,
            agentId,
            isSmartAccount: true,
            userOpHash: receipt.userOpHash,
          }),
        });

        if (!recordResponse.ok) {
          throw new Error("Failed to record payment");
        }

        setPaymentState({
          isProcessing: false,
          error: null,
          transactionHash: receipt.transactionHash,
          paymentId: paymentRequired.paymentId,
          isConfirmed: true,
          useSmartAccount: true,
        });

        return { success: true, transactionHash: receipt.transactionHash };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Smart account payment failed";
        setPaymentState({
          isProcessing: false,
          error: errorMessage,
          transactionHash: null,
          paymentId: paymentRequired.paymentId,
          isConfirmed: false,
          useSmartAccount: true,
        });
        return { success: false, error: errorMessage };
      }
    },
    [smartAccountAddress, chainId, sendErc20Transfer]
  );

  // Execute payment via EOA (fallback)
  const executeEoaPayment = useCallback(
    async (
      paymentRequired: X402PaymentRequired,
      sessionId: string,
      agentId: string
    ): Promise<{ success: boolean; transactionHash?: string; error?: string }> => {
      if (!eoaAddress || !chainId) {
        return { success: false, error: "Wallet not connected" };
      }

      if (!isSupportedChain(chainId)) {
        return { success: false, error: `Chain ${chainId} not supported` };
      }
      const eoaConfig = getChainConfig(chainId);
      const usdcAddress = eoaConfig.usdcAddress;

      setPaymentState({
        isProcessing: true,
        error: null,
        transactionHash: null,
        paymentId: paymentRequired.paymentId,
        isConfirmed: false,
        useSmartAccount: false,
      });

      try {
        // Convert cents to USDC (6 decimals)
        const amountInUsdcUnits = parseUnits(
          (paymentRequired.paymentDetails.amount / 100).toString(),
          6
        );

        // Execute USDC transfer via EOA
        const hash = await writeContractAsync({
          address: usdcAddress,
          abi: USDC_ABI,
          functionName: "transfer",
          args: [
            paymentRequired.paymentDetails.recipient as Address,
            amountInUsdcUnits,
          ],
        });

        // Record payment in backend
        const recordResponse = await fetch("/api/payments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentId: paymentRequired.paymentId,
            payerAddress: eoaAddress,
            amount: paymentRequired.paymentDetails.amount,
            chainId,
            transactionHash: hash,
            sessionId,
            agentId,
            isSmartAccount: false,
          }),
        });

        if (!recordResponse.ok) {
          throw new Error("Failed to record payment");
        }

        setPaymentState({
          isProcessing: false,
          error: null,
          transactionHash: hash,
          paymentId: paymentRequired.paymentId,
          isConfirmed: true,
          useSmartAccount: false,
        });

        return { success: true, transactionHash: hash };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Payment failed";
        setPaymentState({
          isProcessing: false,
          error: errorMessage,
          transactionHash: null,
          paymentId: paymentRequired.paymentId,
          isConfirmed: false,
          useSmartAccount: false,
        });
        return { success: false, error: errorMessage };
      }
    },
    [eoaAddress, chainId, writeContractAsync]
  );

  // Execute payment via embedded wallet (server-side, no MetaMask needed)
  const executeEmbeddedPayment = useCallback(
    async (
      paymentRequired: X402PaymentRequired,
      sessionId: string,
      agentId: string
    ): Promise<{ success: boolean; transactionHash?: string; error?: string }> => {
      setPaymentState({
        isProcessing: true,
        error: null,
        transactionHash: null,
        paymentId: paymentRequired.paymentId,
        isConfirmed: false,
        useSmartAccount: false,
      });

      try {
        const res = await fetch("/api/payments/embedded", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentId: paymentRequired.paymentId,
            amount: paymentRequired.paymentDetails.amount,
            sessionId,
            agentId,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Embedded payment failed");
        }

        // Refresh auth context to update balance
        await refetchAuth();

        setPaymentState({
          isProcessing: false,
          error: null,
          transactionHash: data.transactionHash,
          paymentId: paymentRequired.paymentId,
          isConfirmed: true,
          useSmartAccount: false,
        });

        return { success: true, transactionHash: data.transactionHash };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Embedded payment failed";
        setPaymentState({
          isProcessing: false,
          error: errorMessage,
          transactionHash: null,
          paymentId: paymentRequired.paymentId,
          isConfirmed: false,
          useSmartAccount: false,
        });
        return { success: false, error: errorMessage };
      }
    },
    [refetchAuth]
  );

  // Main payment execution - tries embedded first, then smart account, then EOA
  const executePayment = useCallback(
    async (
      paymentRequired: X402PaymentRequired,
      sessionId: string,
      agentId: string
    ): Promise<{ success: boolean; transactionHash?: string; error?: string }> => {
      // Try embedded wallet first if available with sufficient balance
      if (hasEmbeddedWallet && embeddedBalance >= paymentRequired.paymentDetails.amount) {
        console.log("Executing payment via Embedded Wallet");
        return executeEmbeddedPayment(paymentRequired, sessionId, agentId);
      }

      // Try smart account if available
      if (isSmartAccountReady && smartAccountAddress) {
        console.log("Executing payment via Smart Account (ERC-4337)");
        const result = await executeSmartAccountPayment(paymentRequired, sessionId, agentId);

        // If smart account fails, try EOA fallback
        if (!result.success && eoaAddress) {
          console.warn("Smart account payment failed, falling back to EOA:", result.error);
          return executeEoaPayment(paymentRequired, sessionId, agentId);
        }

        return result;
      }

      // Fall back to EOA
      console.log("Executing payment via EOA (no smart account)");
      return executeEoaPayment(paymentRequired, sessionId, agentId);
    },
    [
      hasEmbeddedWallet,
      embeddedBalance,
      executeEmbeddedPayment,
      isSmartAccountReady,
      smartAccountAddress,
      eoaAddress,
      executeSmartAccountPayment,
      executeEoaPayment,
    ]
  );

  // Reset payment state
  const resetPaymentState = useCallback(() => {
    setPaymentState({
      isProcessing: false,
      error: null,
      transactionHash: null,
      paymentId: null,
      isConfirmed: false,
      useSmartAccount: false,
    });
  }, []);

  return {
    paymentState,
    isPaymentRequired,
    parsePaymentRequired,
    executePayment,
    executeEmbeddedPayment,
    resetPaymentState,
    isConfirming,
    isConfirmed,
    walletConnected: !!activeAddress || hasEmbeddedWallet,
    chainId,
    // Smart account specific
    isSmartAccountReady,
    smartAccountAddress,
    eoaAddress,
    activeAddress,
    getExplorerUrl,
    // Embedded wallet
    hasEmbeddedWallet,
    embeddedBalance,
  };
}
