"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { useAuthContext } from "@/providers/AuthProvider";
import { DocumentStep } from "@/app/developers/builder/DocumentStep";

interface AgentData {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  systemPrompt: string;
  welcomeMessage: string;
  pricingModel: { type: string; pricePerQuery: number; freeQueries: number };
  agentWallet: string | null;
  slug: string | null;
  template: string | null;
  brandColor: string | null;
  businessInfo: { phone: string; address: string; hours: string; website: string } | null;
  llmProvider: string | null;
  llmModel: string | null;
  llmBaseUrl: string | null;
  hasLlmApiKey: boolean;
}

const LLM_PROVIDER_LABELS: Record<string, string> = {
  "": "Platform Default",
  openai: "OpenAI",
  anthropic: "Anthropic",
  openrouter: "OpenRouter",
};

const LLM_DEFAULT_MODELS: Record<string, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-sonnet-4-5-20250929",
  openrouter: "google/gemini-2.0-flash-001",
};

export default function EditAgentPage({ params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = use(params);
  const { isAuthenticated } = useAuthContext();
  const [agent, setAgent] = useState<AgentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [tab, setTab] = useState<"config" | "tools" | "skills" | "documents">("config");

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [pricingType, setPricingType] = useState<"free" | "per-query">("free");
  const [pricePerQuery, setPricePerQuery] = useState(0);
  const [freeQueries, setFreeQueries] = useState(0);
  const [agentWallet, setAgentWallet] = useState("");
  const [brandColor, setBrandColor] = useState("");
  const [businessInfo, setBusinessInfo] = useState({ phone: "", address: "", hours: "", website: "" });
  const [llmProvider, setLlmProvider] = useState("");
  const [llmApiKey, setLlmApiKey] = useState("");
  const [llmModel, setLlmModel] = useState("");
  const [llmBaseUrl, setLlmBaseUrl] = useState("");
  const [hasLlmApiKey, setHasLlmApiKey] = useState(false);

  // Memory config state
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [extractionInstructions, setExtractionInstructions] = useState("");
  const [maxMemoriesPerUser, setMaxMemoriesPerUser] = useState(100);
  const [retentionDays, setRetentionDays] = useState(90);
  const [memoryConfigLoaded, setMemoryConfigLoaded] = useState(false);

  const fetchAgent = useCallback(async () => {
    try {
      const res = await fetch(`/api/agents/${agentId}`);
      if (!res.ok) throw new Error("Agent not found");
      const data: AgentData = await res.json();
      setAgent(data);
      setName(data.name);
      setDescription(data.description || "");
      setIcon(data.icon || "");
      setSystemPrompt(data.systemPrompt || "");
      setWelcomeMessage(data.welcomeMessage || "");
      setPricingType(data.pricingModel.type === "per-query" ? "per-query" : "free");
      setPricePerQuery(data.pricingModel.pricePerQuery || 0);
      setFreeQueries(data.pricingModel.freeQueries || 0);
      setAgentWallet(data.agentWallet || "");
      setBrandColor(data.brandColor || "");
      if (data.businessInfo) {
        setBusinessInfo(data.businessInfo);
      }
      setLlmProvider(data.llmProvider || "");
      setLlmModel(data.llmModel || "");
      setLlmBaseUrl(data.llmBaseUrl || "");
      setHasLlmApiKey(data.hasLlmApiKey || false);

      // Fetch memory config
      try {
        const memRes = await fetch(`/api/agents/${agentId}/memory-config`);
        if (memRes.ok) {
          const memData = await memRes.json();
          setMemoryEnabled(memData.memory_enabled ?? true);
          setExtractionInstructions(memData.extraction_instructions || "");
          setMaxMemoriesPerUser(memData.max_memories_per_user ?? 100);
          setRetentionDays(memData.retention_days ?? 90);
          setMemoryConfigLoaded(true);
        }
      } catch {
        // Memory config not available — use defaults
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load agent");
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    fetchAgent();
  }, [fetchAgent]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const hasBusinessInfo = businessInfo.phone || businessInfo.address || businessInfo.hours || businessInfo.website;

      const res = await fetch(`/api/agents/${agentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          icon,
          systemPrompt,
          welcomeMessage,
          pricingType,
          pricePerQuery,
          freeQueries,
          agentWallet: agentWallet.trim() || null,
          brandColor: brandColor || null,
          businessInfo: hasBusinessInfo ? businessInfo : null,
          llmProvider: llmProvider || null,
          ...(llmApiKey ? { llmApiKey } : {}),
          llmModel: llmModel || null,
          llmBaseUrl: llmBaseUrl || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      // Save memory config
      if (memoryConfigLoaded) {
        await fetch(`/api/agents/${agentId}/memory-config`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            memoryEnabled,
            extractionInstructions: extractionInstructions.trim() || null,
            maxMemoriesPerUser,
            retentionDays,
          }),
        });
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

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

  if (!agent || !isAuthenticated) {
    return (
      <div className="min-h-full">
        <Header />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              {!isAuthenticated ? "Sign In Required" : "Agent Not Found"}
            </h1>
            <Link href="/developers/my-agents" className="text-indigo-600 hover:text-indigo-700">
              Back to My Agents
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <Header />

      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Breadcrumb */}
        <div className="mb-6 text-sm">
          <Link href="/developers" className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">Developers</Link>
          <span className="text-gray-400 mx-2">/</span>
          <Link href="/developers/my-agents" className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">My Agents</Link>
          <span className="text-gray-400 mx-2">/</span>
          <Link href={`/developers/my-agents/${agentId}`} className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">{agent.name}</Link>
          <span className="text-gray-400 mx-2">/</span>
          <span className="text-gray-600 dark:text-gray-400">Edit</span>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Edit {agent.name}
        </h1>
        {agent.slug && (
          <p className="text-sm text-gray-400 font-mono mb-6">/chat/{agent.slug}</p>
        )}

        {/* Tabs */}
        <div className="flex gap-4 border-b border-gray-200 dark:border-gray-700 mb-8">
          <button
            onClick={() => setTab("config")}
            className={`pb-3 text-sm font-medium transition-colors ${
              tab === "config"
                ? "text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            Configuration
          </button>
          <button
            onClick={() => setTab("tools")}
            className={`pb-3 text-sm font-medium transition-colors ${
              tab === "tools"
                ? "text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            Tools
          </button>
          <button
            onClick={() => setTab("skills")}
            className={`pb-3 text-sm font-medium transition-colors ${
              tab === "skills"
                ? "text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            Skills
          </button>
          <button
            onClick={() => setTab("documents")}
            className={`pb-3 text-sm font-medium transition-colors ${
              tab === "documents"
                ? "text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            Knowledge Base
          </button>
        </div>

        {/* Banners */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-sm text-green-700 dark:text-green-400">
            Changes saved!
          </div>
        )}

        {tab === "tools" && <ToolsEditPanel agentId={agentId} />}
        {tab === "skills" && <SkillsEditPanel agentId={agentId} />}

        {tab === "config" ? (
          <div className="space-y-6">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Agent Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Icon */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Icon (emoji)</label>
              <input
                type="text"
                value={icon}
                onChange={(e) => setIcon(e.target.value.slice(0, 4))}
                className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-2xl text-center"
              />
            </div>

            {/* System Prompt */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">System Prompt</label>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={12}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
              />
            </div>

            {/* Welcome Message */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Welcome Message</label>
              <textarea
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Pricing */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Pricing</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={pricingType === "free"}
                    onChange={() => { setPricingType("free"); setPricePerQuery(0); }}
                    className="text-indigo-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Free</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={pricingType === "per-query"}
                    onChange={() => { setPricingType("per-query"); setPricePerQuery(0.01); }}
                    className="text-indigo-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Per Query</span>
                </label>
              </div>
              {pricingType === "per-query" && (
                <div className="mt-3 space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Price per query (USDC)</label>
                      <input
                        type="number"
                        value={pricePerQuery}
                        onChange={(e) => setPricePerQuery(parseFloat(e.target.value) || 0)}
                        step="0.001"
                        min="0"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Free queries</label>
                      <input
                        type="number"
                        value={freeQueries}
                        onChange={(e) => setFreeQueries(parseInt(e.target.value) || 0)}
                        min="0"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                      Payment wallet address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={agentWallet}
                      onChange={(e) => setAgentWallet(e.target.value)}
                      placeholder="0x... (your USDC receiving address on Arbitrum Sepolia)"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Payments from users will be sent to this address in USDC.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Brand Color */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Brand Color</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={brandColor || "#6366f1"}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="w-10 h-10 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                />
                <input
                  type="text"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  placeholder="#6366f1"
                  className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm font-mono"
                />
              </div>
            </div>

            {/* Business Info */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Business Info</label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Phone</label>
                  <input
                    type="text"
                    value={businessInfo.phone}
                    onChange={(e) => setBusinessInfo({ ...businessInfo, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Website</label>
                  <input
                    type="text"
                    value={businessInfo.website}
                    onChange={(e) => setBusinessInfo({ ...businessInfo, website: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Address</label>
                  <input
                    type="text"
                    value={businessInfo.address}
                    onChange={(e) => setBusinessInfo({ ...businessInfo, address: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Hours</label>
                  <input
                    type="text"
                    value={businessInfo.hours}
                    onChange={(e) => setBusinessInfo({ ...businessInfo, hours: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* LLM Configuration */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">LLM Configuration</label>
              <p className="text-xs text-gray-400 mb-3">
                Provide your own API key to avoid platform inference costs. Your key is encrypted at rest.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Provider</label>
                  <select
                    value={llmProvider}
                    onChange={(e) => { setLlmProvider(e.target.value); setLlmApiKey(""); setLlmModel(""); setLlmBaseUrl(""); }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                  >
                    {Object.entries(LLM_PROVIDER_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                {llmProvider && (
                  <>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                        API Key
                        {hasLlmApiKey && (
                          <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                            Key is set
                          </span>
                        )}
                      </label>
                      <input
                        type="password"
                        value={llmApiKey}
                        onChange={(e) => setLlmApiKey(e.target.value)}
                        placeholder={hasLlmApiKey ? "Enter new key to update" : `Enter your ${LLM_PROVIDER_LABELS[llmProvider]} API key`}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                        Base URL <span className="text-xs text-gray-400">(optional, for custom/self-hosted endpoints)</span>
                      </label>
                      <input
                        type="text"
                        value={llmBaseUrl}
                        onChange={(e) => setLlmBaseUrl(e.target.value)}
                        placeholder="https://api.openai.com/v1"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                        Model <span className="text-xs text-gray-400">(optional)</span>
                      </label>
                      <input
                        type="text"
                        value={llmModel}
                        onChange={(e) => setLlmModel(e.target.value)}
                        placeholder={LLM_DEFAULT_MODELS[llmProvider] || "Default model"}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-mono"
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        Leave empty to use the default: {LLM_DEFAULT_MODELS[llmProvider]}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Memory Configuration */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Memory</label>
              <p className="text-xs text-gray-400 mb-3">
                When enabled, your agent remembers users across sessions — their preferences, facts, and context.
              </p>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={memoryEnabled}
                    onChange={(e) => setMemoryEnabled(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Enable agent memory</span>
                </label>
                {memoryEnabled && (
                  <>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                        Extraction instructions <span className="text-xs text-gray-400">(optional)</span>
                      </label>
                      <textarea
                        value={extractionInstructions}
                        onChange={(e) => setExtractionInstructions(e.target.value)}
                        rows={3}
                        placeholder="e.g., Focus on dietary preferences and allergies"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 text-sm"
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        Hints for what the agent should remember about users.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Max memories per user</label>
                        <input
                          type="number"
                          value={maxMemoriesPerUser}
                          onChange={(e) => setMaxMemoriesPerUser(parseInt(e.target.value) || 100)}
                          min="10"
                          max="500"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Retention (days)</label>
                        <input
                          type="number"
                          value={retentionDays}
                          onChange={(e) => setRetentionDays(parseInt(e.target.value) || 90)}
                          min="7"
                          max="365"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Save button */}
            <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={handleSave}
                disabled={saving || !name.trim() || !systemPrompt.trim() || (pricingType === "per-query" && !/^0x[a-fA-F0-9]{40}$/.test(agentWallet.trim())) || (!!llmProvider && !hasLlmApiKey && !llmApiKey.trim())}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors font-medium"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        ) : tab === "documents" ? (
          <DocumentStep
            agentId={agentId}
            documentHints="Upload documents to give your agent knowledge."
            onNext={() => setTab("config")}
            showBack={false}
          />
        ) : null}
      </div>
    </div>
  );
}

// ─── Tools Edit Panel ───────────────────────────────────────────────────────

const BUILTIN_TOOLS = [
  { ref: "search_documents", name: "search_documents", displayName: "Search Knowledge Base", description: "Search the agent's uploaded documents for relevant information." },
  { ref: "get_user_memory", name: "get_user_memory", displayName: "User Memory", description: "Recall what the agent remembers about the current user." },
  { ref: "think", name: "think", displayName: "Think (Reasoning)", description: "Think step-by-step about complex questions before answering." },
  { ref: "discover_agents", name: "discover_agents", displayName: "Discover Agents", description: "Search the marketplace for other agents that can help with a task." },
];

interface ToolItem {
  id: string;
  name: string;
  displayName: string;
  description: string;
  toolType: string;
  builtinRef: string | null;
  webhookUrl: string | null;
  webhookMethod: string | null;
}

interface McpServerItem {
  id: string;
  name: string;
  displayName: string;
  serverUrl: string;
  transportType: string;
  isActive: boolean;
  lastDiscoveredAt: string | null;
  discoveryError: string | null;
  toolCount: number;
}

function ToolsEditPanel({ agentId }: { agentId: string }) {
  const [tools, setTools] = useState<ToolItem[]>([]);
  const [mcpServers, setMcpServers] = useState<McpServerItem[]>([]);
  const [loadingTools, setLoadingTools] = useState(true);
  const [savingTool, setSavingTool] = useState(false);
  const [toolError, setToolError] = useState<string | null>(null);
  const [toolSuccess, setToolSuccess] = useState(false);
  const [discoveringServer, setDiscoveringServer] = useState<string | null>(null);

  // New webhook form
  const [showAddWebhook, setShowAddWebhook] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newMethod, setNewMethod] = useState("POST");

  // New MCP server form
  const [showAddMcp, setShowAddMcp] = useState(false);
  const [mcpName, setMcpName] = useState("");
  const [mcpDisplayName, setMcpDisplayName] = useState("");
  const [mcpServerUrl, setMcpServerUrl] = useState("");
  const [mcpTransport, setMcpTransport] = useState("streamable-http");

  useEffect(() => {
    fetchTools();
    fetchMcpServers();
  }, [agentId]);

  async function fetchTools() {
    try {
      const res = await fetch(`/api/agents/${agentId}/tools`);
      if (res.ok) {
        const data = await res.json();
        setTools(data.tools || []);
      }
    } catch {
      // Tools table may not exist yet
    } finally {
      setLoadingTools(false);
    }
  }

  async function fetchMcpServers() {
    try {
      const res = await fetch(`/api/agents/${agentId}/mcp-servers`);
      if (res.ok) {
        const data = await res.json();
        setMcpServers(data.servers || []);
      }
    } catch {
      // MCP table may not exist yet
    }
  }

  async function toggleBuiltin(ref: string, displayName: string, description: string) {
    setSavingTool(true);
    setToolError(null);
    const existing = tools.find((t) => t.builtinRef === ref);

    try {
      if (existing) {
        // Remove
        await fetch(`/api/agents/${agentId}/tools/${existing.id}`, { method: "DELETE" });
        setTools((prev) => prev.filter((t) => t.id !== existing.id));
      } else {
        // Add
        const res = await fetch(`/api/agents/${agentId}/tools`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: ref,
            displayName,
            description,
            toolType: "builtin",
            builtinRef: ref,
            parametersSchema: { type: "object", properties: {} },
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to add tool");
        }
        await fetchTools();
      }
    } catch (err) {
      setToolError(err instanceof Error ? err.message : "Failed to update tool");
    } finally {
      setSavingTool(false);
    }
  }

  async function addWebhookTool() {
    if (!newName || !newUrl) return;
    setSavingTool(true);
    setToolError(null);

    try {
      const res = await fetch(`/api/agents/${agentId}/tools`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
          displayName: newDisplayName || newName,
          description: newDescription || `Call ${newName}`,
          toolType: "webhook",
          webhookUrl: newUrl,
          webhookMethod: newMethod,
          parametersSchema: { type: "object", properties: {} },
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add tool");
      }
      setNewName("");
      setNewDisplayName("");
      setNewDescription("");
      setNewUrl("");
      setShowAddWebhook(false);
      setToolSuccess(true);
      setTimeout(() => setToolSuccess(false), 3000);
      await fetchTools();
    } catch (err) {
      setToolError(err instanceof Error ? err.message : "Failed to add tool");
    } finally {
      setSavingTool(false);
    }
  }

  async function removeTool(toolId: string) {
    try {
      await fetch(`/api/agents/${agentId}/tools/${toolId}`, { method: "DELETE" });
      setTools((prev) => prev.filter((t) => t.id !== toolId));
    } catch {
      setToolError("Failed to remove tool");
    }
  }

  async function addMcpServer() {
    if (!mcpServerUrl) return;
    setSavingTool(true);
    setToolError(null);

    const name = mcpName || mcpDisplayName.toLowerCase().replace(/[^a-z0-9_-]/g, "-") || `mcp-${Date.now()}`;

    try {
      const res = await fetch(`/api/agents/${agentId}/mcp-servers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          displayName: mcpDisplayName || name,
          serverUrl: mcpServerUrl,
          transportType: mcpTransport,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add MCP server");
      }
      setMcpName("");
      setMcpDisplayName("");
      setMcpServerUrl("");
      setShowAddMcp(false);
      setToolSuccess(true);
      setTimeout(() => setToolSuccess(false), 3000);
      await fetchMcpServers();
    } catch (err) {
      setToolError(err instanceof Error ? err.message : "Failed to add MCP server");
    } finally {
      setSavingTool(false);
    }
  }

  async function removeMcpServer(serverId: string) {
    try {
      await fetch(`/api/agents/${agentId}/mcp-servers/${serverId}`, { method: "DELETE" });
      setMcpServers((prev) => prev.filter((s) => s.id !== serverId));
      await fetchTools(); // Refresh tools since MCP tools may have been deactivated
    } catch {
      setToolError("Failed to remove MCP server");
    }
  }

  async function discoverTools(serverId: string) {
    setDiscoveringServer(serverId);
    setToolError(null);

    try {
      const res = await fetch(`/api/agents/${agentId}/mcp-servers/${serverId}/discover`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Discovery failed");
      }
      const data = await res.json();
      setToolSuccess(true);
      setTimeout(() => setToolSuccess(false), 3000);
      // Refresh both servers (for updated tool count) and tools
      await Promise.all([fetchMcpServers(), fetchTools()]);
    } catch (err) {
      setToolError(err instanceof Error ? err.message : "Discovery failed");
      await fetchMcpServers(); // Refresh to show error state
    } finally {
      setDiscoveringServer(null);
    }
  }

  if (loadingTools) {
    return <div className="text-gray-400 animate-pulse py-8 text-center">Loading tools...</div>;
  }

  const webhookTools = tools.filter((t) => t.toolType === "webhook");

  return (
    <div className="space-y-6">
      {toolError && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
          {toolError}
          <button onClick={() => setToolError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}
      {toolSuccess && (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-sm text-green-700 dark:text-green-400">
          Saved!
        </div>
      )}

      {/* Builtin Tools */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Built-in Tools</h3>
        <div className="space-y-3">
          {BUILTIN_TOOLS.map((b) => {
            const isEnabled = tools.some((t) => t.builtinRef === b.ref);
            return (
              <label
                key={b.ref}
                className="flex items-start gap-3 p-4 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={() => toggleBuiltin(b.ref, b.displayName, b.description)}
                  disabled={savingTool}
                  className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <div className="font-medium text-gray-900 dark:text-white text-sm">{b.displayName}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{b.description}</div>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* Webhook Tools */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Webhook Tools</h3>
          <button
            onClick={() => setShowAddWebhook(!showAddWebhook)}
            className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-medium"
          >
            + Add Webhook
          </button>
        </div>

        {showAddWebhook && (
          <div className="p-4 border border-indigo-200 dark:border-indigo-800 rounded-lg mb-4 space-y-3 bg-indigo-50/50 dark:bg-indigo-900/10">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Function Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="check_inventory"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Display Name</label>
                <input
                  type="text"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder="Check Inventory"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Description</label>
              <input
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Check product inventory levels"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
              />
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div className="col-span-3">
                <label className="block text-xs text-gray-500 mb-1">URL</label>
                <input
                  type="url"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://api.example.com/inventory"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Method</label>
                <select
                  value={newMethod}
                  onChange={(e) => setNewMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
                >
                  <option value="POST">POST</option>
                  <option value="GET">GET</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowAddWebhook(false)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={addWebhookTool}
                disabled={!newName || !newUrl || savingTool}
                className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                {savingTool ? "Adding..." : "Add Tool"}
              </button>
            </div>
          </div>
        )}

        {webhookTools.length === 0 && !showAddWebhook ? (
          <p className="text-sm text-gray-400 italic">No webhook tools configured.</p>
        ) : (
          <div className="space-y-2">
            {webhookTools.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
              >
                <div>
                  <span className="font-medium text-gray-900 dark:text-white text-sm">{t.displayName}</span>
                  <span className="ml-2 text-xs text-gray-400 font-mono">{t.name}</span>
                  {t.webhookUrl && (
                    <span className="ml-2 text-xs text-gray-400">{t.webhookMethod} {t.webhookUrl}</span>
                  )}
                </div>
                <button
                  onClick={() => removeTool(t.id)}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MCP Servers */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">MCP Servers</h3>
            <p className="text-xs text-gray-400 mt-0.5">Connect Model Context Protocol servers to provide external tools.</p>
          </div>
          <button
            onClick={() => setShowAddMcp(!showAddMcp)}
            className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-medium"
          >
            + Add MCP Server
          </button>
        </div>

        {showAddMcp && (
          <div className="p-4 border border-indigo-200 dark:border-indigo-800 rounded-lg mb-4 space-y-3 bg-indigo-50/50 dark:bg-indigo-900/10">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Server Name</label>
                <input
                  type="text"
                  value={mcpName}
                  onChange={(e) => setMcpName(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "-"))}
                  placeholder="my-tool-server"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Display Name</label>
                <input
                  type="text"
                  value={mcpDisplayName}
                  onChange={(e) => setMcpDisplayName(e.target.value)}
                  placeholder="My Tool Server"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Server URL</label>
              <input
                type="url"
                value={mcpServerUrl}
                onChange={(e) => setMcpServerUrl(e.target.value)}
                placeholder="https://mcp.example.com/sse"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Transport</label>
              <select
                value={mcpTransport}
                onChange={(e) => setMcpTransport(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
              >
                <option value="streamable-http">Streamable HTTP</option>
                <option value="sse">Server-Sent Events (SSE)</option>
              </select>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowAddMcp(false)} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
              <button
                onClick={addMcpServer}
                disabled={!mcpServerUrl || savingTool}
                className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                {savingTool ? "Adding..." : "Add Server"}
              </button>
            </div>
          </div>
        )}

        {mcpServers.length === 0 && !showAddMcp ? (
          <p className="text-sm text-gray-400 italic">No MCP servers configured.</p>
        ) : (
          <div className="space-y-2">
            {mcpServers.map((server) => (
              <div
                key={server.id}
                className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-white text-sm">{server.displayName}</span>
                    <span className="text-xs px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded">
                      {server.transportType === "sse" ? "SSE" : "HTTP"}
                    </span>
                    {server.toolCount > 0 && (
                      <span className="text-xs px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
                        {server.toolCount} tool{server.toolCount !== 1 ? "s" : ""}
                      </span>
                    )}
                    {server.discoveryError && (
                      <span className="text-xs px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded" title={server.discoveryError}>
                        Error
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => discoverTools(server.id)}
                      disabled={discoveringServer === server.id}
                      className="text-xs text-indigo-500 hover:text-indigo-700 disabled:opacity-50"
                    >
                      {discoveringServer === server.id ? "Discovering..." : "Refresh Tools"}
                    </button>
                    <button
                      onClick={() => removeMcpServer(server.id)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <div className="mt-1 text-xs text-gray-400 font-mono truncate">{server.serverUrl}</div>
                {server.lastDiscoveredAt && (
                  <div className="mt-0.5 text-xs text-gray-400">
                    Last discovered: {new Date(server.lastDiscoveredAt).toLocaleString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Skills Edit Panel ──────────────────────────────────────────────────────

interface SkillItem {
  id: string;
  name: string;
  displayName: string;
  description: string;
  instructions: string;
  version: string;
  tags: string[];
}

function SkillsEditPanel({ agentId }: { agentId: string }) {
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [loadingSkills, setLoadingSkills] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [skillError, setSkillError] = useState<string | null>(null);
  const [importText, setImportText] = useState("");
  const [showImport, setShowImport] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDisplayName, setFormDisplayName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formInstructions, setFormInstructions] = useState("");
  const [formTags, setFormTags] = useState("");

  useEffect(() => {
    fetchSkills();
  }, [agentId]);

  async function fetchSkills() {
    try {
      const res = await fetch(`/api/agents/${agentId}/skills`);
      if (res.ok) {
        const data = await res.json();
        setSkills(data.skills || []);
      }
    } catch {
      // Skills table may not exist yet
    } finally {
      setLoadingSkills(false);
    }
  }

  function resetForm() {
    setFormName("");
    setFormDisplayName("");
    setFormDescription("");
    setFormInstructions("");
    setFormTags("");
    setEditingId(null);
    setShowAdd(false);
  }

  function startEdit(skill: SkillItem) {
    setFormName(skill.name);
    setFormDisplayName(skill.displayName);
    setFormDescription(skill.description);
    setFormInstructions(skill.instructions);
    setFormTags(skill.tags.join(", "));
    setEditingId(skill.id);
    setShowAdd(true);
  }

  async function handleSaveSkill() {
    if (!formName || !formDisplayName || !formInstructions) return;
    setSaving(true);
    setSkillError(null);

    const tags = formTags.split(",").map((t) => t.trim()).filter(Boolean);
    const body = {
      name: formName.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      displayName: formDisplayName,
      description: formDescription,
      instructions: formInstructions,
      tags,
    };

    try {
      if (editingId) {
        const res = await fetch(`/api/agents/${agentId}/skills/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error((await res.json()).error || "Failed to update");
      } else {
        const res = await fetch(`/api/agents/${agentId}/skills`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error((await res.json()).error || "Failed to create");
      }
      resetForm();
      await fetchSkills();
    } catch (err) {
      setSkillError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function removeSkill(skillId: string) {
    try {
      await fetch(`/api/agents/${agentId}/skills/${skillId}`, { method: "DELETE" });
      setSkills((prev) => prev.filter((s) => s.id !== skillId));
    } catch {
      setSkillError("Failed to remove skill");
    }
  }

  function exportSkillMd(skill: SkillItem): string {
    return `---\nname: ${skill.name}\ndisplay_name: ${skill.displayName}\ndescription: ${skill.description}\nversion: ${skill.version || "1.0.0"}\ntags: [${skill.tags.join(", ")}]\n---\n\n${skill.instructions}`;
  }

  async function handleImport() {
    if (!importText.trim()) return;
    setSaving(true);
    setSkillError(null);

    try {
      const text = importText.trim();
      let fm: Record<string, string> = {};
      let body = text;

      if (text.startsWith("---")) {
        const endIdx = text.indexOf("---", 3);
        if (endIdx !== -1) {
          const yaml = text.slice(3, endIdx).trim();
          body = text.slice(endIdx + 3).trim();
          for (const line of yaml.split("\n")) {
            const ci = line.indexOf(":");
            if (ci === -1) continue;
            fm[line.slice(0, ci).trim()] = line.slice(ci + 1).trim();
          }
        }
      }

      const name = fm.name || "imported-skill";
      const res = await fetch(`/api/agents/${agentId}/skills`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
          displayName: fm.display_name || fm.displayName || name,
          description: fm.description || "",
          instructions: body,
          tags: fm.tags ? fm.tags.replace(/[\[\]]/g, "").split(",").map((t: string) => t.trim()).filter(Boolean) : [],
        }),
      });

      if (!res.ok) throw new Error((await res.json()).error || "Failed to import");
      setImportText("");
      setShowImport(false);
      await fetchSkills();
    } catch (err) {
      setSkillError(err instanceof Error ? err.message : "Failed to import");
    } finally {
      setSaving(false);
    }
  }

  if (loadingSkills) {
    return <div className="text-gray-400 animate-pulse py-8 text-center">Loading skills...</div>;
  }

  return (
    <div className="space-y-6">
      {skillError && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
          {skillError}
          <button onClick={() => setSkillError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Agent Skills</h3>
          <p className="text-xs text-gray-400 mt-1">Skills define expertise and behavior guidelines for your agent.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowImport(!showImport)} className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">Import SKILL.md</button>
          <button onClick={() => { resetForm(); setShowAdd(true); }} className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-medium">+ Add Skill</button>
        </div>
      </div>

      {showImport && (
        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg space-y-3">
          <textarea value={importText} onChange={(e) => setImportText(e.target.value)} rows={8} placeholder="---\nname: my-skill\n---\n\nInstructions..." className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm font-mono" />
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowImport(false)} className="text-sm text-gray-500">Cancel</button>
            <button onClick={handleImport} disabled={!importText.trim() || saving} className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">{saving ? "Importing..." : "Import"}</button>
          </div>
        </div>
      )}

      {showAdd && (
        <div className="p-4 border border-indigo-200 dark:border-indigo-800 rounded-lg space-y-3 bg-indigo-50/50 dark:bg-indigo-900/10">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Skill Name</label>
              <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="menu-browsing" disabled={!!editingId} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm font-mono disabled:opacity-50" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Display Name</label>
              <input type="text" value={formDisplayName} onChange={(e) => setFormDisplayName(e.target.value)} placeholder="Menu Browsing" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Description</label>
            <input type="text" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Help customers explore the menu" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Tags (comma-separated)</label>
            <input type="text" value={formTags} onChange={(e) => setFormTags(e.target.value)} placeholder="food, menu" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Instructions (markdown)</label>
            <textarea value={formInstructions} onChange={(e) => setFormInstructions(e.target.value)} rows={8} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm font-mono" />
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={resetForm} className="text-sm text-gray-500">Cancel</button>
            <button onClick={handleSaveSkill} disabled={!formName || !formDisplayName || !formInstructions || saving} className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">{saving ? "Saving..." : editingId ? "Update" : "Add Skill"}</button>
          </div>
        </div>
      )}

      {skills.length === 0 && !showAdd ? (
        <p className="text-sm text-gray-400 italic py-4">No skills configured.</p>
      ) : (
        <div className="space-y-3">
          {skills.map((skill) => (
            <div key={skill.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-medium text-gray-900 dark:text-white text-sm">{skill.displayName}</span>
                  <span className="ml-2 text-xs text-gray-400 font-mono">{skill.name}</span>
                  {skill.tags.length > 0 && (
                    <div className="flex gap-1 mt-1">{skill.tags.map((tag) => (<span key={tag} className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded">{tag}</span>))}</div>
                  )}
                  <p className="text-xs text-gray-500 mt-1">{skill.description}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { navigator.clipboard.writeText(exportSkillMd(skill)); }} className="text-xs text-gray-400 hover:text-gray-600" title="Copy as SKILL.md">Export</button>
                  <button onClick={() => startEdit(skill)} className="text-xs text-indigo-500 hover:text-indigo-700">Edit</button>
                  <button onClick={() => removeSkill(skill.id)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
