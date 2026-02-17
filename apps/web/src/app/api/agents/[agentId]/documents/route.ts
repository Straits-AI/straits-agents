import { NextResponse } from "next/server";
import { storeDocument, getAgentDocuments, deleteDocument } from "@/lib/rag";
import { getSession } from "@/lib/auth";
import { getDB } from "@/lib/db";

// Get all documents for an agent (owner only)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params;
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify ownership
    const db = await getDB();
    const agent = await db
      .prepare("SELECT id, owner_id FROM agents WHERE (id = ? OR slug = ?)")
      .bind(agentId, agentId)
      .first<{ id: string; owner_id: string }>();

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    if (agent.owner_id !== "system" && agent.owner_id !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const documents = await getAgentDocuments(agent.id);
    return NextResponse.json({ documents });
  } catch (error) {
    console.error("Failed to fetch documents:", error);
    return NextResponse.json(
      { error: "Failed to fetch documents" },
      { status: 500 }
    );
  }
}

// Upload a new document (owner only)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params;
    const session = await getSession();

    // Require authentication
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if agent exists
    const db = await getDB();
    const agent = await db
      .prepare("SELECT id, owner_id FROM agents WHERE (id = ? OR slug = ?)")
      .bind(agentId, agentId)
      .first<{ id: string; owner_id: string }>();

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Check ownership (only owner can upload documents)
    if (agent.owner_id !== "system" && agent.owner_id !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { title, content, contentType, sourceUrl, metadata } = await request.json();

    if (!title || !content) {
      return NextResponse.json(
        { error: "title and content are required" },
        { status: 400 }
      );
    }

    const result = await storeDocument({
      id: crypto.randomUUID(),
      agentId: agent.id,
      title,
      content,
      contentType,
      sourceUrl,
      metadata,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to store document:", error);
    return NextResponse.json(
      { error: "Failed to store document" },
      { status: 500 }
    );
  }
}

// Delete a document (owner only)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params;
    const url = new URL(request.url);
    const documentId = url.searchParams.get("documentId");

    if (!documentId) {
      return NextResponse.json(
        { error: "documentId is required" },
        { status: 400 }
      );
    }

    const session = await getSession();

    // Require authentication
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check ownership
    const db = await getDB();
    const agent = await db
      .prepare("SELECT id, owner_id FROM agents WHERE (id = ? OR slug = ?)")
      .bind(agentId, agentId)
      .first<{ id: string; owner_id: string }>();

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    if (agent.owner_id !== "system" && agent.owner_id !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await deleteDocument(documentId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete document:", error);
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 }
    );
  }
}
