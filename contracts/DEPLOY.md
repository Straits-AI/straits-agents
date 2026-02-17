# Contract Deployment Guide

## Deployed Contracts

### BNB Smart Chain Testnet (Primary)

| Contract | Address |
|----------|---------|
| IdentityRegistry | `0xef9CB6e223d4FC63E82e95b1A6CBFe0B31ef3DC4` |
| ReputationRegistry | `0xdd0cF51e1442274Ea0410897b7c0F2606a2c1669` |
| UsdcPaymaster | `0x9476C70Dd3e76f321028853c740F3dA2de27d355` |

- **Chain ID:** 97
- **Explorer:** https://testnet.bscscan.com
- **Deployer:** `0x40e4CCd3Db59580b23F5dB16e1F9e1BCf6d2Bf8E`
- **USDC:** `0x64544969ed7ebf5f083679233325356ebe738930`

### Arbitrum Sepolia

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

2. Get testnet tokens from faucets:
   - BNB Smart Chain Testnet: https://www.bnbchain.org/en/testnet-faucet
   - Arbitrum Sepolia: https://faucet.quicknode.com/arbitrum/sepolia

3. Set up environment:
```bash
cd contracts
cp .env.example .env
# Edit .env with your PRIVATE_KEY (with 0x prefix)
```

## Deploy to BNB Smart Chain Testnet (Recommended)

```bash
cd contracts
bash scripts/deploy-bsc.sh
```

Or manually with `forge create`:

```bash
source .env
forge create src/IdentityRegistry.sol:IdentityRegistry --rpc-url $BSC_TESTNET_RPC_URL --private-key $PRIVATE_KEY
forge create src/ReputationRegistry.sol:ReputationRegistry --rpc-url $BSC_TESTNET_RPC_URL --private-key $PRIVATE_KEY
forge create src/UsdcPaymaster.sol:UsdcPaymaster --rpc-url $BSC_TESTNET_RPC_URL --private-key $PRIVATE_KEY --constructor-args 0x64544969ed7ebf5f083679233325356ebe738930 0x0000000071727De22E5E9d8BAf0edAc6f37da032
```

## Deploy to Arbitrum Sepolia

```bash
cd contracts
source .env
forge script scripts/Deploy.s.sol --rpc-url $ARBITRUM_SEPOLIA_RPC_URL --broadcast
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
BSC_TESTNET_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545
ARBITRUM_SEPOLIA_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
BSCSCAN_API_KEY=<optional>
ARBISCAN_API_KEY=<optional>
```
