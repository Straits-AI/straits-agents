"use client";

interface ReputationBadgeProps {
  rating: number;
  totalReviews: number;
  trustLevel: "unverified" | "basic" | "verified" | "premium";
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

export function ReputationBadge({
  rating,
  totalReviews,
  trustLevel,
  size = "md",
  showLabel = true,
}: ReputationBadgeProps) {
  const sizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  const badgeColors = {
    unverified: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 dark:bg-gray-700 dark:text-gray-400",
    basic: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    verified: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    premium: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  };

  const trustLabels = {
    unverified: "Unverified",
    basic: "Basic",
    verified: "Verified",
    premium: "Premium",
  };

  const trustIcons = {
    unverified: null,
    basic: (
      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    verified: (
      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
          clipRule="evenodd"
        />
      </svg>
    ),
    premium: (
      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z"
          clipRule="evenodd"
        />
      </svg>
    ),
  };

  // Convert rating to display format (0-5)
  const displayRating = Math.round(rating * 10) / 10;

  return (
    <div className={`flex items-center gap-2 ${sizeClasses[size]}`}>
      {/* Star Rating */}
      <div className="flex items-center gap-1">
        <svg
          className={`${size === "sm" ? "w-3 h-3" : size === "md" ? "w-4 h-4" : "w-5 h-5"} text-yellow-400`}
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z"
            clipRule="evenodd"
          />
        </svg>
        <span className="font-semibold">{displayRating || "N/A"}</span>
        <span className="text-gray-500 dark:text-gray-400">
          ({totalReviews} {totalReviews === 1 ? "review" : "reviews"})
        </span>
      </div>

      {/* Trust Badge */}
      {showLabel && trustLevel !== "unverified" && (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${badgeColors[trustLevel]}`}
        >
          {trustIcons[trustLevel]}
          {trustLabels[trustLevel]}
        </span>
      )}
    </div>
  );
}

export function ReputationStats({
  distribution,
  totalReviews,
}: {
  distribution: Record<number, number>;
  totalReviews: number;
}) {
  return (
    <div className="space-y-2">
      {[5, 4, 3, 2, 1].map((star) => {
        const count = distribution[star] || 0;
        const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;

        return (
          <div key={star} className="flex items-center gap-2">
            <span className="text-sm w-3">{star}</span>
            <svg
              className="w-4 h-4 text-yellow-400"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z"
                clipRule="evenodd"
              />
            </svg>
            <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-yellow-400 rounded-full transition-all"
                style={{ width: `${percentage}%` }}
              />
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400 w-8">
              {count}
            </span>
          </div>
        );
      })}
    </div>
  );
}
