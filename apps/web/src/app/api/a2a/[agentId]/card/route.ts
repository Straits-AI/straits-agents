/**
 * A2A Agent Card Endpoint
 * Returns an A2A-compatible Agent Card per the Google A2A protocol.
 * Includes skills, capabilities, ERC-8004 identity, and x402 pricing.
 */

import { getDB } from "@/lib/db";
import { getAgentSkillsSummary } from "@/lib/skills";
import { NextResponse } from "next/server";
import { getChainConfig, isSupportedChain, type SupportedChainId } from "@/lib/smart-account/config";
import { getContractAddresses } from "@/lib/contracts";

const BASE_URL = "https://straits-agents-web.mystraits-ai.workers.dev";

interface AgentRow {
  id: string;
  name: string;
  description: string;
  icon: string;
  slug: string | null;
  pricing_type: string;
  price_per_query: number;
  capabilities: string | null;
  agent_wallet: string | null;
  chain_id: number | null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params;
    const db = await getDB();

    const agent = await db
      .prepare(
        `SELECT id, name, description, icon, slug, pricing_type, price_per_query, capabilities, agent_wallet, chain_id
         FROM agents WHERE (id = ? OR slug = ?) AND is_active = 1`
      )
      .bind(agentId, agentId)
      .first<AgentRow>();

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const agentPath = agent.slug || agent.id;
    const agentChainId = (agent.chain_id || 421614) as SupportedChainId;
    const chainConfig = isSupportedChain(agentChainId) ? getChainConfig(agentChainId) : getChainConfig(421614);
    const contracts = isSupportedChain(agentChainId) ? getContractAddresses(agentChainId as import("@/lib/contracts").ChainId) : getContractAddresses(421614);

    // Load skills summary
    const skills = await getAgentSkillsSummary(agent.id);

    // Build A2A Agent Card
    const card = {
      name: agent.name,
      description: agent.description,
      url: `${BASE_URL}/api/a2a/${agentPath}`,
      version: "1.0.0",
      capabilities: {
        streaming: true,
        pushNotifications: false,
      },
      skills: skills.map((s) => ({
        id: s.name,
        name: s.displayName,
        description: s.description,
        tags: s.tags,
      })),
      authentication: {
        schemes: agent.pricing_type === "per-query" ? ["x402"] : [],
      },
      // x402 payment info (if paid agent)
      ...(agent.pricing_type === "per-query" && {
        x402: {
          network: chainConfig.name.toLowerCase().replace(/\s+/g, "-"),
          chainId: agentChainId,
          asset: "USDC",
          assetAddress: chainConfig.usdcAddress,
          pricePerQuery: agent.price_per_query,
          payee: agent.agent_wallet,
        },
      }),
      // ERC-8004 on-chain identity
      erc8004: {
        chainId: agentChainId,
        identityRegistry: contracts.identityRegistry,
        reputationRegistry: contracts.reputationRegistry,
        agentId: agent.id,
      },
      // Additional metadata
      metadata: {
        icon: agent.icon,
        platform: "straits-agents",
        chatUrl: `${BASE_URL}/chat/${agentPath}`,
      },
    };

    return NextResponse.json(card, {
      headers: {
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (error) {
    console.error("Failed to generate Agent Card:", error);
    return NextResponse.json({ error: "Failed to generate Agent Card" }, { status: 500 });
  }
}
