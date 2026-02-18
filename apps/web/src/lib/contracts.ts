import { createPublicClient, http, type Address } from "viem";
import { arbitrumSepolia, bscTestnet } from "viem/chains";

// Contract addresses per chain
export const CONTRACT_ADDRESSES = {
  arbitrumSepolia: {
    identityRegistry: "0x4B86B7317e8a4aD52bD9C388c1015d89Ebc8D065" as Address,
    reputationRegistry: "0x0C998b08FF0C9c7470272c9211935692B78Cb3AF" as Address,
    usdcPaymaster: "0x0FcDC11dbf6F0f4D9E39b30c0B8689dD37DD34c7" as Address,
  },
  bscTestnet: {
    identityRegistry: "0xa658c524DD8a4a13026C1B197f78b164DAd1Ba34" as Address,
    reputationRegistry: "0xdd0cF51e1442274Ea0410897b7c0F2606a2c1669" as Address,
    usdcPaymaster: "0x9476C70Dd3e76f321028853c740F3dA2de27d355" as Address,
  },
} as const;

// ABI for IdentityRegistry
export const IDENTITY_REGISTRY_ABI = [
  {
    type: "function",
    name: "registerAgent",
    inputs: [
      { name: "agentWallet", type: "address" },
      { name: "metadataUri", type: "string" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "updateMetadata",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "metadataUri", type: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getAgent",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      { name: "owner", type: "address" },
      { name: "agentWallet", type: "address" },
      { name: "metadataUri", type: "string" },
      { name: "isActive", type: "bool" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isAgentActive",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "walletToToken",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "AgentRegistered",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "agentWallet", type: "address", indexed: false },
    ],
  },
] as const;

// ABI for ReputationRegistry
export const REPUTATION_REGISTRY_ABI = [
  {
    type: "function",
    name: "submitFeedback",
    inputs: [
      { name: "agentTokenId", type: "uint256" },
      { name: "rating", type: "uint8" },
      { name: "commentHash", type: "bytes32" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "submitDetailedFeedback",
    inputs: [
      { name: "agentTokenId", type: "uint256" },
      { name: "rating", type: "uint8" },
      { name: "accuracy", type: "uint8" },
      { name: "helpfulness", type: "uint8" },
      { name: "speed", type: "uint8" },
      { name: "safety", type: "uint8" },
      { name: "commentHash", type: "bytes32" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getReputation",
    inputs: [{ name: "agentTokenId", type: "uint256" }],
    outputs: [
      { name: "overallScore", type: "uint256" },
      { name: "totalReviews", type: "uint256" },
      { name: "accuracyScore", type: "uint256" },
      { name: "helpfulnessScore", type: "uint256" },
      { name: "speedScore", type: "uint256" },
      { name: "safetyScore", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "hasReviewed",
    inputs: [
      { name: "", type: "uint256" },
      { name: "", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "FeedbackSubmitted",
    inputs: [
      { name: "feedbackId", type: "uint256", indexed: true },
      { name: "agentTokenId", type: "uint256", indexed: true },
      { name: "reviewer", type: "address", indexed: true },
      { name: "rating", type: "uint8", indexed: false },
    ],
  },
] as const;

export type ChainId = 421614 | 97; // Arbitrum Sepolia | BSC Testnet

// Default chain for new agents
export const DEFAULT_CHAIN_ID: ChainId = 97;

export function getChain(chainId: ChainId) {
  if (chainId === 421614) return arbitrumSepolia;
  if (chainId === 97) return bscTestnet;
  throw new Error(`Unsupported chain: ${chainId}`);
}

export function getContractAddresses(chainId: ChainId) {
  if (chainId === 421614) return CONTRACT_ADDRESSES.arbitrumSepolia;
  if (chainId === 97) return CONTRACT_ADDRESSES.bscTestnet;
  throw new Error(`Unsupported chain: ${chainId}`);
}

export function createPublicClientForChain(chainId: ChainId) {
  const chain = getChain(chainId);
  return createPublicClient({
    chain,
    transport: http(),
  });
}

// Read functions
export async function getAgentOnChain(
  chainId: ChainId,
  tokenId: bigint
): Promise<{
  owner: Address;
  agentWallet: Address;
  metadataUri: string;
  isActive: boolean;
}> {
  const client = createPublicClientForChain(chainId);
  const addresses = getContractAddresses(chainId);

  const result = await client.readContract({
    address: addresses.identityRegistry,
    abi: IDENTITY_REGISTRY_ABI,
    functionName: "getAgent",
    args: [tokenId],
  });

  return {
    owner: result[0],
    agentWallet: result[1],
    metadataUri: result[2],
    isActive: result[3],
  };
}

export async function getAgentTokenByWallet(
  chainId: ChainId,
  walletAddress: Address
): Promise<bigint> {
  const client = createPublicClientForChain(chainId);
  const addresses = getContractAddresses(chainId);

  return client.readContract({
    address: addresses.identityRegistry,
    abi: IDENTITY_REGISTRY_ABI,
    functionName: "walletToToken",
    args: [walletAddress],
  });
}

export async function getReputationOnChain(
  chainId: ChainId,
  tokenId: bigint
): Promise<{
  overallScore: bigint;
  totalReviews: bigint;
  accuracyScore: bigint;
  helpfulnessScore: bigint;
  speedScore: bigint;
  safetyScore: bigint;
}> {
  const client = createPublicClientForChain(chainId);
  const addresses = getContractAddresses(chainId);

  const result = await client.readContract({
    address: addresses.reputationRegistry,
    abi: REPUTATION_REGISTRY_ABI,
    functionName: "getReputation",
    args: [tokenId],
  });

  return {
    overallScore: result[0],
    totalReviews: result[1],
    accuracyScore: result[2],
    helpfulnessScore: result[3],
    speedScore: result[4],
    safetyScore: result[5],
  };
}

export async function hasUserReviewed(
  chainId: ChainId,
  tokenId: bigint,
  userAddress: Address
): Promise<boolean> {
  const client = createPublicClientForChain(chainId);
  const addresses = getContractAddresses(chainId);

  return client.readContract({
    address: addresses.reputationRegistry,
    abi: REPUTATION_REGISTRY_ABI,
    functionName: "hasReviewed",
    args: [tokenId, userAddress],
  });
}

// Hash a comment for on-chain storage using keccak256
export function hashComment(comment: string): `0x${string}` {
  if (!comment || comment.trim() === "") {
    return "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;
  }

  // Use viem's keccak256 for proper hashing
  const { keccak256, toHex } = require("viem");
  return keccak256(toHex(comment)) as `0x${string}`;
}

// Encode submitFeedback function call
export function encodeSubmitFeedback(
  agentTokenId: bigint,
  rating: number,
  commentHash: `0x${string}`
): `0x${string}` {
  const { encodeFunctionData } = require("viem");
  return encodeFunctionData({
    abi: REPUTATION_REGISTRY_ABI,
    functionName: "submitFeedback",
    args: [agentTokenId, rating, commentHash],
  });
}

// Encode submitDetailedFeedback function call
export function encodeSubmitDetailedFeedback(
  agentTokenId: bigint,
  rating: number,
  accuracy: number,
  helpfulness: number,
  speed: number,
  safety: number,
  commentHash: `0x${string}`
): `0x${string}` {
  const { encodeFunctionData } = require("viem");
  return encodeFunctionData({
    abi: REPUTATION_REGISTRY_ABI,
    functionName: "submitDetailedFeedback",
    args: [agentTokenId, rating, accuracy, helpfulness, speed, safety, commentHash],
  });
}
