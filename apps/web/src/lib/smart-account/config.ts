import { type Address } from "viem";
import { arbitrumSepolia, bscTestnet } from "viem/chains";
import type { ChainConfig } from "./types";

export type SupportedChainId = 421614 | 97;

// ERC-4337 EntryPoint v0.7 (deployed on all major chains)
export const ENTRYPOINT_ADDRESS_V07: Address = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

// Safe v1.4.1 singleton addresses (same across all chains)
export const SAFE_ADDRESSES = {
  singleton: "0x41675C099F32341bf84BFc5382aF534df5C7461a" as Address,
  factory: "0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67" as Address,
  fallbackHandler: "0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99" as Address,
  moduleSetup: "0x2dd68b007B46fBe91B9A7c3EDa5A7a1063cB5b47" as Address,
  safe4337Module: "0x75cf11467937ce3F2f357CE24ffc3DBF8fD5c226" as Address,
};

// USDC address on Arbitrum Sepolia (kept for backward compat)
export const USDC_ADDRESS: Address = "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d";

// Default chain for new agents
export const DEFAULT_CHAIN_ID: SupportedChainId = 97;

// Chain-specific configurations
export const chainConfigs: Record<SupportedChainId, ChainConfig> = {
  [arbitrumSepolia.id]: {
    name: "Arbitrum Sepolia",
    bundlerUrl: process.env.NEXT_PUBLIC_BUNDLER_URL_ARBITRUM_SEPOLIA || "/api/bundler",
    paymasterAddress: (process.env.NEXT_PUBLIC_PAYMASTER_ADDRESS || undefined) as Address | undefined,
    usdcAddress: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d" as Address,
    explorerUrl: "https://sepolia.arbiscan.io",
  },
  [bscTestnet.id]: {
    name: "BNB Smart Chain Testnet",
    bundlerUrl: process.env.NEXT_PUBLIC_BUNDLER_URL_BSC_TESTNET || "/api/bundler",
    paymasterAddress: (process.env.NEXT_PUBLIC_PAYMASTER_ADDRESS_BSC || undefined) as Address | undefined,
    usdcAddress: "0x64544969ed7ebf5f083679233325356ebe738930" as Address,
    explorerUrl: "https://testnet.bscscan.com",
  },
};

// Get viem chain by ID
export function getChainById(chainId: number) {
  if (chainId === arbitrumSepolia.id) return arbitrumSepolia;
  if (chainId === bscTestnet.id) return bscTestnet;
  throw new Error(`Unsupported chain ID: ${chainId}`);
}

// Check if chain is supported
export function isSupportedChain(chainId: number): chainId is SupportedChainId {
  return chainId in chainConfigs;
}

// Get config for chain
export function getChainConfig(chainId: SupportedChainId): ChainConfig {
  const config = chainConfigs[chainId];
  if (!config) {
    throw new Error(`No config for chain ID: ${chainId}`);
  }
  return config;
}
