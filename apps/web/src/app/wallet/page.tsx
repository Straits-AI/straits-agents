"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount, useBalance } from "wagmi";
import { parseUnits, formatUnits, type Address } from "viem";
import { Header } from "@/components/Header";
import { WalletButton } from "@/components/WalletButton";
import { useSmartAccountContext } from "@/providers/SmartAccountProvider";
import { useAuthContext } from "@/providers/AuthProvider";
import { getChainConfig, isSupportedChain } from "@/lib/smart-account/config";

export default function WalletPage() {
  const { address: eoaAddress, isConnected, chainId } = useAccount();
  const {
    smartAccountAddress,
    isSmartAccountReady,
    isDeployed,
    isLoading,
    error,
    withdrawToEoa,
    getExplorerUrl,
  } = useSmartAccountContext();
  const {
    hasEmbeddedWallet,
    embeddedWalletAddress,
    embeddedBalance,
    isAuthenticated,
  } = useAuthContext();

  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [onChainBalance, setOnChainBalance] = useState<string | null>(null);
  const [isLoadingOnChainBalance, setIsLoadingOnChainBalance] = useState(false);
  const [copied, setCopied] = useState(false);

  // Get USDC address for current chain
  const usdcAddress = chainId && isSupportedChain(chainId)
    ? getChainConfig(chainId).usdcAddress
    : undefined;

  // Fetch balances (native ETH for now - USDC would need useReadContract)
  const { data: eoaEthBalance } = useBalance({
    address: eoaAddress,
  });

  const { data: smartAccountEthBalance } = useBalance({
    address: smartAccountAddress as Address | undefined,
  });

  // For display purposes, using ETH balance
  const eoaBalance = eoaEthBalance;
  const smartAccountBalance = smartAccountEthBalance;

  const embeddedBalanceUsdc = (embeddedBalance / 100).toFixed(2);

  // Fetch on-chain USDC balance for embedded wallet
  const fetchOnChainBalance = useCallback(async () => {
    if (!embeddedWalletAddress) return;
    setIsLoadingOnChainBalance(true);
    try {
      const res = await fetch(`/api/wallet/balance?address=${embeddedWalletAddress}`);
      if (res.ok) {
        const data = await res.json();
        setOnChainBalance(data.usdcBalance ?? null);
      }
    } catch {
      // Silently fail — on-chain balance is supplemental
    } finally {
      setIsLoadingOnChainBalance(false);
    }
  }, [embeddedWalletAddress]);

  useEffect(() => {
    if (hasEmbeddedWallet && embeddedWalletAddress) {
      fetchOnChainBalance();
    }
  }, [hasEmbeddedWallet, embeddedWalletAddress, fetchOnChainBalance]);

  const handleCopyAddress = () => {
    if (embeddedWalletAddress) {
      navigator.clipboard.writeText(embeddedWalletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || !usdcAddress) return;

    setIsWithdrawing(true);
    setWithdrawError(null);
    setTxHash(null);

    try {
      const amount = parseUnits(withdrawAmount, 6); // USDC has 6 decimals
      const receipt = await withdrawToEoa(usdcAddress, amount);
      setTxHash(receipt.transactionHash);
      setWithdrawAmount("");
    } catch (err) {
      setWithdrawError(err instanceof Error ? err.message : "Withdrawal failed");
    } finally {
      setIsWithdrawing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Header />

      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Wallet Management</h1>

        <div className="space-y-6">
          {/* Embedded Wallet Section */}
          {isAuthenticated && hasEmbeddedWallet && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-teal-200 dark:border-teal-800 p-6">
              <h2 className="font-semibold mb-4 flex items-center gap-2 dark:text-white">
                <span className="inline-flex items-center rounded bg-teal-100 dark:bg-teal-900/50 px-2 py-0.5 text-xs font-medium text-teal-700 dark:text-teal-400">
                  Smart Account
                </span>
                Embedded Wallet
              </h2>

              <div className="space-y-4">
                {/* Smart Account Address */}
                <div className="p-4 bg-teal-50 dark:bg-teal-950/30 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-teal-700 dark:text-teal-400">Smart Account Address</span>
                    <button
                      onClick={handleCopyAddress}
                      className="text-xs text-teal-600 dark:text-teal-400 hover:underline"
                    >
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <div className="font-mono text-sm break-all text-teal-900 dark:text-teal-100 bg-white dark:bg-gray-900 p-2 rounded border border-teal-200 dark:border-teal-800">
                    {embeddedWalletAddress}
                  </div>

                  {/* On-chain USDC Balance */}
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-sm text-teal-700 dark:text-teal-400">On-chain USDC</span>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-teal-900 dark:text-teal-100">
                        {isLoadingOnChainBalance
                          ? "..."
                          : onChainBalance !== null
                            ? `${onChainBalance} USDC`
                            : "-- USDC"}
                      </span>
                      <button
                        onClick={fetchOnChainBalance}
                        className="text-xs text-teal-600 dark:text-teal-400 hover:underline"
                        disabled={isLoadingOnChainBalance}
                      >
                        Refresh
                      </button>
                    </div>
                  </div>

                  {/* Simulated Balance */}
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-sm text-teal-700 dark:text-teal-400">Testnet Credits</span>
                    <span className="text-sm text-teal-700 dark:text-teal-400">
                      ${embeddedBalanceUsdc}
                    </span>
                  </div>
                </div>

                {/* Funding Instructions */}
                <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-1">Fund your wallet</p>
                  <p className="text-xs text-blue-700 dark:text-blue-400">
                    Send USDC on Arbitrum Sepolia to the smart account address above.
                    Gas fees are paid in USDC via the ERC-20 paymaster — no ETH needed.
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                    When on-chain USDC is available, payments produce real verifiable transaction hashes.
                    Otherwise, testnet credits are used for simulated payments.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* External Wallet Section */}
          {!isConnected ? (
            <div className="bg-white dark:bg-gray-900 rounded-xl border p-8 text-center">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {hasEmbeddedWallet
                  ? "Optionally connect an external wallet for on-chain payments"
                  : "Connect your wallet to get started"}
              </p>
              <WalletButton />
            </div>
          ) : (
            <>
              {/* Account Overview */}
              <div className="bg-white dark:bg-gray-900 rounded-xl border p-6">
                <h2 className="font-semibold mb-4">External Wallet</h2>

                {isLoading ? (
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                    Setting up smart account...
                  </div>
                ) : error ? (
                  <div className="text-red-600 text-sm">{error.message}</div>
                ) : (
                  <div className="space-y-4">
                    {/* EOA */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-950 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-500 dark:text-gray-400">EOA (Signing Wallet)</span>
                        <span className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded">Controller</span>
                      </div>
                      <div className="font-mono text-sm break-all">{eoaAddress}</div>
                      {eoaBalance && (
                        <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                          Balance: {formatUnits(eoaBalance.value, 18)} ETH
                        </div>
                      )}
                    </div>

                    {/* Smart Account */}
                    {isSmartAccountReady && smartAccountAddress && (
                      <div className="p-4 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg border border-indigo-200 dark:border-indigo-800">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-indigo-700 dark:text-indigo-400 font-medium flex items-center gap-1">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                            Safe Smart Account
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded ${isDeployed ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400' : 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400'}`}>
                            {isDeployed ? 'Deployed' : 'Not Deployed'}
                          </span>
                        </div>
                        <div className="font-mono text-sm break-all dark:text-indigo-100">{smartAccountAddress}</div>
                        {smartAccountBalance && (
                          <div className="mt-2 text-sm text-indigo-700 dark:text-indigo-400">
                            Balance: {formatUnits(smartAccountBalance.value, 18)} ETH
                          </div>
                        )}
                        {!isDeployed && (
                          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                            Account will be deployed on first transaction
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Deposit Instructions */}
              {isSmartAccountReady && smartAccountAddress && (
                <div className="bg-white dark:bg-gray-900 rounded-xl border p-6">
                  <h2 className="font-semibold mb-4">Deposit Funds</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Send USDC to your smart account address to fund it for agent payments.
                  </p>
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                    <p className="text-xs text-blue-700 dark:text-blue-400 mb-2">Send USDC to:</p>
                    <div className="font-mono text-sm break-all bg-white dark:bg-gray-900 p-2 rounded border dark:border-blue-800">
                      {smartAccountAddress}
                    </div>
                    <button
                      onClick={() => navigator.clipboard.writeText(smartAccountAddress)}
                      className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Copy address
                    </button>
                  </div>
                  <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                    Chain: {chainId && isSupportedChain(chainId) ? getChainConfig(chainId).name : 'Unknown'}
                  </p>
                </div>
              )}

              {/* Withdraw */}
              {isSmartAccountReady && smartAccountAddress && (
                <div className="bg-white dark:bg-gray-900 rounded-xl border p-6">
                  <h2 className="font-semibold mb-4">Withdraw Funds</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Withdraw USDC from your smart account back to your EOA wallet.
                  </p>

                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder="Amount in USDC"
                      className="flex-1 px-3 py-2 border dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 dark:text-white"
                      step="0.01"
                      min="0"
                    />
                    <button
                      onClick={handleWithdraw}
                      disabled={isWithdrawing || !withdrawAmount}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {isWithdrawing ? "Withdrawing..." : "Withdraw"}
                    </button>
                  </div>

                  {withdrawError && (
                    <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
                      {withdrawError}
                    </div>
                  )}

                  {txHash && (
                    <div className="mt-4 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
                      <p className="text-sm text-green-700 dark:text-green-400">Withdrawal successful!</p>
                      <a
                        href={getExplorerUrl(txHash as `0x${string}`)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-green-600 dark:text-green-400 hover:underline"
                      >
                        View transaction
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* No Bundler Warning */}
              {!isSmartAccountReady && !isLoading && !error && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-6">
                  <h3 className="font-medium text-amber-800 dark:text-amber-300 mb-2">Smart Account Not Available</h3>
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    No bundler is configured. Transactions will use your EOA wallet directly.
                    To enable smart account features, add a bundler API key to your environment.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
