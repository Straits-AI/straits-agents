/**
 * Directory-level Agent Card
 * Lists all active marketplace agents per A2A protocol.
 * Accessible at /.well-known/agent.json
 */

import { getDB } from "@/lib/db";
import { NextResponse } from "next/server";

const BASE_URL = "https://straits-agents-web.mystraits-ai.workers.dev";

export async function GET() {
  try {
    const db = await getDB();

    const result = await db
      .prepare(
        `SELECT id, name, description, icon, slug, pricing_type
         FROM agents WHERE is_active = 1
         ORDER BY name ASC
         LIMIT 100`
      )
      .all<{
        id: string;
        name: string;
        description: string;
        icon: string;
        slug: string | null;
        pricing_type: string;
      }>();

    const agents = result.results.map((agent) => {
      const path = agent.slug || agent.id;
      return {
        name: agent.name,
        description: agent.description,
        url: `${BASE_URL}/api/a2a/${path}`,
        cardUrl: `${BASE_URL}/api/a2a/${path}/card`,
        icon: agent.icon,
        pricingType: agent.pricing_type,
      };
    });

    const directoryCard = {
      name: "Straits Agents Marketplace",
      description: "AI Agents Marketplace with on-chain trust (ERC-8004) and micropayments (x402)",
      url: BASE_URL,
      version: "1.0.0",
      capabilities: {
        streaming: true,
        agentDirectory: true,
      },
      agents,
    };

    return NextResponse.json(directoryCard, {
      headers: {
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch (error) {
    console.error("Failed to generate directory Agent Card:", error);
    return NextResponse.json({ error: "Failed to generate directory" }, { status: 500 });
  }
}
