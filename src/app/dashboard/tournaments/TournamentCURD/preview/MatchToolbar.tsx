"use client";

import { useState, useMemo } from "react";
import type { DraftMatch } from "../TournamentWizard";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type MatchToolbarProps = {
  /** All matches for the current stage (with overlay merged) */
  allRowsForStage: DraftMatch[];
  /** Currently visible matches (filtered by group, search, etc.) */
  visible: DraftMatch[];
  /** Whether current stage is KO */
  isKO: boolean;
  /** Whether current stage is groups */
  isGroups: boolean;
  /** Callback: full regenerate (existing behaviour) */
  onRegenerate: () => void;
  /** Callback: update matches in bulk */
  onBulkUpdate: (updater: (rows: DraftMatch[]) => DraftMatch[]) => void;
  /** Callback: remove a single match */
  onRemoveMatch: (m: DraftMatch) => void;
  /** Callback: add a new empty row */
  onAddRow: () => void;
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Fisher-Yates shuffle */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function isFinished(m: DraftMatch): boolean {
  return (m as any).status === "finished";
}

function uniqueMatchdays(rows: DraftMatch[]): number[] {
  const set = new Set<number>();
  rows.forEach((r) => {
    if (r.matchday != null && r.matchday > 0) set.add(r.matchday);
  });
  return [...set].sort((a, b) => a - b);
}

/* ------------------------------------------------------------------ */
/*  Sub-dialogs                                                        */
/* ------------------------------------------------------------------ */

function Backdrop({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-xl border border-white/15 bg-zinc-900 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function MatchToolbar({
  allRowsForStage,
  visible,
  isKO,
  isGroups,
  onRegenerate,
  onBulkUpdate,
  onRemoveMatch,
  onAddRow,
}: MatchToolbarProps) {
  /* --- Dialog state --- */
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  const [showBatchDate, setShowBatchDate] = useState(false);
  const [showSwapMD, setShowSwapMD] = useState(false);

  /* --- Derived stats --- */
  const finishedCount = useMemo(
    () => allRowsForStage.filter(isFinished).length,
    [allRowsForStage]
  );
  const scheduledCount = allRowsForStage.length - finishedCount;

  const matchdays = useMemo(
    () => uniqueMatchdays(allRowsForStage),
    [allRowsForStage]
  );

  /* ============================================================== */
  /*  1. Regenerate with confirmation                                */
  /* ============================================================== */
  const handleRegenerateConfirmed = () => {
    onRegenerate();
    setShowRegenConfirm(false);
  };

  /* ============================================================== */
  /*  2. Shuffle Unplayed                                            */
  /* ============================================================== */
  const handleShuffleUnplayed = () => {
    if (scheduledCount === 0) return;

    onBulkUpdate((rows) => {
      // Group scheduled matches by matchday
      const byMD = new Map<number, { idx: number; match: DraftMatch }[]>();
      rows.forEach((m, idx) => {
        if (isFinished(m)) return;
        const md = m.matchday ?? 0;
        if (!byMD.has(md)) byMD.set(md, []);
        byMD.get(md)!.push({ idx, match: m });
      });

      const next = [...rows];

      // For each matchday, shuffle the team assignments among scheduled matches
      for (const [, entries] of byMD) {
        if (entries.length < 2) continue;

        // Collect all team pairs from unfinished matches in this matchday
        const pairs = entries.map((e) => ({
          team_a_id: e.match.team_a_id,
          team_b_id: e.match.team_b_id,
        }));
        const shuffled = shuffle(pairs);

        entries.forEach((e, i) => {
          next[e.idx] = {
            ...next[e.idx],
            team_a_id: shuffled[i].team_a_id,
            team_b_id: shuffled[i].team_b_id,
          };
        });
      }

      return next;
    });
  };

  /* ============================================================== */
  /*  3. Batch Set Matchday Date                                     */
  /* ============================================================== */
  const [batchMD, setBatchMD] = useState<number>(matchdays[0] ?? 1);
  const [batchDate, setBatchDate] = useState("");

  const handleBatchDate = () => {
    if (!batchDate) return;
    const iso = localInputToISO(batchDate);

    onBulkUpdate((rows) =>
      rows.map((m) => {
        if (m.matchday !== batchMD) return m;
        if (isFinished(m)) return m; // don't touch finished
        return { ...m, match_date: iso };
      })
    );

    setShowBatchDate(false);
    setBatchDate("");
  };

  /* ============================================================== */
  /*  4. Swap Matchdays                                              */
  /* ============================================================== */
  const [swapA, setSwapA] = useState<number>(matchdays[0] ?? 1);
  const [swapB, setSwapB] = useState<number>(matchdays[1] ?? 2);

  const handleSwapMatchdays = () => {
    if (swapA === swapB) return;

    onBulkUpdate((rows) =>
      rows.map((m) => {
        if (m.matchday === swapA) return { ...m, matchday: swapB };
        if (m.matchday === swapB) return { ...m, matchday: swapA };
        return m;
      })
    );

    setShowSwapMD(false);
  };

  /* ============================================================== */
  /*  5. Clear Unplayed                                              */
  /* ============================================================== */
  const handleClearUnplayed = () => {
    if (scheduledCount === 0) return;
    const msg =
      `Delete ${scheduledCount} unplayed match${scheduledCount !== 1 ? "es" : ""}?\n\n` +
      `${finishedCount} finished match${finishedCount !== 1 ? "es" : ""} will be kept.\n` +
      `This cannot be undone.`;
    if (!confirm(msg)) return;

    // Remove each unfinished match via the provided callback
    const toRemove = allRowsForStage.filter((m) => !isFinished(m));
    toRemove.forEach((m) => onRemoveMatch(m));
  };

  /* ============================================================== */
  /*  Render                                                         */
  /* ============================================================== */
  const btnClass =
    "px-2.5 py-1.5 rounded-md border text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Regenerate */}
        <button
          className={`${btnClass} border-cyan-400/30 text-cyan-200 hover:bg-cyan-500/10`}
          onClick={() => setShowRegenConfirm(true)}
          title="Rebuild all fixtures for this stage from scratch (preserves finished match results)"
        >
          Regenerate
        </button>

        {/* Shuffle Unplayed (only for RR stages) */}
        {!isKO && (
          <button
            className={`${btnClass} border-violet-400/30 text-violet-200 hover:bg-violet-500/10`}
            onClick={handleShuffleUnplayed}
            disabled={scheduledCount === 0}
            title="Randomly reassign teams among unplayed matches within each matchday (finished matches untouched)"
          >
            Shuffle unplayed
          </button>
        )}

        {/* Batch Date (only for RR stages with matchdays) */}
        {!isKO && matchdays.length > 0 && (
          <button
            className={`${btnClass} border-amber-400/30 text-amber-200 hover:bg-amber-500/10`}
            onClick={() => {
              setBatchMD(matchdays[0] ?? 1);
              setShowBatchDate(true);
            }}
            title="Set date/time for all matches in a matchday at once"
          >
            Set matchday date
          </button>
        )}

        {/* Swap Matchdays (only for RR stages with 2+ matchdays) */}
        {!isKO && matchdays.length >= 2 && (
          <button
            className={`${btnClass} border-sky-400/30 text-sky-200 hover:bg-sky-500/10`}
            onClick={() => {
              setSwapA(matchdays[0]);
              setSwapB(matchdays[1]);
              setShowSwapMD(true);
            }}
            title="Swap fixtures between two matchdays"
          >
            Swap matchdays
          </button>
        )}

        {/* Clear Unplayed */}
        <button
          className={`${btnClass} border-rose-400/30 text-rose-200 hover:bg-rose-500/10`}
          onClick={handleClearUnplayed}
          disabled={scheduledCount === 0}
          title={`Delete all ${scheduledCount} unplayed matches (${finishedCount} finished are safe)`}
        >
          Clear unplayed
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Add match */}
        <button
          className={`${btnClass} border-white/15 text-white hover:bg-white/10`}
          onClick={onAddRow}
        >
          + Add match
        </button>

        {/* Status summary */}
        <span className="text-[10px] text-white/40 ml-1">
          {finishedCount} finished / {scheduledCount} scheduled
        </span>
      </div>

      {/* ========== Regenerate confirmation dialog ========== */}
      {showRegenConfirm && (
        <Backdrop onClose={() => setShowRegenConfirm(false)}>
          <h3 className="text-lg font-semibold text-white mb-3">
            Regenerate fixtures?
          </h3>
          <div className="space-y-2 text-sm text-white/80 mb-4">
            <p>
              This will rebuild <strong>all</strong> fixtures for this stage
              using the current stage configuration and team assignments.
            </p>
            <div className="rounded-md border border-white/10 bg-zinc-950 p-3 space-y-1">
              <div className="flex justify-between">
                <span>Total matches:</span>
                <span className="text-white font-medium">
                  {allRowsForStage.length}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Finished (results preserved):</span>
                <span className="text-emerald-300 font-medium">
                  {finishedCount}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Scheduled (will be rebuilt):</span>
                <span className="text-amber-300 font-medium">
                  {scheduledCount}
                </span>
              </div>
            </div>
            {finishedCount > 0 && (
              <p className="text-emerald-300/80 text-xs">
                Finished match results (scores, stats) will be preserved where
                the same team pairing exists in the regenerated fixtures.
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <button
              className="px-3 py-1.5 rounded-md border border-white/15 text-white/70 hover:bg-white/10 text-sm"
              onClick={() => setShowRegenConfirm(false)}
            >
              Cancel
            </button>
            <button
              className="px-3 py-1.5 rounded-md bg-cyan-600 text-white hover:bg-cyan-700 text-sm"
              onClick={handleRegenerateConfirmed}
            >
              Regenerate
            </button>
          </div>
        </Backdrop>
      )}

      {/* ========== Batch Date dialog ========== */}
      {showBatchDate && (
        <Backdrop onClose={() => setShowBatchDate(false)}>
          <h3 className="text-lg font-semibold text-white mb-3">
            Set matchday date
          </h3>
          <p className="text-sm text-white/70 mb-4">
            Set the same date & time for all unplayed matches in a matchday.
          </p>
          <div className="space-y-3 mb-4">
            <div>
              <label className="block text-xs text-white/60 mb-1">
                Matchday
              </label>
              <select
                className="w-full bg-zinc-950 border border-white/15 rounded-md px-3 py-2 text-white text-sm"
                value={batchMD}
                onChange={(e) => setBatchMD(Number(e.target.value))}
              >
                {matchdays.map((md) => {
                  const count = allRowsForStage.filter(
                    (m) => m.matchday === md
                  ).length;
                  const unplayed = allRowsForStage.filter(
                    (m) => m.matchday === md && !isFinished(m)
                  ).length;
                  return (
                    <option key={md} value={md}>
                      Matchday {md} ({count} matches, {unplayed} unplayed)
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <label className="block text-xs text-white/60 mb-1">
                Date & time (UTC)
              </label>
              <input
                type="datetime-local"
                className="w-full bg-zinc-950 border border-white/15 rounded-md px-3 py-2 text-white text-sm"
                value={batchDate}
                onChange={(e) => setBatchDate(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              className="px-3 py-1.5 rounded-md border border-white/15 text-white/70 hover:bg-white/10 text-sm"
              onClick={() => setShowBatchDate(false)}
            >
              Cancel
            </button>
            <button
              className="px-3 py-1.5 rounded-md bg-amber-600 text-white hover:bg-amber-700 text-sm disabled:opacity-40"
              onClick={handleBatchDate}
              disabled={!batchDate}
            >
              Apply
            </button>
          </div>
        </Backdrop>
      )}

      {/* ========== Swap Matchdays dialog ========== */}
      {showSwapMD && (
        <Backdrop onClose={() => setShowSwapMD(false)}>
          <h3 className="text-lg font-semibold text-white mb-3">
            Swap matchdays
          </h3>
          <p className="text-sm text-white/70 mb-4">
            Swap all fixtures between two matchdays (including finished matches).
          </p>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 mb-4">
            <select
              className="bg-zinc-950 border border-white/15 rounded-md px-3 py-2 text-white text-sm"
              value={swapA}
              onChange={(e) => setSwapA(Number(e.target.value))}
            >
              {matchdays.map((md) => (
                <option key={md} value={md}>
                  MD {md}
                </option>
              ))}
            </select>
            <span className="text-white/50 text-lg">&#8596;</span>
            <select
              className="bg-zinc-950 border border-white/15 rounded-md px-3 py-2 text-white text-sm"
              value={swapB}
              onChange={(e) => setSwapB(Number(e.target.value))}
            >
              {matchdays.map((md) => (
                <option key={md} value={md}>
                  MD {md}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button
              className="px-3 py-1.5 rounded-md border border-white/15 text-white/70 hover:bg-white/10 text-sm"
              onClick={() => setShowSwapMD(false)}
            >
              Cancel
            </button>
            <button
              className="px-3 py-1.5 rounded-md bg-sky-600 text-white hover:bg-sky-700 text-sm disabled:opacity-40"
              onClick={handleSwapMatchdays}
              disabled={swapA === swapB}
            >
              Swap
            </button>
          </div>
        </Backdrop>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared helper (duplicated from InlineMatchPlanner to avoid import) */
/* ------------------------------------------------------------------ */

function localInputToISO(localStr?: string) {
  if (!localStr) return null;
  const m = localStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, yStr, moStr, dStr, hhStr, mmStr] = m;
  return new Date(
    Date.UTC(+yStr, +moStr - 1, +dStr, +hhStr, +mmStr, 0, 0)
  ).toISOString();
}
