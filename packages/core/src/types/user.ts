/**
 * User Types - User accounts and authentication
 */

export type AuthProvider = 'email' | 'wallet' | 'google' | 'github';

export interface User {
  id: string;
  email?: string;
  /** Primary wallet address */
  walletAddress?: string;
  /** Display name */
  name?: string;
  /** Avatar URL */
  avatarUrl?: string;
  /** Authentication providers linked */
  authProviders: AuthProvider[];
  /** User role */
  role: UserRole;
  /** API keys for developers */
  apiKeys?: ApiKey[];
  /** Usage stats */
  usage: UserUsage;
  createdAt: Date;
  updatedAt: Date;
}

export type UserRole = 'user' | 'developer' | 'admin';

export interface ApiKey {
  id: string;
  /** Hashed key (only prefix shown) */
  keyPrefix: string;
  name: string;
  /** Scopes/permissions */
  scopes: string[];
  /** Last used timestamp */
  lastUsed?: Date;
  /** Expiration date */
  expiresAt?: Date;
  createdAt: Date;
}

export interface UserUsage {
  /** Total queries made */
  totalQueries: number;
  /** Total amount spent (in cents) */
  totalSpent: number;
  /** Queries this month */
  monthlyQueries: number;
  /** Amount spent this month */
  monthlySpent: number;
  /** Last activity timestamp */
  lastActive: Date;
}

export interface CreateUserInput {
  email?: string;
  walletAddress?: string;
  name?: string;
  authProvider: AuthProvider;
}

export interface UpdateUserInput {
  name?: string;
  avatarUrl?: string;
}

export interface WalletConnection {
  address: string;
  chainId: number;
  /** Signature for verification */
  signature?: string;
  /** Message that was signed */
  message?: string;
}
