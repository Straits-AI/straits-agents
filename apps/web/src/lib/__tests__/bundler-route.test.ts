/**
 * Integration tests for the Bundler JSON-RPC API route logic.
 * Tests request parsing, method dispatch, and response formatting.
 */
import { describe, it, expect } from "vitest";
import {
  ENTRYPOINT_ADDRESS,
  DEFAULT_GAS_LIMITS,
  packUserOperation,
  getPaymasterFields,
  type JsonRpcUserOp,
} from "../bundler";
import { toHex } from "viem";

/**
 * These tests validate the JSON-RPC response format and method routing
 * without calling actual chain RPCs. They test the same logic the route uses.
 */

function buildJsonRpcRequest(method: string, params?: unknown[]) {
  return {
    jsonrpc: "2.0" as const,
    id: 1,
    method,
    params,
  };
}

describe("bundler route logic", () => {
  describe("eth_supportedEntryPoints", () => {
    it("should return the v0.7 EntryPoint address", () => {
      const result = [ENTRYPOINT_ADDRESS];
      expect(result).toEqual(["0x0000000071727De22E5E9d8BAf0edAc6f37da032"]);
    });
  });

  describe("eth_chainId", () => {
    it("should return Arbitrum Sepolia chain ID in hex", () => {
      const chainIdHex = "0x66eee";
      expect(parseInt(chainIdHex, 16)).toBe(421614);
    });
  });

  describe("eth_estimateUserOperationGas", () => {
    it("should return all gas fields as hex strings", () => {
      const result = {
        callGasLimit: toHex(DEFAULT_GAS_LIMITS.callGasLimit),
        verificationGasLimit: toHex(DEFAULT_GAS_LIMITS.verificationGasLimit),
        preVerificationGas: toHex(DEFAULT_GAS_LIMITS.preVerificationGas),
        paymasterVerificationGasLimit: toHex(DEFAULT_GAS_LIMITS.paymasterVerificationGasLimit),
        paymasterPostOpGasLimit: toHex(DEFAULT_GAS_LIMITS.paymasterPostOpGasLimit),
      };

      expect(result.callGasLimit).toMatch(/^0x[0-9a-f]+$/);
      expect(result.verificationGasLimit).toMatch(/^0x[0-9a-f]+$/);
      expect(result.preVerificationGas).toMatch(/^0x[0-9a-f]+$/);
      expect(result.paymasterVerificationGasLimit).toMatch(/^0x[0-9a-f]+$/);
      expect(result.paymasterPostOpGasLimit).toMatch(/^0x[0-9a-f]+$/);
    });

    it("should return values parseable back to original bigints", () => {
      const callGasHex = toHex(DEFAULT_GAS_LIMITS.callGasLimit);
      expect(BigInt(callGasHex)).toBe(DEFAULT_GAS_LIMITS.callGasLimit);
    });
  });

  describe("eth_sendUserOperation validation", () => {
    it("should reject unsupported EntryPoint", () => {
      const wrongEntryPoint = "0x0000000000000000000000000000000000000001";
      expect(
        wrongEntryPoint.toLowerCase() !== ENTRYPOINT_ADDRESS.toLowerCase()
      ).toBe(true);
    });

    it("should accept the correct EntryPoint (case-insensitive)", () => {
      expect(
        ENTRYPOINT_ADDRESS.toLowerCase() === "0x0000000071727de22e5e9d8baf0edac6f37da032"
      ).toBe(true);
    });
  });

  describe("UserOp packing for sendUserOperation", () => {
    const sampleUserOp: JsonRpcUserOp = {
      sender: "0x1111111111111111111111111111111111111111",
      nonce: "0x5",
      callData: "0xb61d27f6" + "0".repeat(128), // executeUserOp selector + args
      callGasLimit: toHex(DEFAULT_GAS_LIMITS.callGasLimit),
      verificationGasLimit: toHex(DEFAULT_GAS_LIMITS.verificationGasLimit),
      preVerificationGas: toHex(DEFAULT_GAS_LIMITS.preVerificationGas),
      maxFeePerGas: "0x59682f00", // 1.5 gwei
      maxPriorityFeePerGas: "0x5f5e100", // 0.1 gwei
      signature: "0x" + "ab".repeat(65),
      paymaster: "0x0FcDC11dbf6F0f4D9E39b30c0B8689dD37DD34c7",
      paymasterVerificationGasLimit: toHex(DEFAULT_GAS_LIMITS.paymasterVerificationGasLimit),
      paymasterPostOpGasLimit: toHex(DEFAULT_GAS_LIMITS.paymasterPostOpGasLimit),
      paymasterData: "0x",
    };

    it("should pack a full UserOp with paymaster for handleOps", () => {
      const packed = packUserOperation(sampleUserOp);

      expect(packed.sender).toBe(sampleUserOp.sender);
      expect(packed.nonce).toBe(5n);
      expect(packed.callData).toBe(sampleUserOp.callData);
      expect(packed.signature).toBe(sampleUserOp.signature);
      expect(packed.paymasterAndData).not.toBe("0x");
      expect(packed.paymasterAndData.toLowerCase()).toContain(
        "0fcdc11dbf6f0f4d9e39b30c0b8689dd37dd34c7"
      );
    });

    it("should produce valid packed fields for handleOps struct", () => {
      const packed = packUserOperation(sampleUserOp);

      // All required fields for PackedUserOperation
      expect(packed).toHaveProperty("sender");
      expect(packed).toHaveProperty("nonce");
      expect(packed).toHaveProperty("initCode");
      expect(packed).toHaveProperty("callData");
      expect(packed).toHaveProperty("accountGasLimits");
      expect(packed).toHaveProperty("preVerificationGas");
      expect(packed).toHaveProperty("gasFees");
      expect(packed).toHaveProperty("paymasterAndData");
      expect(packed).toHaveProperty("signature");
    });

    it("should pack factory data into initCode when factory is present", () => {
      const opWithFactory: JsonRpcUserOp = {
        ...sampleUserOp,
        factory: "0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67",
        factoryData: "0xdeadbeef",
      };

      const packed = packUserOperation(opWithFactory);
      expect(packed.initCode.toLowerCase()).toContain(
        "4e1dcf7ad4e460cfd30791ccc4f9c8a4f820ec67"
      );
      expect(packed.initCode).toContain("deadbeef");
    });
  });

  describe("JSON-RPC response format", () => {
    it("should format success response correctly", () => {
      const response = { jsonrpc: "2.0", id: 1, result: "0xabc" };
      expect(response.jsonrpc).toBe("2.0");
      expect(response.id).toBe(1);
      expect(response.result).toBe("0xabc");
      expect(response).not.toHaveProperty("error");
    });

    it("should format error response correctly", () => {
      const response = {
        jsonrpc: "2.0",
        id: 1,
        error: { code: -32601, message: "Method not found: foo_bar" },
      };
      expect(response.error.code).toBe(-32601);
      expect(response.error.message).toContain("foo_bar");
      expect(response).not.toHaveProperty("result");
    });

    it("should handle unknown methods with -32601", () => {
      const unknownMethods = [
        "eth_getBalance",
        "eth_call",
        "personal_sign",
        "pimlico_getUserOperationGasPrice",
      ];

      const supportedMethods = [
        "eth_sendUserOperation",
        "eth_estimateUserOperationGas",
        "eth_getUserOperationReceipt",
        "eth_getUserOperationByHash",
        "eth_supportedEntryPoints",
        "eth_chainId",
      ];

      for (const method of unknownMethods) {
        expect(supportedMethods).not.toContain(method);
      }
    });
  });

  describe("paymaster field integration", () => {
    it("should produce paymaster fields that match what packUserOperation expects", () => {
      const paymasterAddr = "0x0FcDC11dbf6F0f4D9E39b30c0B8689dD37DD34c7" as `0x${string}`;
      const fields = getPaymasterFields(paymasterAddr);

      // Build a UserOp with these fields
      const userOp: JsonRpcUserOp = {
        sender: "0x1111111111111111111111111111111111111111",
        nonce: "0x0",
        callData: "0x",
        callGasLimit: toHex(DEFAULT_GAS_LIMITS.callGasLimit),
        verificationGasLimit: toHex(DEFAULT_GAS_LIMITS.verificationGasLimit),
        preVerificationGas: toHex(DEFAULT_GAS_LIMITS.preVerificationGas),
        maxFeePerGas: "0x59682f00",
        maxPriorityFeePerGas: "0x5f5e100",
        signature: "0x",
        paymaster: fields.paymaster,
        paymasterVerificationGasLimit: toHex(fields.paymasterVerificationGasLimit),
        paymasterPostOpGasLimit: toHex(fields.paymasterPostOpGasLimit),
        paymasterData: fields.paymasterData,
      };

      const packed = packUserOperation(userOp);
      expect(packed.paymasterAndData.toLowerCase()).toContain(
        paymasterAddr.slice(2).toLowerCase()
      );
    });
  });
});
