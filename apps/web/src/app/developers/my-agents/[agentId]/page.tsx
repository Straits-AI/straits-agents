"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { QRCodeDisplay } from "@/components/QRCodeDisplay";
import { useAuthContext } from "@/providers/AuthProvider";

interface AgentDetail {
  id: string;
  name: string;
  description: string;
  category: string;
  type: string;
  icon: string;
  systemPrompt: string;
  welcomeMessage: string;
  pricingModel: { type: string; pricePerQuery: number; freeQueries: number };
  slug: string | null;
  template: string | null;
  brandColor: string | null;
  businessInfo: Record<string, string> | null;
  ownerId: string | null;
}

interface Document {
  id: string;
  title: string;
  contentType?: string;
  createdAt?: string;
}

export default function AgentDetailPage({ params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = use(params);
  const { isAuthenticated } = useAuthContext();
  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [agentRes, docsRes] = await Promise.all([
        fetch(`/api/agents/${agentId}`),
        fetch(`/api/agents/${agentId}/documents`),
      ]);
      if (!agentRes.ok) throw new Error("Agent not found");
      const agentData = await agentRes.json();
      setAgent(agentData);

      if (docsRes.ok) {
        const docsData = await docsRes.json();
        setDocuments(docsData.documents || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load agent");
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="min-h-full">
        <Header />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-pulse text-gray-400">Loading...</div>
        </div>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="min-h-full">
        <Header />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Agent Not Found</h1>
            <Link href="/developers/my-agents" className="text-indigo-600 hover:text-indigo-700">
              Back to My Agents
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const chatUrl = agent.slug ? `/chat/${agent.slug}` : `/chat/${agent.id}`;

  return (
    <div className="min-h-full">
      <Header />

      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Breadcrumb */}
        <div className="mb-6 text-sm">
          <Link href="/developers" className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">Developers</Link>
          <span className="text-gray-400 mx-2">/</span>
          <Link href="/developers/my-agents" className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">My Agents</Link>
          <span className="text-gray-400 mx-2">/</span>
          <span className="text-gray-600 dark:text-gray-400">{agent.name}</span>
        </div>

        {/* Agent header */}
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-center gap-4">
            <span className="text-4xl">{agent.icon}</span>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{agent.name}</h1>
              {agent.slug && (
                <p className="text-sm text-gray-400 font-mono mt-1">/chat/{agent.slug}</p>
              )}
              {agent.description && (
                <p className="text-gray-600 dark:text-gray-400 mt-1">{agent.description}</p>
              )}
            </div>
          </div>
          {isAuthenticated && (
            <Link
              href={`/developers/my-agents/${agentId}/edit`}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors"
            >
              Edit Agent
            </Link>
          )}
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Left column: info */}
          <div className="md:col-span-2 space-y-6">
            {/* Config details */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Configuration</h2>
              <div className="space-y-4 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Category:</span>
                  <span className="ml-2 text-gray-900 dark:text-white capitalize">{agent.category}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Template:</span>
                  <span className="ml-2 text-gray-900 dark:text-white capitalize">{agent.template || "custom"}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Pricing:</span>
                  <span className="ml-2 text-gray-900 dark:text-white">
                    {agent.pricingModel.type === "free"
                      ? "Free"
                      : `$${agent.pricingModel.pricePerQuery}/query (${agent.pricingModel.freeQueries} free)`}
                  </span>
                </div>
                {agent.brandColor && (
                  <div className="flex items-center">
                    <span className="text-gray-500 dark:text-gray-400">Brand Color:</span>
                    <div className="ml-2 flex items-center gap-2">
                      <div className="w-5 h-5 rounded border" style={{ backgroundColor: agent.brandColor }} />
                      <span className="text-gray-900 dark:text-white font-mono text-xs">{agent.brandColor}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* System Prompt preview */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">System Prompt</h2>
              <pre className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap font-mono bg-gray-50 dark:bg-gray-950 rounded-lg p-4 max-h-64 overflow-y-auto">
                {agent.systemPrompt}
              </pre>
            </div>

            {/* Documents */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Knowledge Base ({documents.length} documents)
                </h2>
              </div>
              {documents.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No documents uploaded yet. Upload documents to give your agent knowledge.
                </p>
              ) : (
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-950 rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="text-sm text-gray-900 dark:text-white">{doc.title}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Business Info */}
            {agent.businessInfo && (
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Business Info</h2>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {agent.businessInfo.phone && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Phone:</span>
                      <span className="ml-2 text-gray-900 dark:text-white">{agent.businessInfo.phone}</span>
                    </div>
                  )}
                  {agent.businessInfo.website && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Website:</span>
                      <span className="ml-2 text-gray-900 dark:text-white">{agent.businessInfo.website}</span>
                    </div>
                  )}
                  {agent.businessInfo.address && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Address:</span>
                      <span className="ml-2 text-gray-900 dark:text-white">{agent.businessInfo.address}</span>
                    </div>
                  )}
                  {agent.businessInfo.hours && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Hours:</span>
                      <span className="ml-2 text-gray-900 dark:text-white">{agent.businessInfo.hours}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right column: QR code + quick actions */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 text-center">QR Code</h2>
              <QRCodeDisplay url={chatUrl} agentName={agent.name} size={180} />
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
              <div className="space-y-2">
                <Link
                  href={chatUrl}
                  className="block w-full text-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors"
                >
                  Open Chat
                </Link>
                <Link
                  href={`/developers/my-agents/${agentId}/edit`}
                  className="block w-full text-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-sm transition-colors"
                >
                  Edit Agent
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
