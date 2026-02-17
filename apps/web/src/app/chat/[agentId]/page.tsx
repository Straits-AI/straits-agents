"use client";

import { useChat, Message } from "ai/react";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useX402Payment, X402PaymentRequired } from "@/hooks/useX402Payment";
import { PaymentDialog } from "@/components/PaymentDialog";
import { FeedbackDialog } from "@/components/FeedbackDialog";
import { MemoryBadge } from "@/components/MemoryBadge";
import { MemoryPanel } from "@/components/MemoryPanel";

interface Agent {
  id: string;
  name: string;
  description: string;
  icon: string;
  systemPrompt: string;
  welcomeMessage: string;
  pricingModel: {
    type: string;
    pricePerQuery: number;
    freeQueries: number;
  };
}

// Session storage key
const getSessionStorageKey = (agentId: string) => `straits_session_${agentId}`;

export default function ChatPage() {
  const params = useParams();
  const agentId = params.agentId as string;

  const [agent, setAgent] = useState<Agent | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [queriesUsed, setQueriesUsed] = useState(0);
  const [restoredMessages, setRestoredMessages] = useState<Message[]>([]);
  const [sessionReady, setSessionReady] = useState(false);

  // Payment state
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentRequired, setPaymentRequired] = useState<X402PaymentRequired | null>(null);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const {
    paymentState,
    executePayment,
    resetPaymentState,
  } = useX402Payment();

  // Feedback state
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);

  // Memory state
  const [showMemoryPanel, setShowMemoryPanel] = useState(false);
  const [memoryCount, setMemoryCount] = useState(0);
  const [memories, setMemories] = useState<Array<{
    id: string;
    memoryType: string;
    priority: string;
    content: string;
    observedAt: string;
    accessCount: number;
  }>>([]);

  // Fetch agent data
  useEffect(() => {
    async function fetchAgent() {
      try {
        const res = await fetch(`/api/agents/${agentId}`);
        if (!res.ok) throw new Error("Agent not found");
        const data = await res.json();
        setAgent(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load agent");
      } finally {
        setLoading(false);
      }
    }
    fetchAgent();
  }, [agentId]);

  // Restore or create session
  useEffect(() => {
    async function initSession() {
      if (!agent) return;

      const storageKey = getSessionStorageKey(agentId);
      const storedSessionId = localStorage.getItem(storageKey);

      // Try to restore existing session
      if (storedSessionId) {
        try {
          // Fetch existing messages
          const messagesRes = await fetch(`/api/sessions/${storedSessionId}/messages`);
          if (messagesRes.ok) {
            const { messages } = await messagesRes.json();

            // Session is valid, restore it
            setSessionId(storedSessionId);

            // Convert to Message format with welcome message
            const restored: Message[] = [
              { id: "welcome", role: "assistant", content: agent.welcomeMessage },
            ];

            messages.forEach((msg: { id: string; role: string; content: string }) => {
              restored.push({
                id: msg.id,
                role: msg.role as "user" | "assistant",
                content: msg.content,
              });
            });

            setRestoredMessages(restored);
            setQueriesUsed(messages.filter((m: { role: string }) => m.role === "user").length);
            setSessionReady(true);
            return;
          }
        } catch (err) {
          console.error("Failed to restore session:", err);
          // Session invalid, remove from storage
          localStorage.removeItem(storageKey);
        }
      }

      // Create new session
      try {
        const res = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentId }),
        });
        if (res.ok) {
          const data = await res.json();
          setSessionId(data.sessionId);
          localStorage.setItem(storageKey, data.sessionId);
          setRestoredMessages([
            { id: "welcome", role: "assistant", content: agent.welcomeMessage },
          ]);
          setSessionReady(true);
        }
      } catch (err) {
        console.error("Failed to create session:", err);
      }
    }
    initSession();
  }, [agent, agentId]);

  // Fetch memory count on page load
  const fetchMemories = useCallback(async () => {
    try {
      const res = await fetch(`/api/memory?agentId=${agentId}`);
      if (res.ok) {
        const data = await res.json();
        setMemoryCount(data.count || 0);
        setMemories(data.memories || []);
      }
    } catch {
      // Not authenticated or memories not available — ignore
    }
  }, [agentId]);

  useEffect(() => {
    if (sessionReady) {
      fetchMemories();
    }
  }, [sessionReady, fetchMemories]);

  const handleDeleteMemory = async (memoryId: string) => {
    try {
      const res = await fetch(`/api/memory/${memoryId}`, { method: "DELETE" });
      if (res.ok) {
        setMemories((prev) => prev.filter((m) => m.id !== memoryId));
        setMemoryCount((prev) => Math.max(0, prev - 1));
      }
    } catch {
      console.error("Failed to delete memory");
    }
  };

  const handleClearAllMemories = async () => {
    try {
      const res = await fetch(`/api/memory?agentId=${agentId}`, { method: "DELETE" });
      if (res.ok) {
        setMemories([]);
        setMemoryCount(0);
        setShowMemoryPanel(false);
      }
    } catch {
      console.error("Failed to clear memories");
    }
  };

  const initialMessages: Message[] = restoredMessages.length > 0
    ? restoredMessages
    : (agent ? [{ id: "welcome", role: "assistant", content: agent.welcomeMessage }] : []);

  // Custom fetch to handle 402 responses
  const customFetch = useCallback(async (url: string | URL | Request, options?: RequestInit) => {
    const response = await fetch(url, options);

    if (response.status === 402) {
      const paymentData = await response.json();

      // Distinguish x402 payment required (has paymentDetails) from insufficient balance (has error)
      if (paymentData.paymentDetails) {
        setPaymentRequired(paymentData);
        setShowPaymentDialog(true);
        // Store the message that was being sent
        if (options?.body) {
          const body = JSON.parse(options.body as string);
          const lastMessage = body.messages?.[body.messages.length - 1];
          if (lastMessage?.role === "user") {
            setPendingMessage(lastMessage.content);
          }
        }
      } else {
        // Insufficient creator balance — show as regular error
        setError(paymentData.error || "Service temporarily unavailable");
      }
      throw new Error("Payment required");
    }

    return response;
  }, []);

  const { messages, input, handleInputChange, handleSubmit, isLoading, append } = useChat({
    api: "/api/chat",
    body: { agentId, sessionId },
    initialMessages,
    fetch: customFetch,
    onFinish: useCallback(async (message: Message) => {
      // Save assistant message to session
      if (sessionId) {
        try {
          await fetch(`/api/sessions/${sessionId}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ role: "assistant", content: message.content }),
          });
        } catch (err) {
          console.error("Failed to save message:", err);
        }
      }
    }, [sessionId]),
    onError: useCallback((error: Error) => {
      // Don't show error for payment required
      if (error.message !== "Payment required") {
        console.error("Chat error:", error);
      }
    }, []),
  });

  // Save user messages to session
  const handleSubmitWithSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    // Save user message
    if (sessionId) {
      try {
        const res = await fetch(`/api/sessions/${sessionId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "user", content: input }),
        });
        if (res.ok) {
          const data = await res.json();
          setQueriesUsed(data.queriesUsed);
        }
      } catch (err) {
        console.error("Failed to save message:", err);
      }
    }

    handleSubmit(e);
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle payment completion
  const handlePayment = async () => {
    if (!paymentRequired || !sessionId) return;

    const result = await executePayment(paymentRequired, sessionId, agentId);

    if (result.success) {
      setShowPaymentDialog(false);
      setPaymentRequired(null);

      // Retry the pending message after successful payment
      if (pendingMessage) {
        append({
          role: "user",
          content: pendingMessage,
        });
        setPendingMessage(null);
      }

      resetPaymentState();
    }
  };

  const handleCancelPayment = () => {
    setShowPaymentDialog(false);
    setPaymentRequired(null);
    setPendingMessage(null);
    resetPaymentState();
  };

  if (loading || !sessionReady) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p className="text-red-600">{error || "Agent not found"}</p>
        <Link href="/" className="text-primary-600 hover:underline">
          Back to home
        </Link>
      </div>
    );
  }

  const freeQueriesLeft = Math.max(0, agent.pricingModel.freeQueries - queriesUsed);

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-950">
      {/* Payment Dialog */}
      <PaymentDialog
        isOpen={showPaymentDialog}
        paymentRequired={paymentRequired}
        onPay={handlePayment}
        onCancel={handleCancelPayment}
        isProcessing={paymentState.isProcessing}
        error={paymentState.error}
      />

      {/* Feedback Dialog */}
      <FeedbackDialog
        isOpen={showFeedbackDialog}
        agentId={agentId}
        agentName={agent.name}
        onClose={() => setShowFeedbackDialog(false)}
        onSubmitSuccess={() => setShowFeedbackDialog(false)}
      />

      {/* Memory Panel */}
      <MemoryPanel
        isOpen={showMemoryPanel}
        onClose={() => setShowMemoryPanel(false)}
        agentId={agentId}
        agentName={agent.name}
        memories={memories}
        onDelete={handleDeleteMemory}
        onClearAll={handleClearAllMemories}
      />

      <header className="border-b bg-white dark:bg-gray-900 px-4 py-3 flex items-center gap-4">
        <Link href="/" className="text-gray-600 dark:text-gray-400 hover:text-gray-900">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </Link>
        <span className="text-2xl">{agent.icon}</span>
        <div className="flex-1">
          <h1 className="font-semibold">{agent.name}</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">Powered by Straits Agents</p>
        </div>
        {agent.pricingModel.type !== "free" && (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {freeQueriesLeft > 0
              ? `${freeQueriesLeft} free queries left`
              : `$${agent.pricingModel.pricePerQuery / 100}/query`}
          </div>
        )}
        <MemoryBadge
          memoryCount={memoryCount}
          onClick={() => setShowMemoryPanel(true)}
        />
        <button
          onClick={() => setShowFeedbackDialog(true)}
          className="text-gray-600 dark:text-gray-400 hover:text-gray-900 p-2 rounded-lg hover:bg-gray-100 dark:bg-gray-800"
          title="Rate this agent"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                message.role === "user"
                  ? "bg-primary-600 text-white"
                  : "bg-white dark:bg-gray-900 border shadow-sm"
              }`}
            >
              {/* Tool invocations */}
              {message.toolInvocations && message.toolInvocations.length > 0 && (
                <div className="mb-2 space-y-1">
                  {message.toolInvocations.map((invocation, idx) => (
                    <ToolInvocationIndicator key={idx} invocation={invocation} />
                  ))}
                </div>
              )}
              <div className="whitespace-pre-wrap">{message.content}</div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-gray-900 border shadow-sm rounded-2xl px-4 py-3 flex gap-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full typing-dot" />
              <div className="w-2 h-2 bg-gray-400 rounded-full typing-dot" />
              <div className="w-2 h-2 bg-gray-400 rounded-full typing-dot" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t bg-white dark:bg-gray-900 p-4">
        <form onSubmit={handleSubmitWithSave} className="flex gap-3 max-w-4xl mx-auto">
          <input
            type="text"
            value={input}
            onChange={handleInputChange}
            placeholder="Type your message..."
            className="flex-1 rounded-xl border border-gray-300 dark:border-gray-600 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="rounded-xl bg-primary-600 px-6 py-3 text-white hover:bg-primary-700 disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Tool Invocation Indicator ──────────────────────────────────────────────

interface ToolInvocation {
  toolName: string;
  toolCallId: string;
  state: "call" | "partial-call" | "result";
  args?: Record<string, unknown>;
  result?: unknown;
}

function ToolInvocationIndicator({ invocation }: { invocation: ToolInvocation }) {
  const [expanded, setExpanded] = useState(false);

  const getLabel = () => {
    switch (invocation.toolName) {
      case "search_documents":
        return "Searched knowledge base";
      case "get_user_memory":
        return "Recalled user memory";
      case "think":
        return "Thinking...";
      case "call_agent":
        return `Consulting agent`;
      case "discover_agents":
        return "Searching marketplace";
      default:
        return `Called ${invocation.toolName}`;
    }
  };

  const getIcon = () => {
    switch (invocation.toolName) {
      case "search_documents":
        return (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        );
      case "think":
        return (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        );
      default:
        return (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        );
    }
  };

  const isLoading = invocation.state === "call" || invocation.state === "partial-call";
  const hasResult = invocation.state === "result" && !!invocation.result;

  return (
    <div className="text-xs">
      <button
        onClick={() => hasResult && setExpanded(!expanded)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-colors ${
          isLoading
            ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 animate-pulse"
            : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
        } ${hasResult ? "cursor-pointer" : "cursor-default"}`}
      >
        {getIcon()}
        <span>{getLabel()}</span>
        {invocation.toolName === "search_documents" && invocation.args?.query ? (
          <span className="text-gray-400 truncate max-w-[150px]">&ldquo;{String(invocation.args.query)}&rdquo;</span>
        ) : null}
        {hasResult && (
          <svg
            className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>
      {expanded && hasResult && (
        <div className="mt-1 px-3 py-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap max-h-40 overflow-y-auto">
          {typeof invocation.result === "string"
            ? invocation.result
            : JSON.stringify(invocation.result, null, 2)}
        </div>
      )}
    </div>
  );
}
