"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { useAuthContext } from "@/providers/AuthProvider";

interface MyAgent {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  slug: string | null;
  template: string | null;
  pricingType: string;
  isActive: boolean;
  createdAt: string;
  stats: {
    totalSessions: number;
    totalDocuments: number;
    uniqueUsers: number;
  };
}

export default function MyAgentsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuthContext();
  const [agents, setAgents] = useState<MyAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch("/api/agents/mine");
      if (!res.ok) throw new Error("Failed to fetch agents");
      const data = await res.json();
      setAgents(data.agents);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load agents");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) fetchAgents();
    else setLoading(false);
  }, [isAuthenticated, fetchAgents]);

  const deactivateAgent = async (agentId: string) => {
    try {
      const res = await fetch(`/api/agents/${agentId}`, { method: "DELETE" });
      if (res.ok) {
        setAgents((prev) => prev.filter((a) => a.id !== agentId));
      }
    } catch {
      setError("Failed to deactivate agent");
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-full">
        <Header />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-pulse text-gray-400">Loading...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-full">
        <Header />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Sign In Required</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">Sign in to view and manage your agents.</p>
            <Link href="/login" className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <Header />

      <div className="max-w-5xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/developers" className="text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 mb-2 inline-block">
              Developers
            </Link>
            <span className="text-gray-400 mx-2 text-sm">/</span>
            <span className="text-sm text-gray-600 dark:text-gray-400">My Agents</span>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mt-2">My Agents</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your custom AI agents</p>
          </div>
          <Link
            href="/developers/builder"
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create New Agent
          </Link>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse bg-gray-100 dark:bg-gray-800 rounded-xl h-48" />
            ))}
          </div>
        ) : agents.length === 0 ? (
          /* Empty state */
          <div className="text-center py-16 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No agents yet</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">Create your first AI agent to get started.</p>
            <Link
              href="/developers/builder"
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Your First Agent
            </Link>
          </div>
        ) : (
          /* Agent grid */
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{agent.icon}</span>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{agent.name}</h3>
                      {agent.slug && (
                        <p className="text-xs text-gray-400 font-mono">/chat/{agent.slug}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full">
                    Active
                  </span>
                </div>

                {agent.description && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2">
                    {agent.description}
                  </p>
                )}

                {/* Stats */}
                <div className="flex gap-4 text-xs text-gray-500 dark:text-gray-400 mb-4">
                  <span>{agent.stats.totalSessions} sessions</span>
                  <span>{agent.stats.uniqueUsers} users</span>
                  <span>{agent.stats.totalDocuments} docs</span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                  <Link
                    href={`/developers/my-agents/${agent.id}/edit`}
                    className="text-xs px-3 py-1.5 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    Edit
                  </Link>
                  {agent.slug && (
                    <Link
                      href={`/chat/${agent.slug}`}
                      className="text-xs px-3 py-1.5 text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                    >
                      Chat
                    </Link>
                  )}
                  <Link
                    href={`/developers/my-agents/${agent.id}`}
                    className="text-xs px-3 py-1.5 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    Details
                  </Link>
                  <button
                    onClick={() => deactivateAgent(agent.id)}
                    className="text-xs px-3 py-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors ml-auto"
                  >
                    Deactivate
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
