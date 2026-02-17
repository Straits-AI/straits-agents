"use client";

import { useState } from "react";

interface ArtifactExportProps {
  artifactId: string;
  title: string;
}

type ExportFormat = "markdown" | "html" | "json" | "txt";

export function ArtifactExport({ artifactId, title }: ArtifactExportProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);

  const handleExport = async (format: ExportFormat) => {
    setExporting(format);
    try {
      const response = await fetch(`/api/artifacts/${artifactId}/export?format=${format}`);

      if (!response.ok) {
        throw new Error("Export failed");
      }

      // Get the blob from response
      const blob = await response.blob();

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = `${title}.${format === "markdown" ? "md" : format}`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+?)"/);
        if (match) {
          filename = match[1];
        }
      }

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setIsOpen(false);
    } catch (error) {
      console.error("Export failed:", error);
      alert("Failed to export artifact. Please try again.");
    } finally {
      setExporting(null);
    }
  };

  const formats: { id: ExportFormat; name: string; description: string; icon: string }[] = [
    { id: "markdown", name: "Markdown", description: "For docs and version control", icon: "M" },
    { id: "html", name: "HTML", description: "Print-ready web format", icon: "H" },
    { id: "json", name: "JSON", description: "Structured data export", icon: "J" },
    { id: "txt", name: "Plain Text", description: "Simple text format", icon: "T" },
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
        Export
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
            <div className="p-3 border-b border-gray-100">
              <h3 className="font-medium text-gray-900 dark:text-white">Export Document</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{title}</p>
            </div>
            <div className="p-2">
              {formats.map((format) => (
                <button
                  key={format.id}
                  onClick={() => handleExport(format.id)}
                  disabled={exporting !== null}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:bg-gray-950 transition-colors text-left disabled:opacity-50"
                >
                  <span className="w-8 h-8 bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center text-sm font-mono font-bold text-gray-600 dark:text-gray-400">
                    {format.icon}
                  </span>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 dark:text-white text-sm">
                      {format.name}
                      {exporting === format.id && (
                        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">Exporting...</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{format.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Artifact preview panel for chat interface
 */
interface ArtifactPreviewProps {
  artifact: {
    id: string;
    type: string;
    title: string;
    content: string;
    createdAt: string;
  } | null;
  onClose?: () => void;
}

export function ArtifactPreview({ artifact, onClose }: ArtifactPreviewProps) {
  if (!artifact) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <span className="text-xs uppercase tracking-wide text-indigo-600 font-medium">
              {artifact.type.replace(/-/g, " ")}
            </span>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{artifact.title}</h2>
          </div>
          <div className="flex items-center gap-2">
            <ArtifactExport artifactId={artifact.id} title={artifact.title} />
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:bg-gray-800"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="prose prose-indigo max-w-none">
            <MarkdownPreview content={artifact.content} />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 dark:bg-gray-950 text-sm text-gray-500 dark:text-gray-400 text-center">
          Generated on {new Date(artifact.createdAt).toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}

/**
 * Simple markdown preview component
 */
function MarkdownPreview({ content }: { content: string }) {
  // Basic markdown to HTML conversion
  const html = content
    .replace(/^### (.*?)$/gm, "<h3>$1</h3>")
    .replace(/^## (.*?)$/gm, "<h2>$1</h2>")
    .replace(/^# (.*?)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/^- (.*?)$/gm, "<li>$1</li>")
    .replace(/(<li>.*?<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)
    .replace(/^---$/gm, "<hr/>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br/>");

  return (
    <div
      dangerouslySetInnerHTML={{ __html: `<p>${html}</p>` }}
      className="[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-4 [&_h1]:text-gray-900
                 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-6 [&_h2]:mb-3 [&_h2]:text-gray-800
                 [&_h3]:text-lg [&_h3]:font-medium [&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:text-gray-700
                 [&_p]:mb-4 [&_p]:text-gray-600
                 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-4
                 [&_li]:mb-1
                 [&_hr]:my-6 [&_hr]:border-gray-200
                 [&_strong]:text-gray-900
                 [&_em]:text-gray-500 dark:text-gray-400"
    />
  );
}
