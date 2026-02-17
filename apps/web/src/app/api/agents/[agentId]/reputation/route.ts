import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getReputationOnChain, type ChainId } from "@/lib/contracts";

interface AgentRow {
  id: string;
  name: string;
  nft_token_id: string | null;
  chain_id: number | null;
}

interface OnChainReputation {
  overallScore: number;
  totalReviews: number;
  accuracyScore: number;
  helpfulnessScore: number;
  speedScore: number;
  safetyScore: number;
}

// GET reputation for an agent
export async function GET(
  request: Request,
  context: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await context.params;

    const db = await getDB();

    // Get agent info
    const agent = await db
      .prepare("SELECT id, name, nft_token_id, chain_id FROM agents WHERE id = ?")
      .bind(agentId)
      .first<AgentRow>();

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Get feedback stats from database
    const statsResult = await db
      .prepare(
        `SELECT
           COUNT(*) as total_reviews,
           AVG(rating) as average_rating,
           SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as five_star,
           SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as four_star,
           SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as three_star,
           SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as two_star,
           SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as one_star
         FROM feedback
         WHERE agent_id = ?`
      )
      .bind(agentId)
      .first<{
        total_reviews: number;
        average_rating: number;
        five_star: number;
        four_star: number;
        three_star: number;
        two_star: number;
        one_star: number;
      }>();

    // Get recent feedback
    const recentFeedback = await db
      .prepare(
        `SELECT rating, comment, reviewer_address, created_at
         FROM feedback
         WHERE agent_id = ?
         ORDER BY created_at DESC
         LIMIT 5`
      )
      .bind(agentId)
      .all<{
        rating: number;
        comment: string | null;
        reviewer_address: string;
        created_at: string;
      }>();

    // Calculate trust level based on reviews
    const totalReviews = statsResult?.total_reviews || 0;
    const avgRating = statsResult?.average_rating || 0;
    let trustLevel: "unverified" | "basic" | "verified" | "premium" = "unverified";

    if (totalReviews >= 50 && avgRating >= 4.5) {
      trustLevel = "premium";
    } else if (totalReviews >= 20 && avgRating >= 4.0) {
      trustLevel = "verified";
    } else if (totalReviews >= 5 && avgRating >= 3.0) {
      trustLevel = "basic";
    }

    // Fetch on-chain reputation if agent has token ID
    let onChainReputation: OnChainReputation | null = null;
    if (agent.nft_token_id && agent.chain_id) {
      try {
        const chainId = agent.chain_id as ChainId;
        const tokenId = BigInt(agent.nft_token_id);
        const onChainData = await getReputationOnChain(chainId, tokenId);

        onChainReputation = {
          overallScore: Number(onChainData.overallScore) / 100,
          totalReviews: Number(onChainData.totalReviews),
          accuracyScore: Number(onChainData.accuracyScore) / 100,
          helpfulnessScore: Number(onChainData.helpfulnessScore) / 100,
          speedScore: Number(onChainData.speedScore) / 100,
          safetyScore: Number(onChainData.safetyScore) / 100,
        };
      } catch (err) {
        console.error("Failed to fetch on-chain reputation:", err);
        // Continue without on-chain data
      }
    }

    // Format response
    const reputation = {
      agentId,
      agentName: agent.name,
      onChain: {
        tokenId: agent.nft_token_id,
        chainId: agent.chain_id,
        // Use actual on-chain data if available, otherwise fallback to off-chain
        overallScore: onChainReputation?.overallScore ?? (Math.round(avgRating * 100) / 100 || 0),
        totalReviews: onChainReputation?.totalReviews ?? totalReviews,
        accuracyScore: onChainReputation?.accuracyScore,
        helpfulnessScore: onChainReputation?.helpfulnessScore,
        speedScore: onChainReputation?.speedScore,
        safetyScore: onChainReputation?.safetyScore,
        isVerified: !!onChainReputation,
      },
      offChain: {
        averageRating: Math.round((avgRating || 0) * 100) / 100,
        totalReviews,
        distribution: {
          5: statsResult?.five_star || 0,
          4: statsResult?.four_star || 0,
          3: statsResult?.three_star || 0,
          2: statsResult?.two_star || 0,
          1: statsResult?.one_star || 0,
        },
      },
      trustLevel,
      recentFeedback: recentFeedback.results.map((f) => ({
        rating: f.rating,
        comment: f.comment,
        reviewerAddress: f.reviewer_address,
        createdAt: f.created_at,
      })),
    };

    return NextResponse.json(reputation);
  } catch (error) {
    console.error("Failed to fetch reputation:", error);
    return NextResponse.json(
      { error: "Failed to fetch reputation" },
      { status: 500 }
    );
  }
}
