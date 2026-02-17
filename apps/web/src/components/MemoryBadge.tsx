"use client";

interface MemoryBadgeProps {
  memoryCount: number;
  onClick: () => void;
}

export function MemoryBadge({ memoryCount, onClick }: MemoryBadgeProps) {
  if (memoryCount === 0) return null;

  return (
    <button
      onClick={onClick}
      className="relative text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      title={`This agent remembers you (${memoryCount} memories)`}
    >
      {/* Brain icon */}
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
        />
      </svg>
      {/* Count badge */}
      <span className="absolute -top-0.5 -right-0.5 bg-indigo-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
        {memoryCount > 99 ? "99+" : memoryCount}
      </span>
    </button>
  );
}
