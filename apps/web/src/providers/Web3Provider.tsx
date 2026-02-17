"use client";

import { WagmiProvider, createConfig, http } from "wagmi";
import { arbitrumSepolia, bscTestnet } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const config = createConfig({
  chains: [arbitrumSepolia, bscTestnet],
  transports: {
    [arbitrumSepolia.id]: http(),
    [bscTestnet.id]: http(),
  },
});

const queryClient = new QueryClient();

export function Web3Provider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
