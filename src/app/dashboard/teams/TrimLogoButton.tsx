// components/DashboardPageComponents/teams/TrimLogoButton.tsx
"use client";

import React, { useState } from "react";

interface TrimLogoButtonProps {
  teamId: number;
  hasLogo: boolean;
  onTrimmed?: () => void; // callback to refresh preview
}

export default function TrimLogoButton({ teamId, hasLogo, onTrimmed }: TrimLogoButtonProps) {
  const [trimming, setTrimming] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleTrim() {
    if (!hasLogo) return;
    
    setTrimming(true);
    setResult(null);

    try {
      const res = await fetch(`/api/teams/${teamId}/trim-logo`, {
        method: "POST",
        credentials: "include",
      });
      
      const body = await res.json();

      if (!res.ok) {
        setResult(`❌ ${body.error || "Failed"}`);
        return;
      }

      if (body.trimmed) {
        setResult(`✅ ${body.before.width}×${body.before.height} → ${body.after.width}×${body.after.height}`);
        onTrimmed?.();
      } else {
        setResult("✓ Already trimmed");
      }
    } catch (err: any) {
      setResult(`❌ ${err.message || "Error"}`);
    } finally {
      setTrimming(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleTrim}
        disabled={trimming || !hasLogo}
        className="px-3 py-1.5 text-sm rounded-lg border border-white/15 text-white/80 hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
        title={!hasLogo ? "No logo to trim" : "Remove transparent padding from logo"}
      >
        {trimming ? "Trimming…" : "Trim Logo"}
      </button>
      
      {result && (
        <span className="text-xs text-white/60">{result}</span>
      )}
    </div>
  );
}