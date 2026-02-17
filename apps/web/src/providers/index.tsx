"use client";

import { ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { Web3Provider } from "./Web3Provider";
import { AuthProvider } from "./AuthProvider";
import { SmartAccountProvider } from "./SmartAccountProvider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <Web3Provider>
        <SmartAccountProvider>
          <AuthProvider>{children}</AuthProvider>
        </SmartAccountProvider>
      </Web3Provider>
    </ThemeProvider>
  );
}
