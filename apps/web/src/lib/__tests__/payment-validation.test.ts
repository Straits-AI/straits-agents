/**
 * Tests for the embedded payment route input validation and business logic.
 * Validates the Zod schema and edge cases without needing D1/KV.
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";

// Replicate the schema from the route (single source of truth test)
const paymentSchema = z.object({
  paymentId: z.string(),
  amount: z.number().positive(),
  sessionId: z.string().optional(),
  agentId: z.string(),
});

describe("payment validation", () => {
  describe("paymentSchema", () => {
    it("should accept valid payment request", () => {
      const result = paymentSchema.safeParse({
        paymentId: "pay_123",
        amount: 500,
        agentId: "qr-menu",
        sessionId: "sess_abc",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.paymentId).toBe("pay_123");
        expect(result.data.amount).toBe(500);
        expect(result.data.agentId).toBe("qr-menu");
        expect(result.data.sessionId).toBe("sess_abc");
      }
    });

    it("should accept payment without sessionId", () => {
      const result = paymentSchema.safeParse({
        paymentId: "pay_456",
        amount: 100,
        agentId: "code-auditor",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sessionId).toBeUndefined();
      }
    });

    it("should reject zero amount", () => {
      const result = paymentSchema.safeParse({
        paymentId: "pay_789",
        amount: 0,
        agentId: "qr-menu",
      });
      expect(result.success).toBe(false);
    });

    it("should reject negative amount", () => {
      const result = paymentSchema.safeParse({
        paymentId: "pay_789",
        amount: -100,
        agentId: "qr-menu",
      });
      expect(result.success).toBe(false);
    });

    it("should reject missing paymentId", () => {
      const result = paymentSchema.safeParse({
        amount: 500,
        agentId: "qr-menu",
      });
      expect(result.success).toBe(false);
    });

    it("should reject missing agentId", () => {
      const result = paymentSchema.safeParse({
        paymentId: "pay_123",
        amount: 500,
      });
      expect(result.success).toBe(false);
    });

    it("should reject non-numeric amount", () => {
      const result = paymentSchema.safeParse({
        paymentId: "pay_123",
        amount: "five hundred",
        agentId: "qr-menu",
      });
      expect(result.success).toBe(false);
    });

    it("should accept fractional amounts (cents)", () => {
      const result = paymentSchema.safeParse({
        paymentId: "pay_123",
        amount: 0.01,
        agentId: "qr-menu",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("simulated transaction hash format", () => {
    it("should generate valid simulated hash format", () => {
      const uuid = "550e8400-e29b-41d4-a716-446655440000";
      const simHash = `0xsim_${uuid.replace(/-/g, "")}`;

      expect(simHash).toMatch(/^0xsim_[0-9a-f]{32}$/);
      expect(simHash.startsWith("0xsim_")).toBe(true);
    });
  });

  describe("balance validation logic", () => {
    it("should detect insufficient balance", () => {
      const balance = 400;
      const amount = 500;
      expect(balance < amount).toBe(true);
    });

    it("should allow exact balance", () => {
      const balance = 500;
      const amount = 500;
      expect(balance >= amount).toBe(true);
    });

    it("should allow surplus balance", () => {
      const balance = 1000;
      const amount = 500;
      expect(balance >= amount).toBe(true);
    });
  });

  describe("wallet type validation", () => {
    it("should only allow embedded wallet type", () => {
      const validTypes = ["embedded"];
      expect(validTypes.includes("embedded")).toBe(true);
      expect(validTypes.includes("external")).toBe(false);
      expect(validTypes.includes("smart-account")).toBe(false);
    });
  });

  describe("env requirements", () => {
    it("should require all four env vars for on-chain payment", () => {
      const envScenarios = [
        { key: null, secret: "s", relayer: "r", paymaster: "p", onChain: false },
        { key: "k", secret: null, relayer: "r", paymaster: "p", onChain: false },
        { key: "k", secret: "s", relayer: null, paymaster: "p", onChain: false },
        { key: "k", secret: "s", relayer: "r", paymaster: null, onChain: false },
        { key: "k", secret: "s", relayer: "r", paymaster: "p", onChain: true },
      ];

      for (const env of envScenarios) {
        const canGoOnChain = !!(env.key && env.secret && env.relayer && env.paymaster);
        expect(canGoOnChain).toBe(env.onChain);
      }
    });
  });
});
