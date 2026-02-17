#!/bin/bash
# Deploy all contracts to BSC Testnet
# Prerequisites: Fund deployer 0x6ba4e80bf45c3867EE99Cd23aA59b7f93a33F593 with ~0.05 tBNB
# Faucet: https://www.bnbchain.org/en/testnet-faucet

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.."

# Load env
source .env

echo "=== BSC Testnet Deployment ==="
echo ""

# Check balance
BALANCE=$(cast balance 0x6ba4e80bf45c3867EE99Cd23aA59b7f93a33F593 --rpc-url "$BSC_TESTNET_RPC_URL" --ether 2>/dev/null || echo "0")
echo "Deployer balance: $BALANCE tBNB"

if [ "$BALANCE" = "0" ] || [ "$BALANCE" = "0.000000000000000000" ]; then
  echo "ERROR: Deployer has no tBNB. Fund from: https://www.bnbchain.org/en/testnet-faucet"
  exit 1
fi

echo ""
echo "Step 1: Deploy IdentityRegistry + ReputationRegistry..."
forge script scripts/Deploy.s.sol \
  --rpc-url bsc-testnet \
  --broadcast \
  --slow \
  -vvv

echo ""
echo "Step 2: Deploy UsdcPaymaster (BSC)..."
forge script scripts/DeployPaymasterBSC.s.sol \
  --rpc-url bsc-testnet \
  --broadcast \
  --slow \
  -vvv

echo ""
echo "=== Deployment Complete ==="
echo ""
echo "Next steps:"
echo "1. Copy the deployed contract addresses from above"
echo "2. Update apps/web/src/lib/contracts.ts with the BSC addresses"
echo "3. Set PAYMASTER_ADDRESS_BSC secret: cd apps/web && npx wrangler secret put PAYMASTER_ADDRESS_BSC"
echo "4. Update NEXT_PUBLIC_PAYMASTER_ADDRESS_BSC in apps/web/wrangler.jsonc"
echo "5. Redeploy: cd apps/web && pnpm run deploy"
echo "6. Register agents on BSC IdentityRegistry (optional)"
