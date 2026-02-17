"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useOnChainFeedback } from "@/hooks/useOnChainFeedback";
import type { ChainId } from "@/lib/contracts";

interface FeedbackDialogProps {
  isOpen: boolean;
  agentId: string;
  agentName: string;
  agentTokenId?: string | null;
  agentChainId?: number | null;
  onClose: () => void;
  onSubmitSuccess: () => void;
}

export function FeedbackDialog({
  isOpen,
  agentId,
  agentName,
  agentTokenId,
  agentChainId,
  onClose,
  onSubmitSuccess,
}: FeedbackDialogProps) {
  const { address, isConnected } = useAccount();
  const [rating, setRating] = useState<number>(0);
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitOnChain, setSubmitOnChain] = useState(false);
  const [onChainTxHash, setOnChainTxHash] = useState<string | null>(null);

  const {
    submitFeedback: submitOnChainFeedback,
    isSubmitting: isSubmittingOnChain,
    error: onChainError,
  } = useOnChainFeedback();

  // Check if on-chain submission is available
  const canSubmitOnChain = isConnected && agentTokenId && agentChainId;

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (rating === 0) {
      setError("Please select a rating");
      return;
    }

    if (!address) {
      setError("Please connect your wallet to submit feedback");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      let txHash: string | null = null;

      // Submit on-chain if enabled and available
      if (submitOnChain && canSubmitOnChain) {
        const hash = await submitOnChainFeedback({
          agentTokenId: BigInt(agentTokenId!),
          rating,
          comment: comment.trim() || undefined,
          chainId: agentChainId as ChainId,
        });

        if (!hash) {
          throw new Error(onChainError || "Failed to submit on-chain feedback");
        }

        txHash = hash;
        setOnChainTxHash(hash);
      }

      // Always submit off-chain as well (for faster queries and backup)
      const response = await fetch(`/api/agents/${agentId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewerAddress: address,
          rating,
          comment: comment.trim() || null,
          transactionHash: txHash,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to submit feedback");
      }

      setSubmitted(true);
      setTimeout(() => {
        onSubmitSuccess();
        onClose();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit feedback");
    } finally {
      setIsSubmitting(false);
    }
  };

  const StarIcon = ({ filled }: { filled: boolean }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={`h-8 w-8 transition-colors ${
        filled ? "text-yellow-400" : "text-gray-300"
      }`}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
      />
    </svg>
  );

  if (submitted) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-900 dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-8 text-center">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-8 w-8 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h3 className="text-xl font-semibold mb-2">Thank You!</h3>
          <p className="text-gray-600 dark:text-gray-400">
            Your feedback helps improve {agentName}.
          </p>
          {onChainTxHash && (
            <div className="mt-4 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
              <p className="text-sm text-indigo-700 dark:text-indigo-300">
                Recorded on-chain
              </p>
              <a
                href={`https://sepolia.basescan.org/tx/${onChainTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-indigo-600 hover:underline"
              >
                View transaction
              </a>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-600 p-6 text-white">
          <h2 className="text-xl font-bold">Rate Your Experience</h2>
          <p className="text-sm text-white/80 mt-1">
            How was your experience with {agentName}?
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Star Rating */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Overall Rating
            </label>
            <div className="flex justify-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="focus:outline-none transform hover:scale-110 transition-transform"
                >
                  <StarIcon
                    filled={star <= (hoveredRating || rating)}
                  />
                </button>
              ))}
            </div>
            <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-2">
              {rating === 0
                ? "Click to rate"
                : ["", "Poor", "Fair", "Good", "Very Good", "Excellent"][rating]}
            </p>
          </div>

          {/* Comment */}
          <div className="mb-6">
            <label
              htmlFor="comment"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Comment (optional)
            </label>
            <textarea
              id="comment"
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share your experience..."
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* On-chain option */}
          {canSubmitOnChain && (
            <div className="mb-6">
              <label className="flex items-center gap-3 p-3 bg-gradient-to-r from-indigo-50 to-indigo-50 dark:from-indigo-900/20 dark:to-indigo-900/20 rounded-lg cursor-pointer hover:from-indigo-100 hover:to-indigo-100 dark:hover:from-indigo-900/30 dark:hover:to-indigo-900/30 transition-colors">
                <input
                  type="checkbox"
                  checked={submitOnChain}
                  onChange={(e) => setSubmitOnChain(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    Submit on-chain
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Permanent & verifiable on blockchain
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <svg
                    className="w-4 h-4 text-indigo-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                </div>
              </label>
            </div>
          )}

          {/* Wallet info */}
          {isConnected ? (
            <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm text-green-700 dark:text-green-400">
                  Connected: {address?.slice(0, 6)}...{address?.slice(-4)}
                </span>
              </div>
            </div>
          ) : (
            <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <p className="text-sm text-yellow-700 dark:text-yellow-400">
                Connect your wallet to submit feedback
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2 px-4 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || isSubmittingOnChain || rating === 0}
              className="flex-1 py-2 px-4 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-600 text-white hover:from-indigo-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isSubmitting || isSubmittingOnChain
                ? submitOnChain
                  ? "Confirming..."
                  : "Submitting..."
                : submitOnChain
                ? "Submit On-Chain"
                : "Submit Rating"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
