//app/dashboard/tournaments/TournamentCURD/stages/TournamentBracket.tsx
"use client";

import { useMemo, useState } from "react";
import ModernKnockoutTree from "./KnockoutTree/ModernKnockoutTree";
import { useTournamentMatches } from "./KnockoutTree/hooks/useTournamentMatches";
import type { BracketMatch as Match, TeamsMap } from "@/app/lib/types";

type Props = {
  tournamentId: number;
  teamsMap: TeamsMap;
  title?: string;
  editable?: boolean;
};

export default function TournamentBracket({
  tournamentId,
  teamsMap,
  title = "Knockout Bracket",
  editable = false,
}: Props) {
  const { matches, isLoading, finishMatch, refetch } = useTournamentMatches(tournamentId);
  const [active, setActive] = useState<Match | null>(null);

  // NEW: confirm state + pending scores
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingScores, setPendingScores] = useState<{ a: number; b: number } | null>(null);

  const onMatchClick = (m: Match) => {
    if (m.status !== "finished" && m.team_a_id && m.team_b_id) setActive(m);
  };

  // Helper: is this the last unfinished match in the SAME stage?
  const isLastUnfinishedInStage = (target: Match): boolean => {
    // If stage_id is not present on your API shape, skip the confirm.
    const sid = (target as any).stage_id;
    if (sid == null) return false;
    const remaining = (matches ?? []).filter(
      (mm: any) => mm.stage_id === sid && mm.id !== target.id && mm.status !== "finished"
    );
    return remaining.length === 0;
  };

  // Do the actual finish (after confirm or if not last)
  const reallyFinishActive = async () => {
    if (!active || !pendingScores) return;
    const { a, b } = pendingScores;

    if (a === b) {
      alert("Scores cannot be equal for a finished match.");
      return;
    }
    const winnerId = a > b ? active.team_a_id! : active.team_b_id!;
    await finishMatch(active.id, {
      team_a_score: a,
      team_b_score: b,
      winner_team_id: winnerId,
    });
    setPendingScores(null);
    setActive(null);
    setConfirmOpen(false);
  };

  // Called by modal’s Save button; decides whether to show confirm
  const requestFinish = async (aScore: number, bScore: number) => {
    if (!active) return;
    setPendingScores({ a: aScore, b: bScore });

    if (isLastUnfinishedInStage(active)) {
      // Block with confirm
      setConfirmOpen(true);
    } else {
      // Finish immediately
      await reallyFinishActive();
    }
  };

  const headerStatus = useMemo(() => {
    if (isLoading) return "Loading bracket…";
    if (!matches?.length) return "No matches yet";
    return null;
  }, [isLoading, matches]);

  return (
    <div className="relative">
      {headerStatus && (
        <div className="text-white/60 text-sm mb-2">{headerStatus}</div>
      )}

      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-base text-white/90">Tournament #{tournamentId}</h3>
        <button
          onClick={() => refetch()}
          className="text-xs px-2 py-1 rounded border border-white/15 hover:border-white/30 text-white/70 hover:text-white"
          title="Reload matches"
        >
          Refresh
        </button>
      </div>

      <ModernKnockoutTree
        title={title}
        matches={matches}
        teamsMap={teamsMap}
        onMatchClick={onMatchClick}
        editable={editable}
      />

      {active && (
        <FinishMatchModal
          match={active}
          teamsMap={teamsMap}
          onClose={() => setActive(null)}
          onConfirm={requestFinish} // <-- funnel through confirm-aware handler
        />
      )}

      {/* NEW: blocking confirm dialog */}
      <ConfirmDialog
        open={confirmOpen}
        title="Finish last match of this stage?"
        message="This is the final unfinished match in this stage. Saving will automatically generate and save the next stage (e.g., knockout) in the database. Continue?"
        confirmLabel="Yes, continue"
        cancelLabel="Cancel"
        onConfirm={reallyFinishActive}
        onCancel={() => {
          setConfirmOpen(false);
          setPendingScores(null);
        }}
      />
    </div>
  );
}

function FinishMatchModal({
  match,
  teamsMap,
  onClose,
  onConfirm,
}: {
  match: Match;
  teamsMap: TeamsMap;
  onClose: () => void;
  onConfirm: (aScore: number, bScore: number) => void | Promise<void>;
}) {
  const [a, setA] = useState<string>("");
  const [b, setB] = useState<string>("");

  const aTeam = match.team_a_id ? teamsMap[match.team_a_id] : null;
  const bTeam = match.team_b_id ? teamsMap[match.team_b_id] : null;

  const disabled =
    !aTeam ||
    !bTeam ||
    a.trim() === "" ||
    b.trim() === "" ||
    Number(a) < 0 ||
    Number(b) < 0 ||
    Number.isNaN(Number(a)) ||
    Number.isNaN(Number(b));

  return (
    <div className="fixed inset-0 z-[50] grid place-items-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/90 p-5 shadow-2xl">
        <div className="mb-4">
          <h4 className="text-lg font-semibold text-white">Finish Match</h4>
          <p className="text-xs text-white/60 mt-1">
            Set the final score. The winner will be auto-derived and progression will update the next round.
          </p>
        </div>

        <div className="space-y-3">
          <TeamScoreRow
            label={aTeam?.name ?? "Team A"}
            value={a}
            onChange={setA}
            autoFocus
          />
          <TeamScoreRow
            label={bTeam?.name ?? "Team B"}
            value={b}
            onChange={setB}
          />
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-md border border-white/15 text-white/80 hover:text-white hover:border-white/30"
          >
            Cancel
          </button>
          <button
            disabled={disabled || Number(a) === Number(b)}
            onClick={() => onConfirm(Number(a), Number(b))}
            className={`px-3 py-1.5 text-sm rounded-md ${
              disabled || Number(a) === Number(b)
                ? "opacity-50 cursor-not-allowed bg-emerald-600/30 text-white/70"
                : "bg-emerald-600 hover:bg-emerald-500 text-white"
            }`}
            title={
              Number(a) === Number(b)
                ? "Scores must not be equal"
                : "Save final score"
            }
          >
            Save & Progress
          </button>
        </div>
      </div>
    </div>
  );
}

function TeamScoreRow({
  label,
  value,
  onChange,
  autoFocus = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-sm text-white/80">{label}</span>
      <input
        autoFocus={autoFocus}
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))}
        className="w-24 rounded-md border border-white/15 bg-slate-800/70 px-3 py-1.5 text-right text-white/90 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
        placeholder="0"
      />
    </label>
  );
}

/* ---------- Inline ConfirmDialog (or import your own) ---------- */
function ConfirmDialog({
  open,
  title = "Are you sure?",
  message,
  confirmLabel = "OK",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/90 p-5 shadow-2xl">
        <h4 className="text-lg font-semibold text-white">{title}</h4>
        <p className="mt-2 text-sm text-white/70">{message}</p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm rounded-md border border-white/15 text-white/80 hover:text-white hover:border-white/30"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="px-3 py-1.5 text-sm rounded-md bg-amber-600 hover:bg-amber-500 text-white"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
