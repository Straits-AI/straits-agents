"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { useAuthContext } from "@/providers/AuthProvider";
import { WalletButton } from "@/components/WalletButton";

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="w-8 h-8" />;

  return (
    <button
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-800 transition-colors"
      aria-label="Toggle dark mode"
    >
      {resolvedTheme === "dark" ? (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  );
}

const navLinkClasses = "text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white";

export function Header() {
  const { user, isLoading, logout } = useAuthContext();

  return (
    <header className="border-b bg-white dark:bg-gray-900 dark:border-gray-800">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">SA</span>
              </div>
              <span className="font-semibold text-lg dark:text-white">Straits Agents</span>
            </Link>
          </div>

          <nav className="flex items-center gap-6">
            <Link href="/marketplace" className={navLinkClasses}>Marketplace</Link>
            <Link href="/developers" className={navLinkClasses}>Developers</Link>
            <Link href="/docs" className={navLinkClasses}>Docs</Link>

            <ThemeToggle />

            {isLoading ? (
              <div className="h-10 w-24 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
            ) : user ? (
              <div className="flex items-center gap-4">
                <Link href="/developers/my-agents" className={navLinkClasses}>My Agents</Link>
                <Link href="/wallet" className={`${navLinkClasses} flex items-center gap-1`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  Wallet
                </Link>
                <WalletButton />
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {user.name || user.email || `${user.walletAddress?.slice(0, 6)}...${user.walletAddress?.slice(-4)}`}
                  </span>
                  <button
                    onClick={logout}
                    className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white"
                  >
                    Logout
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <WalletButton />
                <Link href="/login" className={navLinkClasses}>Sign in</Link>
                <Link
                  href="/register"
                  className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
                >
                  Get Started
                </Link>
              </div>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
