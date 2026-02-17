'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useStraits } from '../context';
import type { Message } from '@straits/core';

export interface ChatWidgetProps {
  agentId: string;
  userId?: string;
  /** Initial messages to display */
  initialMessages?: Message[];
  /** Callback when a new message is sent */
  onMessage?: (message: Message) => void;
  /** Custom styles */
  className?: string;
  /** Theme */
  theme?: 'light' | 'dark';
}

/**
 * ChatWidget is an embeddable chat component for Straits Agents.
 */
export function ChatWidget({
  agentId,
  userId,
  initialMessages = [],
  onMessage,
  className = '',
  theme = 'light',
}: ChatWidgetProps) {
  const { client } = useStraits();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize session on mount
  useEffect(() => {
    const initSession = async () => {
      try {
        const session = await client.createSession({ agentId, userId });
        setSessionId(session.id);
      } catch (error) {
        console.error('Failed to create session:', error);
      }
    };

    initSession();
  }, [client, agentId, userId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !sessionId || isLoading) return;

    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: input,
      createdAt: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await client.sendMessage(sessionId, input);

      const assistantMessage: Message = {
        id: response.message.id,
        role: 'assistant',
        content: response.message.content,
        createdAt: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      onMessage?.(assistantMessage);
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const isDark = theme === 'dark';

  return (
    <div
      className={`flex flex-col h-full ${isDark ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'} ${className}`}
    >
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                message.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : isDark
                    ? 'bg-gray-700'
                    : 'bg-gray-100'
              }`}
            >
              {message.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className={`rounded-lg px-4 py-2 ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
              <span className="animate-pulse">Thinking...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            disabled={isLoading || !sessionId}
            className={`flex-1 rounded-lg px-4 py-2 border ${
              isDark
                ? 'bg-gray-800 border-gray-700 focus:border-blue-500'
                : 'bg-white border-gray-300 focus:border-blue-500'
            } focus:outline-none`}
          />
          <button
            type="submit"
            disabled={isLoading || !sessionId || !input.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
