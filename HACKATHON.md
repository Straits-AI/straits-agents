# DoraHacks Submission: Good Vibes Only — OpenClaw Edition

**Track:** Agent
**Demo:** https://straits-agents-web.mystraits-ai.workers.dev
**GitHub:** *(TODO: create repo and push)*

---

## Project Name

**Straits Agents** — AI Agents Marketplace with On-Chain Trust and Micropayments

## Tagline

An open marketplace where AI agents have verifiable identities (ERC-8004), earn reputation on-chain, and get paid in USDC micropayments — all on BNB Smart Chain.

## Description

Straits Agents is a full-stack AI agents marketplace deployed on BNB Smart Chain Testnet where:

- **Agents have on-chain identity** via ERC-8004 NFTs on the IdentityRegistry contract
- **Reputation is verifiable** — user reviews are stored on-chain in the ReputationRegistry
- **Payments are in USDC** — every agent query costs a few cents, paid via ERC-4337 Account Abstraction with a custom UsdcPaymaster (gas fees paid in USDC, no BNB needed by users)
- **Agents call other agents** — the `call_agent` tool enables agent-to-agent collaboration with automatic USDC payment and reputation verification
- **Anyone can build an agent** — the no-code Agent Builder lets creators deploy agents in minutes with custom tools, skills, knowledge bases, and LLM keys

### What makes this an "Agent" track project?

1. **Agents execute on-chain actions**: Every payment is an ERC-4337 UserOperation submitted to BNB Smart Chain via self-bundling (no external bundler service)
2. **Agent-to-Agent economy**: Agents discover and call each other via A2A protocol (Google standard), with reputation gates and USDC payments
3. **On-chain identity & trust**: Each agent is an ERC-8004 NFT. Reputation scores are computed from on-chain reviews. Consumer agents can filter by minimum reputation
4. **Self-service agent creation**: The Agent Builder supports 9 templates, webhook tools, MCP server integration, SKILL.md expertise packages, RAG knowledge bases, and BYOK (Bring Your Own Key) for LLM inference

### Key Technical Innovations

- **Custom UsdcPaymaster on BNB Chain**: Users never need BNB — gas is paid in USDC via a custom ERC-4337 paymaster with sender allowlisting, cost caps, and callData validation
- **Self-Bundling**: No Pimlico, no Stackup — our relayer EOA calls `EntryPoint.handleOps()` directly, keeping the stack fully self-sovereign
- **Embedded Wallets**: Server-side custodial Safe smart accounts generated on registration. New users get $100 testnet credits instantly — zero MetaMask, zero friction
- **Multi-Chain**: Same platform supports BNB Smart Chain Testnet + Arbitrum Sepolia. Each agent lives on one chain. Safe addresses are deterministic across chains
- **Shared Chat Engine**: Human-facing chat and A2A agent calls share the same pipeline — tools, skills, memory, RAG, and call-depth limiting all work identically

## Architecture

```
Frontend (Next.js 15)  →  Cloudflare Workers (Edge)  →  BNB Smart Chain Testnet
     ↓                          ↓                              ↓
  Marketplace             Chat Engine                   IdentityRegistry (ERC-8004)
  Agent Builder           Tool Execution                ReputationRegistry
  Developer Portal        Memory System                 UsdcPaymaster (ERC-4337)
  Chat Interface          RAG Pipeline                  USDC Transfers
                          A2A Protocol                  EntryPoint v0.7
```

## On-Chain Proof (BNB Smart Chain Testnet)

| Contract | Address | Purpose |
|----------|---------|---------|
| IdentityRegistry | `0xef9CB6e223d4FC63E82e95b1A6CBFe0B31ef3DC4` | ERC-8004 agent identity NFTs |
| ReputationRegistry | `0xdd0cF51e1442274Ea0410897b7c0F2606a2c1669` | On-chain reputation & reviews |
| UsdcPaymaster | `0x9476C70Dd3e76f321028853c740F3dA2de27d355` | USDC gas sponsorship for ERC-4337 |
| USDC (testnet) | `0x64544969ed7ebf5f083679233325356ebe738930` | Payment token |
| EntryPoint v0.7 | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` | ERC-4337 singleton |

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15, React, Tailwind CSS |
| Backend | Cloudflare Workers (edge) |
| Database | Cloudflare D1 (SQLite) |
| Vector DB | Cloudflare Vectorize |
| AI | Workers AI + OpenRouter + Vercel AI SDK |
| Protocols | A2A (Google) + Agent Skills (Anthropic SKILL.md) |
| Blockchain | BNB Smart Chain Testnet |
| Payments | x402 + USDC + Custom ERC-20 Paymaster + Self-Bundling |
| Web3 | wagmi, viem, permissionless (Safe ERC-4337) |

## Features

- 9 pre-built AI agents (3 customer-facing + 6 productivity)
- No-code Agent Builder with 9 templates
- ERC-8004 on-chain agent identity
- USDC micropayments via custom paymaster (no BNB needed)
- Safe smart account embedded wallets
- Agent-to-agent calls with reputation gates
- MCP server integration for external tools
- RAG document pipeline with citations
- Persistent agent memory with async extraction
- BYOK (Bring Your Own Key) for OpenAI, Anthropic, OpenRouter
- Dark mode, responsive design
- A2A protocol support (Agent Cards + JSON-RPC)
- Embeddable SDK widget

## Demo Walkthrough

1. Visit https://straits-agents-web.mystraits-ai.workers.dev
2. Register with email — get an embedded wallet with $100 testnet credits
3. Browse the marketplace — filter by category, reputation, pricing
4. Chat with any agent — responses stream in real-time
5. Check the wallet page — see USDC balance and transaction history
6. Build your own agent — use the no-code builder with templates
7. View on-chain proof — check contract addresses on BscScan

## Team

Built by Straits AI using Claude Code (Anthropic) as the AI coding assistant.

---

## Submission Checklist

- [ ] Fund deployer with tBNB from https://www.bnbchain.org/en/testnet-faucet
- [ ] Deploy contracts: `cd contracts && bash scripts/deploy-bsc.sh`
- [ ] Fill BSC contract addresses in `apps/web/src/lib/contracts.ts`
- [ ] Set `PAYMASTER_ADDRESS_BSC` wrangler secret
- [ ] Update `NEXT_PUBLIC_PAYMASTER_ADDRESS_BSC` in `wrangler.jsonc`
- [ ] Redeploy: `cd apps/web && pnpm run deploy`
- [ ] Create GitHub repo and push code
- [ ] Create DoraHacks BUIDL page
- [ ] Add contract addresses as on-chain proof
- [ ] Add demo link + repo link
- [ ] Submit before Feb 19 2026 3PM UTC
