import { describe, it, expect } from "vitest";
import { generateEmbeddedWallet, decryptPrivateKey } from "../embedded-wallet";

describe("embedded-wallet", () => {
  const TEST_SECRET = "test-encryption-secret-key-12345";

  describe("generateEmbeddedWallet", () => {
    it("should generate a valid Ethereum address", async () => {
      const wallet = await generateEmbeddedWallet(TEST_SECRET);

      expect(wallet.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });

    it("should generate an encrypted private key in v2 format", async () => {
      const wallet = await generateEmbeddedWallet(TEST_SECRET);

      // v2 format: v2:salt:iv:ciphertext
      expect(wallet.encryptedPrivateKey.startsWith("v2:")).toBe(true);
      const parts = wallet.encryptedPrivateKey.split(":");
      expect(parts.length).toBe(4);
      expect(parts[1]!.length).toBeGreaterThan(0); // salt
      expect(parts[2]!.length).toBeGreaterThan(0); // IV
      expect(parts[3]!.length).toBeGreaterThan(0); // ciphertext
    });

    it("should generate unique wallets each time", async () => {
      const wallet1 = await generateEmbeddedWallet(TEST_SECRET);
      const wallet2 = await generateEmbeddedWallet(TEST_SECRET);

      expect(wallet1.address).not.toBe(wallet2.address);
      expect(wallet1.encryptedPrivateKey).not.toBe(wallet2.encryptedPrivateKey);
    });
  });

  describe("decryptPrivateKey", () => {
    it("should decrypt back to a valid private key", async () => {
      const wallet = await generateEmbeddedWallet(TEST_SECRET);
      const decrypted = await decryptPrivateKey(wallet.encryptedPrivateKey, TEST_SECRET);

      expect(decrypted).toMatch(/^0x[0-9a-fA-F]{64}$/);
    });

    it("should produce a private key matching the original address", async () => {
      const { privateKeyToAccount } = await import("viem/accounts");
      const wallet = await generateEmbeddedWallet(TEST_SECRET);
      const decrypted = await decryptPrivateKey(wallet.encryptedPrivateKey, TEST_SECRET);
      const account = privateKeyToAccount(decrypted);

      expect(account.address.toLowerCase()).toBe(wallet.address.toLowerCase());
    });

    it("should fail with wrong secret", async () => {
      const wallet = await generateEmbeddedWallet(TEST_SECRET);

      await expect(
        decryptPrivateKey(wallet.encryptedPrivateKey, "wrong-secret")
      ).rejects.toThrow();
    });

    it("should fail with invalid format", async () => {
      await expect(
        decryptPrivateKey("not-valid-encrypted-data", TEST_SECRET)
      ).rejects.toThrow();
    });

    it("should fail with empty string", async () => {
      await expect(
        decryptPrivateKey("", TEST_SECRET)
      ).rejects.toThrow();
    });
  });

  describe("encrypt/decrypt round-trip", () => {
    it("should successfully round-trip multiple wallets", async () => {
      const wallets = await Promise.all(
        Array.from({ length: 5 }, () => generateEmbeddedWallet(TEST_SECRET))
      );

      for (const wallet of wallets) {
        const decrypted = await decryptPrivateKey(wallet.encryptedPrivateKey, TEST_SECRET);
        expect(decrypted).toMatch(/^0x[0-9a-fA-F]{64}$/);
      }
    });

    it("should work with different secrets for different wallets", async () => {
      const secret1 = "secret-one-abc";
      const secret2 = "secret-two-xyz";

      const wallet1 = await generateEmbeddedWallet(secret1);
      const wallet2 = await generateEmbeddedWallet(secret2);

      // Decrypt with matching secrets
      const key1 = await decryptPrivateKey(wallet1.encryptedPrivateKey, secret1);
      const key2 = await decryptPrivateKey(wallet2.encryptedPrivateKey, secret2);

      expect(key1).toMatch(/^0x[0-9a-fA-F]{64}$/);
      expect(key2).toMatch(/^0x[0-9a-fA-F]{64}$/);

      // Cross-decryption should fail
      await expect(
        decryptPrivateKey(wallet1.encryptedPrivateKey, secret2)
      ).rejects.toThrow();
    });
  });
});
