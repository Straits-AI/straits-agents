"use client";

import Link from "next/link";
import { QRCodeDisplay } from "@/components/QRCodeDisplay";

interface SuccessStepProps {
  agentId: string;
  agentName: string;
  slug: string;
}

export function SuccessStep({ agentId, agentName, slug }: SuccessStepProps) {
  const chatUrl = `/chat/${slug}`;

  return (
    <div className="text-center">
      <div className="w-16 h-16 mx-auto mb-6 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
        <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        Agent Created!
      </h2>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        Your agent <strong>{agentName}</strong> is live and ready to chat.
      </p>

      {/* QR Code */}
      <div className="mb-8">
        <QRCodeDisplay url={chatUrl} agentName={agentName} />
      </div>

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        <Link
          href={chatUrl}
          className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          Open Chat
        </Link>
        <Link
          href={`/developers/my-agents/${agentId}`}
          className="inline-flex items-center gap-2 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium"
        >
          Manage Agent
        </Link>
        <Link
          href="/developers/my-agents"
          className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
        >
          Go to My Agents
        </Link>
      </div>
    </div>
  );
}
