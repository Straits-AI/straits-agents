import { z } from 'zod';

export const SupportedChainSchema = z.enum(['base', 'polygon', 'base-sepolia', 'polygon-amoy']);

export const EthereumAddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/);

export const ContractAddressesSchema = z.object({
  identityRegistry: EthereumAddressSchema,
  reputationRegistry: EthereumAddressSchema,
  validationRegistry: EthereumAddressSchema,
  usdcToken: EthereumAddressSchema,
});

export const ChainConfigSchema = z.object({
  chainId: z.number(),
  name: z.string(),
  rpcUrl: z.string().url(),
  explorerUrl: z.string().url(),
  contracts: ContractAddressesSchema,
  nativeCurrency: z.object({
    name: z.string(),
    symbol: z.string(),
    decimals: z.number(),
  }),
  isTestnet: z.boolean(),
});

// ERC-8004 Schemas

export const AgentIdentitySchema = z.object({
  tokenId: z.string(),
  owner: EthereumAddressSchema,
  agentWallet: EthereumAddressSchema,
  metadataUri: z.string(),
  chainId: z.number(),
  registeredAt: z.coerce.date(),
  isActive: z.boolean(),
});

export const ReputationBreakdownSchema = z.object({
  accuracy: z.number().min(0).max(100),
  helpfulness: z.number().min(0).max(100),
  speed: z.number().min(0).max(100),
  safety: z.number().min(0).max(100),
});

export const ReputationScoreSchema = z.object({
  agentId: z.string(),
  overallScore: z.number().min(0).max(100),
  totalReviews: z.number().min(0),
  breakdown: ReputationBreakdownSchema,
  lastUpdated: z.coerce.date(),
});

export const FeedbackEntrySchema = z.object({
  id: z.string(),
  agentId: z.string(),
  reviewer: EthereumAddressSchema,
  rating: z.number().min(1).max(5),
  comment: z.string().optional(),
  transactionHash: z.string(),
  createdAt: z.coerce.date(),
});

export const ValidationTypeSchema = z.enum(['identity', 'capability', 'security', 'compliance']);

export const ValidationRecordSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  validator: EthereumAddressSchema,
  validationType: ValidationTypeSchema,
  status: z.enum(['pending', 'approved', 'rejected']),
  evidence: z.string().optional(),
  transactionHash: z.string().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

// x402 Payment Schemas

export const X402PaymentRequestSchema = z.object({
  paymentId: z.string(),
  payeeAddress: EthereumAddressSchema,
  amount: z.number().min(0),
  currency: z.literal('USDC'),
  chainId: z.number(),
  description: z.string(),
  expiresAt: z.coerce.date(),
  callbackUrl: z.string().url().optional(),
});

export const X402PaymentReceiptSchema = z.object({
  paymentId: z.string(),
  payerAddress: EthereumAddressSchema,
  payeeAddress: EthereumAddressSchema,
  amount: z.number().min(0),
  currency: z.literal('USDC'),
  chainId: z.number(),
  transactionHash: z.string(),
  blockNumber: z.number(),
  timestamp: z.coerce.date(),
});

export const TransactionStatusSchema = z.enum([
  'pending',
  'verified',
  'settled',
  'failed',
  'refunded',
]);

export const TransactionSchema = z.object({
  id: z.string(),
  x402PaymentId: z.string(),
  payerAddress: EthereumAddressSchema,
  payeeAddress: EthereumAddressSchema,
  amount: z.number().min(0),
  currency: z.literal('USDC'),
  chainId: z.number(),
  status: TransactionStatusSchema,
  transactionHash: z.string().optional(),
  blockNumber: z.number().optional(),
  sessionId: z.string().optional(),
  agentId: z.string(),
  errorMessage: z.string().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type X402PaymentRequestSchemaType = z.infer<typeof X402PaymentRequestSchema>;
export type X402PaymentReceiptSchemaType = z.infer<typeof X402PaymentReceiptSchema>;
export type TransactionSchemaType = z.infer<typeof TransactionSchema>;
