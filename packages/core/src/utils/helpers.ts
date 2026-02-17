import { v4 as uuidv4 } from 'uuid';
import type { Message, SessionMemory } from '../types';

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return uuidv4();
}

/**
 * Generate a session token
 */
export function generateSessionToken(): string {
  return `sess_${generateId().replace(/-/g, '')}`;
}

/**
 * Truncate text to a maximum length
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Format USDC amount from cents to display string
 */
export function formatUSDC(cents: number): string {
  return `$${(cents / 100).toFixed(2)} USDC`;
}

/**
 * Parse USDC amount from string to cents
 */
export function parseUSDC(amount: string): number {
  const cleaned = amount.replace(/[^0-9.]/g, '');
  return Math.round(parseFloat(cleaned) * 100);
}

/**
 * Calculate token count estimate (rough approximation)
 */
export function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token for English
  return Math.ceil(text.length / 4);
}

/**
 * Create an empty session memory
 */
export function createEmptyMemory(): SessionMemory {
  return {
    shortTerm: [],
    facts: [],
    preferences: {},
  };
}

/**
 * Add a message to session memory with overflow handling
 */
export function addMessageToMemory(
  memory: SessionMemory,
  message: Message,
  maxMessages: number = 20
): SessionMemory {
  const newShortTerm = [...memory.shortTerm, message];

  // If exceeding max, move older messages to summary
  if (newShortTerm.length > maxMessages) {
    const toSummarize = newShortTerm.slice(0, newShortTerm.length - maxMessages);
    const remaining = newShortTerm.slice(-maxMessages);

    // Simple summary: just extract key points
    const summaryAddition = toSummarize
      .filter((m) => m.role !== 'system')
      .map((m) => `${m.role}: ${truncateText(m.content, 100)}`)
      .join('\n');

    const existingSummary = memory.summary || '';
    const newSummary = existingSummary
      ? `${existingSummary}\n---\n${summaryAddition}`
      : summaryAddition;

    return {
      ...memory,
      shortTerm: remaining,
      summary: truncateText(newSummary, 2000),
    };
  }

  return {
    ...memory,
    shortTerm: newShortTerm,
  };
}

/**
 * Check if an Ethereum address is valid
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Shorten an Ethereum address for display
 */
export function shortenAddress(address: string, chars: number = 4): string {
  if (!isValidAddress(address)) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

/**
 * Get chain name from chain ID
 */
export function getChainName(chainId: number): string {
  const chains: Record<number, string> = {
    8453: 'Base',
    84532: 'Base Sepolia',
    137: 'Polygon',
    80002: 'Polygon Amoy',
  };
  return chains[chainId] || `Chain ${chainId}`;
}

/**
 * Check if a chain is a testnet
 */
export function isTestnet(chainId: number): boolean {
  const testnets = [84532, 80002];
  return testnets.includes(chainId);
}

/**
 * Sleep utility for async operations
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry an async function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: { maxRetries?: number; baseDelay?: number; maxDelay?: number } = {}
): Promise<T> {
  const { maxRetries = 3, baseDelay = 1000, maxDelay = 10000 } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries - 1) {
        const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}
