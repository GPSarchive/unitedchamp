"use client";

import React, { useState } from "react";
import { Award, Calendar, Clock, Shield } from "lucide-react";
import PostponeDialog from "@/app/dashboard/matches/PostponeDialog";
import { awardForfeitWinMatchPageAction } from "./actions";
import type { MatchRow } from "@/app/lib/types";
import { SURFACE, layers, BUTTON_SHAPE, BUTTON_SHAPE_ORANGE } from "@/app/lib/ui/flat";

interface MatchAdminActionsProps {
  match: {
    id: number;
    status: "scheduled" | "postponed" | "finished";
    match_date: string | null;
    original_match_date?: string | null;
    postponement_reason?: string | null;
    teamA?: { name: string } | null;
    teamB?: { name: string } | null;
  };
}

// Rendered only inside MatchAdminSlot (admins + editors). The 3-0 buttons use
// the same logic as the dashboard's match panel (lib/awardForfeitWin.ts).
export default function MatchAdminActions({ match }: MatchAdminActionsProps) {
  const [showPostpone, setShowPostpone] = useState(false);
  const [awarding, setAwarding] = useState(false);
  const [awardError, setAwardError] = useState<string | null>(null);

  // Only show for scheduled or postponed matches (as in the dashboard, a 3-0
  // is offered only while the match is not finished).
  if (match.status !== "scheduled" && match.status !== "postponed") {
    return null;
  }

  const isPostponed = match.status === "postponed";
  const teamAName = match.teamA?.name ?? "Ομάδα Α";
  const teamBName = match.teamB?.name ?? "Ομάδα Β";

  const handleAwardForfeit = async (winningTeam: "A" | "B") => {
    const teamName = winningTeam === "A" ? teamAName : teamBName;
    const ok = confirm(
      `Απονομή νίκης 3-0 στην ${teamName};\n\n` +
        `• Σκορ ${teamAName} ${winningTeam === "A" ? "3-0" : "0-3"} ${teamBName}\n` +
        `• Ο αγώνας ολοκληρώνεται και η διοργάνωση προχωρά\n` +
        `• Δεν καταγράφονται στατιστικά παικτών`
    );
    if (!ok) return;

    setAwarding(true);
    setAwardError(null);
    try {
      const result = await awardForfeitWinMatchPageAction(match.id, winningTeam);
      if (!result.success) {
        setAwardError(result.error || "Η απονομή απέτυχε");
        return;
      }
      window.location.reload();
    } catch (error) {
      setAwardError(error instanceof Error ? error.message : "Άγνωστο σφάλμα");
    } finally {
      setAwarding(false);
    }
  };

  // Prepare match data for PostponeDialog
  const matchForDialog: MatchRow & {
    teamA?: { name: string };
    teamB?: { name: string };
  } = {
    id: match.id,
    status: match.status,
    match_date: match.match_date,
    original_match_date: match.original_match_date ?? null,
    postponement_reason: match.postponement_reason ?? null,
    team_a_score: 0,
    team_b_score: 0,
    winner_team_id: null,
    team_a_id: 0,
    team_b_id: 0,
    teamA: match.teamA || undefined,
    teamB: match.teamB || undefined,
  };

  return (
    <>
      {/* Admin Actions Bar */}
      <div
        className={`${SURFACE} p-4`}
        style={{ boxShadow: layers("#fb923c") }}
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-orange-300">
            <Shield className="h-5 w-5" />
            <span className="text-sm font-semibold">Ενέργειες Διαχειριστή</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(["A", "B"] as const).map((side) => (
                <button
                  key={side}
                  onClick={() => handleAwardForfeit(side)}
                  disabled={awarding}
                  title="Απονομή νίκης 3-0 λόγω ήττας αντιπάλου (χωρίς στατιστικά παικτών)"
                  className={`inline-flex min-w-0 items-center gap-2 px-4 py-2 ${BUTTON_SHAPE} text-white font-medium transition-all disabled:opacity-50`}
                >
                  <Award className="h-4 w-4 shrink-0" />
                  <span className="truncate">
                    3-0 στην {side === "A" ? teamAName : teamBName}
                  </span>
                </button>
              ))}
            <button
              onClick={() => setShowPostpone(true)}
              disabled={awarding}
              className={`inline-flex items-center gap-2 px-4 py-2 ${BUTTON_SHAPE_ORANGE} text-white font-medium transition-all disabled:opacity-50`}
            >
              {isPostponed ? <Calendar className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
              {isPostponed ? "Νέα Ημερομηνία" : "Αναβολή Αγώνα"}
            </button>
          </div>
        </div>
        {awardError && (
          <p className="mt-3 text-sm text-red-300">{awardError}</p>
        )}
      </div>

      {/* Postpone Dialog */}
      {showPostpone && (
        <PostponeDialog
          match={matchForDialog}
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
