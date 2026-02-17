"use client";

import { useState } from "react";

interface Document {
  id: string;
  title: string;
  contentType?: string;
}

interface DocumentStepProps {
  agentId: string;
  documentHints: string;
  onNext: () => void;
  onBack?: () => void;
  showBack?: boolean;
}

export function DocumentStep({ agentId, documentHints, onNext, onBack, showBack = true }: DocumentStepProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadDocument = async () => {
    if (!title.trim() || !content.trim()) {
      setError("Both title and content are required.");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const res = await fetch(`/api/agents/${agentId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), content: content.trim(), contentType: "text" }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to upload document");
      }

      const data = await res.json();
      setDocuments((prev) => [...prev, { id: data.id || crypto.randomUUID(), title: title.trim(), contentType: "text" }]);
      setTitle("");
      setContent("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const removeDocument = async (docId: string) => {
    try {
      await fetch(`/api/agents/${agentId}/documents?documentId=${docId}`, { method: "DELETE" });
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch {
      // Silently fail on delete — document list still shows removal
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Upload Knowledge Base</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-2">
        Add documents so your agent can answer questions using your content.
      </p>
      <p className="text-sm text-indigo-600 dark:text-indigo-400 mb-8">
        {documentHints}
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {/* Uploaded documents list */}
      {documents.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Uploaded Documents ({documents.length})
          </h3>
          <div className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-gray-900 dark:text-white">{doc.title}</span>
                </div>
                <button
                  onClick={() => removeDocument(doc.id)}
                  className="text-sm text-red-600 hover:text-red-700 dark:text-red-400"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload form */}
      <div className="space-y-4 max-w-2xl">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Document Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Full Menu, Product Catalog, FAQ"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Content
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={10}
            placeholder="Paste your document content here..."
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm"
          />
        </div>
        <button
          onClick={uploadDocument}
          disabled={uploading || !title.trim() || !content.trim()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
        >
          {uploading ? (
            "Uploading..."
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Upload Document
            </>
          )}
        </button>
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-8">
        {showBack && onBack ? (
          <button
            onClick={onBack}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            Back
          </button>
        ) : (
          <div />
        )}
        <button
          onClick={onNext}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          {documents.length > 0 ? "Continue" : "Skip for Now"}
        </button>
      </div>
    </div>
  );
}
