"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { ReputationBadge } from "@/components/ReputationBadge";
import { Pagination } from "@/components/Pagination";

interface Agent {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  pricingType?: string;
  pricePerQuery?: number;
  freeQueries?: number;
  capabilities?: string[];
  isFeatured?: boolean;
  stats?: {
    avgRating: number;
    totalReviews: number;
    totalSessions: number;
  };
}

interface AgentWithReputation extends Agent {
  reputation?: {
    averageRating: number;
    totalReviews: number;
    trustLevel: "unverified" | "basic" | "verified" | "premium";
  };
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

type SortOption = "rating" | "popular" | "newest";

export default function MarketplacePage() {
  const [agents, setAgents] = useState<AgentWithReputation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [pricingFilter, setPricingFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortOption>("rating");
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 0,
  });

  const fetchAgents = useCallback(async (page: number = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "12",
        sort: sortBy,
        order: "desc",
      });

      if (categoryFilter !== "all") {
        params.append("category", categoryFilter);
      }

      const response = await fetch(`/api/agents?${params}`);
      if (response.ok) {
        const data = await response.json();

        // Fetch reputation for each agent
        const agentsWithRep = await Promise.all(
          data.agents.map(async (agent: Agent) => {
            // Use stats from API if available
            if (agent.stats) {
              return {
                ...agent,
                reputation: {
                  averageRating: agent.stats.avgRating,
                  totalReviews: agent.stats.totalReviews,
                  trustLevel: getTrustLevel(
                    agent.stats.avgRating,
                    agent.stats.totalReviews
                  ),
                },
              };
            }
            // Fallback to separate reputation fetch
            try {
              const repRes = await fetch(`/api/agents/${agent.id}/reputation`);
              if (repRes.ok) {
                const repData = await repRes.json();
                return {
                  ...agent,
                  reputation: {
                    averageRating: repData.offChain.averageRating,
                    totalReviews: repData.offChain.totalReviews,
                    trustLevel: repData.trustLevel,
                  },
                };
              }
            } catch {
              // Ignore reputation fetch errors
            }
            return agent;
          })
        );
        setAgents(agentsWithRep);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error("Failed to fetch agents:", error);
    } finally {
      setLoading(false);
    }
  }, [sortBy, categoryFilter]);

  useEffect(() => {
    fetchAgents(1);
  }, [fetchAgents]);

  const handlePageChange = (page: number) => {
    fetchAgents(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Client-side filtering for search and pricing (API handles category and sorting)
  const filteredAgents = agents.filter((agent) => {
    const matchesSearch =
      searchQuery === "" ||
      agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesPricing =
      pricingFilter === "all" ||
      (pricingFilter === "free" && agent.pricingType === "free") ||
      (pricingFilter === "paid" && agent.pricingType !== "free");

    return matchesSearch && matchesPricing;
  });

  const categories = [
    { value: "all", label: "All Categories" },
    { value: "customer-facing", label: "Customer-Facing" },
    { value: "productivity", label: "Productivity" },
  ];

  const pricingOptions = [
    { value: "all", label: "All Pricing" },
    { value: "free", label: "Free" },
    { value: "paid", label: "Paid" },
  ];

  const sortOptions = [
    { value: "rating", label: "Top Rated" },
    { value: "popular", label: "Most Popular" },
    { value: "newest", label: "Newest" },
  ];

  return (
    <div className="min-h-full bg-gray-50 dark:bg-gray-950">
      <Header />

      {/* Hero */}
      <section className="bg-gradient-to-b from-indigo-50 to-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-center mb-4">
            AI Agent Marketplace
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-center mb-8 max-w-xl mx-auto">
            Discover and deploy verified AI agents for your business. All agents
            include on-chain identity and reputation.
          </p>

          {/* Search */}
          <div className="max-w-2xl mx-auto mb-8">
            <div className="relative">
              <input
                type="text"
                placeholder="Search agents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-3 pl-12 rounded-xl border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <svg
                className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>

          {/* Filters and Sorting */}
          <div className="flex flex-wrap justify-center gap-4">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {categories.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>

            <select
              value={pricingFilter}
              onChange={(e) => setPricingFilter(e.target.value)}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {pricingOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {sortOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Agent Grid */}
      <section className="py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Results count */}
          {!loading && (
            <div className="mb-6 text-sm text-gray-500 dark:text-gray-400">
              Showing {filteredAgents.length} of {pagination.total} agents
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="bg-white dark:bg-gray-900 rounded-xl border p-6 animate-pulse"
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-lg" />
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                    </div>
                  </div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2" />
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : filteredAgents.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">
                No agents found matching your criteria.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredAgents.map((agent) => (
                  <AgentCard key={agent.id} agent={agent} />
                ))}
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="mt-12">
                  <Pagination
                    currentPage={pagination.page}
                    totalPages={pagination.totalPages}
                    onPageChange={handlePageChange}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function getTrustLevel(
  rating: number,
  reviews: number
): "unverified" | "basic" | "verified" | "premium" {
  if (reviews >= 50 && rating >= 4.5) return "premium";
  if (reviews >= 20 && rating >= 4.0) return "verified";
  if (reviews >= 5 && rating >= 3.0) return "basic";
  return "unverified";
}

function AgentCard({ agent }: { agent: AgentWithReputation }) {
  const capabilities = agent.capabilities || [];
  const displayCaps = capabilities.slice(0, 3);
  const moreCaps = capabilities.length - 3;

  return (
    <Link
      href={`/marketplace/${agent.id}`}
      className="bg-white dark:bg-gray-900 rounded-xl border hover:shadow-lg transition-shadow overflow-hidden group relative"
    >
      {/* Featured badge */}
      {agent.isFeatured && (
        <div className="absolute top-3 right-3 z-10">
          <span className="px-2 py-1 bg-gradient-to-r from-amber-400 to-orange-400 text-white text-xs font-semibold rounded-full shadow-sm">
            Featured
          </span>
        </div>
      )}

      <div className="p-6">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-100 to-indigo-100 rounded-lg flex items-center justify-center text-2xl shrink-0">
            {agent.icon}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 transition-colors truncate">
              {agent.name}
            </h3>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                agent.category === "customer-facing"
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                  : "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400"
              }`}
            >
              {agent.category}
            </span>
          </div>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
          {agent.description}
        </p>

        {/* Capabilities tags */}
        {capabilities.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {displayCaps.map((cap) => (
              <span
                key={cap}
                className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs rounded-md"
              >
                {cap}
              </span>
            ))}
            {moreCaps > 0 && (
              <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs rounded-md">
                +{moreCaps} more
              </span>
            )}
          </div>
        )}

        {/* Reputation */}
        {agent.reputation && (
          <div className="mb-4">
            <ReputationBadge
              rating={agent.reputation.averageRating}
              totalReviews={agent.reputation.totalReviews}
              trustLevel={agent.reputation.trustLevel}
              size="sm"
            />
          </div>
        )}

        {/* Pricing */}
        <div className="flex items-center justify-between text-sm border-t pt-4">
          {agent.pricingType === "free" ? (
            <span className="text-green-600 font-medium">Free</span>
          ) : (
            <span className="text-gray-600 dark:text-gray-400">
              {agent.freeQueries || 0} free, then $
              {((agent.pricePerQuery || 0) / 100).toFixed(2)}/query
            </span>
          )}
          <span className="text-indigo-600 font-medium group-hover:translate-x-1 transition-transform">
            Try it &rarr;
          </span>
        </div>
      </div>
    </Link>
  );
}
