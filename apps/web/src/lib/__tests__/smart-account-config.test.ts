import { describe, it, expect } from "vitest";
import {
  ENTRYPOINT_ADDRESS_V07,
  SAFE_ADDRESSES,
  USDC_ADDRESS,
  isSupportedChain,
  getChainConfig,
  getChainById,
  type SupportedChainId,
} from "../smart-account/config";

describe("smart-account/config", () => {
  describe("constants", () => {
    it("should have correct EntryPoint v0.7 address", () => {
      expect(ENTRYPOINT_ADDRESS_V07).toBe("0x0000000071727De22E5E9d8BAf0edAc6f37da032");
    });

    it("should have correct USDC address for Arbitrum Sepolia", () => {
      expect(USDC_ADDRESS).toBe("0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d");
    });

    it("should have all required Safe addresses", () => {
      expect(SAFE_ADDRESSES.singleton).toMatch(/^0x[0-9a-fA-F]{40}$/);
      expect(SAFE_ADDRESSES.factory).toMatch(/^0x[0-9a-fA-F]{40}$/);
      expect(SAFE_ADDRESSES.fallbackHandler).toMatch(/^0x[0-9a-fA-F]{40}$/);
      expect(SAFE_ADDRESSES.moduleSetup).toMatch(/^0x[0-9a-fA-F]{40}$/);
      expect(SAFE_ADDRESSES.safe4337Module).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });
  });

  describe("isSupportedChain", () => {
    it("should return true for Arbitrum Sepolia (421614)", () => {
      expect(isSupportedChain(421614)).toBe(true);
    });

    it("should return true for BSC Testnet (97)", () => {
      expect(isSupportedChain(97)).toBe(true);
    });

    it("should return false for unsupported chains", () => {
      expect(isSupportedChain(1)).toBe(false);
      expect(isSupportedChain(137)).toBe(false);
      expect(isSupportedChain(8453)).toBe(false);
      expect(isSupportedChain(0)).toBe(false);
    });
  });

  describe("getChainConfig", () => {
    it("should return config for Arbitrum Sepolia", () => {
      const config = getChainConfig(421614 as SupportedChainId);

      expect(config.name).toBe("Arbitrum Sepolia");
      expect(config.usdcAddress).toBe(USDC_ADDRESS);
      expect(config.explorerUrl).toContain("arbiscan");
    });

    it("should return config for BSC Testnet", () => {
      const config = getChainConfig(97 as SupportedChainId);

      expect(config.name).toBe("BNB Smart Chain Testnet");
      expect(config.usdcAddress).toBe("0x64544969ed7ebf5f083679233325356ebe738930");
      expect(config.explorerUrl).toContain("bscscan");
    });

    it("should have a bundler URL", () => {
      const config = getChainConfig(421614 as SupportedChainId);
      expect(config.bundlerUrl).toBeTruthy();
    });
  });

  describe("getChainById", () => {
    it("should return the viem chain for Arbitrum Sepolia", () => {
      const chain = getChainById(421614 as SupportedChainId);
      expect(chain.id).toBe(421614);
      expect(chain.name).toBe("Arbitrum Sepolia");
    });

    it("should return the viem chain for BSC Testnet", () => {
      const chain = getChainById(97 as SupportedChainId);
      expect(chain.id).toBe(97);
    });

    it("should throw for unsupported chain ID", () => {
      expect(() => getChainById(999)).toThrow("Unsupported chain ID: 999");
    });
  });
});
