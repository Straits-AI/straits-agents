"use client";

import Link from "next/link";

interface FeaturedAgent {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  pricingType: string;
  pricePerQuery: number;
  freeQueries: number;
  capabilities: string[];
  isFeatured: boolean;
  stats: {
    avgRating: number;
    totalReviews: number;
  };
}

interface FeaturedAgentsCarouselProps {
  agents: FeaturedAgent[];
}

export function FeaturedAgentsCarousel({
  agents,
}: FeaturedAgentsCarouselProps) {
  if (agents.length === 0) {
    return null;
  }

  return (
    <div className="relative">
      {/* Horizontal scrollable container */}
      <div className="overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide">
        <div className="flex gap-6" style={{ minWidth: "max-content" }}>
          {agents.map((agent) => (
            <FeaturedAgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      </div>

      {/* Gradient fade indicators */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-indigo-50 dark:from-gray-950 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-indigo-50 dark:from-gray-950 to-transparent" />
    </div>
  );
}

function FeaturedAgentCard({ agent }: { agent: FeaturedAgent }) {
  const displayCaps = agent.capabilities.slice(0, 2);

  return (
    <Link
      href={`/marketplace/${agent.id}`}
      className="flex-shrink-0 w-80 bg-white dark:bg-gray-900 rounded-2xl border border-indigo-100 hover:border-indigo-300 hover:shadow-xl transition-all overflow-hidden group"
    >
      {/* Header with gradient */}
      <div className="relative bg-gradient-to-br from-indigo-500 to-indigo-600 p-6 text-white">
        {/* Featured/Trending badge */}
        <div className="absolute top-3 right-3">
          <span className="px-2 py-1 bg-white dark:bg-gray-900/20 backdrop-blur-sm text-white text-xs font-semibold rounded-full">
            {agent.isFeatured ? "Featured" : "Trending"}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white dark:bg-gray-900/20 backdrop-blur-sm rounded-xl flex items-center justify-center text-3xl">
            {agent.icon}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-lg truncate">{agent.name}</h3>
            <span className="text-xs text-white/80 capitalize">
              {agent.category.replace("-", " ")}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
          {agent.description}
        </p>

        {/* Capabilities */}
        {displayCaps.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {displayCaps.map((cap) => (
              <span
                key={cap}
                className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 text-xs rounded-md"
              >
                {cap}
              </span>
            ))}
            {agent.capabilities.length > 2 && (
              <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs rounded-md">
                +{agent.capabilities.length - 2} more
              </span>
            )}
          </div>
        )}

        {/* Rating */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center">
            {[1, 2, 3, 4, 5].map((star) => (
              <svg
                key={star}
                className={`w-4 h-4 ${
                  star <= Math.round(agent.stats.avgRating)
                    ? "text-yellow-400"
                    : "text-gray-200"
                }`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {agent.stats.avgRating.toFixed(1)} ({agent.stats.totalReviews}{" "}
            reviews)
          </span>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t">
          {agent.pricingType === "free" ? (
            <span className="text-green-600 font-medium text-sm">Free</span>
          ) : (
            <span className="text-gray-600 dark:text-gray-400 text-sm">
              {agent.freeQueries} free queries
            </span>
          )}
          <span className="text-indigo-600 font-semibold text-sm group-hover:translate-x-1 transition-transform flex items-center gap-1">
            Try Now
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  );
}
