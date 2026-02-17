"use client";

import { useState } from "react";

interface Memory {
  id: string;
  memoryType: string;
  priority: string;
  content: string;
  observedAt: string;
  accessCount: number;
}

interface MemoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  agentName: string;
  memories: Memory[];
  onDelete: (memoryId: string) => void;
  onClearAll: () => void;
}

const PRIORITY_COLORS: Record<string, { dot: string; bg: string }> = {
  red: {
    dot: "bg-red-500",
    bg: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",
  },
  yellow: {
    dot: "bg-yellow-500",
    bg: "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800",
  },
  green: {
    dot: "bg-green-500",
    bg: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800",
  },
};

const TYPE_LABELS: Record<string, string> = {
  preference: "Preferences",
  fact: "Facts",
  context: "Context",
  decision: "Decisions",
  interaction: "Interactions",
};

export function MemoryPanel({
  isOpen,
  onClose,
  agentName,
  memories,
  onDelete,
  onClearAll,
}: MemoryPanelProps) {
  const [confirmClear, setConfirmClear] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (!isOpen) return null;

  // Group memories by type
  const grouped = memories.reduce<Record<string, Memory[]>>((acc, mem) => {
    const type = mem.memoryType || "fact";
    if (!acc[type]) acc[type] = [];
    acc[type].push(mem);
    return acc;
  }, {});

  const handleDelete = async (memoryId: string) => {
    setDeletingId(memoryId);
    await onDelete(memoryId);
    setDeletingId(null);
  };

  const handleClearAll = async () => {
    await onClearAll();
    setConfirmClear(false);
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white dark:bg-gray-900 shadow-xl z-50 flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">Memories</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              What {agentName} remembers about you
            </p>
          </div>
          <div className="flex items-center gap-2">
            {memories.length > 0 && (
              confirmClear ? (
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleClearAll}
                    className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setConfirmClear(false)}
                    className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmClear(true)}
                  className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                >
                  Clear all
                </button>
              )
            )}
            <button
              onClick={onClose}
              className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {memories.length === 0 ? (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
              <p className="text-sm">No memories yet</p>
              <p className="text-xs mt-1">Chat more to build memory</p>
            </div>
          ) : (
            Object.entries(grouped).map(([type, mems]) => (
              <div key={type}>
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                  {TYPE_LABELS[type] || type}
                </h3>
                <div className="space-y-2">
                  {mems.map((mem) => {
                    const colors = PRIORITY_COLORS[mem.priority] || PRIORITY_COLORS.yellow;
                    return (
                      <div
                        key={mem.id}
                        className={`relative group p-3 rounded-lg border ${colors.bg} transition-colors`}
                      >
                        <div className="flex items-start gap-2">
                          <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${colors.dot}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-900 dark:text-gray-100">{mem.content}</p>
                            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                              {new Date(mem.observedAt).toLocaleDateString()}
                            </p>
                          </div>
                          <button
                            onClick={() => handleDelete(mem.id)}
                            disabled={deletingId === mem.id}
                            className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-opacity flex-shrink-0"
                            title="Remove this memory"
                          >
                            {deletingId === mem.id ? (
                              <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-[10px] text-gray-400 dark:text-gray-500">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-red-500" /> Critical
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-yellow-500" /> Notable
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500" /> Background
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
