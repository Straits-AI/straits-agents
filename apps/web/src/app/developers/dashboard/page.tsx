"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuthContext } from "@/providers/AuthProvider";

interface ApiKey {
  id: string;
  keyPrefix: string;
  name: string;
  scopes: string[];
  lastUsed: string | null;
  expiresAt: string | null;
  createdAt: string;
}

interface NewKeyResponse extends ApiKey {
  apiKey: string;
  message: string;
}

export default function DeveloperDashboard() {
  const { user, isAuthenticated } = useAuthContext();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyExpiry, setNewKeyExpiry] = useState<string>("never");
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/developer/keys");
      if (res.ok) {
        const data = await res.json();
        setKeys(data.keys);
      } else {
        setError("Failed to fetch API keys");
      }
    } catch {
      setError("Failed to fetch API keys");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchKeys();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, fetchKeys]);

  const createKey = async () => {
    if (!newKeyName.trim()) {
      setError("Please enter a name for your API key");
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const expiresInDays =
        newKeyExpiry === "never"
          ? null
          : newKeyExpiry === "30"
          ? 30
          : newKeyExpiry === "90"
          ? 90
          : 365;

      const res = await fetch("/api/developer/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newKeyName,
          expiresInDays,
          scopes: ["chat", "sessions", "agents"],
        }),
      });

      if (res.ok) {
        const data: NewKeyResponse = await res.json();
        setNewlyCreatedKey(data.apiKey);
        setKeys((prev) => [
          {
            id: data.id,
            keyPrefix: data.keyPrefix,
            name: data.name,
            scopes: data.scopes,
            lastUsed: null,
            expiresAt: data.expiresAt,
            createdAt: data.createdAt,
          },
          ...prev,
        ]);
        setNewKeyName("");
        setNewKeyExpiry("never");
        setShowCreateForm(false);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to create API key");
      }
    } catch {
      setError("Failed to create API key");
    } finally {
      setCreating(false);
    }
  };

  const revokeKey = async (keyId: string) => {
    if (!confirm("Are you sure you want to revoke this API key? This cannot be undone.")) {
      return;
    }

    try {
      const res = await fetch("/api/developer/keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyId }),
      });

      if (res.ok) {
        setKeys((prev) => prev.filter((k) => k.id !== keyId));
      } else {
        const data = await res.json();
        setError(data.error || "Failed to revoke API key");
      }
    } catch {
      setError("Failed to revoke API key");
    }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Developer Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-8">Please sign in to access your developer dashboard.</p>
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
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/developers" className="text-indigo-600 hover:text-indigo-700 text-sm mb-2 inline-block">
            ← Back to Developer Portal
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Developer Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Manage your API keys and view usage</p>
        </div>

        {/* User Info */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Account</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Email:</span>
              <span className="ml-2 text-gray-900 dark:text-white">{user?.email}</span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">User ID:</span>
              <span className="ml-2 text-gray-900 dark:text-white font-mono text-xs">{user?.id}</span>
            </div>
          </div>
        </div>

        {/* New Key Created Alert */}
        {newlyCreatedKey && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-8">
            <h3 className="text-lg font-semibold text-green-800 mb-2">API Key Created!</h3>
            <p className="text-green-700 text-sm mb-4">
              Copy your API key now. You won&apos;t be able to see it again.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-white dark:bg-gray-900 border border-green-200 rounded px-4 py-2 font-mono text-sm">
                {newlyCreatedKey}
              </code>
              <button
                onClick={() => copyToClipboard(newlyCreatedKey)}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <button
              onClick={() => setNewlyCreatedKey(null)}
              className="mt-4 text-sm text-green-700 hover:text-green-800"
            >
              I&apos;ve saved my key, close this
            </button>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
            <p className="text-red-700">{error}</p>
            <button onClick={() => setError(null)} className="text-sm text-red-600 hover:text-red-700 mt-2">
              Dismiss
            </button>
          </div>
        )}

        {/* API Keys Section */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">API Keys</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">You can create up to 5 API keys</p>
            </div>
            {keys.length < 5 && !showCreateForm && (
              <button
                onClick={() => setShowCreateForm(true)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Create New Key
              </button>
            )}
          </div>

          {/* Create Key Form */}
          {showCreateForm && (
            <div className="bg-gray-50 dark:bg-gray-950 rounded-lg p-4 mb-6">
              <h3 className="font-medium text-gray-900 dark:text-white mb-4">Create New API Key</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                  <input
                    type="text"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="e.g., Production Key, Development Key"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Expiration</label>
                  <select
                    value={newKeyExpiry}
                    onChange={(e) => setNewKeyExpiry(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="never">Never expires</option>
                    <option value="30">30 days</option>
                    <option value="90">90 days</option>
                    <option value="365">1 year</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={createKey}
                    disabled={creating}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {creating ? "Creating..." : "Create Key"}
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateForm(false);
                      setNewKeyName("");
                      setNewKeyExpiry("never");
                    }}
                    className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:text-gray-100"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Keys List */}
          {loading ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading...</div>
          ) : keys.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400 mb-4">You haven&apos;t created any API keys yet.</p>
              {!showCreateForm && (
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Create Your First Key
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {keys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-950 rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-gray-900 dark:text-white">{key.name}</span>
                      <code className="text-sm bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded font-mono">
                        {key.keyPrefix}
                      </code>
                    </div>
                    <div className="mt-1 text-sm text-gray-500 dark:text-gray-400 space-x-4">
                      <span>Created: {formatDate(key.createdAt)}</span>
                      <span>Last used: {key.lastUsed ? formatDate(key.lastUsed) : "Never"}</span>
                      <span>
                        Expires:{" "}
                        {key.expiresAt ? (
                          new Date(key.expiresAt) < new Date() ? (
                            <span className="text-red-600">Expired</span>
                          ) : (
                            formatDate(key.expiresAt)
                          )
                        ) : (
                          "Never"
                        )}
                      </span>
                    </div>
                    <div className="mt-2 flex gap-1">
                      {key.scopes.map((scope) => (
                        <span
                          key={scope}
                          className="text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 px-2 py-0.5 rounded"
                        >
                          {scope}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => revokeKey(key.id)}
                    className="ml-4 px-3 py-1 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Usage Stats */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Usage Statistics</h2>
            <Link
              href="/developers/analytics"
              className="text-sm text-indigo-600 hover:text-indigo-700"
            >
              View detailed analytics →
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-6">
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-950 rounded-lg">
              <p className="text-3xl font-bold text-indigo-600">-</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">API Calls (This Month)</p>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-950 rounded-lg">
              <p className="text-3xl font-bold text-green-600">-</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Sessions Created</p>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-950 rounded-lg">
              <p className="text-3xl font-bold text-indigo-600">-</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Total Spend (USDC)</p>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            href="/developers/my-agents"
            className="block p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-indigo-300"
          >
            <h3 className="font-medium text-gray-900 dark:text-white">My Agents</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage your custom agents</p>
          </Link>
          <Link
            href="/developers/builder"
            className="block p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-indigo-300"
          >
            <h3 className="font-medium text-gray-900 dark:text-white">Agent Builder</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Create a new agent</p>
          </Link>
          <Link
            href="/developers/analytics"
            className="block p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-indigo-300"
          >
            <h3 className="font-medium text-gray-900 dark:text-white">Usage Analytics</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Track your API usage</p>
          </Link>
          <Link
            href="/developers#docs"
            className="block p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-indigo-300"
          >
            <h3 className="font-medium text-gray-900 dark:text-white">API Documentation</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Learn how to use our API</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
