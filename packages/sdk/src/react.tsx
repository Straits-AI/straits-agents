/**
 * Straits Agents SDK - React Components
 */

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { StraitsAgentClient, StraitsConfig, Message, PaymentRequiredError } from "./index";

// Context
interface StraitsContextValue {
  client: StraitsAgentClient | null;
  messages: Message[];
  isLoading: boolean;
  error: Error | null;
  sendMessage: (content: string) => Promise<void>;
  resetChat: () => void;
}

const StraitsContext = createContext<StraitsContextValue | null>(null);

// Provider
interface StraitsProviderProps {
  config: StraitsConfig;
  children: React.ReactNode;
}

export function StraitsProvider({ config, children }: StraitsProviderProps) {
  const clientRef = useRef<StraitsAgentClient | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Initialize client
  useEffect(() => {
    clientRef.current = new StraitsAgentClient(config);
  }, [config.apiKey, config.agentId, config.baseUrl]);

  const sendMessage = useCallback(async (content: string) => {
    if (!clientRef.current) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      const response = await clientRef.current.chat(content);
      setMessages((prev) => [...prev, response.message]);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const resetChat = useCallback(() => {
    setMessages([]);
    setError(null);
    clientRef.current?.resetSession();
  }, []);

  return (
    <StraitsContext.Provider
      value={{
        client: clientRef.current,
        messages,
        isLoading,
        error,
        sendMessage,
        resetChat,
      }}
    >
      {children}
    </StraitsContext.Provider>
  );
}

// Hook
export function useStraitsChat() {
  const context = useContext(StraitsContext);
  if (!context) {
    throw new Error("useStraitsChat must be used within a StraitsProvider");
  }
  return context;
}

// Chat Widget Component
interface ChatWidgetProps {
  config: StraitsConfig;
  title?: string;
  placeholder?: string;
  welcomeMessage?: string;
  position?: "bottom-right" | "bottom-left";
  theme?: "light" | "dark";
  className?: string;
}

export function ChatWidget({
  config,
  title = "Chat with us",
  placeholder = "Type your message...",
  welcomeMessage,
  position = "bottom-right",
  theme = "light",
  className = "",
}: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <StraitsProvider config={config}>
      <div
        className={`straits-widget ${position} ${theme} ${className}`}
        style={{
          position: "fixed",
          [position.includes("right") ? "right" : "left"]: "20px",
          bottom: "20px",
          zIndex: 9999,
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {isOpen ? (
          <ChatWindow
            title={title}
            placeholder={placeholder}
            welcomeMessage={welcomeMessage}
            theme={theme}
            onClose={() => setIsOpen(false)}
          />
        ) : (
          <button
            onClick={() => setIsOpen(true)}
            style={{
              width: "60px",
              height: "60px",
              borderRadius: "50%",
              border: "none",
              background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
              color: "white",
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "transform 0.2s",
            }}
            onMouseOver={(e) => (e.currentTarget.style.transform = "scale(1.1)")}
            onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
            </svg>
          </button>
        )}
      </div>
    </StraitsProvider>
  );
}

// Internal Chat Window
function ChatWindow({
  title,
  placeholder,
  welcomeMessage,
  theme,
  onClose,
}: {
  title: string;
  placeholder: string;
  welcomeMessage?: string;
  theme: "light" | "dark";
  onClose: () => void;
}) {
  const { messages, isLoading, sendMessage } = useStraitsChat();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const message = input;
    setInput("");
    await sendMessage(message);
  };

  const isDark = theme === "dark";
  const bgColor = isDark ? "#1f2937" : "white";
  const textColor = isDark ? "white" : "#1f2937";
  const borderColor = isDark ? "#374151" : "#e5e7eb";

  return (
    <div
      style={{
        width: "380px",
        height: "600px",
        borderRadius: "16px",
        boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: bgColor,
        color: textColor,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 20px",
          background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
          color: "white",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>{title}</h3>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "white",
            cursor: "pointer",
            padding: "4px",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        {welcomeMessage && messages.length === 0 && (
          <div
            style={{
              padding: "12px 16px",
              background: isDark ? "#374151" : "#f3f4f6",
              borderRadius: "12px",
              maxWidth: "85%",
            }}
          >
            {welcomeMessage}
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "85%",
            }}
          >
            <div
              style={{
                padding: "12px 16px",
                borderRadius: "12px",
                background:
                  msg.role === "user"
                    ? "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)"
                    : isDark
                    ? "#374151"
                    : "#f3f4f6",
                color: msg.role === "user" ? "white" : textColor,
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div
            style={{
              alignSelf: "flex-start",
              padding: "12px 16px",
              background: isDark ? "#374151" : "#f3f4f6",
              borderRadius: "12px",
            }}
          >
            <div style={{ display: "flex", gap: "4px" }}>
              <span className="typing-dot" style={{ animationDelay: "0s" }}>
                •
              </span>
              <span className="typing-dot" style={{ animationDelay: "0.2s" }}>
                •
              </span>
              <span className="typing-dot" style={{ animationDelay: "0.4s" }}>
                •
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        style={{
          padding: "16px",
          borderTop: `1px solid ${borderColor}`,
          display: "flex",
          gap: "8px",
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          disabled={isLoading}
          style={{
            flex: 1,
            padding: "12px 16px",
            border: `1px solid ${borderColor}`,
            borderRadius: "8px",
            outline: "none",
            fontSize: "14px",
            background: isDark ? "#374151" : "white",
            color: textColor,
          }}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          style={{
            padding: "12px 20px",
            background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: isLoading || !input.trim() ? "not-allowed" : "pointer",
            opacity: isLoading || !input.trim() ? 0.5 : 1,
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
}

export { PaymentRequiredError };
