"use client";

import { agentTemplates, AgentTemplate } from "@/lib/agentTemplates";

interface TemplateStepProps {
  onSelect: (template: AgentTemplate) => void;
}

export function TemplateStep({ onSelect }: TemplateStepProps) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Choose a Template</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        Pick a starting point for your agent. You can customize everything later.
      </p>

      <div className="grid sm:grid-cols-2 gap-4">
        {agentTemplates.map((template) => (
          <button
            key={template.id}
            onClick={() => onSelect(template)}
            className="text-left p-6 bg-white dark:bg-gray-800 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors group"
          >
            <div className="flex items-start gap-4">
              <span className="text-3xl">{template.icon}</span>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {template.name}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {template.description}
                </p>
                <div className="flex flex-wrap gap-1 mt-3">
                  {template.defaultCapabilities.slice(0, 3).map((cap) => (
                    <span
                      key={cap}
                      className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded"
                    >
                      {cap}
                    </span>
                  ))}
                  {template.defaultCapabilities.length === 0 && (
                    <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                      fully customizable
                    </span>
                  )}
                </div>
              </div>
              <svg
                className="w-5 h-5 text-gray-400 group-hover:text-indigo-500 transition-colors flex-shrink-0 mt-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
