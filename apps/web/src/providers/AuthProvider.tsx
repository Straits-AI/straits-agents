"use client";

import { createContext, useContext, ReactNode } from "react";
import { useAuth, User } from "@/hooks/useAuth";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<unknown>;
  register: (email: string, password: string, name?: string) => Promise<unknown>;
  otpLogin: (email: string, otp: string) => Promise<unknown>;
  logout: () => Promise<void>;
  signInWithWallet: () => Promise<unknown>;
  linkWallet: () => Promise<unknown>;
  walletAddress: string | undefined;
  isWalletConnected: boolean;
  hasEmbeddedWallet: boolean;
  embeddedWalletAddress: string | null;
  embeddedBalance: number;
  refetch: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
}
