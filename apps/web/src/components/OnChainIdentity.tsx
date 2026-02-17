"use client";

import { useState, useEffect } from "react";
import {
  getAgentOnChain,
  getReputationOnChain,
  type ChainId,
} from "@/lib/contracts";

interface OnChainIdentityProps {
  tokenId: string;
  chainId: number;
  chainName: string;
  explorerUrl: string;
}

interface OnChainData {
  owner: string;
  agentWallet: string;
  metadataUri: string;
  isActive: boolean;
  reputation?: {
    overallScore: number;
    totalReviews: number;
    accuracyScore: number;
    helpfulnessScore: number;
    speedScore: number;
    safetyScore: number;
  };
}

export function OnChainIdentity({
  tokenId,
  chainId,
  chainName,
  explorerUrl,
}: OnChainIdentityProps) {
  const [data, setData] = useState<OnChainData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOnChainData() {
      try {
        setLoading(true);
        setError(null);

        const tokenIdBigInt = BigInt(tokenId);
        const chainIdTyped = chainId as ChainId;

        // Fetch agent identity
        const agent = await getAgentOnChain(chainIdTyped, tokenIdBigInt);

        // Fetch reputation
        const reputation = await getReputationOnChain(chainIdTyped, tokenIdBigInt);

        setData({
          owner: agent.owner,
          agentWallet: agent.agentWallet,
          metadataUri: agent.metadataUri,
          isActive: agent.isActive,
          reputation: {
            overallScore: Number(reputation.overallScore) / 100,
            totalReviews: Number(reputation.totalReviews),
            accuracyScore: Number(reputation.accuracyScore) / 100,
            helpfulnessScore: Number(reputation.helpfulnessScore) / 100,
            speedScore: Number(reputation.speedScore) / 100,
            safetyScore: Number(reputation.safetyScore) / 100,
          },
        });
      } catch (err) {
        console.error("Failed to fetch on-chain data:", err);
        setError("Failed to load on-chain data");
      } finally {
        setLoading(false);
      }
    }

    fetchOnChainData();
  }, [tokenId, chainId]);

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-indigo-50 to-indigo-50 dark:from-indigo-900/20 dark:to-indigo-900/20 rounded-xl p-6 animate-pulse">
        <div className="h-4 bg-indigo-200 dark:bg-indigo-800 rounded w-1/3 mb-4"></div>
        <div className="h-3 bg-indigo-100 dark:bg-indigo-800/50 rounded w-2/3 mb-2"></div>
        <div className="h-3 bg-indigo-100 dark:bg-indigo-800/50 rounded w-1/2"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-gray-50 dark:bg-gray-950 dark:bg-gray-800 rounded-xl p-6 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">{error || "No on-chain data available"}</p>
      </div>
    );
  }

  const shortenAddress = (address: string) =>
    `${address.slice(0, 6)}...${address.slice(-4)}`;

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-indigo-50 dark:from-indigo-900/20 dark:to-indigo-900/20 rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-indigo-600"
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
          <h3 className="font-semibold text-gray-900 dark:text-white">
            On-Chain Identity
          </h3>
        </div>
        {data.isActive ? (
          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
            Active
          </span>
        ) : (
          <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
            Inactive
          </span>
        )}
      </div>

      {/* Identity details */}
      <div className="space-y-3 mb-6">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Token ID
          </span>
          <span className="text-sm font-mono text-gray-900 dark:text-white">
            #{tokenId}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Chain
          </span>
          <span className="text-sm text-gray-900 dark:text-white">
            {chainName}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Owner
          </span>
          <a
            href={`${explorerUrl}/address/${data.owner}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-mono text-indigo-600 hover:text-indigo-700 hover:underline"
          >
            {shortenAddress(data.owner)}
          </a>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Agent Wallet
          </span>
          <a
            href={`${explorerUrl}/address/${data.agentWallet}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-mono text-indigo-600 hover:text-indigo-700 hover:underline"
          >
            {shortenAddress(data.agentWallet)}
          </a>
        </div>
      </div>

      {/* On-chain reputation */}
      {data.reputation && data.reputation.totalReviews > 0 && (
        <div className="border-t border-indigo-200 dark:border-indigo-800 pt-6">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-4">
            On-Chain Reputation
          </h4>

          <div className="grid grid-cols-2 gap-4">
            <ReputationScore
              label="Overall"
              score={data.reputation.overallScore}
            />
            <ReputationScore
              label="Accuracy"
              score={data.reputation.accuracyScore}
            />
            <ReputationScore
              label="Helpfulness"
              score={data.reputation.helpfulnessScore}
            />
            <ReputationScore
              label="Speed"
              score={data.reputation.speedScore}
            />
            <ReputationScore
              label="Safety"
              score={data.reputation.safetyScore}
            />
            <div className="flex flex-col items-center p-3 bg-white dark:bg-gray-900/50 dark:bg-gray-800/50 rounded-lg">
              <span className="text-xl font-bold text-gray-900 dark:text-white">
                {data.reputation.totalReviews}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Reviews
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Verified badge */}
      <div className="mt-6 flex items-center justify-center gap-2 p-3 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg">
        <svg
          className="w-5 h-5 text-indigo-600"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
        <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
          ERC-8004 Verified Identity
        </span>
      </div>
    </div>
  );
}

function ReputationScore({ label, score }: { label: string; score: number }) {
  const getColor = (s: number) => {
    if (s >= 4.5) return "text-green-600";
    if (s >= 3.5) return "text-blue-600";
    if (s >= 2.5) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="flex flex-col items-center p-3 bg-white dark:bg-gray-900/50 dark:bg-gray-800/50 rounded-lg">
      <span className={`text-xl font-bold ${getColor(score)}`}>
        {score.toFixed(1)}
      </span>
      <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
    </div>
  );
}
