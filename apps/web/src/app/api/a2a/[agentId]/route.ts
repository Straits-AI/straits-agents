/**
 * A2A JSON-RPC Endpoint
 * Implements the Google A2A protocol's JSON-RPC 2.0 methods:
 * - tasks/send: Send a message to the agent (creates a session, runs chat pipeline)
 * - tasks/get: Check task status
 * - tasks/cancel: Cancel a running task
 */

import { getDB } from "@/lib/db";
import { executeChatPipeline } from "@/lib/chat-engine";
import { NextResponse } from "next/server";
import type { Message } from "ai";

// ─── Types ──────────────────────────────────────────────────────────────────

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params: Record<string, unknown>;
}

interface A2AMessage {
  role: "user" | "assistant";
  parts: Array<{ type: "text"; text: string }>;
}

interface TaskSendParams {
  message: A2AMessage;
  taskId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

interface TaskGetParams {
  taskId: string;
}

// ─── Main Handler ───────────────────────────────────────────────────────────

export async function POST(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params;

    // Parse JSON-RPC request
    let rpcRequest: JsonRpcRequest;
    try {
      rpcRequest = await request.json();
    } catch {
      return jsonRpcError(null, -32700, "Parse error");
    }

    if (rpcRequest.jsonrpc !== "2.0" || !rpcRequest.method) {
      return jsonRpcError(rpcRequest.id, -32600, "Invalid Request");
    }

    // Resolve agent
    const db = await getDB();
    const agent = await db
      .prepare("SELECT id, name FROM agents WHERE (id = ? OR slug = ?) AND is_active = 1")
      .bind(agentId, agentId)
      .first<{ id: string; name: string }>();

    if (!agent) {
      return jsonRpcError(rpcRequest.id, -32001, "Agent not found");
    }

    // Route to handler
    switch (rpcRequest.method) {
      case "tasks/send":
        return handleTasksSend(rpcRequest, agent.id);
      case "tasks/get":
        return handleTasksGet(rpcRequest, agent.id);
      case "tasks/cancel":
        return handleTasksCancel(rpcRequest, agent.id);
      default:
        return jsonRpcError(rpcRequest.id, -32601, `Method not found: ${rpcRequest.method}`);
    }
  } catch (error) {
    console.error("A2A endpoint error:", error);
    return jsonRpcError(null, -32603, "Internal error");
  }
}

// ─── tasks/send ─────────────────────────────────────────────────────────────

async function handleTasksSend(rpc: JsonRpcRequest, resolvedAgentId: string) {
  const params = rpc.params as unknown as TaskSendParams;

  if (!params.message || !params.message.parts) {
    return jsonRpcError(rpc.id, -32602, "Missing message with parts");
  }

  // Extract text from parts
  const textParts = params.message.parts.filter((p) => p.type === "text");
  const messageContent = textParts.map((p) => p.text).join("\n");

  if (!messageContent) {
    return jsonRpcError(rpc.id, -32602, "No text content in message");
  }

  const taskId = params.taskId || crypto.randomUUID();
  const sessionId = params.sessionId || crypto.randomUUID();

  // Build messages for pipeline
  const messages: Message[] = [
    { id: `a2a-${taskId}`, role: "user", content: messageContent },
  ];

  // Extract caller metadata
  const callDepth = typeof params.metadata?.callDepth === "number" ? params.metadata.callDepth : 0;
  const callChain = Array.isArray(params.metadata?.callChain) ? params.metadata.callChain as string[] : [];

  try {
    // Execute chat pipeline (non-streaming for A2A)
    const result = await executeChatPipeline({
      agentId: resolvedAgentId,
      messages,
      sessionId,
      userId: null, // A2A calls are agent-to-agent, no human user
      callDepth: callDepth + 1,
      callChain,
      useRag: true,
      stream: false,
    });

    const responseText = result.text || "";

    // Build A2A response
    return NextResponse.json({
      jsonrpc: "2.0",
      id: rpc.id,
      result: {
        taskId,
        sessionId,
        status: { state: "completed" },
        artifacts: [
          {
            parts: [{ type: "text", text: responseText }],
          },
        ],
        ...(result.citations.length > 0 && {
          metadata: {
            citations: result.citations.map((c) => ({
              title: c.title,
              excerpt: c.content.slice(0, 200),
              score: c.score,
            })),
          },
        }),
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Pipeline error";
    console.error("A2A tasks/send error:", msg);

    return NextResponse.json({
      jsonrpc: "2.0",
      id: rpc.id,
      result: {
        taskId,
        sessionId,
        status: {
          state: "failed",
          message: { role: "agent", parts: [{ type: "text", text: msg }] },
        },
      },
    });
  }
}

// ─── tasks/get ──────────────────────────────────────────────────────────────

async function handleTasksGet(rpc: JsonRpcRequest, resolvedAgentId: string) {
  const params = rpc.params as unknown as TaskGetParams;

  if (!params.taskId) {
    return jsonRpcError(rpc.id, -32602, "Missing taskId");
  }

  // For now, tasks are synchronous — they complete immediately.
  // In the future, this could query a task store for async operations.
  return NextResponse.json({
    jsonrpc: "2.0",
    id: rpc.id,
    result: {
      taskId: params.taskId,
      status: { state: "completed" },
    },
  });
}

// ─── tasks/cancel ───────────────────────────────────────────────────────────

async function handleTasksCancel(rpc: JsonRpcRequest, resolvedAgentId: string) {
  return NextResponse.json({
    jsonrpc: "2.0",
    id: rpc.id,
    result: {
      status: { state: "canceled" },
    },
  });
}

// ─── JSON-RPC Error Helper ──────────────────────────────────────────────────

function jsonRpcError(id: string | number | null, code: number, message: string) {
  return NextResponse.json(
    {
      jsonrpc: "2.0",
      id: id ?? null,
      error: { code, message },
    },
    { status: code === -32700 || code === -32600 ? 400 : 200 }
  );
}
