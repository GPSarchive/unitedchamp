"use client";

import React, { useState } from "react";
import { Clock, Shield } from "lucide-react";
import PostponeDialog from "@/app/dashboard/matches/PostponeDialog";

interface MatchAdminActionsProps {
  match: {
    id: number;
    status: "scheduled" | "postponed" | "finished";
    match_date: string | null;
    teamA?: { name: string } | null;
    teamB?: { name: string } | null;
  };
}

export default function MatchAdminActions({ match }: MatchAdminActionsProps) {
  const [showPostpone, setShowPostpone] = useState(false);

  // Only show for scheduled or postponed matches
  if (match.status !== "scheduled" && match.status !== "postponed") {
    return null;
  }

  return (
    <>
      {/* Admin Actions Bar */}
      <div className="rounded-lg border border-orange-400/30 bg-gradient-to-r from-orange-950/20 via-black to-orange-950/20 p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-orange-300">
            <Shield className="h-5 w-5" />
            <span className="text-sm font-semibold">Ενέργειες Διαχειριστή</span>
          </div>
          <button
            onClick={() => setShowPostpone(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-orange-400/40 bg-orange-700/30 hover:bg-orange-700/50 text-white font-medium transition-all shadow-lg shadow-orange-500/20"
          >
            <Clock className="h-4 w-4" />
            Αναβολή Αγώνα
          </button>
        </div>
      </div>

      {/* Postpone Dialog */}
      {showPostpone && (
        <PostponeDialog
          match={{
            id: match.id,
            match_date: match.match_date,
            teamA: match.teamA ?? undefined,
            teamB: match.teamB ?? undefined,
          }}
          onCancel={() => setShowPostpone(false)}
          onSuccess={() => {
            setShowPostpone(false);
            // Refresh the page to show updated data
            window.location.reload();
          }}
        />
      )}
    </>
  );
}
