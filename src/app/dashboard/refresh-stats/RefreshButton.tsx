"use client";

import { useState } from "react";
import { runFullBackfill } from "./actions";

export default function RefreshButton() {
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [result, setResult] = useState<{
    careerRows?: number;
    tournamentRows?: number;
    error?: string;
  } | null>(null);

  async function handleClick() {
    setStatus("running");
    setResult(null);
    try {
      const res = await runFullBackfill();
      if (res.success) {
        setStatus("done");
        setResult({ careerRows: res.careerRows, tournamentRows: res.tournamentRows });
      } else {
        setStatus("error");
        setResult({ error: res.error });
      }
    } catch (err) {
      setStatus("error");
      setResult({ error: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  return (
    <div className="space-y-4">
      <button
        onClick={handleClick}
        disabled={status === "running"}
        className={`px-6 py-3 rounded-lg font-semibold text-white transition-colors ${
          status === "running"
            ? "bg-gray-500 cursor-not-allowed"
            : "bg-blue-600 hover:bg-blue-700"
        }`}
      >
        {status === "running" ? "Running backfill..." : "Run Full Backfill"}
      </button>

      {status === "done" && result && (
        <div className="p-4 bg-green-900/50 border border-green-700 rounded-lg text-green-200">
          <p className="font-semibold">Backfill complete!</p>
          <p>Career stats rows: {result.careerRows}</p>
          <p>Tournament stats rows: {result.tournamentRows}</p>
        </div>
      )}

      {status === "error" && result && (
        <div className="p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-200">
          <p className="font-semibold">Error</p>
          <p>{result.error}</p>
        </div>
      )}
    </div>
  );
}
