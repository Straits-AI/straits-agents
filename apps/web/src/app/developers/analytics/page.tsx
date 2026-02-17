"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuthContext } from "@/providers/AuthProvider";

interface UsageStats {
  period: string;
  apiCalls: number;
  sessions: number;
  totalSpend: number;
  queriesByAgent: { agentId: string; agentName: string; count: number }[];
  dailyUsage: { date: string; calls: number; spend: number }[];
}

export default function AnalyticsPage() {
  const { isAuthenticated } = useAuthContext();
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("30d");

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/developer/usage?period=${period}`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchStats();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, fetchStats]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const getMaxCalls = () => {
    if (!stats?.dailyUsage.length) return 1;
    return Math.max(...stats.dailyUsage.map((d) => d.calls), 1);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Usage Analytics</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-8">Please sign in to view your usage analytics.</p>
          <Link
            href="/login"
            className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/developers/dashboard" className="text-indigo-600 hover:text-indigo-700 text-sm mb-2 inline-block">
            ← Back to Dashboard
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Usage Analytics</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">Track your API usage and spending</p>
            </div>
            {/* Period Selector */}
            <div className="flex gap-2">
              {["7d", "30d", "90d"].map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${
                    period === p
                      ? "bg-indigo-600 text-white"
                      : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:bg-gray-950"
                  }`}
                >
                  {p === "7d" ? "7 Days" : p === "30d" ? "30 Days" : "90 Days"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading analytics...</div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <StatCard
                title="API Calls"
                value={stats?.apiCalls.toLocaleString() || "0"}
                subtitle={`Last ${period === "7d" ? "7" : period === "30d" ? "30" : "90"} days`}
                color="blue"
              />
              <StatCard
                title="Sessions Created"
                value={stats?.sessions.toLocaleString() || "0"}
                subtitle="Unique chat sessions"
                color="green"
              />
              <StatCard
                title="Total Spend"
                value={`$${(stats?.totalSpend || 0).toFixed(4)}`}
                subtitle="USDC paid"
                color="purple"
              />
            </div>

            {/* Usage Chart */}
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-8">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Daily API Calls</h2>
              {stats?.dailyUsage && stats.dailyUsage.length > 0 ? (
                <div className="h-64">
                  <div className="flex items-end h-48 gap-1">
                    {stats.dailyUsage.map((day) => (
                      <div
                        key={day.date}
                        className="flex-1 flex flex-col items-center group"
                      >
                        <div className="relative w-full flex justify-center">
                          <div
                            className="w-full max-w-8 bg-indigo-500 rounded-t hover:bg-indigo-600 transition-colors"
                            style={{
                              height: `${Math.max((day.calls / getMaxCalls()) * 180, 4)}px`,
                            }}
                          />
                          {/* Tooltip */}
                          <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                            {day.calls} calls
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* X-axis labels */}
                  <div className="flex gap-1 mt-2">
                    {stats.dailyUsage.map((day, i) => (
                      <div
                        key={day.date}
                        className="flex-1 text-center text-xs text-gray-500 dark:text-gray-400"
                      >
                        {i === 0 || i === stats.dailyUsage.length - 1 || i % Math.ceil(stats.dailyUsage.length / 7) === 0
                          ? formatDate(day.date)
                          : ""}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-gray-500 dark:text-gray-400">
                  No usage data for this period
                </div>
              )}
            </div>

            {/* Usage by Agent */}
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Usage by Agent</h2>
              {stats?.queriesByAgent && stats.queriesByAgent.length > 0 ? (
                <div className="space-y-4">
                  {stats.queriesByAgent.map((agent) => {
                    const maxCount = stats.queriesByAgent[0]?.count || 1;
                    const percentage = (agent.count / maxCount) * 100;
                    return (
                      <div key={agent.agentId} className="flex items-center gap-4">
                        <div className="w-32 truncate text-sm font-medium text-gray-900 dark:text-white">
                          {agent.agentName}
                        </div>
                        <div className="flex-1">
                          <div className="h-6 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-indigo-500 to-indigo-500 rounded-full"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                        <div className="w-20 text-right text-sm text-gray-600 dark:text-gray-400">
                          {agent.count.toLocaleString()} calls
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No agent usage data for this period
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="mt-8 grid grid-cols-2 gap-4">
              <Link
                href="/developers/dashboard"
                className="block p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-indigo-300"
              >
                <h3 className="font-medium text-gray-900 dark:text-white">Manage API Keys</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Create or revoke API keys</p>
              </Link>
              <Link
                href="/marketplace"
                className="block p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-indigo-300"
              >
                <h3 className="font-medium text-gray-900 dark:text-white">Browse Agents</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Discover more agents to use</p>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  color,
}: {
  title: string;
  value: string;
  subtitle: string;
  color: "blue" | "green" | "purple";
}) {
  const colors = {
    blue: "text-indigo-600",
    green: "text-green-600",
    purple: "text-indigo-600",
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">{title}</h3>
      <p className={`text-3xl font-bold ${colors[color]}`}>{value}</p>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
    </div>
  );
}
