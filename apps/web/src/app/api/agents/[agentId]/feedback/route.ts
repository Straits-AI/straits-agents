import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { hashComment } from "@/lib/contracts";
import { getSession } from "@/lib/auth";

interface FeedbackRow {
  id: string;
  agent_id: string;
  reviewer_address: string;
  rating: number;
  comment: string | null;
  transaction_hash: string | null;
  created_at: string;
}

// GET feedback for an agent
export async function GET(
  request: Request,
  context: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await context.params;
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 100);
    const offset = parseInt(url.searchParams.get("offset") || "0");

    const db = await getDB();

    // Get feedback entries
    const feedbackResult = await db
      .prepare(
        `SELECT id, agent_id, reviewer_address, rating, comment, transaction_hash, created_at
         FROM feedback
         WHERE agent_id = ?
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`
      )
      .bind(agentId, limit, offset)
      .all<FeedbackRow>();

    // Get aggregate stats
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

    return NextResponse.json({
      feedback: feedbackResult.results.map((f) => ({
        id: f.id,
        agentId: f.agent_id,
        reviewerAddress: f.reviewer_address,
        rating: f.rating,
        comment: f.comment,
        transactionHash: f.transaction_hash,
        createdAt: f.created_at,
      })),
      stats: {
        totalReviews: statsResult?.total_reviews || 0,
        averageRating: statsResult?.average_rating || 0,
        distribution: {
          5: statsResult?.five_star || 0,
          4: statsResult?.four_star || 0,
          3: statsResult?.three_star || 0,
          2: statsResult?.two_star || 0,
          1: statsResult?.one_star || 0,
        },
      },
    });
  } catch (error) {
    console.error("Failed to fetch feedback:", error);
    return NextResponse.json(
      { error: "Failed to fetch feedback" },
      { status: 500 }
    );
  }
}

// POST submit feedback (authenticated only)
export async function POST(
  request: Request,
  context: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await context.params;

    // Require authentication
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { reviewerAddress, rating, comment, transactionHash } = await request.json();

    // Validate required fields
    if (!reviewerAddress || !rating) {
      return NextResponse.json(
        { error: "reviewerAddress and rating are required" },
        { status: 400 }
      );
    }

    // Verify reviewerAddress belongs to the authenticated user
    const db2 = await getDB();
    const user = await db2
      .prepare("SELECT embedded_wallet_address FROM users WHERE id = ?")
      .bind(session.userId)
      .first<{ embedded_wallet_address: string | null }>();

    const userWallets = [
      session.walletAddress?.toLowerCase(),
      user?.embedded_wallet_address?.toLowerCase(),
    ].filter(Boolean);

    if (!userWallets.includes(reviewerAddress.toLowerCase())) {
      return NextResponse.json(
        { error: "Reviewer address does not match your account" },
        { status: 403 }
      );
    }

    // Validate rating
    if (rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "Rating must be between 1 and 5" },
        { status: 400 }
      );
    }

    const db = await getDB();

    // Check if agent exists
    const agent = await db
      .prepare("SELECT id FROM agents WHERE id = ?")
      .bind(agentId)
      .first();

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Check if reviewer has already submitted feedback for this agent
    const existingFeedback = await db
      .prepare("SELECT id FROM feedback WHERE agent_id = ? AND reviewer_address = ?")
      .bind(agentId, reviewerAddress.toLowerCase())
      .first();

    if (existingFeedback) {
      return NextResponse.json(
        { error: "You have already submitted feedback for this agent" },
        { status: 409 }
      );
    }

    // Generate comment hash for on-chain storage
    const commentHash = comment ? hashComment(comment) : null;

    // Insert feedback
    const id = crypto.randomUUID();
    await db
      .prepare(
        `INSERT INTO feedback (id, agent_id, reviewer_address, rating, comment, comment_hash, transaction_hash, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        agentId,
        reviewerAddress.toLowerCase(),
        rating,
        comment || null,
        commentHash,
        transactionHash || null,
        new Date().toISOString()
      )
      .run();

    return NextResponse.json({
      id,
      agentId,
      reviewerAddress: reviewerAddress.toLowerCase(),
      rating,
      comment,
      commentHash,
      transactionHash,
      message: "Feedback submitted successfully",
    });
  } catch (error) {
    console.error("Failed to submit feedback:", error);
    return NextResponse.json(
      { error: "Failed to submit feedback" },
      { status: 500 }
    );
  }
}
