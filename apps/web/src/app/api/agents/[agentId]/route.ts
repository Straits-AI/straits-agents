import { getDB, getEnv } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { RESERVED_SLUGS } from "@/lib/agentTemplates";
import { NextResponse } from "next/server";
import { encrypt } from "@/lib/encryption";
import { isValidProvider } from "@/lib/llm-providers";
import { isSupportedChain } from "@/lib/smart-account/config";

interface AgentRow {
  id: string;
  name: string;
  description: string;
  category: string;
  type: string;
  icon: string;
  system_prompt: string;
  welcome_message: string;
  pricing_type: string;
  price_per_query: number;
  free_queries: number;
  agent_wallet: string | null;
  slug: string | null;
  template: string | null;
  brand_color: string | null;
  business_info: string | null;
  owner_id: string | null;
  llm_provider: string | null;
  encrypted_llm_api_key: string | null;
  llm_model: string | null;
  llm_base_url: string | null;
  chain_id: number | null;
}

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params;
    const db = await getDB();

    // Resolve by id or slug
    const result = await db
      .prepare(
        `SELECT id, name, description, category, type, icon, system_prompt, welcome_message, pricing_type, price_per_query, free_queries, agent_wallet, slug, template, brand_color, business_info, owner_id, llm_provider, encrypted_llm_api_key, llm_model, llm_base_url, chain_id
         FROM agents WHERE (id = ? OR slug = ?) AND is_active = 1`
      )
      .bind(agentId, agentId)
      .first<AgentRow>();

    if (!result) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const agent = {
      id: result.id,
      name: result.name,
      description: result.description,
      category: result.category,
      type: result.type,
      icon: result.icon,
      systemPrompt: result.system_prompt,
      welcomeMessage: result.welcome_message,
      pricingModel: {
        type: result.pricing_type,
        pricePerQuery: result.price_per_query,
        freeQueries: result.free_queries,
      },
      agentWallet: result.agent_wallet,
      slug: result.slug,
      template: result.template,
      brandColor: result.brand_color,
      businessInfo: result.business_info ? JSON.parse(result.business_info) : null,
      ownerId: result.owner_id,
      llmProvider: result.llm_provider,
      llmModel: result.llm_model,
      llmBaseUrl: result.llm_base_url,
      hasLlmApiKey: !!result.encrypted_llm_api_key,
      chainId: result.chain_id || 421614,
    };

    return NextResponse.json(agent);
  } catch (error) {
    console.error("Failed to fetch agent:", error);
    return NextResponse.json(
      { error: "Failed to fetch agent" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { agentId } = await params;
    const db = await getDB();

    // Check ownership
    const agent = await db
      .prepare("SELECT id, owner_id FROM agents WHERE id = ? AND is_active = 1")
      .bind(agentId)
      .first<{ id: string; owner_id: string }>();

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }
    if (agent.owner_id !== session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (body.name !== undefined) {
      if (typeof body.name !== "string" || body.name.length > 100) {
        return NextResponse.json({ error: "name max 100 chars" }, { status: 400 });
      }
      updates.push("name = ?");
      values.push(body.name.trim());
    }

    if (body.slug !== undefined) {
      if (typeof body.slug !== "string" || !SLUG_REGEX.test(body.slug)) {
        return NextResponse.json({ error: "Invalid slug format" }, { status: 400 });
      }
      if (RESERVED_SLUGS.includes(body.slug)) {
        return NextResponse.json({ error: "This slug is reserved" }, { status: 409 });
      }
      const existingSlug = await db
        .prepare("SELECT id FROM agents WHERE slug = ? AND id != ?")
        .bind(body.slug, agentId)
        .first<{ id: string }>();
      if (existingSlug) {
        return NextResponse.json({ error: "This slug is already taken" }, { status: 409 });
      }
      updates.push("slug = ?");
      values.push(body.slug);
    }

    if (body.description !== undefined) {
      updates.push("description = ?");
      values.push((body.description || "").slice(0, 500));
    }
    if (body.icon !== undefined) {
      updates.push("icon = ?");
      values.push(body.icon);
    }
    if (body.systemPrompt !== undefined) {
      updates.push("system_prompt = ?");
      values.push(body.systemPrompt);
    }
    if (body.welcomeMessage !== undefined) {
      updates.push("welcome_message = ?");
      values.push(body.welcomeMessage);
    }
    if (body.pricingType !== undefined) {
      const pt = body.pricingType === "per-query" ? "per-query" : "free";
      updates.push("pricing_type = ?");
      values.push(pt);
    }
    if (body.pricePerQuery !== undefined) {
      updates.push("price_per_query = ?");
      values.push(body.pricePerQuery);
    }
    if (body.freeQueries !== undefined) {
      updates.push("free_queries = ?");
      values.push(body.freeQueries);
    }
    if (body.agentWallet !== undefined) {
      const wallet = body.agentWallet && /^0x[a-fA-F0-9]{40}$/.test(body.agentWallet) ? body.agentWallet : null;
      updates.push("agent_wallet = ?");
      values.push(wallet);
    }
    if (body.capabilities !== undefined) {
      updates.push("capabilities = ?");
      values.push(body.capabilities ? JSON.stringify(body.capabilities) : null);
    }
    if (body.brandColor !== undefined) {
      updates.push("brand_color = ?");
      values.push(body.brandColor);
    }
    if (body.businessInfo !== undefined) {
      updates.push("business_info = ?");
      values.push(body.businessInfo ? JSON.stringify(body.businessInfo) : null);
    }
    if (body.category !== undefined) {
      updates.push("category = ?");
      values.push(body.category === "productivity" ? "productivity" : "customer-facing");
    }

    // BYOK fields
    if (body.llmProvider !== undefined) {
      if (body.llmProvider === "" || body.llmProvider === null) {
        // Clear BYOK: set provider, key, and model to null
        updates.push("llm_provider = ?");
        values.push(null);
        updates.push("encrypted_llm_api_key = ?");
        values.push(null);
        updates.push("llm_model = ?");
        values.push(null);
      } else {
        if (!isValidProvider(body.llmProvider)) {
          return NextResponse.json({ error: "llmProvider must be one of: openai, anthropic, openrouter" }, { status: 400 });
        }
        updates.push("llm_provider = ?");
        values.push(body.llmProvider);

        // If provider changed, require a new key (handled by client sending llmApiKey)
      }
    }

    if (body.llmApiKey !== undefined) {
      if (body.llmApiKey === "" || body.llmApiKey === null) {
        // Clear the API key
        updates.push("encrypted_llm_api_key = ?");
        values.push(null);
      } else {
        const env = await getEnv();
        const encryptedKey = await encrypt(body.llmApiKey.trim(), env.EMBEDDED_WALLET_SECRET, "llm-api-key");
        updates.push("encrypted_llm_api_key = ?");
        values.push(encryptedKey);
      }
    }

    if (body.llmModel !== undefined) {
      updates.push("llm_model = ?");
      values.push(body.llmModel?.trim() || null);
    }

    if (body.llmBaseUrl !== undefined) {
      updates.push("llm_base_url = ?");
      values.push(body.llmBaseUrl?.trim() || null);
    }

    if (body.chainId !== undefined) {
      if (!isSupportedChain(body.chainId)) {
        return NextResponse.json({ error: "Unsupported chain ID" }, { status: 400 });
      }
      updates.push("chain_id = ?");
      values.push(body.chainId);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    values.push(agentId);
    await db
      .prepare(`UPDATE agents SET ${updates.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update agent:", error);
    return NextResponse.json(
      { error: "Failed to update agent" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { agentId } = await params;
    const db = await getDB();

    const agent = await db
      .prepare("SELECT id, owner_id FROM agents WHERE id = ? AND is_active = 1")
      .bind(agentId)
      .first<{ id: string; owner_id: string }>();

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }
    if (agent.owner_id !== session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await db
      .prepare("UPDATE agents SET is_active = 0 WHERE id = ?")
      .bind(agentId)
      .run();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete agent:", error);
    return NextResponse.json(
      { error: "Failed to delete agent" },
      { status: 500 }
    );
  }
}
