# ERC-4337 Account Abstraction — Custom Paymaster & Self-Bundling

**Date:** 2026-02-09 (Updated)
**Goal:** Zero third-party dependencies for ERC-4337 — custom UsdcPaymaster contract + self-bundled handleOps via relayer EOA

---

## Architecture

```
Server-side (Embedded Wallet):
  1. Build UserOp: [approve(paymaster, amount), transfer(recipient, amount)]
  2. Sign with Safe smart account
  3. Call EntryPoint.handleOps() directly from relayer EOA
  4. UsdcPaymaster validates balance -> execution runs -> postOp collects USDC fee

Client-side (External Wallet / MetaMask):
  1. createSmartAccountClient with bundlerTransport: http("/api/bundler")
  2. Custom paymaster fields via getPaymasterData callback
  3. SDK sends UserOp to /api/bundler (our JSON-RPC endpoint)
  4. /api/bundler calls handleOps via relayer EOA
```

---

## Key Components

### UsdcPaymaster.sol
Custom IPaymaster contract that accepts USDC for gas:
- Fixed ETH/USDC exchange rate (owner-updatable)
- 10% price markup for gas safety margin
- `validatePaymasterUserOp`: Checks sender USDC balance
- `postOp`: Collects actual USDC fee via `transferFrom`
- Approval pattern: UserOps batch `[approve(paymaster), transfer(recipient)]`
- **Location:** `contracts/src/UsdcPaymaster.sol`

### Self-Bundler (`bundler.ts`)
Core utilities replacing Pimlico:
- `getGasPrice()` — Standard gas estimation with 20% buffer
- `getPaymasterFields()` — Paymaster config for SDK
- `packUserOperation()` — JSON-RPC UserOp to PackedUserOperation
- `submitUserOperation()` — Direct `handleOps` via relayer EOA
- `waitForUserOperationReceipt()` — Parse UserOperationEvent logs
- **Location:** `apps/web/src/lib/bundler.ts`

### Bundler JSON-RPC API (`/api/bundler`)
ERC-4337 bundler methods for client-side `createSmartAccountClient`:
- `eth_sendUserOperation` — Pack + handleOps + store hash mapping
- `eth_estimateUserOperationGas` — Conservative gas limits
- `eth_getUserOperationReceipt` — Lookup via KV store
- `eth_supportedEntryPoints` / `eth_chainId`
- `pimlico_getUserOperationGasPrice` — Compatibility shim
- **Location:** `apps/web/src/app/api/bundler/route.ts`

---

## Deployed Contracts

| Contract | Address | Chain |
|----------|---------|-------|
| EntryPoint v0.7 | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` | All chains |
| UsdcPaymaster | TBD (deploy via `DeployPaymaster.s.sol`) | Arbitrum Sepolia |
| USDC | `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d` | Arbitrum Sepolia |

---

## Environment Variables

### Cloudflare Secrets (server-side only)
```
EMBEDDED_WALLET_SECRET    # AES key for encrypting embedded wallet private keys
RELAYER_PRIVATE_KEY       # EOA private key for submitting handleOps transactions
PAYMASTER_ADDRESS         # Deployed UsdcPaymaster contract address
```

### Public Environment Variables
```
NEXT_PUBLIC_PAYMASTER_ADDRESS                 # UsdcPaymaster address (Arbitrum Sepolia)
NEXT_PUBLIC_BUNDLER_URL_ARBITRUM_SEPOLIA      # Default: /api/bundler
```

---

## File Map

### New Files
| File | Purpose |
|------|---------|
| `contracts/src/UsdcPaymaster.sol` | Custom IPaymaster — USDC for gas |
| `contracts/scripts/DeployPaymaster.s.sol` | Foundry deploy script |
| `apps/web/src/lib/bundler.ts` | Core self-bundling logic |
| `apps/web/src/app/api/bundler/route.ts` | JSON-RPC bundler endpoint |

### Modified Files
| File | Changes |
|------|---------|
| `apps/web/src/lib/db.ts` | `PIMLICO_API_KEY` replaced with `RELAYER_PRIVATE_KEY` + `PAYMASTER_ADDRESS` |
| `apps/web/src/lib/smart-account/types.ts` | `paymasterUrl` replaced with `paymasterAddress` |
| `apps/web/src/lib/smart-account/config.ts` | Removed Pimlico URLs, added paymaster address, default bundler `/api/bundler` |
| `apps/web/src/lib/smart-account/client.ts` | Removed `createPimlicoClient`, uses custom paymaster + bundler |
| `apps/web/src/lib/embedded-wallet.ts` | Direct handleOps self-bundling, no Pimlico |
| `apps/web/src/app/api/payments/embedded/route.ts` | Uses `RELAYER_PRIVATE_KEY` + `PAYMASTER_ADDRESS` |
| `apps/web/src/hooks/useSmartAccount.ts` | Prepends USDC approval when paymaster configured |

---

## Deployment Steps

```bash
# 1. Deploy paymaster contract
cd contracts
forge script scripts/DeployPaymaster.s.sol --rpc-url arbitrum-sepolia --broadcast

# 2. Set Cloudflare secrets
cd apps/web
npx wrangler secret put RELAYER_PRIVATE_KEY
npx wrangler secret put PAYMASTER_ADDRESS

# 3. Set public env var
# Add to wrangler.toml or .env:
# NEXT_PUBLIC_PAYMASTER_ADDRESS=<deployed address>

# 4. Deploy web app
pnpm run deploy
```

---

## Payment Flow

### Embedded Wallet (Server-side)
1. Decrypt user's private key from D1
2. Create Safe smart account (deterministic address)
3. Check USDC balance on smart account
4. Encode batch: `[approve(paymaster, 10 USDC), transfer(recipient, amount)]`
5. Build PackedUserOperation with paymaster fields
6. Sign with Safe account
7. Submit via `handleOps()` from relayer EOA
8. Wait for receipt, return tx hash

### External Wallet (Client-side)
1. MetaMask connects, `useSmartAccount` creates Safe smart account client
2. `sendUserOperation` prepends USDC approval for paymaster
3. SDK sends UserOp to `/api/bundler`
4. Bundler API packs and submits via `handleOps()`
5. Returns receipt via KV-stored hash mapping

### Fallback
If wallet lacks USDC or paymaster errors, falls back to simulated payments (`0xsim_` prefix).

---

## Verification Checklist

- [ ] Deploy paymaster on Arbitrum Sepolia, verify on Arbiscan
- [ ] Check EntryPoint deposit and stake
- [ ] Register new test user, verify embedded wallet address is Safe smart account
- [ ] Fund smart account with USDC
- [ ] Embedded payment produces real on-chain tx hash (not `0xsim_`)
- [ ] Unfunded wallet falls back to simulated
- [ ] External wallet (MetaMask) connects and creates smart account
- [ ] External wallet can send via `/api/bundler`
- [ ] Paymaster received USDC fee after payment
