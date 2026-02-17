import { z } from 'zod';

export const MessageRoleSchema = z.enum(['user', 'assistant', 'system']);

export const CitationSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  title: z.string(),
  excerpt: z.string(),
  location: z.string().optional(),
  score: z.number().min(0).max(1),
});

export const ToolCallSchema = z.object({
  id: z.string(),
  name: z.string(),
  arguments: z.record(z.unknown()),
  result: z.unknown().optional(),
  status: z.enum(['pending', 'completed', 'failed']),
});

export const MessageSchema = z.object({
  id: z.string(),
  role: MessageRoleSchema,
  content: z.string(),
  citations: z.array(CitationSchema).optional(),
  toolCalls: z.array(ToolCallSchema).optional(),
  createdAt: z.coerce.date(),
  tokenCount: z.number().optional(),
});

export const SessionMemorySchema = z.object({
  shortTerm: z.array(MessageSchema),
  summary: z.string().optional(),
  facts: z.array(z.string()),
  preferences: z.record(z.unknown()),
});

export const ArtifactTypeSchema = z.enum([
  'prd',
  'proposal',
  'postmortem',
  'roadmap',
  'sop',
  'stance-map',
  'order',
  'ticket',
]);

export const GeneratedArtifactSchema = z.object({
  id: z.string(),
  type: ArtifactTypeSchema,
  title: z.string(),
  content: z.string(),
  format: z.enum(['markdown', 'json', 'html']),
  data: z.record(z.unknown()).optional(),
  createdAt: z.coerce.date(),
});

export const SessionStateSchema = z.object({
  currentStep: z.string().optional(),
  collectedData: z.record(z.unknown()),
  awaitingConfirmation: z.boolean().optional(),
});

export const PaymentStatusSchema = z.enum(['free', 'prepaid', 'pay-as-you-go', 'exhausted']);

export const SessionSchema = z.object({
  id: z.string().uuid(),
  agentId: z.string().uuid(),
  userId: z.string().optional(),
  sessionToken: z.string().optional(),
  messages: z.array(MessageSchema),
  memory: SessionMemorySchema,
  queriesUsed: z.number().min(0),
  generatedArtifact: GeneratedArtifactSchema.optional(),
  state: SessionStateSchema.optional(),
  paymentStatus: PaymentStatusSchema,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  expiresAt: z.coerce.date(),
});

export const CreateSessionInputSchema = z.object({
  agentId: z.string().uuid(),
  userId: z.string().optional(),
});

export const AddMessageInputSchema = z.object({
  sessionId: z.string().uuid(),
  role: MessageRoleSchema,
  content: z.string().min(1),
});

export type MessageSchemaType = z.infer<typeof MessageSchema>;
export type SessionSchemaType = z.infer<typeof SessionSchema>;
