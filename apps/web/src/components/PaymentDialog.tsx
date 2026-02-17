"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { X402PaymentRequired } from "@/hooks/useX402Payment";
import { useSmartAccountContext } from "@/providers/SmartAccountProvider";
import { useAuthContext } from "@/providers/AuthProvider";

interface PaymentDialogProps {
  isOpen: boolean;
  paymentRequired: X402PaymentRequired | null;
  onPay: () => Promise<void>;
  onCancel: () => void;
  isProcessing: boolean;
  error: string | null;
}

export function PaymentDialog({
  isOpen,
  paymentRequired,
  onPay,
  onCancel,
  isProcessing,
  error,
}: PaymentDialogProps) {
  const { address: eoaAddress, isConnected } = useAccount();
  const { connect, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const {
    smartAccountAddress,
    isSmartAccountReady,
    isLoading: isSmartAccountLoading,
    isDeployed,
  } = useSmartAccountContext();
  const { hasEmbeddedWallet, embeddedWalletAddress, embeddedBalance } = useAuthContext();

  if (!isOpen || !paymentRequired) return null;

  const { paymentDetails, paymentId } = paymentRequired;
  const amountInUsdc = (paymentDetails.amount / 100).toFixed(2);
  const embeddedBalanceUsdc = (embeddedBalance / 100).toFixed(2);
  const hasSufficientEmbeddedBalance = embeddedBalance >= paymentDetails.amount;

  // Determine display address and account type
  const displayAddress = smartAccountAddress || eoaAddress;
  const isUsingSmartAccount = !!smartAccountAddress && isSmartAccountReady;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-600 p-6 text-white">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white dark:bg-gray-900/20 rounded-full flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold">Payment Required</h2>
              <p className="text-sm text-white/80">x402 Micropayment</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="mb-6">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {paymentDetails.description}
            </p>

            <div className="bg-gray-100 dark:bg-gray-800 dark:bg-gray-700 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">Amount</span>
                <span className="text-2xl font-bold text-gray-900 dark:text-white">
                  ${amountInUsdc} USDC
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500 dark:text-gray-400">Payment ID</span>
                <span className="font-mono text-gray-600 dark:text-gray-400">
                  {paymentId.slice(0, 12)}...
                </span>
              </div>
            </div>
          </div>

          {/* Embedded Wallet Payment (priority) */}
          {hasEmbeddedWallet ? (
            <div className="mb-4">
              {/* Embedded Wallet Display */}
              <div className="flex items-center justify-between p-3 bg-teal-50 dark:bg-teal-900/20 rounded-lg mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-teal-500 rounded-full"></div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center rounded bg-teal-100 dark:bg-teal-900/50 px-1.5 py-0.5 text-xs font-medium text-teal-700 dark:text-teal-300">
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
                            d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                          />
                        </svg>
                        Embedded
                      </span>
                      <span className="text-sm text-teal-700 dark:text-teal-400">
                        {embeddedWalletAddress?.slice(0, 6)}...{embeddedWalletAddress?.slice(-4)}
                      </span>
                    </div>
                    <span className={`text-xs mt-0.5 ${hasSufficientEmbeddedBalance ? "text-teal-600 dark:text-teal-400" : "text-amber-600 dark:text-amber-400"}`}>
                      Balance: ${embeddedBalanceUsdc} USDC
                    </span>
                  </div>
                </div>
              </div>

              {hasSufficientEmbeddedBalance ? (
                <>
                  <div className="mb-3 p-2 bg-teal-50 dark:bg-teal-900/20 rounded-lg">
                    <p className="text-xs text-teal-700 dark:text-teal-300 flex items-center gap-1">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Instant payment from embedded wallet - no MetaMask needed
                    </p>
                  </div>

                  <button
                    onClick={onPay}
                    disabled={isProcessing}
                    className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-medium py-3 px-4 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isProcessing ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                            fill="none"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        Processing Payment...
                      </span>
                    ) : (
                      `Pay $${amountInUsdc} USDC`
                    )}
                  </button>
                </>
              ) : (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    Insufficient embedded wallet balance. Need ${amountInUsdc} USDC but have ${embeddedBalanceUsdc} USDC.
                  </p>
                  <p className="text-xs text-amber-500 mt-1">
                    Connect MetaMask to pay with an external wallet instead.
                  </p>
                </div>
              )}
            </div>
          ) : !isConnected ? (
            /* No embedded wallet and no MetaMask */
            <div className="mb-4">
              <button
                onClick={() => connect({ connector: injected() })}
                disabled={isConnecting}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
              >
                {isConnecting ? "Connecting..." : "Connect Wallet"}
              </button>
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
                Connect your wallet to make the payment, or register for a free embedded wallet
              </p>
            </div>
          ) : isSmartAccountLoading ? (
            <div className="mb-4">
              <div className="flex items-center justify-center gap-2 p-4 bg-gray-50 dark:bg-gray-950 dark:bg-gray-700 rounded-lg">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Setting up smart account...
                </span>
              </div>
            </div>
          ) : (
            <div className="mb-4">
              {/* Connected External Wallet Display */}
              <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      {isUsingSmartAccount && (
                        <span className="inline-flex items-center rounded bg-indigo-100 dark:bg-indigo-900/50 px-1.5 py-0.5 text-xs font-medium text-indigo-700 dark:text-indigo-300">
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
                      <span className="text-sm text-green-700 dark:text-green-400">
                        {displayAddress?.slice(0, 6)}...{displayAddress?.slice(-4)}
                      </span>
                    </div>
                    {isUsingSmartAccount && !isDeployed && (
                      <span className="text-xs text-amber-600 dark:text-amber-400">
                        Account will be deployed with first transaction
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => disconnect()}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300"
                >
                  Disconnect
                </button>
              </div>

              {/* Smart Account Benefits */}
              {isUsingSmartAccount && (
                <div className="mb-3 p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                  <p className="text-xs text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Paying with ERC-4337 Smart Account
                  </p>
                </div>
              )}

              <button
                onClick={onPay}
                disabled={isProcessing}
                className="w-full bg-gradient-to-r from-indigo-600 to-indigo-600 hover:from-indigo-700 hover:to-indigo-700 text-white font-medium py-3 px-4 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    {isUsingSmartAccount ? "Sending UserOperation..." : "Processing Payment..."}
                  </span>
                ) : (
                  `Pay $${amountInUsdc} USDC`
                )}
              </button>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Cancel Button */}
          <button
            onClick={onCancel}
            disabled={isProcessing}
            className="w-full bg-gray-100 dark:bg-gray-800 dark:bg-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Cancel
          </button>

          {/* Info */}
          <p className="text-xs text-gray-400 text-center mt-4">
            {hasEmbeddedWallet
              ? "Payments are processed from your embedded wallet (simulated testnet)"
              : `Payments are processed on Base Sepolia using USDC${isUsingSmartAccount ? " via ERC-4337" : ""}`}
          </p>
        </div>
      </div>
    </div>
  );
}
