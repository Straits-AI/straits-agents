import type { ChainConfig } from '../types';

/**
 * Supported blockchain networks
 */
export const CHAIN_CONFIGS: Record<string, ChainConfig> = {
  'arbitrum-sepolia': {
    chainId: 421614,
    name: 'Arbitrum Sepolia',
    rpcUrl: 'https://sepolia-rollup.arbitrum.io/rpc',
    explorerUrl: 'https://sepolia.arbiscan.io',
    contracts: {
      identityRegistry: '0xfc4e8b1d87aae1F1577eeFF16d607E92afCde55D',
      reputationRegistry: '0x0C998b08FF0C9c7470272c9211935692B78Cb3AF',
      validationRegistry: '0x0000000000000000000000000000000000000000',
      usdcToken: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
    },
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
    },
    isTestnet: true,
  },
};

/**
 * Default pricing for agents
 */
export const DEFAULT_PRICING = {
  FREE_QUERIES: 5,
  PRICE_PER_QUERY_CENTS: 1, // 0.01 USDC
  PREMIUM_PRICE_PER_QUERY_CENTS: 10, // 0.10 USDC
};

/**
 * Session configuration
 */
export const SESSION_CONFIG = {
  /** Maximum messages in short-term memory */
  MAX_SHORT_TERM_MESSAGES: 20,
  /** Session expiry time in hours */
  SESSION_EXPIRY_HOURS: 24,
  /** Maximum tokens per message */
  MAX_MESSAGE_TOKENS: 4000,
  /** Maximum session duration in hours */
  MAX_SESSION_DURATION_HOURS: 168, // 1 week
};

/**
 * RAG configuration
 */
export const RAG_CONFIG = {
  /** Number of chunks to retrieve */
  TOP_K: 5,
  /** Minimum similarity score */
  MIN_SIMILARITY: 0.7,
  /** Chunk size for document splitting */
  CHUNK_SIZE: 500,
  /** Overlap between chunks */
  CHUNK_OVERLAP: 50,
};

/**
 * Agent limits
 */
export const AGENT_LIMITS = {
  /** Maximum system prompt length */
  MAX_SYSTEM_PROMPT_LENGTH: 10000,
  /** Maximum welcome message length */
  MAX_WELCOME_MESSAGE_LENGTH: 1000,
  /** Maximum capabilities per agent */
  MAX_CAPABILITIES: 20,
  /** Maximum tags per agent */
  MAX_TAGS: 10,
};
