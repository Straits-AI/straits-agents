"use client";

import QRCode from "react-qr-code";
import { useCallback, useRef } from "react";

interface QRCodeDisplayProps {
  url: string;
  agentName: string;
  size?: number;
}

export function QRCodeDisplay({ url, agentName, size = 200 }: QRCodeDisplayProps) {
  const svgRef = useRef<HTMLDivElement>(null);

  const downloadPNG = useCallback(() => {
    const svg = svgRef.current?.querySelector("svg");
    if (!svg) return;

    const canvas = document.createElement("canvas");
    const padding = 32;
    canvas.width = size + padding * 2;
    canvas.height = size + padding * 2 + 40;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // White background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw QR code
    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, padding, padding, size, size);

      // Draw agent name below
      ctx.fillStyle = "#374151";
      ctx.font = "bold 14px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(agentName, canvas.width / 2, size + padding + 24);

      const link = document.createElement("a");
      link.download = `${agentName.toLowerCase().replace(/\s+/g, "-")}-qr.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    img.src = `data:image/svg+xml;base64,${btoa(svgData)}`;
  }, [size, agentName]);

  const fullUrl = url.startsWith("http") ? url : `${typeof window !== "undefined" ? window.location.origin : ""}${url}`;

  return (
    <div className="flex flex-col items-center gap-4">
      <div ref={svgRef} className="bg-white p-4 rounded-xl">
        <QRCode value={fullUrl} size={size} />
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 text-center break-all max-w-xs">
        {fullUrl}
      </p>
      <button
        onClick={downloadPNG}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Download as PNG
      </button>
    </div>
  );
}
