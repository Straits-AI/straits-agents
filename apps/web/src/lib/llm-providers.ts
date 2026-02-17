/**
 * LLM Provider Factory for BYOK (Bring Your Own Key)
 * Resolves the correct AI model based on agent's BYOK configuration
 */

import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";
import { getDB, getEnv } from "./db";
import { decrypt } from "./encryption";

export type LlmProvider = "openai" | "anthropic" | "openrouter";

const VALID_PROVIDERS: LlmProvider[] = ["openai", "anthropic", "openrouter"];

const DEFAULT_MODELS: Record<LlmProvider, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-sonnet-4-5-20250929",
  openrouter: "google/gemini-2.0-flash-001",
};

// Estimated cost per query in cents (for platform balance deduction)
const PLATFORM_COST_PER_QUERY_CENTS = 5; // $0.005

export interface ResolvedModel {
  model: LanguageModel;
  provider: string;
  modelId: string;
  isByok: boolean;
}

interface AgentLlmRow {
  llm_provider: string | null;
  encrypted_llm_api_key: string | null;
  llm_model: string | null;
  llm_base_url: string | null;
  owner_id: string | null;
}

export function isValidProvider(provider: string): provider is LlmProvider {
  return VALID_PROVIDERS.includes(provider as LlmProvider);
}

/**
 * Resolve the LLM model for an agent based on BYOK configuration.
 * Falls back to platform OpenRouter key if no BYOK key is set.
 * For platform-key agents, checks and deducts from creator's balance.
 */
export async function resolveModel(resolvedAgentId: string): Promise<ResolvedModel> {
  const db = await getDB();
  const env = await getEnv();

  // Fetch agent's LLM config
  const agent = await db
    .prepare("SELECT llm_provider, encrypted_llm_api_key, llm_model, llm_base_url, owner_id FROM agents WHERE id = ?")
    .bind(resolvedAgentId)
    .first<AgentLlmRow>();

  // BYOK path: agent has its own API key
  if (agent?.llm_provider && agent?.encrypted_llm_api_key) {
    const provider = agent.llm_provider as LlmProvider;
    const apiKey = await decrypt(agent.encrypted_llm_api_key, env.EMBEDDED_WALLET_SECRET, "llm-api-key");
    const modelId = agent.llm_model || DEFAULT_MODELS[provider];
    const baseURL = agent.llm_base_url || undefined;

    const model = createProviderModel(provider, apiKey, modelId, baseURL);
    return { model, provider, modelId, isByok: true };
  }

  // Platform path: use platform's OpenRouter key
  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("Platform API key not configured");
  }

  // Check creator's platform balance for non-BYOK agents
  if (agent?.owner_id) {
    const owner = await db
      .prepare("SELECT embedded_balance FROM users WHERE id = ?")
      .bind(agent.owner_id)
      .first<{ embedded_balance: number }>();

    if (owner && owner.embedded_balance < PLATFORM_COST_PER_QUERY_CENTS) {
      throw new InsufficientBalanceError(
        "Agent creator has insufficient platform balance for inference. Please add funds or configure a BYOK API key."
      );
    }
  }

  const modelId = agent?.llm_model || DEFAULT_MODELS.openrouter;
  const openrouter = createOpenRouter({
    apiKey,
    headers: {
      "HTTP-Referer": "https://straits-agents-web.mystraits-ai.workers.dev",
      "X-Title": "Straits Agents Marketplace",
    },
  });

  return { model: openrouter(modelId) as unknown as LanguageModel, provider: "openrouter", modelId, isByok: false };
}

/**
 * Atomically deduct platform inference cost from creator's balance BEFORE the LLM call.
 * Returns true if deduction succeeded, false if insufficient balance.
 * Uses UPDATE WHERE balance >= cost to prevent races.
 */
export async function deductPlatformCost(agentId: string): Promise<boolean> {
  const db = await getDB();
  const agent = await db
    .prepare("SELECT owner_id, llm_provider FROM agents WHERE id = ?")
    .bind(agentId)
    .first<{ owner_id: string | null; llm_provider: string | null }>();

  // Only deduct for platform-key (non-BYOK) agents
  if (!agent?.owner_id || agent.llm_provider) return true;

  const result = await db
    .prepare("UPDATE users SET embedded_balance = embedded_balance - ? WHERE id = ? AND embedded_balance >= ?")
    .bind(PLATFORM_COST_PER_QUERY_CENTS, agent.owner_id, PLATFORM_COST_PER_QUERY_CENTS)
    .run();

  return (result.meta.changes ?? 0) > 0;
}

/**
 * Refund platform cost on LLM failure. Best-effort — logs errors but doesn't throw.
 */
export async function refundPlatformCost(agentId: string): Promise<void> {
  try {
    const db = await getDB();
    const agent = await db
      .prepare("SELECT owner_id, llm_provider FROM agents WHERE id = ?")
      .bind(agentId)
      .first<{ owner_id: string | null; llm_provider: string | null }>();

    if (!agent?.owner_id || agent.llm_provider) return;

    await db
      .prepare("UPDATE users SET embedded_balance = embedded_balance + ? WHERE id = ?")
      .bind(PLATFORM_COST_PER_QUERY_CENTS, agent.owner_id)
      .run();
  } catch (err) {
    console.error("Failed to refund platform cost:", err);
  }
}

function createProviderModel(provider: LlmProvider, apiKey: string, modelId: string, baseURL?: string): LanguageModel {
  switch (provider) {
    case "openai": {
      const openai = createOpenAI({ apiKey, baseURL });
      return openai(modelId) as unknown as LanguageModel;
    }
    case "anthropic": {
      const anthropic = createAnthropic({ apiKey, baseURL });
      return anthropic(modelId) as unknown as LanguageModel;
    }
    case "openrouter": {
      const openrouter = createOpenRouter({ apiKey, baseURL });
      return openrouter(modelId) as unknown as LanguageModel;
    }
    default:
      throw new Error(`Unsupported LLM provider: ${provider}`);
  }
}

export class InsufficientBalanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InsufficientBalanceError";
  }
}
