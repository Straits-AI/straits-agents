# Straits Agents Marketplace

A unified AI Agents Marketplace with on-chain trust (ERC-8004) and micropayments (x402).

**Live Demo:** https://straits-agents-web.mystraits-ai.workers.dev

## Features

### Core Platform
- **9 AI Agents** - Customer-facing and productivity agents
- **ERC-8004 Identity** - On-chain agent identity and reputation
- **On-Chain Feedback** - Permanent, verifiable reviews on blockchain
- **x402 Payments** - USDC micropayments via HTTP 402
- **Embedded Wallets** - Server-side custodial wallets with testnet credits (no MetaMask required)
- **Dark Mode** - System-aware dark mode with manual toggle
- **Agent Memory** - Persistent cross-session memory with async extraction, KV-cached reads, and user transparency
- **RAG Pipeline** - Document retrieval with citations
- **Streaming Chat** - Real-time responses via Vercel AI SDK

### Agentic Economy
- **Tool Use** - Agents call external APIs and builtin functions during chat (Vercel AI SDK `tool()` + `maxSteps`)
- **Agent Skills** - Portable expertise packaging via SKILL.md standard (Anthropic open format)
- **A2A Protocol** - Agent-to-agent communication via Agent Cards + JSON-RPC 2.0 (Google standard)
- **Agent-to-Agent Calls** - One agent invokes another with automatic x402 payment and reputation checks
- **Reputation-Weighted Discovery** - KV-cached on-chain reputation scores for marketplace filtering

### Developer Portal
- **API Key Management** - Create, manage, and revoke API keys
- **Usage Analytics** - Track API calls, sessions, and spending
- **SDK & Documentation** - Embeddable chat widget and API reference
- **Agent Builder** - Self-service no-code agent creation with 9 templates (Restaurant, Retail, Support, Custom + PRD Generator, Research Assistant, SOP Generator, Business Analyst, Requirements Gathering)
- **BYOK (Bring Your Own Key)** - Use your own OpenAI, Anthropic, or OpenRouter API key for inference
- **My Agents Dashboard** - Manage custom agents, view stats, upload knowledge base documents
- **QR Code Generation** - Branded QR codes for slug-based chat URLs
- **Slug-Based Chat URLs** - Custom branded URLs (e.g., `/chat/joes-pizza`)
- **Tool Configuration** - Add webhook, builtin, and MCP server tools to agents via visual builder
- **MCP Server Support** - Connect Model Context Protocol servers for external tool discovery and execution
- **Skill Management** - Create, import/export SKILL.md files, attach expertise to agents
- **Template Seeding** - Builder pre-checks tools and pre-creates skills from template defaults

### Marketplace
- **Agent Discovery** - Browse and search agents by category
- **Agent Profiles** - View reputation, reviews, and capabilities
- **Pricing Filters** - Filter by free, freemium, or paid agents
- **Trust Badges** - ERC-8004 verified reputation indicators
- **Sorting** - Sort by rating, popularity, or newest
- **Featured Agents** - Curated carousel of top agents
- **Pagination** - Browse large agent catalogs efficiently
- **Favorites** - Save agents to your favorites list
- **Reputation Filtering** - Filter agents by minimum reputation score (0-100 scale)

### Agents

#### Customer-Facing
| Agent | Description | RAG Data |
|-------|-------------|----------|
| QR Menu Assistant | Restaurant menu Q&A, dietary recommendations | Sample restaurant menu |
| Retail Assistant | Product discovery and recommendations | TechMart product catalog (laptops, phones, accessories) |
| Product Support | Troubleshooting and documentation Q&A | Support knowledge base (KB-1001 to KB-3001) |

#### Productivity
| Agent | Description | Features |
|-------|-------------|----------|
| PRD Generator | Create product requirements documents | 6-phase structured interview |
| Sales Proposal | Generate client proposals | Discovery-driven workflow |
| Postmortem | Document incident retrospectives | Blameless 5 Whys analysis |
| Roadmap | Create product roadmaps | Now/Next/Later framework |
| SOP Generator | Capture standard operating procedures | Step-by-step knowledge capture |
| Opinion Research | Analyze qualitative data | Stance mapping and synthesis |

#### Builder Templates (Self-Service)
| Template | Category | Default Skills | Default Tools |
|----------|----------|----------------|---------------|
| Restaurant Menu | Customer-Facing | Menu Browsing, Dietary Filtering | Search KB, User Memory |
| Retail / E-Commerce | Customer-Facing | Product Comparison | Search KB |
| Customer Support | Customer-Facing | Troubleshooting | Search KB, Think |
| Custom Agent | Customer-Facing | — | — |
| PRD Generator | Productivity | PRD Writing, Scope Breakdown | Search KB, Think |
| Research Assistant | Productivity | Research Synthesis, Comparative Analysis | Search KB, Think, User Memory |
| SOP Generator | Productivity | SOP Writing, Checklist Creation | Search KB, Think |
| Business Analyst | Productivity | SWOT Analysis, Market Sizing | Search KB, Think, User Memory |
| Requirements Gathering | Productivity | Stakeholder Interview, Requirements Documentation | Search KB, Think, User Memory |

**Suggested MCP Servers:** The builder includes curated open MCP servers (Cloudflare Docs, Exa Search, HuggingFace, AWS Docs) for one-click addition.

### Artifact Export
- Export generated documents in multiple formats:
  - **Markdown** - For docs and version control
  - **HTML** - Print-ready web format
  - **JSON** - Structured data export
  - **Plain Text** - Simple text format

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15, React, Tailwind CSS |
| Backend | Cloudflare Workers |
| Database | Cloudflare D1 (SQLite) |
| Vector DB | Cloudflare Vectorize |
| AI | Workers AI + OpenRouter + Vercel AI SDK (tool use, streaming) |
| Protocols | A2A (Google) + Agent Skills (Anthropic SKILL.md) |
| Blockchain | Arbitrum Sepolia + BNB Smart Chain Testnet (multi-chain) |
| Payments | x402 with USDC + Custom ERC-20 Paymaster + Self-Bundling |
| Web3 | wagmi, viem, permissionless (Safe ERC-4337) |

## Project Structure

```
straits-agents/
├── apps/
│   └── web/                    # Next.js frontend
│       ├── src/
│       │   ├── app/           # App router pages
│       │   │   ├── api/       # API routes
│       │   │   ├── chat/      # Chat interface
│       │   │   ├── developers/# Developer portal
│       │   │   └── marketplace/# Agent marketplace
│       │   ├── components/    # React components
│       │   ├── hooks/         # Custom hooks
│       │   ├── lib/           # Utilities
│       │   └── providers/     # Context providers
│       └── scripts/           # Database scripts
├── contracts/                  # Solidity smart contracts
│   └── src/
│       ├── IdentityRegistry.sol
│       ├── ReputationRegistry.sol
│       └── UsdcPaymaster.sol
└── packages/
    └── sdk/                    # Embeddable SDK
        └── src/
            ├── index.ts       # Core client
            └── react.tsx      # React components
```

## Getting Started

### Prerequisites
- Node.js 18+
- pnpm
- Cloudflare account

### Installation

```bash
# Clone the repository
git clone https://github.com/Straits-AI/straits-agents.git
cd straits-agents

# Install dependencies
pnpm install

# Set up environment variables
cp apps/web/.env.example apps/web/.env.local
```

### Development

```bash
# Run locally
cd apps/web
pnpm dev

# Build
pnpm build

# Deploy to Cloudflare
pnpm run deploy
```

### Smart Contract Deployment

See [contracts/DEPLOY.md](contracts/DEPLOY.md) for deployment instructions. Contracts are deployed on multiple chains:

**Arbitrum Sepolia** (chainId 421614):
| Contract | Address |
|----------|---------|
| IdentityRegistry | `0xfc4e8b1d87aae1F1577eeFF16d607E92afCde55D` |
| ReputationRegistry | `0x0C998b08FF0C9c7470272c9211935692B78Cb3AF` |
| UsdcPaymaster (v2) | `0x0FcDC11dbf6F0f4D9E39b30c0B8689dD37DD34c7` |

**BNB Smart Chain Testnet** (chainId 97):
| Contract | Address |
|----------|---------|
| IdentityRegistry | `0xef9CB6e223d4FC63E82e95b1A6CBFe0B31ef3DC4` |
| ReputationRegistry | `0xdd0cF51e1442274Ea0410897b7c0F2606a2c1669` |
| UsdcPaymaster | `0x9476C70Dd3e76f321028853c740F3dA2de27d355` |

Each agent lives on one chain (via `agents.chain_id`). New agents default to BSC Testnet. Existing agents are on Arbitrum Sepolia.

## SDK Usage

### Installation

```bash
npm install @straits/sdk
```

### React Widget

```tsx
import { ChatWidget } from '@straits/sdk/react';

function App() {
  return (
    <ChatWidget
      config={{
        apiKey: 'your-api-key',
        agentId: 'qr-menu',
      }}
      title="Chat with us"
      position="bottom-right"
    />
  );
}
```

### Direct API Usage

```typescript
import { StraitsAgentClient } from '@straits/sdk';

const client = new StraitsAgentClient({
  apiKey: 'your-api-key',
  agentId: 'prd-generator',
});

// Create session and chat
const session = await client.createSession();
const response = await client.chat('Help me create a PRD for a todo app');
```

## API Reference

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/chat | Send message, get streaming response |
| POST | /api/sessions | Create chat session |
| GET | /api/agents | List all agents (supports sorting, pagination) |
| GET | /api/agents?sort=rating&page=1 | Query params: sort (rating/popular/newest), page, limit, category, minReputation (0-100) |
| GET | /api/agents/featured | Get featured agents |
| GET | /api/agents/:id | Get agent details (supports slug or UUID) |
| POST | /api/agents | Create a new custom agent (auth required) |
| PUT | /api/agents/:id | Update agent (owner auth required) |
| DELETE | /api/agents/:id | Soft-delete agent (owner auth required) |
| GET | /api/agents/mine | List current user's agents (auth required) |
| GET | /api/agents/check-slug?slug=x | Check slug availability |
| POST | /api/agents/:id/documents | Upload RAG documents |
| GET | /api/agents/:id/feedback | Get agent feedback |
| POST | /api/agents/:id/feedback | Submit feedback (supports on-chain tx hash) |
| GET | /api/agents/:id/reputation | Get reputation data (includes on-chain scores) |
| POST | /api/payments | Record x402 payment |
| POST | /api/payments/embedded | Pay via embedded wallet |
| GET | /api/wallet/balance | Get embedded wallet balance |
| GET | /api/developer/keys | List API keys |
| POST | /api/developer/keys | Create API key |
| DELETE | /api/developer/keys | Revoke API key |
| GET | /api/developer/usage | Get usage statistics |
| GET | /api/artifacts/:id/export | Export artifact (md/html/json/txt) |
| GET | /api/memory?agentId=X | List user's memories with an agent |
| DELETE | /api/memory?agentId=X | Clear all memories |
| DELETE | /api/memory/:id | Delete single memory |
| POST | /api/memory/extract | Manual memory extraction |
| POST | /api/memory/gc | Memory garbage collection |
| GET | /api/agents/:id/memory-config | Get memory config |
| PUT | /api/agents/:id/memory-config | Update memory config |
| GET | /api/agents/:id/tools | List agent tools (public) |
| POST | /api/agents/:id/tools | Create tool (owner auth) |
| GET | /api/agents/:id/tools/:toolId | Get tool details |
| PUT | /api/agents/:id/tools/:toolId | Update tool (owner auth) |
| DELETE | /api/agents/:id/tools/:toolId | Soft-delete tool (owner auth) |
| GET | /api/agents/:id/skills | List agent skills (public) |
| POST | /api/agents/:id/skills | Create skill (owner auth) |
| GET | /api/agents/:id/skills/:skillId | Get skill details |
| PUT | /api/agents/:id/skills/:skillId | Update skill (owner auth) |
| DELETE | /api/agents/:id/skills/:skillId | Soft-delete skill (owner auth) |
| GET | /api/agents/:id/mcp-servers | List MCP servers for agent |
| POST | /api/agents/:id/mcp-servers | Add MCP server (owner auth) |
| GET | /api/agents/:id/mcp-servers/:serverId | Get MCP server details |
| PUT | /api/agents/:id/mcp-servers/:serverId | Update MCP server (owner auth) |
| DELETE | /api/agents/:id/mcp-servers/:serverId | Remove MCP server (owner auth) |
| POST | /api/agents/:id/mcp-servers/:serverId/discover | Discover tools from MCP server (owner auth) |
| POST | /api/a2a/:agentId | A2A JSON-RPC endpoint (tasks/send, tasks/get, tasks/cancel) |
| GET | /api/a2a/:agentId/card | A2A Agent Card |
| GET | /.well-known/agent.json | Directory Agent Card (lists all agents) |

### Authentication

API requests require a Bearer token:

```bash
curl -H "Authorization: Bearer sk_your_api_key" \
  https://straits-agents-web.mystraits-ai.workers.dev/api/agents
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     STRAITS AGENTS MARKETPLACE                  │
├─────────────────────────────────────────────────────────────────┤
│  Frontend (Next.js)  │  Marketplace  │  Developer Portal       │
├─────────────────────────────────────────────────────────────────┤
│                   CLOUDFLARE EDGE LAYER                         │
│  API Gateway │ x402 Middleware │ Auth │ Rate Limiting          │
├─────────────────────────────────────────────────────────────────┤
│                   AGENTIC ECONOMY LAYER                         │
│  Tool Use │ Agent Skills │ A2A Protocol │ Agent Discovery      │
├─────────────────────────────────────────────────────────────────┤
│                   AGENT RUNTIME LAYER                           │
│  Chat Engine │ Memory │ RAG │ Prompt Engine │ LLM Providers    │
├─────────────────────────────────────────────────────────────────┤
│                   DATA & AI LAYER                               │
│  D1 (SQL) │ KV (Cache) │ R2 (Files) │ Vectorize │ Workers AI   │
├─────────────────────────────────────────────────────────────────┤
│                   BLOCKCHAIN LAYER (Multi-Chain)                 │
│  Arbitrum Sepolia │ BSC Testnet │ ERC-8004 │ USDC │ Paymaster  │
└─────────────────────────────────────────────────────────────────┘
```

## Security

The platform has undergone a comprehensive security audit covering authentication, authorization, SSRF, payments, and encryption. Key security features:

### Authentication & Authorization
- **Session ownership checks** on all message, artifact, and document endpoints
- **Owner-only access** for document management (GET/POST/DELETE require agent ownership)
- **Authenticated feedback** with wallet address verification against the user's account
- **Authenticated payments** — both GET (own wallet only) and POST require JWT auth
- **Bundler auth** — `eth_sendUserOperation` requires authentication + per-user rate limiting (10/min via KV)
- **OTP test bypass disabled by default** — requires both `TEST_EMAIL_DOMAIN` and `TEST_OTP_CODE` env vars (no hardcoded fallbacks)
- **KV-based rate limiting** on all auth endpoints:
  - Login: 5 attempts/15min per email
  - Registration: 3/hour per IP
  - Wallet auth: 10/min per address
  - OTP: 5/min per email
- **Constant-time OTP comparison** prevents timing side-channel attacks

### SSRF & DNS Rebinding Protection
- **All external request paths** (`tools.ts`, `mcp-client.ts`, `a2a-client.ts`) validate URLs against expanded SSRF patterns
- Blocks: localhost, private IPs (RFC 1918), link-local (169.254), IPv6 loopback (`[::1]`), IPv4-mapped IPv6 (`[::ffff:]`), `0.0.0.0`, zero-padded IPs, non-HTTP schemes
- **Redirect validation** — all fetch calls use `redirect: "manual"` and validate redirect targets against SSRF patterns before following (prevents DNS rebinding via redirect)

### Payment Security
- **UNIQUE constraint** on `transaction_hash` prevents double-spend (migration 009)
- **Simulated payments (`0xsim_`)** are no longer auto-verified — recorded but not marked as verified
- **Atomic balance deduction** via `UPDATE WHERE balance >= cost` before LLM calls (eliminates race conditions)
- **Fail-closed payment checks** — returns 503 on payment check failure instead of allowing free access
- **Refund on LLM failure** — platform cost is refunded if the LLM call errors

### Encryption
- **PBKDF2 key derivation** (v2) — 100,000 iterations with random 16-byte salt per encryption, replacing direct SHA-256 hashing
- **Context-separated key derivation** — each encryption purpose (`wallet`, `llm-api-key`, `webhook`, `mcp`) derives a unique key from the master secret
- **All existing secrets re-encrypted** — wallet keys (v1→v2 "wallet"), LLM API keys ("default"→"llm-api-key"), webhook headers ("default"→"webhook"), MCP headers ("default"→"mcp")
- **Backward-compatible** — decryption detects v1 (SHA-256) and v2 (PBKDF2) formats automatically, falling back for pre-migration data
- **AES-256-GCM** with random 12-byte IVs for all sensitive data

### Tool Security
- **Webhook timeout cap** — 30s hard maximum regardless of tool configuration
- **Response sanitization** — 5 comprehensive regex patterns for prompt injection detection
- **SQL LIKE escaping** — `discover_agents` tool sanitizes wildcard characters in user input
- **Rate limiting** — per-user per-tool rate limits via `tool_executions` table

### Migration
```bash
# Run the security hardening migration
npx wrangler d1 execute straits-agents-db --remote --file scripts/migrations/009_security_hardening.sql
```

## Embedded Wallet & On-Chain Payments

New users automatically receive a server-side custodial wallet with $100.00 testnet USDC credits on registration. This eliminates the need for MetaMask or any browser extension to use the marketplace.

**How it works:**
1. User registers with email/password
2. Server generates an Ethereum keypair, encrypts the private key with AES-256-GCM, and stores it in D1
3. A Safe smart account address is derived deterministically from the EOA signer
4. User gets $100.00 testnet credits (balance tracked in `embedded_balance` column)
5. When the Safe has USDC, payments execute on-chain via ERC-4337 UserOperations with a custom UsdcPaymaster (gas paid in USDC, no ETH needed)
6. Falls back to simulated transactions (`0xsim_` prefix) if the Safe lacks USDC (recorded but not verified on-chain)

**Self-Bundling Architecture (No Pimlico):**
- Custom `UsdcPaymaster` contract accepts USDC for gas fees with security controls:
  - **Sender allowlist** (owner-managed, toggleable) restricts sponsorship to platform wallets
  - **Per-operation cost cap** (default 1 USDC) prevents gas abuse
  - **callData validation** — rejects empty UserOps
  - **Stake management** — `unlockStake()` and `withdrawStake()` for recovering staked ETH from EntryPoint
- Relayer EOA calls `EntryPoint.handleOps()` directly (no third-party bundler)
- `createSmartAccountClient` from permissionless with custom `bundlerTransport` handles Safe initialization and signing
- Client-side MetaMask/external wallet support via `/api/bundler` JSON-RPC endpoint

**Payment priority:** Embedded Wallet > Smart Account (ERC-4337) > EOA (MetaMask)

**Setup:**
```bash
cd apps/web
npx wrangler secret put EMBEDDED_WALLET_SECRET
npx wrangler secret put RELAYER_PRIVATE_KEY
npx wrangler secret put PAYMASTER_ADDRESS
```

**Migration:** Run `npx wrangler d1 execute straits-agents-db --remote --file scripts/migrations/002_embedded_wallet.sql`

## BYOK (Bring Your Own Key)

Agent creators can provide their own LLM API key instead of relying on the platform's OpenRouter key. This eliminates platform inference costs for the creator.

**Supported providers:** OpenAI, Anthropic, OpenRouter

**How it works:**
1. In the Agent Builder or Edit page, select an LLM provider (OpenAI, Anthropic, or OpenRouter)
2. Enter your API key — it's encrypted with AES-256-GCM before storage
3. Optionally specify a model override (defaults per provider below)
4. Your agent's chat inference uses your key directly

**Default models per provider:**
| Provider | Default Model |
|----------|--------------|
| OpenAI | `gpt-4o-mini` |
| Anthropic | `claude-sonnet-4-5-20250929` |
| OpenRouter | `google/gemini-2.0-flash-001` |

**Platform balance fallback:** Free agents without BYOK deduct ~$0.005 per query from the creator's `embedded_balance`. If the balance is insufficient, inference returns HTTP 402.

**API fields:**
- `llmProvider`: `"openai"`, `"anthropic"`, `"openrouter"`, or `null` (platform default)
- `llmApiKey`: API key (write-only, never returned in GET responses)
- `llmModel`: Optional model override
- `hasLlmApiKey`: Boolean indicating if a key is set (GET responses only)

**Migration:** Run `npx wrangler d1 execute straits-agents-db --remote --file scripts/migrations/004_byok.sql`

## Agent Memory

Agents have persistent observational memory — they remember users across sessions including preferences, facts, decisions, and context. Memory is extracted asynchronously with zero impact on chat latency.

**How it works:**
1. Every 4 user messages, an async observer runs via `ctx.waitUntil()` to extract memories from the conversation
2. Extracted memories are stored in D1 with priority levels: RED (critical constraints like allergies), YELLOW (preferences), GREEN (background context)
3. On each chat request, memories are loaded from KV cache (~1ms) and injected into the system prompt
4. Users can say "remember this" to explicitly store high-priority memories
5. Memory is scoped per-user-per-agent — user X's memories with agent Y are isolated

**User transparency:**
- Brain icon in chat header shows memory count
- Click to open slide-out panel showing all memories grouped by type
- Users can delete individual memories or clear all

**Agent creator configuration:**
- Enable/disable memory per agent
- Custom extraction instructions (e.g., "Focus on dietary preferences")
- Max memories per user (default: 100)
- Retention period in days (default: 90)

**Garbage collection:**
- Time-based expiry: green memories not accessed within retention period are deactivated
- Count-based compaction: oldest green memories removed when over limit
- Triggered via `POST /api/memory/gc` or piggybacked on extraction

**API endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/memory?agentId=X | List user's memories with an agent |
| DELETE | /api/memory?agentId=X | Clear all memories with an agent |
| DELETE | /api/memory/:id | Delete a single memory |
| POST | /api/memory/extract | Manual extraction trigger |
| POST | /api/memory/gc | Run memory garbage collection |
| GET | /api/agents/:id/memory-config | Get memory config (owner only) |
| PUT | /api/agents/:id/memory-config | Update memory config (owner only) |

**Key files:**
- `src/lib/memory.ts` — Core memory module (load, extract, build context, CRUD, reflector)
- `src/components/MemoryPanel.tsx` — Slide-out memory viewer
- `src/components/MemoryBadge.tsx` — Brain icon badge in chat header

**Migration:** Run `npx wrangler d1 execute straits-agents-db --remote --file scripts/migrations/005_agent_memory.sql`

## Tool Use

Agents can call external APIs and builtin functions during chat conversations. Tools are resolved per-agent and executed via Vercel AI SDK's `tool()` with `maxSteps: 5`.

**Builtin tools:**
| Tool | Description |
|------|-------------|
| `search_documents` | Search the agent's knowledge base via RAG pipeline |
| `get_user_memory` | Load the current user's memories with this agent |
| `think` | Free reasoning scratchpad (improves accuracy on complex tasks) |
| `call_agent` | Invoke another agent with x402 payment and reputation checks |
| `discover_agents` | Search the marketplace for agents by capability |

**Webhook tools:** Agent creators can add custom HTTP webhook tools with:
- Configurable URL, method, headers (encrypted with AES-256-GCM)
- JSON Schema parameter validation
- Timeout (default 10s) and rate limiting (default 30/min per user)
- SSRF protection (blocks private IPs, localhost, non-HTTP schemes)
- Response sanitization (10KB max, strips instruction-like content)

**MCP Server tools:** Connect Model Context Protocol servers to provide external tools:
- Supports Streamable HTTP and SSE transports
- Auto-discovery via `tools/list` JSON-RPC call
- Discovered tools sync to `agent_tools` with `tool_type='mcp'` and `mcp_server_id`
- Auth headers encrypted with AES-256-GCM
- Tool filter to selectively enable specific tools from a server
- SSRF protection on server URLs
- Lightweight fetch()-based client (no `@modelcontextprotocol/sdk` dependency — compatible with Cloudflare Workers)
- **Suggested servers** in builder: Cloudflare Docs (SSE), Exa Search (HTTP, requires API key), HuggingFace (HTTP), AWS Documentation (HTTP)

**Chat UI indicators:** Tool executions show inline badges — "Searched knowledge base", "Thinking...", "Consulted {agent}", etc. Results are expandable.

**Key files:**
- `src/lib/tools.ts` — Tool resolution engine, builtin/webhook/MCP tool implementations
- `src/lib/mcp-client.ts` — MCP client: discover, call, sync, cache
- `src/app/api/agents/:id/tools/` — Tool CRUD API
- `src/app/api/agents/:id/mcp-servers/` — MCP server CRUD + discovery API
- `src/app/developers/builder/ToolsStep.tsx` — Visual tool + skill + MCP configuration in builder

**Migrations:**
- `npx wrangler d1 execute straits-agents-db --remote --file scripts/migrations/006_agent_tools.sql`
- `npx wrangler d1 execute straits-agents-db --remote --file scripts/migrations/008_mcp_tools.sql`

## Agent Skills (SKILL.md)

Skills are portable packages of expertise attached to agents, following the Anthropic SKILL.md open standard (YAML frontmatter + markdown body). They inject domain-specific instructions into the system prompt.

**How it works:**
1. Create skills via API or import SKILL.md files
2. Skills are loaded at chat time and appended to the system prompt
3. Each skill can specify `allowed_tools` — which tools it may use
4. Templates include default skills (e.g., Restaurant → "menu-browsing" + "dietary-filter", PRD Generator → "prd-writing" + "scope-breakdown")

**SKILL.md format:**
```yaml
---
name: menu-browsing
display_name: Menu Browsing
description: Help customers browse and filter the menu
version: 1.0.0
tags: [food, menu, restaurant]
allowed_tools: [search_documents]
---
When a customer asks about the menu, use the search_documents tool to find relevant items...
```

**Key files:**
- `src/lib/skills.ts` — Skill resolution, SKILL.md parsing/generation, prompt formatting
- `src/app/api/agents/:id/skills/` — Skill CRUD API

**Migration:** Run `npx wrangler d1 execute straits-agents-db --remote --file scripts/migrations/007_agent_skills.sql`

## A2A Protocol (Agent-to-Agent Communication)

Implements Google's A2A protocol for agent-to-agent communication. Each agent exposes an Agent Card and a JSON-RPC 2.0 endpoint.

**Agent Card** (`/api/a2a/:agentId/card`):
- Agent name, description, capabilities, skills
- x402 pricing information (network, asset, price per query)
- ERC-8004 identity (chain ID, registry addresses, token ID)

**Directory Card** (`/.well-known/agent.json`):
- Lists all active marketplace agents with their A2A endpoints

**JSON-RPC endpoint** (`/api/a2a/:agentId`):
- `tasks/send` — Send a message, get a response (uses shared chat engine with tools, skills, memory, RAG)
- `tasks/get` — Check task status
- `tasks/cancel` — Cancel a running task

**A2A Client** (`src/lib/a2a-client.ts`):
- `fetchAgentCard(url)` — Fetch and validate an Agent Card
- `sendA2AMessage(url, message, options)` — Send JSON-RPC message with payment headers
- `extractA2AText(response)` — Extract text from A2A response

**Shared Chat Engine** (`src/lib/chat-engine.ts`):
- Core chat pipeline extracted from `/api/chat` route
- Used by both human-facing chat and A2A agent-facing requests
- Ensures tools, skills, memory, and RAG work identically for both paths

## Multi-Chain Support

The platform supports multiple EVM chains. Each agent lives on a single chain (stored in `agents.chain_id`). The on-chain identity (ERC-8004), reputation, and USDC payments all operate on the agent's designated chain.

**Supported chains:**
| Chain | Chain ID | USDC Address | Explorer |
|-------|----------|-------------|----------|
| BNB Smart Chain Testnet | 97 | `0x64544969ed7ebf5f083679233325356ebe738930` | https://testnet.bscscan.com |
| Arbitrum Sepolia | 421614 | `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d` | https://sepolia.arbiscan.io |

**Architecture:**
- Chain config: `src/lib/smart-account/config.ts` — `SupportedChainId`, `chainConfigs`, `getChainById()`, `getChainConfig()`
- Contract addresses: `src/lib/contracts.ts` — per-chain `CONTRACT_ADDRESSES`
- Bundler: `src/lib/bundler.ts` — `createChainClient(chainId)`, `submitUserOperation(..., chain)`
- Embedded wallet: `src/lib/embedded-wallet.ts` — `sendUsdcViaPaymaster(..., chainId)`
- A2A card: dynamically returns the agent's chain info (USDC address, contract addresses)
- Builder: chain selector in ConfigStep (BSC Testnet default for new agents)

**Safe Smart Accounts** use deterministic CREATE2 deployment, so the same private key produces the same Safe address across all chains. No re-registration is needed.

## Agent-to-Agent Calls

The `call_agent` builtin tool lets one agent invoke another during a chat conversation, with automatic x402 payment and ERC-8004 reputation verification.

**Flow:**
1. LLM decides to call another agent via `call_agent` tool
2. Target agent is resolved by ID or slug
3. ERC-8004 reputation is checked (default minimum: 30/100)
4. x402 payment is processed from the user's embedded wallet
5. A sub-session is created with incremented `callDepth`
6. The shared chat engine runs the target agent's full pipeline
7. Response is returned as the tool result

**Safety:**
- **Call depth limit:** Maximum 3 levels of nested agent calls
- **Cycle detection:** Tracks `callChain` to prevent circular calls
- **Reputation gate:** Agents below minimum reputation score are blocked
- **Execution logging:** All calls logged in `tool_executions` with sub-session ID and payment hash

## Pages

| Page | Path | Description |
|------|------|-------------|
| Wallet | /wallet | Embedded & external wallet management |
| Home | / | Marketing landing page with hero, how-it-works, features, live stats, featured agents carousel, developer CTA, and footer |
| Marketplace | /marketplace | Browse and search agents |
| Agent Profile | /marketplace/:id | Agent details and reviews |
| Chat | /chat/:agentId | Chat interface with agent |
| Developer Portal | /developers | SDK docs and quickstart |
| Dashboard | /developers/dashboard | API key management |
| Analytics | /developers/analytics | Usage statistics |
| Agent Builder | /developers/builder | Self-service 5-step wizard with 9 templates (4 customer-facing + 5 productivity), tools, MCP servers (with suggested open servers), and skills configuration |
| My Agents | /developers/my-agents | Dashboard to manage user-created agents |
| Agent Detail | /developers/my-agents/:id | Agent stats, QR code, knowledge base management |
| Agent Edit | /developers/my-agents/:id/edit | Edit agent configuration, tools, skills, and documents |

### Landing Page Sections

The home page (`/`) is a full marketing landing page with the following sections:

| Section | Description |
|---------|-------------|
| Hero | Gradient background with animated grid overlay and glow effect, CTAs for demo and marketplace |
| How It Works | 3-step horizontal flow: Discover → Connect → Pay & Use |
| Key Features | 4-card grid: USDC Micropayments, Embedded Wallets, On-Chain Reputation, Open Marketplace |
| Live Stats | Server-side counts of active agents, sessions, and payments from D1 |
| Featured Agents | Horizontal carousel from `FeaturedAgentsCarousel` component (DB `is_featured` flag) |
| Agent Listings | Category-grouped cards (customer-facing, productivity) |
| Developer CTA | Indigo gradient banner promoting docs and developer dashboard |
| Footer | `Footer` component with product/developer/legal navigation columns and Arbitrum badge |

### Key Components

| Component | File | Description |
|-----------|------|-------------|
| Header | `src/components/Header.tsx` | Navigation bar with dark mode toggle |
| Footer | `src/components/Footer.tsx` | Site-wide footer with nav columns, chain badge, copyright |
| FeaturedAgentsCarousel | `src/components/FeaturedAgentsCarousel.tsx` | Horizontal scrollable carousel for featured agents |

## License

MIT
