"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/Header";
import { ReputationBadge, ReputationStats } from "@/components/ReputationBadge";

interface Agent {
  id: string;
  name: string;
  description: string;
  category: string;
  type: string;
  icon: string;
  capabilities: string[];
  pricingModel: {
    type: string;
    pricePerQuery: number;
    freeQueries: number;
  };
  systemPrompt: string;
  welcomeMessage: string;
}

interface Reputation {
  agentId: string;
  agentName: string;
  onChain: {
    tokenId: string | null;
    chainId: number | null;
    overallScore: number;
    totalReviews: number;
  };
  offChain: {
    averageRating: number;
    totalReviews: number;
    distribution: Record<number, number>;
  };
  trustLevel: "unverified" | "basic" | "verified" | "premium";
  recentFeedback: Array<{
    rating: number;
    comment: string | null;
    reviewerAddress: string;
    createdAt: string;
  }>;
}

export default function AgentProfilePage() {
  const params = useParams();
  const agentId = params.agentId as string;

  const [agent, setAgent] = useState<Agent | null>(null);
  const [reputation, setReputation] = useState<Reputation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [agentRes, repRes] = await Promise.all([
          fetch(`/api/agents/${agentId}`),
          fetch(`/api/agents/${agentId}/reputation`),
        ]);

        if (!agentRes.ok) {
          throw new Error("Agent not found");
        }

        const agentData = await agentRes.json();
        setAgent(agentData);

        if (repRes.ok) {
          const repData = await repRes.json();
          setReputation(repData);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load agent");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [agentId]);

  if (loading) {
    return (
      <div className="min-h-full bg-gray-50 dark:bg-gray-950">
        <Header />
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="min-h-full bg-gray-50 dark:bg-gray-950">
        <Header />
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <p className="text-red-600">{error || "Agent not found"}</p>
          <Link href="/marketplace" className="text-indigo-600 hover:underline">
            Back to Marketplace
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gray-50 dark:bg-gray-950">
      <Header />

      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Back link */}
        <Link
          href="/marketplace"
          className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 mb-6"
        >
          <svg
            className="w-4 h-4 mr-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Back to Marketplace
        </Link>

        {/* Agent Header */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-start gap-6">
            <div className="w-20 h-20 bg-gradient-to-br from-indigo-100 to-indigo-100 rounded-xl flex items-center justify-center text-4xl shrink-0">
              {agent.icon}
            </div>

            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold">{agent.name}</h1>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    agent.category === "customer-facing"
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                      : "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400"
                  }`}
                >
                  {agent.category}
                </span>
                {reputation && (
                  <TrustBadge level={reputation.trustLevel} />
                )}
              </div>

              <p className="text-gray-600 dark:text-gray-400 mb-4">{agent.description}</p>

              {reputation && (
                <ReputationBadge
                  rating={reputation.offChain.averageRating}
                  totalReviews={reputation.offChain.totalReviews}
                  trustLevel={reputation.trustLevel}
                />
              )}
            </div>

            <div className="flex flex-col gap-3">
              <Link
                href={`/chat/${agent.id}`}
                className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 text-center"
              >
                Try Agent
              </Link>
              <div className="text-center text-sm text-gray-500 dark:text-gray-400">
                {agent.pricingModel ? (
                  agent.pricingModel.type === "free" ? (
                    "Free to use"
                  ) : (
                    <>
                      {agent.pricingModel.freeQueries || 0} free queries
                      <br />
                      then ${(agent.pricingModel.pricePerQuery || 0) / 100}/query
                    </>
                  )
                ) : (
                  "Free to use"
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="md:col-span-2 space-y-6">
            {/* Capabilities */}
            {agent.capabilities && agent.capabilities.length > 0 && (
              <div className="bg-white dark:bg-gray-900 rounded-xl border p-6">
                <h2 className="font-semibold mb-4">Capabilities</h2>
                <div className="flex flex-wrap gap-2">
                  {agent.capabilities.map((cap) => (
                    <span
                      key={cap}
                      className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full text-sm"
                    >
                      {cap}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Reviews */}
            {reputation && reputation.recentFeedback.length > 0 && (
              <div className="bg-white dark:bg-gray-900 rounded-xl border p-6">
                <h2 className="font-semibold mb-4">Recent Reviews</h2>
                <div className="space-y-4">
                  {reputation.recentFeedback.map((feedback, idx) => (
                    <div
                      key={idx}
                      className="border-b last:border-0 pb-4 last:pb-0"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <svg
                              key={star}
                              className={`w-4 h-4 ${
                                star <= feedback.rating
                                  ? "text-yellow-400"
                                  : "text-gray-300"
                              }`}
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          ))}
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {feedback.reviewerAddress.slice(0, 6)}...
                          {feedback.reviewerAddress.slice(-4)}
                        </span>
                      </div>
                      {feedback.comment && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {feedback.comment}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Rating Distribution */}
            {reputation && (
              <div className="bg-white dark:bg-gray-900 rounded-xl border p-6">
                <h2 className="font-semibold mb-4">Rating Distribution</h2>
                <ReputationStats
                  distribution={reputation.offChain.distribution}
                  totalReviews={reputation.offChain.totalReviews}
                />
              </div>
            )}

            {/* On-Chain Info */}
            {reputation?.onChain.tokenId && (
              <div className="bg-white dark:bg-gray-900 rounded-xl border p-6">
                <h2 className="font-semibold mb-4">On-Chain Identity</h2>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Token ID</span>
                    <span className="font-mono">
                      {reputation.onChain.tokenId}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Chain</span>
                    <span>
                      {reputation.onChain.chainId === 97
                        ? "BNB Smart Chain Testnet"
                        : reputation.onChain.chainId === 421614
                          ? "Arbitrum Sepolia"
                          : `Chain ${reputation.onChain.chainId}`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">On-Chain Score</span>
                    <span>{Math.round(reputation.onChain.overallScore * 100)}%{reputation.onChain.totalReviews > 0 ? ` (${reputation.onChain.totalReviews} reviews)` : ""}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TrustBadge({
  level,
}: {
  level: "unverified" | "basic" | "verified" | "premium";
}) {
  const config = {
    unverified: {
      bg: "bg-gray-100 dark:bg-gray-800",
      text: "text-gray-600 dark:text-gray-400",
      label: "Unverified",
    },
    basic: {
      bg: "bg-blue-100 dark:bg-blue-900/30",
      text: "text-blue-700 dark:text-blue-400",
      label: "Basic Trust",
    },
    verified: {
      bg: "bg-green-100 dark:bg-green-900/30",
      text: "text-green-700 dark:text-green-400",
      label: "Verified",
    },
    premium: {
      bg: "bg-indigo-100 dark:bg-indigo-900/30",
      text: "text-indigo-700 dark:text-indigo-400",
      label: "Premium",
    },
  };

  const c = config[level];

  return (
    <span className={`text-xs px-2 py-1 rounded-full ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}
