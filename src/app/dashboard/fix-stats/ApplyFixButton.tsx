"use client";

import { useState, useTransition } from "react";
import { applySyncFix } from "./actions";

export default function ApplyFixButton() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  function handleClick() {
    if (!confirm("This will overwrite player_statistics with values recalculated from match data. Continue?")) {
      return;
    }
    setResult(null);
    startTransition(async () => {
      try {
        const res = await applySyncFix();
        setResult(`Done! Updated stats for ${res.updated} players. Page will refresh.`);
      } catch (e: any) {
        setResult(`Error: ${e.message}`);
      }
    });
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleClick}
        disabled={isPending}
        className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-semibold text-sm transition-colors"
      >
        {isPending ? "Applying..." : "Apply Fix"}
      </button>
      {result && (
        <span
          className={`text-sm ${
            result.startsWith("Error") ? "text-red-400" : "text-emerald-400"
          }`}
        >
          {result}
        </span>
      )}
    </div>
  );
}
