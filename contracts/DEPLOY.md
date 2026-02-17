# Contract Deployment Guide

## Deployed Contracts

### Arbitrum Sepolia (Active)

| Contract | Address |
|----------|---------|
| IdentityRegistry | `0xfc4e8b1d87aae1F1577eeFF16d607E92afCde55D` |
| ReputationRegistry | `0x0C998b08FF0C9c7470272c9211935692B78Cb3AF` |
| UsdcPaymaster | `0x0FcDC11dbf6F0f4D9E39b30c0B8689dD37DD34c7` |

- **Chain ID:** 421614
- **Explorer:** https://sepolia.arbiscan.io
- **Deployer:** `0x6ba4e80bf45c3867EE99Cd23aA59b7f93a33F593`

### Registered Agents (On-Chain)

| Token ID | Agent | Wallet |
|----------|-------|--------|
| 0 | QR Menu Assistant | `0x0000...0001` |
| 1 | Retail Assistant | `0x0000...0002` |
| 2 | Product Support | `0x0000...0003` |
| 3 | PRD Generator | `0x0000...0004` |
| 4 | Sales Proposal | `0x0000...0005` |
| 5 | Postmortem | `0x0000...0006` |
| 6 | Roadmap | `0x0000...0007` |
| 7 | SOP Generator | `0x0000...0008` |
| 8 | Opinion Research | `0x0000...0009` |

---

## Prerequisites

1. Install Foundry:
```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

2. Get testnet ETH from faucets:
   - Arbitrum Sepolia: https://faucet.quicknode.com/arbitrum/sepolia
   - Base Sepolia: https://www.alchemy.com/faucets/base-sepolia
   - Polygon Amoy: https://faucet.polygon.technology/

3. Set up environment:
```bash
cd contracts
cp .env.example .env
# Edit .env with your PRIVATE_KEY (with 0x prefix)
```

## Deploy to Arbitrum Sepolia (Recommended)

```bash
cd contracts
source .env
forge script scripts/Deploy.s.sol --rpc-url $ARBITRUM_SEPOLIA_RPC_URL --broadcast
```

## Deploy to Base Sepolia

```bash
source .env
forge script scripts/Deploy.s.sol --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast --verify
```

## Deploy to Polygon Amoy

```bash
source .env
forge script scripts/Deploy.s.sol --rpc-url $POLYGON_AMOY_RPC_URL --broadcast --verify
```

## After Deployment

### 1. Update Contract Addresses

Update addresses in three files:

**`/apps/web/src/lib/contracts.ts`:**
```typescript
export const CONTRACT_ADDRESSES = {
  arbitrumSepolia: {
    identityRegistry: "0xYOUR_ADDRESS" as Address,
    reputationRegistry: "0xYOUR_ADDRESS" as Address,
  },
};
```

**`/packages/core/src/utils/constants.ts`:**
```typescript
'arbitrum-sepolia': {
  contracts: {
    identityRegistry: '0xYOUR_ADDRESS',
    reputationRegistry: '0xYOUR_ADDRESS',
  },
}
```

**`/apps/web/src/lib/smart-account/config.ts`:**
Ensure the chain ID is included in `SupportedChainId` and chain configs.

### 2. Register Agents On-Chain

Use `cast` to register each agent on the IdentityRegistry:

```bash
cast send <IDENTITY_REGISTRY_ADDRESS> \
  "registerAgent(address,string)" \
  <AGENT_WALLET_ADDRESS> \
  "https://straits-agents-web.mystraits-ai.workers.dev/api/agents/<AGENT_ID>" \
  --rpc-url $ARBITRUM_SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY
```

### 3. Update Database

Set `nft_token_id`, `chain_id`, and `agent_wallet` for each agent in the D1 database using Wrangler:

```bash
cd apps/web
npx wrangler d1 execute straits-agents-db --remote --command \
  "UPDATE agents SET nft_token_id = '0', chain_id = 421614, agent_wallet = '0x...' WHERE id = 'qr-menu'"
```

### 4. Submit Test Feedback

```bash
cast send <REPUTATION_REGISTRY_ADDRESS> \
  "submitDetailedFeedback(uint256,uint8,uint8,uint8,uint8,uint8,bytes32)" \
  <TOKEN_ID> <RATING> <ACCURACY> <HELPFULNESS> <SPEED> <SAFETY> <COMMENT_HASH> \
  --rpc-url $ARBITRUM_SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY
```

### 5. Verify On-Chain Data

```bash
# Check agent registration
cast call <IDENTITY_REGISTRY_ADDRESS> \
  "getAgent(uint256)(address,address,string,bool)" <TOKEN_ID> \
  --rpc-url $ARBITRUM_SEPOLIA_RPC_URL

# Check reputation
cast call <REPUTATION_REGISTRY_ADDRESS> \
  "getReputation(uint256)(uint256,uint256,uint256,uint256,uint256,uint256)" <TOKEN_ID> \
  --rpc-url $ARBITRUM_SEPOLIA_RPC_URL
```

## Contract Architecture

- **IdentityRegistry** (ERC-721): Mints an NFT per agent. Stores owner, agent wallet address, and metadata URI. Supports activation/deactivation.
- **ReputationRegistry**: Accepts feedback (overall + category scores: accuracy, helpfulness, speed, safety). Stores weighted averages on-chain. One review per reviewer per agent.

## Environment Variables (.env)

```bash
PRIVATE_KEY=0x<your-private-key>
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
POLYGON_AMOY_RPC_URL=https://rpc-amoy.polygon.technology
ARBITRUM_SEPOLIA_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
BASESCAN_API_KEY=<optional>
POLYGONSCAN_API_KEY=<optional>
ARBISCAN_API_KEY=<optional>
```
