"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { useSmartAccountContext } from "@/providers/SmartAccountProvider";

export interface User {
  id: string;
  email: string | null;
  name: string | null;
  walletAddress: string | null;
  smartAccountAddress: string | null;
  eoaAddress: string | null;
  embeddedWalletAddress: string | null;
  walletType: "none" | "embedded" | "external";
  embeddedBalance: number;
  createdAt: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { address: eoaAddress, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const {
    smartAccountAddress,
    isSmartAccountReady,
    isLoading: isSmartAccountLoading,
  } = useSmartAccountContext();

  // Use smart account address if available, otherwise fall back to EOA
  const activeAddress = smartAccountAddress || eoaAddress;

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Login failed");
    }

    await fetchUser();
    return data;
  };

  const register = async (email: string, password: string, name?: string) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Registration failed");
    }

    await fetchUser();
    return data;
  };

  const otpLogin = async (email: string, otp: string) => {
    const res = await fetch("/api/auth/otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "OTP login failed");
    }

    await fetchUser();
    return data;
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  };

  const signInWithWallet = async () => {
    if (!eoaAddress) {
      throw new Error("No wallet connected");
    }

    // Build message including smart account if available
    const messageLines = [
      "Sign in to Straits Agents",
      "",
      `Wallet: ${eoaAddress}`,
    ];

    if (smartAccountAddress) {
      messageLines.push(`Smart Account: ${smartAccountAddress}`);
    }

    messageLines.push(`Timestamp: ${Date.now()}`);
    const message = messageLines.join("\n");

    // Sign with EOA (the signer behind the smart account)
    const signature = await signMessageAsync({ message });

    const res = await fetch("/api/auth/wallet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address: activeAddress, // Use smart account if available
        eoaAddress,
        smartAccountAddress,
        message,
        signature,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Wallet authentication failed");
    }

    await fetchUser();
    return data;
  };

  const linkWallet = async () => {
    if (!eoaAddress) {
      throw new Error("No wallet connected");
    }

    // Build message including smart account if available
    const messageLines = [
      "Link wallet to Straits Agents account",
      "",
      `Wallet: ${eoaAddress}`,
    ];

    if (smartAccountAddress) {
      messageLines.push(`Smart Account: ${smartAccountAddress}`);
    }

    messageLines.push(`Timestamp: ${Date.now()}`);
    const message = messageLines.join("\n");

    const signature = await signMessageAsync({ message });

    const res = await fetch("/api/auth/wallet", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address: activeAddress,
        eoaAddress,
        smartAccountAddress,
        message,
        signature,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to link wallet");
    }

    await fetchUser();
    return data;
  };

  const hasEmbeddedWallet = user?.walletType === "embedded" && !!user?.embeddedWalletAddress;

  return {
    user,
    isLoading: isLoading || isSmartAccountLoading,
    isAuthenticated: !!user,
    login,
    register,
    otpLogin,
    logout,
    signInWithWallet,
    linkWallet,
    // Wallet addresses
    walletAddress: activeAddress,
    eoaAddress,
    smartAccountAddress,
    // Embedded wallet
    hasEmbeddedWallet,
    embeddedWalletAddress: user?.embeddedWalletAddress ?? null,
    embeddedBalance: user?.embeddedBalance ?? 0,
    // States
    isWalletConnected: isConnected,
    isSmartAccountReady,
    refetch: fetchUser,
  };
}
