import Link from "next/link";
import { Header } from "@/components/Header";

export default function DevelopersPage() {
  return (
    <div className="min-h-full">
      <Header />

      {/* Hero */}
      <section className="bg-gradient-to-b from-indigo-50 to-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
            Build with Straits Agents
          </h1>
          <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Embed AI agents in your applications with our simple SDK. Pay only for what you use
            with x402 micropayments.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Link
              href="/developers/builder"
              className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
            >
              Build an Agent
            </Link>
            <Link
              href="/developers/dashboard"
              className="rounded-lg border border-gray-300 dark:border-gray-600 px-6 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:bg-gray-950"
            >
              Dashboard
            </Link>
            <Link
              href="#docs"
              className="text-sm font-semibold text-gray-700 dark:text-gray-300 hover:text-indigo-600"
            >
              API Docs →
            </Link>
          </div>
        </div>
      </section>

      {/* Quick Start */}
      <section id="quickstart" className="py-16 bg-white dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-center mb-12">Quick Start</h2>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="bg-gray-50 dark:bg-gray-950 rounded-xl p-6">
              <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center font-bold mb-4">
                1
              </div>
              <h3 className="font-semibold mb-2">Install the SDK</h3>
              <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-sm overflow-x-auto">
                <code>npm install @straits/sdk</code>
              </pre>
            </div>

            {/* Step 2 */}
            <div className="bg-gray-50 dark:bg-gray-950 rounded-xl p-6">
              <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center font-bold mb-4">
                2
              </div>
              <h3 className="font-semibold mb-2">Add the Widget</h3>
              <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-sm overflow-x-auto">
                <code>{`import { ChatWidget }
  from '@straits/sdk/react';

<ChatWidget
  config={{
    apiKey: 'your-key',
    agentId: 'qr-menu'
  }}
/>`}</code>
              </pre>
            </div>

            {/* Step 3 */}
            <div className="bg-gray-50 dark:bg-gray-950 rounded-xl p-6">
              <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center font-bold mb-4">
                3
              </div>
              <h3 className="font-semibold mb-2">Deploy</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Your users can now chat with AI agents. Payments are handled automatically via x402.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 bg-gray-50 dark:bg-gray-950">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-center mb-12">SDK Features</h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <FeatureCard
              title="React Components"
              description="Pre-built chat widget and provider for React applications"
              icon="R"
            />
            <FeatureCard
              title="Streaming Support"
              description="Real-time token streaming for responsive chat experiences"
              icon="S"
            />
            <FeatureCard
              title="x402 Payments"
              description="Built-in micropayment handling with USDC stablecoins"
              icon="$"
            />
            <FeatureCard
              title="RAG Integration"
              description="Automatic retrieval-augmented generation with citations"
              icon="D"
            />
          </div>
        </div>
      </section>

      {/* API Overview */}
      <section id="docs" className="py-16 bg-white dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-center mb-12">API Endpoints</h2>

          <div className="max-w-3xl mx-auto space-y-4">
            <ApiEndpoint
              method="POST"
              path="/api/chat"
              description="Send a message and get a streaming response"
            />
            <ApiEndpoint
              method="POST"
              path="/api/sessions"
              description="Create a new chat session"
            />
            <ApiEndpoint
              method="GET"
              path="/api/agents"
              description="List available agents"
            />
            <ApiEndpoint
              method="GET"
              path="/api/agents/:id"
              description="Get agent details and configuration"
            />
            <ApiEndpoint
              method="POST"
              path="/api/agents/:id/documents"
              description="Upload documents for RAG"
            />
            <ApiEndpoint
              method="GET"
              path="/api/agents/:id/feedback"
              description="Get agent feedback and ratings"
            />
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-16 bg-gray-50 dark:bg-gray-950">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-center mb-4">Simple Pricing</h2>
          <p className="text-center text-gray-600 dark:text-gray-400 mb-12">Pay per query with x402 micropayments</p>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <PricingCard
              title="Free Tier"
              price="$0"
              features={["5 free queries per session", "Basic RAG support", "Community support"]}
            />
            <PricingCard
              title="Pay-as-you-go"
              price="$0.01"
              perUnit="/query"
              features={[
                "Unlimited queries",
                "Full RAG with citations",
                "x402 USDC payments",
                "Priority support",
              ]}
              highlighted
            />
            <PricingCard
              title="Enterprise"
              price="Custom"
              features={[
                "Volume discounts",
                "Custom agents",
                "SLA guarantees",
                "Dedicated support",
              ]}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border">
      <span className="text-3xl mb-4 block w-10 h-10 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center font-bold">{icon}</span>
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>
    </div>
  );
}

function ApiEndpoint({
  method,
  path,
  description,
}: {
  method: string;
  path: string;
  description: string;
}) {
  const methodColors: Record<string, string> = {
    GET: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    POST: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
    PUT: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    DELETE: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };

  return (
    <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-950 rounded-lg">
      <span className={`px-2 py-1 rounded text-xs font-mono font-bold ${methodColors[method]}`}>
        {method}
      </span>
      <code className="font-mono text-sm flex-1">{path}</code>
      <span className="text-sm text-gray-500 dark:text-gray-400 hidden md:block">{description}</span>
    </div>
  );
}

function PricingCard({
  title,
  price,
  perUnit,
  features,
  highlighted,
}: {
  title: string;
  price: string;
  perUnit?: string;
  features: string[];
  highlighted?: boolean;
}) {
  return (
    <div
      className={`rounded-xl p-6 ${
        highlighted ? "bg-indigo-600 text-white ring-2 ring-indigo-600" : "bg-white dark:bg-gray-900 border"
      }`}
    >
      <h3 className="font-semibold mb-2">{title}</h3>
      <div className="mb-6">
        <span className="text-3xl font-bold">{price}</span>
        {perUnit && <span className="text-sm opacity-75">{perUnit}</span>}
      </div>
      <ul className="space-y-2">
        {features.map((feature) => (
          <li key={feature} className="flex items-center gap-2 text-sm">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            {feature}
          </li>
        ))}
      </ul>
    </div>
  );
}
