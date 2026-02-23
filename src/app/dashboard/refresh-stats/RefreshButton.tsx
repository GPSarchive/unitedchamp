"use client";

import { useState } from "react";
import { runFullBackfill, runTournamentCountsBackfill } from "./actions";

export default function RefreshButton() {
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [result, setResult] = useState<{
    careerRows?: number;
    tournamentRows?: number;
    mpsRowsProcessed?: number;
    error?: string;
  } | null>(null);

  async function handleClick() {
    setStatus("running");
    setResult(null);
    try {
      const res = await runFullBackfill();
      if (res.success) {
        setStatus("done");
        setResult({
          careerRows: res.careerRows,
          tournamentRows: res.tournamentRows,
          mpsRowsProcessed: res.mpsRowsProcessed,
        });
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
          <p>match_player_stats rows processed: {result.mpsRowsProcessed}</p>
          <p>Career stats rows written: {result.careerRows}</p>
          <p>Tournament stats rows written: {result.tournamentRows}</p>
          <p className="text-xs text-green-400 mt-2">
            Verify: the &quot;rows processed&quot; count should match your total match_player_stats
            row count in Supabase.
          </p>
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

export function RefreshTournamentCountsButton() {
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [result, setResult] = useState<{
    tournamentsUpdated?: number;
    error?: string;
  } | null>(null);

  async function handleClick() {
    setStatus("running");
    setResult(null);
    try {
      const res = await runTournamentCountsBackfill();
      if (res.success) {
        setStatus("done");
        setResult({ tournamentsUpdated: res.tournamentsUpdated });
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
            : "bg-orange-600 hover:bg-orange-700"
        }`}
      >
        {status === "running" ? "Refreshing counts..." : "Refresh Tournament Counts"}
      </button>

      {status === "done" && result && (
        <div className="p-4 bg-green-900/50 border border-green-700 rounded-lg text-green-200">
          <p className="font-semibold">Tournament counts refreshed!</p>
          <p>Tournaments updated: {result.tournamentsUpdated}</p>
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
