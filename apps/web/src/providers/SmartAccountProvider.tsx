"use client";

import { createContext, useContext, ReactNode } from "react";
import { useSmartAccount, type UseSmartAccountReturn } from "@/hooks/useSmartAccount";

const SmartAccountContext = createContext<UseSmartAccountReturn | null>(null);

export function SmartAccountProvider({ children }: { children: ReactNode }) {
  const smartAccount = useSmartAccount();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Provider = SmartAccountContext.Provider as any;
  return <Provider value={smartAccount}>{children}</Provider>;
}

export function useSmartAccountContext(): UseSmartAccountReturn {
  const context = useContext(SmartAccountContext);
  if (!context) {
    throw new Error(
      "useSmartAccountContext must be used within SmartAccountProvider"
    );
  }
  return context;
}

// Re-export types for convenience
export type { UseSmartAccountReturn } from "@/hooks/useSmartAccount";
