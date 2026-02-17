import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { SessionDO, type Env } from './durable-objects/SessionDO';

// Re-export Durable Object class
export { SessionDO };

// Create Hono app
const app = new Hono<{ Bindings: Env }>();

// Middleware
app.use('*', logger());
app.use(
  '*',
  cors({
    origin: '*', // Configure for production
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Session-Token', 'X-Payment-Id', 'X-Payment-Payer', 'X-Payment-Tx'],
  })
);

// Health check
app.get('/', (c) => {
  return c.json({
    name: 'Straits Agents API',
    version: '0.1.0',
    status: 'healthy',
  });
});

// Session routes
app.post('/api/sessions', async (c) => {
  const { agentId, userId } = await c.req.json<{ agentId: string; userId?: string }>();

  if (!agentId) {
    return c.json({ error: 'agentId is required' }, 400);
  }

  // Create a new Durable Object for this session
  const sessionId = crypto.randomUUID();
  const doId = c.env.SESSION_DO.idFromName(sessionId);
  const stub = c.env.SESSION_DO.get(doId);

  // Initialize the session
  const response = await stub.fetch(new Request('http://session/init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId, userId }),
  }));

  const result = await response.json();
  return c.json(result, response.status as 200);
});

app.get('/api/sessions/:sessionId', async (c) => {
  const sessionId = c.req.param('sessionId');
  const doId = c.env.SESSION_DO.idFromName(sessionId);
  const stub = c.env.SESSION_DO.get(doId);

  const response = await stub.fetch(new Request('http://session/session'));
  const result = await response.json();
  return c.json(result, response.status as 200);
});

app.delete('/api/sessions/:sessionId', async (c) => {
  const sessionId = c.req.param('sessionId');
  const doId = c.env.SESSION_DO.idFromName(sessionId);
  const stub = c.env.SESSION_DO.get(doId);

  const response = await stub.fetch(new Request('http://session/session', { method: 'DELETE' }));
  const result = await response.json();
  return c.json(result, response.status as 200);
});

// Message routes
app.post('/api/sessions/:sessionId/messages', async (c) => {
  const sessionId = c.req.param('sessionId');
  const body = await c.req.json();

  const doId = c.env.SESSION_DO.idFromName(sessionId);
  const stub = c.env.SESSION_DO.get(doId);

  const response = await stub.fetch(new Request('http://session/message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }));

  const result = await response.json();
  return c.json(result, response.status as 200);
});

app.get('/api/sessions/:sessionId/messages', async (c) => {
  const sessionId = c.req.param('sessionId');
  const doId = c.env.SESSION_DO.idFromName(sessionId);
  const stub = c.env.SESSION_DO.get(doId);

  const response = await stub.fetch(new Request('http://session/messages'));
  const result = await response.json();
  return c.json(result, response.status as 200);
});

// Artifact routes
app.post('/api/sessions/:sessionId/artifact', async (c) => {
  const sessionId = c.req.param('sessionId');
  const body = await c.req.json();

  const doId = c.env.SESSION_DO.idFromName(sessionId);
  const stub = c.env.SESSION_DO.get(doId);

  const response = await stub.fetch(new Request('http://session/artifact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }));

  const result = await response.json();
  return c.json(result, response.status as 200);
});

// Agent routes (placeholder - would query D1)
app.get('/api/agents', async (c) => {
  // Placeholder - return demo agents
  const agents = [
    {
      id: 'qr-menu',
      name: 'QR Menu Assistant',
      description: 'Restaurant dining assistant',
      category: 'customer-facing',
      type: 'qr-menu',
      icon: '🍽️',
    },
    {
      id: 'retail',
      name: 'Retail Assistant',
      description: 'Product discovery and shopping',
      category: 'customer-facing',
      type: 'retail',
      icon: '🛒',
    },
    {
      id: 'prd-generator',
      name: 'PRD Generator',
      description: 'Create product requirements documents',
      category: 'productivity',
      type: 'prd-generator',
      icon: '📋',
    },
  ];

  return c.json({ agents });
});

app.get('/api/agents/:agentId', async (c) => {
  const agentId = c.req.param('agentId');

  // Placeholder - return demo agent
  const agents: Record<string, object> = {
    'qr-menu': {
      id: 'qr-menu',
      name: 'QR Menu Assistant',
      description: 'Restaurant dining assistant for menu Q&A and order assistance',
      category: 'customer-facing',
      type: 'qr-menu',
      icon: '🍽️',
      pricingModel: { type: 'per-query', currency: 'USDC', pricePerQuery: 1, freeQueries: 5 },
    },
    retail: {
      id: 'retail',
      name: 'Retail Assistant',
      description: 'Product discovery, recommendations, and cart actions',
      category: 'customer-facing',
      type: 'retail',
      icon: '🛒',
      pricingModel: { type: 'per-query', currency: 'USDC', pricePerQuery: 1, freeQueries: 5 },
    },
    'prd-generator': {
      id: 'prd-generator',
      name: 'PRD Generator',
      description: 'Transform feedback into product requirements documents',
      category: 'productivity',
      type: 'prd-generator',
      icon: '📋',
      pricingModel: { type: 'per-query', currency: 'USDC', pricePerQuery: 10, freeQueries: 1 },
    },
  };

  const agent = agents[agentId];
  if (!agent) {
    return c.json({ error: 'Agent not found' }, 404);
  }

  return c.json(agent);
});

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ error: 'Internal Server Error', message: err.message }, 500);
});

export default app;
