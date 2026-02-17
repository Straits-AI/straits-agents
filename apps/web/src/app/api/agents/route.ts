import { getDB, getEnv } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { RESERVED_SLUGS } from "@/lib/agentTemplates";
import { NextResponse } from "next/server";
import { encrypt } from "@/lib/encryption";
import { isValidProvider } from "@/lib/llm-providers";
import { isSupportedChain, DEFAULT_CHAIN_ID } from "@/lib/smart-account/config";

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/;

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
  capabilities: string | null;
  is_featured: number;
  avg_rating: number | null;
  total_reviews: number;
  total_sessions: number;
  created_at: string;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const sort = searchParams.get("sort") || "rating"; // rating | popular | newest
    const order = searchParams.get("order") || "desc"; // asc | desc
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "12", 10), 50);
    const category = searchParams.get("category"); // customer-facing | productivity
    const featured = searchParams.get("featured") === "true";
    const minReputation = searchParams.get("minReputation") ? parseInt(searchParams.get("minReputation")!, 10) : null;

    const offset = (page - 1) * limit;

    // Build ORDER BY clause based on sort parameter
    let orderByClause = "";
    const orderDir = order === "asc" ? "ASC" : "DESC";

    switch (sort) {
      case "popular":
        orderByClause = `total_sessions ${orderDir}, avg_rating ${orderDir}`;
        break;
      case "newest":
        orderByClause = `a.created_at ${orderDir}`;
        break;
      case "rating":
      default:
        orderByClause = `avg_rating ${orderDir}, total_reviews ${orderDir}`;
        break;
    }

    // Build WHERE clause
    const whereClauses = ["a.is_active = 1"];
    const params: (string | number)[] = [];

    if (category && category !== "all") {
      whereClauses.push("a.category = ?");
      params.push(category);
    }

    if (featured) {
      whereClauses.push("(a.is_featured = 1 OR (COALESCE(avg_rating, 0) >= 4.5 AND total_reviews >= 10))");
    }

    // Reputation filter (score is 0-100, derived from avg_rating * 20)
    if (minReputation !== null && minReputation > 0) {
      whereClauses.push("(COALESCE(avg_rating, 0) * 20 >= ?)");
      params.push(minReputation);
    }

    const whereClause = whereClauses.join(" AND ");

    const db = await getDB();

    // Get total count for pagination
    const countResult = await db
      .prepare(
        `SELECT COUNT(*) as total
         FROM agents a
         LEFT JOIN (
           SELECT agent_id, AVG(rating) as avg_rating, COUNT(*) as total_reviews
           FROM feedback GROUP BY agent_id
         ) f ON a.id = f.agent_id
         LEFT JOIN (
           SELECT agent_id, COUNT(*) as total_sessions
           FROM sessions GROUP BY agent_id
         ) s ON a.id = s.agent_id
         WHERE ${whereClause}`
      )
      .bind(...params)
      .first<{ total: number }>();

    const total = countResult?.total || 0;

    // Fetch agents with sorting and pagination
    const result = await db
      .prepare(
        `SELECT
           a.id, a.name, a.description, a.category, a.type, a.icon,
           a.system_prompt, a.welcome_message, a.pricing_type,
           a.price_per_query, a.free_queries, a.capabilities,
           COALESCE(a.is_featured, 0) as is_featured,
           a.created_at,
           COALESCE(f.avg_rating, 0) as avg_rating,
           COALESCE(f.total_reviews, 0) as total_reviews,
           COALESCE(s.total_sessions, 0) as total_sessions
         FROM agents a
         LEFT JOIN (
           SELECT agent_id, AVG(rating) as avg_rating, COUNT(*) as total_reviews
           FROM feedback GROUP BY agent_id
         ) f ON a.id = f.agent_id
         LEFT JOIN (
           SELECT agent_id, COUNT(*) as total_sessions
           FROM sessions GROUP BY agent_id
         ) s ON a.id = s.agent_id
         WHERE ${whereClause}
         ORDER BY ${orderByClause}
         LIMIT ? OFFSET ?`
      )
      .bind(...params, limit, offset)
      .all<AgentRow>();

    const agents = result.results.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      type: row.type,
      icon: row.icon,
      systemPrompt: row.system_prompt,
      welcomeMessage: row.welcome_message,
      pricingModel: {
        type: row.pricing_type,
        pricePerQuery: row.price_per_query,
        freeQueries: row.free_queries,
      },
      capabilities: row.capabilities ? JSON.parse(row.capabilities) : [],
      isFeatured: row.is_featured === 1,
      stats: {
        avgRating: Math.round((row.avg_rating || 0) * 100) / 100,
        totalReviews: row.total_reviews,
        totalSessions: row.total_sessions,
      },
      createdAt: row.created_at,
    }));

    return NextResponse.json({
      agents,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Failed to fetch agents:", error);
    return NextResponse.json(
      { error: "Failed to fetch agents" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json();
    const { name, slug, description, category, template, systemPrompt, welcomeMessage, icon, pricingType, pricePerQuery, freeQueries, agentWallet, capabilities, brandColor, businessInfo, llmProvider, llmApiKey, llmModel, llmBaseUrl, chainId: requestChainId } = body;

    // Validate chain ID (default to BSC Testnet for new agents)
    const chainId = requestChainId && isSupportedChain(requestChainId) ? requestChainId : DEFAULT_CHAIN_ID;

    // Validate required fields
    if (!name || typeof name !== "string" || name.length > 100) {
      return NextResponse.json({ error: "name is required (max 100 chars)" }, { status: 400 });
    }
    if (!slug || typeof slug !== "string" || !SLUG_REGEX.test(slug)) {
      return NextResponse.json({ error: "slug must be 3-50 lowercase alphanumeric characters and hyphens" }, { status: 400 });
    }
    if (description && typeof description === "string" && description.length > 500) {
      return NextResponse.json({ error: "description max 500 chars" }, { status: 400 });
    }
    if (!systemPrompt || typeof systemPrompt !== "string") {
      return NextResponse.json({ error: "systemPrompt is required" }, { status: 400 });
    }

    // Check slug not reserved
    if (RESERVED_SLUGS.includes(slug)) {
      return NextResponse.json({ error: "This slug is reserved" }, { status: 409 });
    }

    const db = await getDB();

    // Check slug uniqueness in DB
    const existing = await db
      .prepare("SELECT id FROM agents WHERE slug = ?")
      .bind(slug)
      .first<{ id: string }>();

    if (existing) {
      return NextResponse.json({ error: "This slug is already taken" }, { status: 409 });
    }

    const id = crypto.randomUUID();
    const validCategory = category === "productivity" ? "productivity" : "customer-facing";
    const validPricingType = pricingType === "per-query" ? "per-query" : "free";

    // Validate wallet address if per-query pricing
    const validWallet = agentWallet && /^0x[a-fA-F0-9]{40}$/.test(agentWallet) ? agentWallet : null;

    // Validate BYOK fields
    let validLlmProvider: string | null = null;
    let encryptedLlmApiKey: string | null = null;
    let validLlmModel: string | null = llmModel?.trim() || null;
    let validLlmBaseUrl: string | null = llmBaseUrl?.trim() || null;

    if (llmProvider) {
      if (!isValidProvider(llmProvider)) {
        return NextResponse.json({ error: "llmProvider must be one of: openai, anthropic, openrouter" }, { status: 400 });
      }
      if (!llmApiKey || typeof llmApiKey !== "string" || !llmApiKey.trim()) {
        return NextResponse.json({ error: "llmApiKey is required when llmProvider is set" }, { status: 400 });
      }
      validLlmProvider = llmProvider;
      const env = await getEnv();
      encryptedLlmApiKey = await encrypt(llmApiKey.trim(), env.EMBEDDED_WALLET_SECRET, "llm-api-key");
    }

    await db
      .prepare(
        `INSERT INTO agents (id, name, description, category, type, icon, system_prompt, welcome_message, pricing_type, price_per_query, free_queries, agent_wallet, capabilities, owner_id, is_active, slug, template, brand_color, business_info, llm_provider, encrypted_llm_api_key, llm_model, llm_base_url, chain_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        name.trim(),
        (description || "").trim(),
        validCategory,
        template || "custom",
        icon || "🤖",
        systemPrompt,
        welcomeMessage || "Hello! How can I help you today?",
        validPricingType,
        validPricingType === "per-query" ? (pricePerQuery || 0.01) : 0,
        freeQueries || 0,
        validWallet,
        capabilities ? JSON.stringify(capabilities) : null,
        session.userId,
        slug,
        template || null,
        brandColor || null,
        businessInfo ? JSON.stringify(businessInfo) : null,
        validLlmProvider,
        encryptedLlmApiKey,
        validLlmModel,
        validLlmBaseUrl,
        chainId
      )
      .run();

    return NextResponse.json({
      id,
      slug,
      name: name.trim(),
      chatUrl: `/chat/${slug}`,
    }, { status: 201 });
  } catch (error) {
    console.error("Failed to create agent:", error);
    return NextResponse.json(
      { error: "Failed to create agent" },
      { status: 500 }
    );
  }
}
