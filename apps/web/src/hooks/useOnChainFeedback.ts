"use client";

import { useState, useCallback } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import {
  getContractAddresses,
  REPUTATION_REGISTRY_ABI,
  hashComment,
  type ChainId,
} from "@/lib/contracts";

interface SubmitFeedbackParams {
  agentTokenId: bigint;
  rating: number;
  comment?: string;
  chainId: ChainId;
}

interface SubmitDetailedFeedbackParams extends SubmitFeedbackParams {
  accuracy: number;
  helpfulness: number;
  speed: number;
  safety: number;
}

interface UseOnChainFeedbackResult {
  submitFeedback: (params: SubmitFeedbackParams) => Promise<`0x${string}` | null>;
  submitDetailedFeedback: (params: SubmitDetailedFeedbackParams) => Promise<`0x${string}` | null>;
  isSubmitting: boolean;
  txHash: `0x${string}` | null;
  error: string | null;
  reset: () => void;
}

export function useOnChainFeedback(): UseOnChainFeedbackResult {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setTxHash(null);
    setError(null);
    setIsSubmitting(false);
  }, []);

  const submitFeedback = useCallback(
    async (params: SubmitFeedbackParams): Promise<`0x${string}` | null> => {
      if (!isConnected || !address || !walletClient) {
        setError("Please connect your wallet first");
        return null;
      }

      setIsSubmitting(true);
      setError(null);
      setTxHash(null);

      try {
        const { agentTokenId, rating, comment, chainId } = params;
        const addresses = getContractAddresses(chainId);
        const commentHash = hashComment(comment || "");

        // Prepare the transaction
        const hash = await walletClient.writeContract({
          address: addresses.reputationRegistry,
          abi: REPUTATION_REGISTRY_ABI,
          functionName: "submitFeedback",
          args: [agentTokenId, rating, commentHash],
        });

        setTxHash(hash);

        // Wait for transaction confirmation
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash });
        }

        return hash;
      } catch (err) {
        console.error("Failed to submit on-chain feedback:", err);
        const errorMessage =
          err instanceof Error ? err.message : "Failed to submit feedback";
        setError(errorMessage);
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    [isConnected, address, walletClient, publicClient]
  );

  const submitDetailedFeedback = useCallback(
    async (
      params: SubmitDetailedFeedbackParams
    ): Promise<`0x${string}` | null> => {
      if (!isConnected || !address || !walletClient) {
        setError("Please connect your wallet first");
        return null;
      }

      setIsSubmitting(true);
      setError(null);
      setTxHash(null);

      try {
        const {
          agentTokenId,
          rating,
          accuracy,
          helpfulness,
          speed,
          safety,
          comment,
          chainId,
        } = params;
        const addresses = getContractAddresses(chainId);
        const commentHash = hashComment(comment || "");

        // Prepare the transaction
        const hash = await walletClient.writeContract({
          address: addresses.reputationRegistry,
          abi: REPUTATION_REGISTRY_ABI,
          functionName: "submitDetailedFeedback",
          args: [
            agentTokenId,
            rating,
            accuracy,
            helpfulness,
            speed,
            safety,
            commentHash,
          ],
        });

        setTxHash(hash);

        // Wait for transaction confirmation
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash });
        }

        return hash;
      } catch (err) {
        console.error("Failed to submit detailed on-chain feedback:", err);
        const errorMessage =
          err instanceof Error ? err.message : "Failed to submit feedback";
        setError(errorMessage);
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    [isConnected, address, walletClient, publicClient]
  );

  return {
    submitFeedback,
    submitDetailedFeedback,
    isSubmitting,
    txHash,
    error,
    reset,
  };
}
