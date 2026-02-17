"use client";

import { useState, useEffect, useCallback } from "react";

export interface BasicInfo {
  name: string;
  slug: string;
  description: string;
  icon: string;
}

interface BasicInfoStepProps {
  initialData: BasicInfo;
  onChange: (data: BasicInfo) => void;
  onNext: () => void;
  onBack: () => void;
}

function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

export function BasicInfoStep({ initialData, onChange, onNext, onBack }: BasicInfoStepProps) {
  const [data, setData] = useState<BasicInfo>(initialData);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [slugSuggestion, setSlugSuggestion] = useState<string | null>(null);
  const [slugReason, setSlugReason] = useState<string | null>(null);

  const update = (partial: Partial<BasicInfo>) => {
    const next = { ...data, ...partial };
    setData(next);
    onChange(next);
  };

  const checkSlug = useCallback(async (slug: string) => {
    if (!slug || slug.length < 3) {
      setSlugStatus("idle");
      return;
    }
    setSlugStatus("checking");
    setSlugSuggestion(null);
    setSlugReason(null);
    try {
      const res = await fetch(`/api/agents/check-slug?slug=${encodeURIComponent(slug)}`);
      const result = await res.json();
      if (result.available) {
        setSlugStatus("available");
      } else {
        setSlugStatus("taken");
        setSlugReason(result.reason || null);
        setSlugSuggestion(result.suggestion || null);
      }
    } catch {
      setSlugStatus("idle");
    }
  }, []);

  // Debounced slug check
  useEffect(() => {
    if (!data.slug || data.slug.length < 3) return;
    const timer = setTimeout(() => checkSlug(data.slug), 400);
    return () => clearTimeout(timer);
  }, [data.slug, checkSlug]);

  const handleNameChange = (name: string) => {
    const next: Partial<BasicInfo> = { name };
    if (!slugManuallyEdited) {
      next.slug = nameToSlug(name);
    }
    update(next);
  };

  const handleSlugChange = (slug: string) => {
    setSlugManuallyEdited(true);
    update({ slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 50) });
  };

  const isValid = data.name.trim().length > 0 && data.slug.length >= 3 && slugStatus === "available";

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Basic Info</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        Name your agent and choose a URL slug for its chat page.
      </p>

      <div className="space-y-6 max-w-lg">
        {/* Agent Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Agent Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={data.name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="e.g., Joe's Pizza Menu"
            maxLength={100}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        {/* Slug */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Chat URL Slug <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center gap-0">
            <span className="px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-r-0 border-gray-300 dark:border-gray-600 rounded-l-lg text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
              /chat/
            </span>
            <input
              type="text"
              value={data.slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder="joes-pizza"
              maxLength={50}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-r-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          {/* Slug status indicator */}
          <div className="mt-1 text-sm">
            {slugStatus === "checking" && (
              <span className="text-gray-400">Checking availability...</span>
            )}
            {slugStatus === "available" && (
              <span className="text-green-600 dark:text-green-400">Available</span>
            )}
            {slugStatus === "taken" && (
              <span className="text-red-600 dark:text-red-400">
                {slugReason || "Not available"}
                {slugSuggestion && (
                  <>
                    {" "}Try{" "}
                    <button
                      onClick={() => { update({ slug: slugSuggestion }); setSlugManuallyEdited(true); }}
                      className="underline font-medium"
                    >
                      {slugSuggestion}
                    </button>
                    ?
                  </>
                )}
              </span>
            )}
          </div>
          {data.slug.length >= 3 && slugStatus === "available" && (
            <p className="mt-1 text-xs text-gray-400">
              {baseUrl}/chat/{data.slug}
            </p>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Description
          </label>
          <textarea
            value={data.description}
            onChange={(e) => update({ description: e.target.value })}
            placeholder="A short description of what your agent does"
            maxLength={500}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <p className="text-xs text-gray-400 mt-1">{data.description.length}/500</p>
        </div>

        {/* Icon */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Icon (emoji)
          </label>
          <input
            type="text"
            value={data.icon}
            onChange={(e) => update({ icon: e.target.value.slice(0, 4) })}
            className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-2xl text-center focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-8">
        <button
          onClick={onBack}
          className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
        >
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!isValid}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}
