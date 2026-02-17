import { z } from 'zod';

export const AgentCategorySchema = z.enum(['customer-facing', 'productivity']);

export const AgentTypeSchema = z.enum([
  'qr-menu',
  'retail',
  'support',
  'prd-generator',
  'sales-proposal',
  'postmortem',
  'roadmap',
  'sop-generator',
  'opinion-research',
]);

export const TrustLevelSchema = z.enum(['unverified', 'basic', 'verified', 'premium']);

export const PricingModelSchema = z.object({
  type: z.enum(['free', 'per-query', 'subscription', 'tiered']),
  currency: z.literal('USDC'),
  pricePerQuery: z.number().min(0).optional(),
  monthlyPrice: z.number().min(0).optional(),
  freeQueries: z.number().min(0).optional(),
});

export const AgentCapabilitySchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  premium: z.boolean().optional(),
});

export const AgentIntegrationSchema = z.object({
  type: z.enum(['webhook', 'api', 'oauth']),
  name: z.string(),
  endpoint: z.string().url().optional(),
  scopes: z.array(z.string()).optional(),
});

export const AgentMetadataSchema = z.object({
  version: z.string(),
  ipfsHash: z.string().optional(),
  tags: z.array(z.string()),
  languages: z.array(z.string()),
  integrations: z.array(AgentIntegrationSchema).optional(),
});

export const AgentSchema = z.object({
  id: z.string().uuid(),
  nftTokenId: z.string(),
  chainId: z.number(),
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(1000),
  category: AgentCategorySchema,
  type: AgentTypeSchema,
  capabilities: z.array(AgentCapabilitySchema),
  agentWallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  pricingModel: PricingModelSchema,
  ownerId: z.string(),
  systemPrompt: z.string().min(1).max(10000),
  welcomeMessage: z.string().min(1).max(1000),
  icon: z.string(),
  metadata: AgentMetadataSchema,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const CreateAgentInputSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(1000),
  category: AgentCategorySchema,
  type: AgentTypeSchema,
  capabilities: z.array(AgentCapabilitySchema.omit({ id: true })),
  pricingModel: PricingModelSchema,
  systemPrompt: z.string().min(1).max(10000),
  welcomeMessage: z.string().min(1).max(1000),
  icon: z.string(),
  tags: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
});

export const UpdateAgentInputSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().min(1).max(1000).optional(),
  capabilities: z.array(AgentCapabilitySchema.omit({ id: true })).optional(),
  pricingModel: PricingModelSchema.optional(),
  systemPrompt: z.string().min(1).max(10000).optional(),
  welcomeMessage: z.string().min(1).max(1000).optional(),
  icon: z.string().optional(),
  metadata: AgentMetadataSchema.partial().optional(),
});

export type AgentSchemaType = z.infer<typeof AgentSchema>;
export type CreateAgentInputSchemaType = z.infer<typeof CreateAgentInputSchema>;
export type UpdateAgentInputSchemaType = z.infer<typeof UpdateAgentInputSchema>;
