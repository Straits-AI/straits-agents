import Link from "next/link";
import { Header } from "@/components/Header";

export default function DocsPage() {
  return (
    <div className="min-h-full">
      <Header />

      <div className="min-h-[80vh] bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-4xl mx-auto px-4 py-16">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Documentation</h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-12">
            Learn how to integrate Straits Agents into your applications.
          </p>

          {/* Quick Links */}
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            <Link
              href="/developers"
              className="p-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-primary-300 hover:shadow-md transition-all"
            >
              <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Quick Start</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Get up and running with Straits Agents in minutes.</p>
            </Link>

            <Link
              href="/developers/dashboard"
              className="p-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-primary-300 hover:shadow-md transition-all"
            >
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">API Keys</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Manage your API keys in the developer dashboard.</p>
            </Link>

            <Link
              href="/marketplace"
              className="p-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-primary-300 hover:shadow-md transition-all"
            >
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Browse Agents</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Explore available agents in the marketplace.</p>
            </Link>

            <Link
              href="/wallet"
              className="p-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-primary-300 hover:shadow-md transition-all"
            >
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Wallet Management</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Manage your smart account and funds.</p>
            </Link>
          </div>

          {/* API Reference */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">API Reference</h2>

            <div className="space-y-6">
              {/* Chat API */}
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs font-medium rounded">POST</span>
                    <code className="text-sm font-mono text-gray-900 dark:text-white">/api/chat</code>
                  </div>
                </div>
                <div className="px-6 py-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Send a message to an agent and receive a streaming response.</p>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
{`{
  "messages": [
    { "role": "user", "content": "Hello!" }
  ],
  "agentId": "qr-menu",
  "sessionId": "uuid"
}`}
                  </pre>
                </div>
              </div>

              {/* Sessions API */}
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs font-medium rounded">POST</span>
                    <code className="text-sm font-mono text-gray-900 dark:text-white">/api/sessions</code>
                  </div>
                </div>
                <div className="px-6 py-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Create a new chat session with an agent.</p>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
{`{
  "agentId": "qr-menu"
}`}
                  </pre>
                </div>
              </div>

              {/* Agents API */}
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs font-medium rounded">GET</span>
                    <code className="text-sm font-mono text-gray-900 dark:text-white">/api/agents</code>
                  </div>
                </div>
                <div className="px-6 py-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">List all available agents in the marketplace.</p>
                </div>
              </div>
            </div>
          </section>

          {/* x402 Payments */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">x402 Micropayments</h2>
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Straits Agents uses the x402 protocol for micropayments. When a paid action is triggered,
                the API returns a 402 Payment Required response with payment details.
              </p>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
{`HTTP/1.1 402 Payment Required
Content-Type: application/json

{
  "paymentRequired": true,
  "amount": 1,
  "currency": "USDC",
  "recipientAddress": "0x...",
  "chainId": 97,
  "reason": "Query limit exceeded"
}`}
              </pre>
            </div>
          </section>

          {/* Smart Accounts */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Smart Accounts (ERC-4337)</h2>
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Straits Agents supports ERC-4337 smart accounts for gasless transactions and improved UX.
                Smart accounts are automatically created when you connect your wallet.
              </p>
              <div className="flex gap-4">
                <Link
                  href="/wallet"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm"
                >
                  Manage Wallet
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
