"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { useSmartAccountContext } from "@/providers/SmartAccountProvider";

export function WalletButton() {
  const { address: eoaAddress, isConnected } = useAccount();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const {
    smartAccountAddress,
    isSmartAccountReady,
    isLoading: isSmartAccountLoading,
    isDeployed,
    isChainSupported,
  } = useSmartAccountContext();

  // Show loading state while smart account initializes
  if (isConnected && isSmartAccountLoading) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
        <span className="text-sm text-gray-500 dark:text-gray-400">Setting up account...</span>
      </div>
    );
  }

  if (isConnected && eoaAddress) {
    // Determine which address to display
    const displayAddress = smartAccountAddress || eoaAddress;
    const isUsingSmartAccount = !!smartAccountAddress;

    return (
      <div className="flex items-center gap-2">
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-1.5">
            {/* Smart account indicator */}
            {isUsingSmartAccount && (
              <span
                className="inline-flex items-center rounded-full bg-indigo-100 px-1.5 py-0.5 text-xs font-medium text-indigo-700"
                title="ERC-4337 Smart Account"
              >
                <svg
                  className="mr-0.5 h-3 w-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
                Safe
              </span>
            )}
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {displayAddress.slice(0, 6)}...{displayAddress.slice(-4)}
            </span>
          </div>
          {/* Status indicators */}
          {isUsingSmartAccount && !isDeployed && (
            <span className="text-xs text-amber-600">Not deployed yet</span>
          )}
          {!isChainSupported && (
            <span className="text-xs text-red-600">Unsupported chain</span>
          )}
        </div>
        <button
          onClick={() => disconnect()}
          className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => connect({ connector: connectors[0] })}
      disabled={isConnecting}
      className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:bg-gray-950 disabled:opacity-50"
    >
      {isConnecting ? "Connecting..." : "Connect Wallet"}
    </button>
  );
}

// Compact version for use in headers
export function WalletButtonCompact() {
  const { address: eoaAddress, isConnected } = useAccount();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { smartAccountAddress, isLoading } = useSmartAccountContext();

  if (isConnected && isLoading) {
    return (
      <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700" />
    );
  }

  if (isConnected && eoaAddress) {
    const displayAddress = smartAccountAddress || eoaAddress;
    const isUsingSmartAccount = !!smartAccountAddress;

    return (
      <button
        onClick={() => disconnect()}
        className="flex items-center gap-1 rounded-full bg-gray-100 dark:bg-gray-800 px-3 py-1.5 text-sm hover:bg-gray-200 dark:bg-gray-700"
        title={`${isUsingSmartAccount ? "Smart Account" : "EOA"}: ${displayAddress}`}
      >
        {isUsingSmartAccount && (
          <svg
            className="h-3.5 w-3.5 text-indigo-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
        )}
        <span>
          {displayAddress.slice(0, 4)}...{displayAddress.slice(-3)}
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={() => connect({ connector: connectors[0] })}
      disabled={isConnecting}
      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
    >
      {isConnecting ? "..." : "Connect"}
    </button>
  );
}
