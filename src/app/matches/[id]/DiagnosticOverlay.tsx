"use client";

import { useEffect, useState } from "react";

/**
 * DiagnosticOverlay - Shows viewport and overflow information
 * Add ?debug=true to URL to activate
 *
 * Usage: Add <DiagnosticOverlay /> to your page component
 */
export default function DiagnosticOverlay() {
  const [isActive, setIsActive] = useState(false);
  const [diagnostics, setDiagnostics] = useState({
    viewportWidth: 0,
    documentWidth: 0,
    hasOverflow: false,
    overflowAmount: 0,
    devicePixelRatio: 1,
    userAgent: "",
    screenSize: "",
  });

  useEffect(() => {
    // Check if debug mode is enabled
    const params = new URLSearchParams(window.location.search);
    if (params.get("debug") === "true") {
      setIsActive(true);
    }

    const updateDiagnostics = () => {
      const viewportWidth = window.innerWidth;
      const documentWidth = document.documentElement.scrollWidth;
      const hasOverflow = documentWidth > viewportWidth;

      setDiagnostics({
        viewportWidth,
        documentWidth,
        hasOverflow,
        overflowAmount: documentWidth - viewportWidth,
        devicePixelRatio: window.devicePixelRatio,
        userAgent: navigator.userAgent,
        screenSize: `${window.screen.width}x${window.screen.height}`,
      });
    };

    if (isActive) {
      updateDiagnostics();
      window.addEventListener("resize", updateDiagnostics);
      return () => window.removeEventListener("resize", updateDiagnostics);
    }
  }, [isActive]);

  if (!isActive) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[9999] bg-black/95 text-white text-xs p-3 font-mono border-t-4"
      style={{
        borderTopColor: diagnostics.hasOverflow ? "#ef4444" : "#22c55e",
        maxHeight: "40vh",
        overflow: "auto",
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-sm">🔍 Display Diagnostics</h3>
        <button
          onClick={() => setIsActive(false)}
          className="px-2 py-1 bg-red-600 rounded text-white hover:bg-red-700"
        >
          Close
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {/* Overflow Status */}
        <div
          className={`p-2 rounded ${
            diagnostics.hasOverflow
              ? "bg-red-900/50 border border-red-500"
              : "bg-green-900/50 border border-green-500"
          }`}
        >
          <strong>
            {diagnostics.hasOverflow ? "❌ HORIZONTAL OVERFLOW DETECTED" : "✅ NO OVERFLOW"}
          </strong>
          {diagnostics.hasOverflow && (
            <div className="mt-1">Overflow: {diagnostics.overflowAmount}px</div>
          )}
        </div>

        {/* Viewport Info */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-blue-900/30 p-2 rounded border border-blue-500">
            <div className="font-bold">Viewport Width</div>
            <div className="text-lg">{diagnostics.viewportWidth}px</div>
          </div>
          <div className="bg-purple-900/30 p-2 rounded border border-purple-500">
            <div className="font-bold">Document Width</div>
            <div className="text-lg">{diagnostics.documentWidth}px</div>
          </div>
        </div>

        {/* Device Info */}
        <div className="bg-gray-800 p-2 rounded border border-gray-600">
          <div><strong>Screen:</strong> {diagnostics.screenSize}</div>
          <div><strong>DPR:</strong> {diagnostics.devicePixelRatio}x</div>
          <div className="truncate"><strong>UA:</strong> {diagnostics.userAgent}</div>
        </div>

        {/* Instructions */}
        <div className="bg-amber-900/30 p-2 rounded border border-amber-500 text-xs">
          <strong>💡 Tip:</strong> Open browser console and paste the contents of{" "}
          <code className="bg-black/50 px-1">diagnostic-overflow.js</code> to find problematic elements
        </div>
      </div>
    </div>
  );
}
