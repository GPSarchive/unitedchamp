// app/dashboard/tournaments/TournamentCURD/submit/components/ExpandedRowEditor.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useMatchUpdate } from "./Usematchupdate";
import type { DraftMatch } from "../TournamentWizard";

interface ExpandedRowEditorProps {
  match: DraftMatch;
  teams: { id: number; name: string; logo: string | null }[];
  onUpdate: (patch: Partial<DraftMatch>) => void;
  onServerUpdate?: (matchId: number) => void; // Callback after successful server update
  allowDraws: boolean;
  stageKind: "knockout" | "groups" | "league" | null;
}

export function ExpandedRowEditor({
  match,
  teams,
  onUpdate,
  onServerUpdate,
  allowDraws,
  stageKind,
}: ExpandedRowEditorProps) {
  const [localStatus, setLocalStatus] = useState<"scheduled" | "finished">(match.status ?? "scheduled");
  const [localScoreA, setLocalScoreA] = useState(match.team_a_score ?? 0);
  const [localScoreB, setLocalScoreB] = useState(match.team_b_score ?? 0);
  const [localWinner, setLocalWinner] = useState(match.winner_team_id ?? null);
  const [localField, setLocalField] = useState((match as any).field ?? "");
  const [showSuccess, setShowSuccess] = useState(false);

  const { updateMatch, isUpdating, error, clearError } = useMatchUpdate({
    onSuccess: (matchId) => {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      onServerUpdate?.(matchId);
    },
  });

  const isFinished = localStatus === "finished";
  const scoresEqual = localScoreA === localScoreB;
  const isDraw = isFinished && allowDraws && scoresEqual;

  // Auto-clear winner for draws
  useEffect(() => {
    if (isDraw && localWinner != null) {
      setLocalWinner(null);
    }
  }, [isDraw, localWinner]);

  const handleSave = async () => {
    // First, update local state via the parent's onUpdate
    const patch: Partial<DraftMatch> = {
      status: localStatus as "scheduled" | "finished",
      team_a_score: isFinished ? localScoreA : null,
      team_b_score: isFinished ? localScoreB : null,
      winner_team_id: isFinished ? (isDraw ? null : localWinner) : null,
      field: localField || null,
    };
    
    // Update local store immediately for UI responsiveness
    onUpdate(patch);

    // If we have a database ID, also update the server
    const dbId = (match as any).db_id;
    if (dbId && typeof dbId === 'number') {
      // patch.status may be "scheduled" | "finished" | null | undefined (from DraftMatch),
      // normalize to "scheduled" | "finished" | undefined for the server updater
      const statusForServer: "scheduled" | "finished" | undefined = patch.status ?? undefined;
      await updateMatch({
        matchId: dbId,
        status: statusForServer,
        team_a_score: patch.team_a_score,
        team_b_score: patch.team_b_score,
        winner_team_id: patch.winner_team_id,
        field: patch.field,
      });
    }
  };

  const validationError = useMemo(() => {
    if (isFinished) {
      if (localScoreA < 0 || localScoreB < 0) return "Scores cannot be negative";
      
      if (allowDraws && scoresEqual) {
        if (localWinner != null) return "Winner must be empty for a draw";
      } else {
        if (!localWinner) return "Winner is required when status is 'finished'";
        if (![match.team_a_id, match.team_b_id].includes(localWinner))
          return "Winner must be Team A or Team B";
      }
    }
    return null;
  }, [isFinished, localScoreA, localScoreB, scoresEqual, allowDraws, localWinner, match.team_a_id, match.team_b_id]);

  return (
    <div className="bg-zinc-900/50 p-4 space-y-4 border-t border-white/10">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Status */}
        <label className="flex flex-col gap-1">
          <span className="text-xs text-white/70">Status</span>
          <select
            value={localStatus}
            onChange={(e) => {
              setLocalStatus(e.target.value as "scheduled" | "finished");
              clearError();
            }}
            className="px-3 py-2 min-h-[44px] rounded-md bg-slate-950 text-white border border-white/10 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
          >
            <option value="scheduled">Scheduled</option>
            <option value="finished">Finished</option>
          </select>
        </label>

        {/* Team A Score */}
        <label className="flex flex-col gap-1">
          <span className="text-xs text-white/70">Team A Score</span>
          <input
            type="number"
            min={0}
            value={localScoreA}
            onChange={(e) => setLocalScoreA(Number(e.target.value) || 0)}
            disabled={!isFinished}
            className="px-3 py-2 min-h-[44px] rounded-md bg-slate-950 text-white border border-white/10 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
          />
        </label>

        {/* Team B Score */}
        <label className="flex flex-col gap-1">
          <span className="text-xs text-white/70">Team B Score</span>
          <input
            type="number"
            min={0}
            value={localScoreB}
            onChange={(e) => setLocalScoreB(Number(e.target.value) || 0)}
            disabled={!isFinished}
            className="px-3 py-2 min-h-[44px] rounded-md bg-slate-950 text-white border border-white/10 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
          />
        </label>

        {/* Winner */}
        <label className="flex flex-col gap-1">
          <span className="text-xs text-white/70">Winner</span>
          <select
            value={localWinner ?? ""}
            onChange={(e) => setLocalWinner(e.target.value === "" ? null : Number(e.target.value))}
            disabled={isDraw || !isFinished}
            className="px-3 py-2 min-h-[44px] rounded-md bg-slate-950 text-white border border-white/10 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
          >
            <option value="">— Select Winner —</option>
            {([match.team_a_id, match.team_b_id]
              .filter((id): id is number => typeof id === "number"))
              .map((id) => {
                const t = teams.find((x) => x.id === id) ?? null;
                return (
                  <option key={id} value={id}>
                    {t ? `${t.name} (#${id})` : `#${id}`}
                  </option>
                );
              })}
          </select>
          {isFinished && allowDraws && scoresEqual && (
            <span className="text-xs text-emerald-300 mt-1">Draw — winner will be empty</span>
          )}
          {isFinished && !allowDraws && scoresEqual && !localWinner && (
            <span className="text-xs text-rose-300 mt-1">Draws not allowed — pick a winner</span>
          )}
        </label>

        {/* Field/Venue */}
        <label className="flex flex-col gap-1">
          <span className="text-xs text-white/70">Field/Venue</span>
          <input
            type="text"
            value={localField}
            onChange={(e) => setLocalField(e.target.value)}
            placeholder="e.g., Stadium A"
            className="px-3 py-2 min-h-[44px] rounded-md bg-slate-950 text-white border border-white/10 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 placeholder:text-white/30"
          />
        </label>
      </div>

      {/* Status Messages */}
      {validationError && (
        <p className="text-rose-300 text-sm">{validationError}</p>
      )}
      {error && (
        <p className="text-rose-300 text-sm">Server error: {error}</p>
      )}
      {showSuccess && (
        <p className="text-emerald-300 text-sm">✓ Match updated successfully</p>
      )}

      {/* Save Button */}
      <div className="flex justify-end gap-2">
        <button
          onClick={handleSave}
          disabled={!!validationError || isUpdating}
          className={`
            px-4 py-2 rounded-md text-white transition-all
            ${isUpdating 
              ? 'bg-gray-600 cursor-wait' 
              : 'bg-emerald-600/80 hover:bg-emerald-600'}
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        >
          {isUpdating ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Saving...
            </span>
          ) : (
            'Save Changes'
          )}
        </button>
      </div>
    </div>
  );
}