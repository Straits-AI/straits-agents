"use client";

import { useState } from "react";

export interface AgentConfig {
  systemPrompt: string;
  welcomeMessage: string;
  pricingType: "free" | "per-query";
  pricePerQuery: number;
  freeQueries: number;
  agentWallet: string;
  capabilities: string[];
  brandColor: string;
  businessInfo: {
    phone: string;
    address: string;
    hours: string;
    website: string;
  };
  llmProvider: "openai" | "anthropic" | "openrouter" | "";
  llmApiKey: string;
  llmModel: string;
  llmBaseUrl: string;
  chainId: number;
}

const CHAIN_OPTIONS = [
  { id: 97, name: "BNB Smart Chain Testnet", icon: "🔶" },
  { id: 421614, name: "Arbitrum Sepolia", icon: "🔵" },
] as const;

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

interface ConfigStepProps {
  initialData: AgentConfig;
  onChange: (data: AgentConfig) => void;
  onSubmit: () => void;
  onBack: () => void;
  isSubmitting: boolean;
}

export function ConfigStep({ initialData, onChange, onSubmit, onBack, isSubmitting }: ConfigStepProps) {
  const [data, setData] = useState<AgentConfig>(initialData);
  const [showBusinessInfo, setShowBusinessInfo] = useState(
    !!(initialData.businessInfo.phone || initialData.businessInfo.address || initialData.businessInfo.hours || initialData.businessInfo.website)
  );
  const [showLlmConfig, setShowLlmConfig] = useState(!!initialData.llmProvider);

  const update = (partial: Partial<AgentConfig>) => {
    const next = { ...data, ...partial };
    setData(next);
    onChange(next);
  };

  const updateBusinessInfo = (field: string, value: string) => {
    const next = { ...data, businessInfo: { ...data.businessInfo, [field]: value } };
    setData(next);
    onChange(next);
  };

  const isValid = data.systemPrompt.trim().length > 0 &&
    (data.pricingType === "free" || (data.agentWallet.trim().length > 0 && /^0x[a-fA-F0-9]{40}$/.test(data.agentWallet.trim()))) &&
    (!data.llmProvider || data.llmApiKey.trim().length > 0);

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Configure Agent</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        Customize your agent&apos;s behavior, pricing, and branding.
      </p>

      <div className="space-y-6 max-w-2xl">
        {/* System Prompt */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            System Prompt <span className="text-red-500">*</span>
          </label>
          <textarea
            value={data.systemPrompt}
            onChange={(e) => update({ systemPrompt: e.target.value })}
            rows={12}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm"
            placeholder="Define your agent's personality, capabilities, and guidelines..."
          />
          <p className="text-xs text-gray-400 mt-1">
            This is the instruction that shapes your agent&apos;s behavior.
          </p>
        </div>

        {/* Welcome Message */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Welcome Message
          </label>
          <textarea
            value={data.welcomeMessage}
            onChange={(e) => update({ welcomeMessage: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="The first message users see when they start a chat..."
          />
        </div>

        {/* Chain Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Blockchain Network
          </label>
          <div className="flex gap-3">
            {CHAIN_OPTIONS.map((chain) => (
              <button
                key={chain.id}
                type="button"
                onClick={() => update({ chainId: chain.id })}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                  data.chainId === chain.id
                    ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500"
                    : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500"
                }`}
              >
                <span>{chain.icon}</span>
                <span>{chain.name}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Your agent&apos;s on-chain identity and payments will live on this network.
          </p>
        </div>

        {/* Pricing */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Pricing
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="pricing"
                checked={data.pricingType === "free"}
                onChange={() => update({ pricingType: "free", pricePerQuery: 0 })}
                className="text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Free</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="pricing"
                checked={data.pricingType === "per-query"}
                onChange={() => update({ pricingType: "per-query", pricePerQuery: 0.01 })}
                className="text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Per Query</span>
            </label>
          </div>
          {data.pricingType === "per-query" && (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Price per query (USDC)</label>
                  <input
                    type="number"
                    value={data.pricePerQuery}
                    onChange={(e) => update({ pricePerQuery: parseFloat(e.target.value) || 0 })}
                    step="0.001"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Free queries (before charging)</label>
                  <input
                    type="number"
                    value={data.freeQueries}
                    onChange={(e) => update({ freeQueries: parseInt(e.target.value) || 0 })}
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Payment wallet address <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={data.agentWallet}
                  onChange={(e) => update({ agentWallet: e.target.value })}
                  placeholder={`0x... (your USDC receiving address on ${CHAIN_OPTIONS.find(c => c.id === data.chainId)?.name || "selected chain"})`}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
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
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Brand Color <span className="text-xs text-gray-400">(optional)</span>
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={data.brandColor || "#6366f1"}
              onChange={(e) => update({ brandColor: e.target.value })}
              className="w-10 h-10 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
            />
            <input
              type="text"
              value={data.brandColor}
              onChange={(e) => update({ brandColor: e.target.value })}
              placeholder="#6366f1"
              className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-mono"
            />
          </div>
        </div>

        {/* Business Info toggle */}
        <div>
          <button
            onClick={() => setShowBusinessInfo(!showBusinessInfo)}
            className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1"
          >
            <svg
              className={`w-4 h-4 transition-transform ${showBusinessInfo ? "rotate-90" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Business Info (optional)
          </button>
          {showBusinessInfo && (
            <div className="mt-3 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Phone</label>
                <input
                  type="text"
                  value={data.businessInfo.phone}
                  onChange={(e) => updateBusinessInfo("phone", e.target.value)}
                  placeholder="+1 (555) 123-4567"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Website</label>
                <input
                  type="text"
                  value={data.businessInfo.website}
                  onChange={(e) => updateBusinessInfo("website", e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Address</label>
                <input
                  type="text"
                  value={data.businessInfo.address}
                  onChange={(e) => updateBusinessInfo("address", e.target.value)}
                  placeholder="123 Main St, City"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Hours</label>
                <input
                  type="text"
                  value={data.businessInfo.hours}
                  onChange={(e) => updateBusinessInfo("hours", e.target.value)}
                  placeholder="Mon-Fri 9am-5pm"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                />
              </div>
            </div>
          )}
        </div>

        {/* LLM Configuration toggle */}
        <div>
          <button
            onClick={() => setShowLlmConfig(!showLlmConfig)}
            className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1"
          >
            <svg
              className={`w-4 h-4 transition-transform ${showLlmConfig ? "rotate-90" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            LLM Configuration (optional)
          </button>
          {showLlmConfig && (
            <div className="mt-3 space-y-3">
              <p className="text-xs text-gray-400">
                Provide your own API key to avoid platform inference costs. Your key is encrypted at rest.
              </p>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Provider</label>
                <select
                  value={data.llmProvider}
                  onChange={(e) => update({ llmProvider: e.target.value as AgentConfig["llmProvider"], llmApiKey: "", llmModel: "", llmBaseUrl: "" })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                >
                  {Object.entries(LLM_PROVIDER_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              {data.llmProvider && (
                <>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                      API Key <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      value={data.llmApiKey}
                      onChange={(e) => update({ llmApiKey: e.target.value })}
                      placeholder={`Enter your ${LLM_PROVIDER_LABELS[data.llmProvider]} API key`}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                      Base URL <span className="text-xs text-gray-400">(optional, for custom/self-hosted endpoints)</span>
                    </label>
                    <input
                      type="text"
                      value={data.llmBaseUrl}
                      onChange={(e) => update({ llmBaseUrl: e.target.value })}
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
                      value={data.llmModel}
                      onChange={(e) => update({ llmModel: e.target.value })}
                      placeholder={LLM_DEFAULT_MODELS[data.llmProvider] || "Default model"}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-mono"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Leave empty to use the default: {LLM_DEFAULT_MODELS[data.llmProvider]}
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-8">
        <button
          onClick={onBack}
          className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
        >
          Back
        </button>
        <button
          onClick={onSubmit}
          disabled={!isValid || isSubmitting}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}
