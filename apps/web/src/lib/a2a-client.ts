/**
 * A2A Protocol Client
 * Used by the call_agent builtin tool to communicate with other agents.
 * Supports both local (same platform) and remote A2A agents.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AgentCard {
  name: string;
  description?: string;
  url: string;
  version?: string;
  capabilities?: {
    streaming?: boolean;
    pushNotifications?: boolean;
  };
  skills?: Array<{
    id: string;
    name: string;
    description?: string;
    tags?: string[];
  }>;
  authentication?: {
    schemes: string[];
  };
  x402?: {
    network: string;
    chainId: number;
    asset: string;
    pricePerQuery: number;
    payee?: string;
  };
  erc8004?: {
    chainId: number;
    identityRegistry: string;
    reputationRegistry: string;
    agentId: string;
  };
}

export interface A2AResponse {
  taskId: string;
  sessionId?: string;
  status: {
    state: "completed" | "failed" | "canceled" | "working";
    message?: {
      role: string;
      parts: Array<{ type: string; text: string }>;
    };
  };
  artifacts?: Array<{
    parts: Array<{ type: string; text: string }>;
  }>;
  metadata?: Record<string, unknown>;
}

// ─── SSRF Protection ────────────────────────────────────────────────────────

const A2A_SSRF_BLOCKED_PATTERNS = [
  /^https?:\/\/localhost/i,
  /^https?:\/\/127\./,
  /^https?:\/\/0\./,
  /^https?:\/\/0+\./,
  /^https?:\/\/10\./,
  /^https?:\/\/172\.(1[6-9]|2\d|3[0-1])\./,
  /^https?:\/\/192\.168\./,
  /^https?:\/\/169\.254\./,
  /^https?:\/\/\[::1\]/,
  /^https?:\/\/\[0*:0*:0*:0*:0*:0*:0*:0*1?\]/,
  /^https?:\/\/\[::ffff:/i,
  /^https?:\/\/\[fc/i,
  /^https?:\/\/\[fd/i,
  /^https?:\/\/\[fe80/i,
  /^file:/i,
  /^ftp:/i,
  /^data:/i,
];

function isA2AUrlSafe(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    // Block non-standard ports for localhost patterns
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === "0.0.0.0" || hostname === "[::0]") return false;
    for (const pattern of A2A_SSRF_BLOCKED_PATTERNS) {
      if (pattern.test(url)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

// ─── Client Functions ───────────────────────────────────────────────────────

/**
 * Fetch and validate an Agent Card from a URL.
 */
export async function fetchAgentCard(agentUrl: string): Promise<AgentCard> {
  const cardUrl = agentUrl.endsWith("/card") ? agentUrl : `${agentUrl}/card`;

  if (!isA2AUrlSafe(cardUrl)) {
    throw new Error("Agent URL is blocked for security reasons");
  }

  const response = await fetch(cardUrl, {
    headers: { Accept: "application/json" },
    redirect: "manual", // Prevent SSRF via redirect
  });

  // Validate redirect targets
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    if (!location || !isA2AUrlSafe(new URL(location, cardUrl).href)) {
      throw new Error("Agent Card URL redirected to blocked address");
    }
    const redirectResponse = await fetch(new URL(location, cardUrl).href, {
      headers: { Accept: "application/json" },
      redirect: "error",
    });
    if (!redirectResponse.ok) {
      throw new Error(`Failed to fetch Agent Card: ${redirectResponse.status}`);
    }
    const card = await redirectResponse.json() as AgentCard;
    if (!card.name || !card.url) {
      throw new Error("Invalid Agent Card: missing name or url");
    }
    return card;
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch Agent Card from ${cardUrl}: ${response.status}`);
  }

  const card = await response.json() as AgentCard;

  if (!card.name || !card.url) {
    throw new Error("Invalid Agent Card: missing name or url");
  }

  return card;
}

/**
 * Send a message to an A2A agent via JSON-RPC.
 */
export async function sendA2AMessage(
  agentUrl: string,
  message: string,
  options?: {
    taskId?: string;
    sessionId?: string;
    callDepth?: number;
    callChain?: string[];
    paymentHeader?: string;
  }
): Promise<A2AResponse> {
  const taskId = options?.taskId || crypto.randomUUID();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (options?.paymentHeader) {
    headers["X-Payment"] = options.paymentHeader;
  }

  if (!isA2AUrlSafe(agentUrl)) {
    throw new Error("Agent URL is blocked for security reasons");
  }

  const rpcBody = JSON.stringify({
    jsonrpc: "2.0",
    id: taskId,
    method: "tasks/send",
    params: {
      taskId,
      sessionId: options?.sessionId,
      message: {
        role: "user",
        parts: [{ type: "text", text: message }],
      },
      metadata: {
        callDepth: options?.callDepth || 0,
        callChain: options?.callChain || [],
      },
    },
  });

  let response = await fetch(agentUrl, {
    method: "POST",
    headers,
    body: rpcBody,
    redirect: "manual", // Prevent SSRF via redirect
  });

  // Validate redirect targets
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    if (!location || !isA2AUrlSafe(new URL(location, agentUrl).href)) {
      throw new Error("A2A endpoint redirected to blocked address");
    }
    response = await fetch(new URL(location, agentUrl).href, {
      method: "POST",
      headers,
      body: rpcBody,
      redirect: "error",
    });
  }

  if (!response.ok) {
    throw new Error(`A2A request failed: ${response.status} ${response.statusText}`);
  }

  const rpcResponse = await response.json() as {
    jsonrpc: string;
    id: string | number;
    result?: A2AResponse;
    error?: { code: number; message: string };
  };

  if (rpcResponse.error) {
    throw new Error(`A2A error: ${rpcResponse.error.message}`);
  }

  if (!rpcResponse.result) {
    throw new Error("A2A response missing result");
  }

  return rpcResponse.result;
}

/**
 * Extract text content from an A2A response.
 */
export function extractA2AText(response: A2AResponse): string {
  if (response.status.state === "failed") {
    const failMsg = response.status.message?.parts
      ?.filter((p) => p.type === "text")
      .map((p) => p.text)
      .join("\n");
    return failMsg || "Agent call failed";
  }

  if (!response.artifacts || response.artifacts.length === 0) {
    return "No response from agent";
  }

  return response.artifacts
    .flatMap((a) => a.parts.filter((p) => p.type === "text").map((p) => p.text))
    .join("\n");
}
