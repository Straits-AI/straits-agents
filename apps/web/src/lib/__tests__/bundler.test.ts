import { describe, it, expect } from "vitest";
import {
  packUserOperation,
  getPaymasterFields,
  DEFAULT_GAS_LIMITS,
  ENTRYPOINT_ADDRESS,
  type JsonRpcUserOp,
} from "../bundler";

describe("bundler", () => {
  describe("ENTRYPOINT_ADDRESS", () => {
    it("should be the v0.7 EntryPoint address", () => {
      expect(ENTRYPOINT_ADDRESS).toBe("0x0000000071727De22E5E9d8BAf0edAc6f37da032");
    });
  });

  describe("DEFAULT_GAS_LIMITS", () => {
    it("should have all required gas fields as bigints", () => {
      expect(typeof DEFAULT_GAS_LIMITS.callGasLimit).toBe("bigint");
      expect(typeof DEFAULT_GAS_LIMITS.verificationGasLimit).toBe("bigint");
      expect(typeof DEFAULT_GAS_LIMITS.preVerificationGas).toBe("bigint");
      expect(typeof DEFAULT_GAS_LIMITS.paymasterVerificationGasLimit).toBe("bigint");
      expect(typeof DEFAULT_GAS_LIMITS.paymasterPostOpGasLimit).toBe("bigint");
    });

    it("should have reasonable gas values", () => {
      expect(DEFAULT_GAS_LIMITS.callGasLimit).toBeGreaterThan(0n);
      expect(DEFAULT_GAS_LIMITS.verificationGasLimit).toBeGreaterThan(0n);
      expect(DEFAULT_GAS_LIMITS.preVerificationGas).toBeGreaterThan(0n);
    });
  });

  describe("getPaymasterFields", () => {
    it("should return correct paymaster fields", () => {
      const paymasterAddr = "0x0FcDC11dbf6F0f4D9E39b30c0B8689dD37DD34c7" as `0x${string}`;
      const fields = getPaymasterFields(paymasterAddr);

      expect(fields.paymaster).toBe(paymasterAddr);
      expect(fields.paymasterData).toBe("0x");
      expect(fields.paymasterVerificationGasLimit).toBe(
        DEFAULT_GAS_LIMITS.paymasterVerificationGasLimit
      );
      expect(fields.paymasterPostOpGasLimit).toBe(
        DEFAULT_GAS_LIMITS.paymasterPostOpGasLimit
      );
    });
  });

  describe("packUserOperation", () => {
    const baseUserOp: JsonRpcUserOp = {
      sender: "0x1234567890123456789012345678901234567890" as `0x${string}`,
      nonce: "0x1",
      callData: "0xabcdef",
      callGasLimit: "0x7a120", // 500000
      verificationGasLimit: "0x7a120", // 500000
      preVerificationGas: "0x186a0", // 100000
      maxFeePerGas: "0x3b9aca00", // 1 gwei
      maxPriorityFeePerGas: "0x5f5e100", // 0.1 gwei
      signature: "0xdeadbeef",
    };

    it("should pack a basic UserOp without factory or paymaster", () => {
      const packed = packUserOperation(baseUserOp);

      expect(packed.sender).toBe(baseUserOp.sender);
      expect(packed.nonce).toBe(1n);
      expect(packed.initCode).toBe("0x");
      expect(packed.callData).toBe("0xabcdef");
      expect(packed.preVerificationGas).toBe(100_000n);
      expect(packed.paymasterAndData).toBe("0x");
      expect(packed.signature).toBe("0xdeadbeef");
    });

    it("should pack accountGasLimits correctly (verificationGas || callGas)", () => {
      const packed = packUserOperation(baseUserOp);

      // accountGasLimits = verificationGasLimit (high 16 bytes) || callGasLimit (low 16 bytes)
      // Both are 0x7a120 = 500000
      expect(packed.accountGasLimits).toMatch(/^0x/);
      // Should be 32 bytes (64 hex chars + 0x prefix)
      expect(packed.accountGasLimits.length).toBe(66);
    });

    it("should pack gasFees correctly (priorityFee || maxFee)", () => {
      const packed = packUserOperation(baseUserOp);

      expect(packed.gasFees).toMatch(/^0x/);
      expect(packed.gasFees.length).toBe(66);
    });

    it("should pack initCode when factory is present", () => {
      const opWithFactory: JsonRpcUserOp = {
        ...baseUserOp,
        factory: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as `0x${string}`,
        factoryData: "0x1234" as `0x${string}`,
      };

      const packed = packUserOperation(opWithFactory);
      // initCode = factory (20 bytes) + factoryData
      expect(packed.initCode).toContain("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
      expect(packed.initCode).toContain("1234");
      expect(packed.initCode).not.toBe("0x");
    });

    it("should pack paymasterAndData when paymaster is present", () => {
      const paymasterAddr = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as `0x${string}`;
      const opWithPaymaster: JsonRpcUserOp = {
        ...baseUserOp,
        paymaster: paymasterAddr,
        paymasterVerificationGasLimit: "0x186a0", // 100000
        paymasterPostOpGasLimit: "0x186a0",
        paymasterData: "0x",
      };

      const packed = packUserOperation(opWithPaymaster);
      // paymasterAndData = paymaster (20 bytes) + pmVerGas (16 bytes) + pmPostGas (16 bytes) + pmData
      expect(packed.paymasterAndData).not.toBe("0x");
      expect(packed.paymasterAndData.toLowerCase()).toContain(
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
      );
    });

    it("should handle zero nonce", () => {
      const packed = packUserOperation({ ...baseUserOp, nonce: "0x0" });
      expect(packed.nonce).toBe(0n);
    });

    it("should handle large gas values", () => {
      const packed = packUserOperation({
        ...baseUserOp,
        callGasLimit: "0xf4240", // 1_000_000
        verificationGasLimit: "0x1e8480", // 2_000_000
      });

      expect(packed.accountGasLimits).toMatch(/^0x/);
      expect(packed.accountGasLimits.length).toBe(66);
    });
  });
});
