import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { FeaturedAgentsCarousel } from "@/components/FeaturedAgentsCarousel";
import { getDB } from "@/lib/db";

interface AgentRow {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  pricing_type: string;
  price_per_query: number;
  free_queries: number;
  capabilities: string | null;
  is_featured: number;
  avg_rating: number | null;
  total_reviews: number;
}

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

async function getAgents() {
  try {
    const db = await getDB();
    const result = await db
      .prepare(
        `SELECT id, name, description, category, icon, pricing_type, price_per_query, free_queries
         FROM agents WHERE is_active = 1 ORDER BY category, name`
      )
      .all<AgentRow>();
    return result.results;
  } catch (error) {
    console.error("Failed to fetch agents:", error);
    return [];
  }
}

async function getFeaturedAgents(): Promise<FeaturedAgent[]> {
  try {
    const db = await getDB();
    const result = await db
      .prepare(
        `SELECT
           a.id, a.name, a.description, a.category, a.icon,
           a.pricing_type, a.price_per_query, a.free_queries, a.capabilities,
           COALESCE(a.is_featured, 0) as is_featured,
           COALESCE(f.avg_rating, 0) as avg_rating,
           COALESCE(f.total_reviews, 0) as total_reviews
         FROM agents a
         LEFT JOIN (
           SELECT agent_id, AVG(rating) as avg_rating, COUNT(*) as total_reviews
           FROM feedback GROUP BY agent_id
         ) f ON a.id = f.agent_id
         WHERE a.is_active = 1
           AND (
             a.is_featured = 1
             OR (COALESCE(f.avg_rating, 0) >= 4.5 AND COALESCE(f.total_reviews, 0) >= 10)
           )
         ORDER BY
           a.is_featured DESC,
           f.avg_rating DESC,
           f.total_reviews DESC
         LIMIT 6`
      )
      .all<AgentRow>();

    return result.results.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      icon: row.icon,
      pricingType: row.pricing_type,
      pricePerQuery: row.price_per_query,
      freeQueries: row.free_queries,
      capabilities: row.capabilities ? JSON.parse(row.capabilities) : [],
      isFeatured: row.is_featured === 1,
      stats: {
        avgRating: Math.round((row.avg_rating || 0) * 100) / 100,
        totalReviews: row.total_reviews,
      },
    }));
  } catch (error) {
    console.error("Failed to fetch featured agents:", error);
    return [];
  }
}

async function getStats(): Promise<{
  agentCount: number;
  sessionCount: number;
  paymentCount: number;
}> {
  try {
    const db = await getDB();
    const agentResult = await db
      .prepare(`SELECT COUNT(*) as count FROM agents WHERE is_active = 1`)
      .first<{ count: number }>();
    const agentCount = agentResult?.count ?? 0;

    let sessionCount = 0;
    try {
      const sessionResult = await db
        .prepare(`SELECT COUNT(*) as count FROM sessions`)
        .first<{ count: number }>();
      sessionCount = sessionResult?.count ?? 0;
    } catch {
      // sessions table may not exist
    }

    let paymentCount = 0;
    try {
      const paymentResult = await db
        .prepare(`SELECT COUNT(*) as count FROM payments`)
        .first<{ count: number }>();
      paymentCount = paymentResult?.count ?? 0;
    } catch {
      // payments table may not exist
    }

    return { agentCount, sessionCount, paymentCount };
  } catch (error) {
    console.error("Failed to fetch stats:", error);
    return { agentCount: 0, sessionCount: 0, paymentCount: 0 };
  }
}

export default async function HomePage() {
  const [agents, featuredAgents, stats] = await Promise.all([
    getAgents(),
    getFeaturedAgents(),
    getStats(),
  ]);

  const customerFacing = agents.filter((a) => a.category === "customer-facing");
  const productivity = agents.filter((a) => a.category === "productivity");

  return (
    <div className="min-h-full">
      <Header />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary-50 to-white dark:from-gray-900 dark:to-gray-950 py-24">
        {/* Animated grid background */}
        <div className="absolute inset-0 hero-grid" />
        {/* Glow accent */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-indigo-400/20 dark:bg-indigo-500/10 rounded-full blur-3xl hero-glow" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-6xl">
            AI Agents with<span className="text-primary-600"> On-Chain Trust</span>
          </h1>
          <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Deploy, discover, and monetize AI agents with built-in identity (ERC-8004) and micropayments (x402).
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Link href="/chat/qr-menu" className="rounded-lg bg-primary-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 transition-colors">
              Try Demo Agents
            </Link>
            <Link href="/marketplace" className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-6 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              Browse Marketplace
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-white dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">How It Works</h2>
            <p className="mt-3 text-gray-600 dark:text-gray-400">Get started in three simple steps</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
            {/* Step 1 */}
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              </div>
              <div className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold mb-3">1</div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Discover</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Browse the marketplace and find AI agents for your use case</p>
            </div>

            {/* Step 2 */}
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
                </svg>
              </div>
              <div className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold mb-3">2</div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Connect</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Sign up with email and get an embedded wallet instantly — no ETH needed</p>
            </div>

            {/* Step 3 */}
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                </svg>
              </div>
              <div className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold mb-3">3</div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Pay & Use</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">USDC micropayments per query with on-chain receipts and reputation tracking</p>
            </div>
          </div>
        </div>
      </section>

      {/* Key Features Section */}
      <section className="py-20 bg-gray-50 dark:bg-gray-950">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Why Straits Agents</h2>
            <p className="mt-3 text-gray-600 dark:text-gray-400">Built for the future of AI agent commerce</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* USDC Micropayments */}
            <div className="p-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
              <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">USDC Micropayments</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Pay per query in USDC — no ETH needed, gas abstracted via custom paymaster</p>
            </div>

            {/* Embedded Wallets */}
            <div className="p-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
              <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Embedded Wallets</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Auto-generated Safe smart accounts on signup, no browser extension required</p>
            </div>

            {/* On-Chain Reputation */}
            <div className="p-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
              <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">On-Chain Reputation</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">ERC-8004 identity tokens + verifiable review scores on Arbitrum</p>
            </div>

            {/* Open Marketplace */}
            <div className="p-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
              <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016A3.001 3.001 0 0021 9.349m-18 0V8.25A2.25 2.25 0 015.25 6h13.5A2.25 2.25 0 0121 8.25v1.098" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Open Marketplace</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Deploy your own agents, set pricing, earn directly from usage</p>
            </div>
          </div>
        </div>
      </section>

      {/* Live Stats Bar */}
      {(stats.agentCount > 0 || stats.sessionCount > 0 || stats.paymentCount > 0) && (
        <section className="py-12 bg-white dark:bg-gray-900 border-y border-gray-200 dark:border-gray-800">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
              <div>
                <p className="text-3xl font-bold text-indigo-600">{stats.agentCount}</p>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Active Agents</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-indigo-600">{stats.sessionCount.toLocaleString()}</p>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Sessions Completed</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-indigo-600">{stats.paymentCount.toLocaleString()}</p>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Payments Processed</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Featured Agents Section */}
      {featuredAgents.length > 0 && (
        <section className="py-12 bg-gradient-to-r from-indigo-50 to-indigo-50 dark:from-gray-950 dark:to-gray-950">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Featured Agents</h2>
                <p className="text-gray-600 dark:text-gray-400 mt-1">Top-rated and trending AI agents</p>
              </div>
              <Link
                href="/marketplace?featured=true"
                className="text-indigo-600 hover:text-indigo-700 font-medium text-sm flex items-center gap-1"
              >
                View all
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
            <FeaturedAgentsCarousel agents={featuredAgents} />
          </div>
        </section>
      )}

      {customerFacing.length > 0 && (
        <section className="py-16 bg-gray-50 dark:bg-gray-950">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-center mb-4">Customer-Facing Agents</h2>
            <p className="text-center text-gray-600 dark:text-gray-400 mb-12">AI assistants for customer interactions</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {customerFacing.map((agent) => (
                <AgentCard key={agent.id} agent={agent} />
              ))}
            </div>
          </div>
        </section>
      )}

      {productivity.length > 0 && (
        <section className="py-16 bg-white dark:bg-gray-900">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-center mb-4">Productivity Agents</h2>
            <p className="text-center text-gray-600 dark:text-gray-400 mb-12">AI assistants for internal workflows</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {productivity.map((agent) => (
                <AgentCard key={agent.id} agent={agent} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Developer CTA Section */}
      <section className="py-16 bg-gradient-to-r from-indigo-600 to-indigo-700">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white">Build & Monetize Your Own Agents</h2>
          <p className="mt-4 text-lg text-indigo-100 max-w-2xl mx-auto">
            Use our API and SDK to deploy custom agents, configure pricing, and start earning from every query.
          </p>
          <div className="mt-8 flex items-center justify-center gap-x-4">
            <Link
              href="/docs"
              className="rounded-lg bg-white px-6 py-3 text-sm font-semibold text-indigo-700 shadow-sm hover:bg-indigo-50 transition-colors"
            >
              Read the Docs
            </Link>
            <Link
              href="/developers"
              className="rounded-lg border border-indigo-300 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-600 transition-colors"
            >
              Developer Dashboard
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

function AgentCard({ agent }: { agent: AgentRow }) {
  return (
    <Link
      href={`/chat/${agent.id}`}
      className="p-6 rounded-xl border bg-white dark:bg-gray-900 hover:shadow-lg transition-shadow"
    >
      <div className="flex items-start gap-4">
        <span className="text-3xl">{agent.icon}</span>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold">{agent.name}</h3>
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
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{agent.description}</p>
          {agent.pricing_type !== "free" && (
            <p className="text-xs text-gray-400 mt-2">
              {agent.free_queries} free queries, then ${agent.price_per_query / 100}/query
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
