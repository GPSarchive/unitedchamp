"use client";

// ---------------------------------------------------------------------------
// Local draft autosave for the admin stats form (#stats-form).
//
// "Save all" is not a temporary save: it finishes the match and runs
// progression. So the in-progress inputs are kept in localStorage instead
// (this browser/device only) and offered back on the next visit.
//
// Capture reads the form's own FormData — the field names are the submit
// contract, so this works across StatsEditor ×2, the awards provider and the
// penalty panel without lifting their state. Restore is state-driven: the
// draft is exposed through context to those components' useState
// initialisers, and the subtree is remounted (key bump) to apply it. Poking
// values into controlled inputs via the DOM doesn't stick, which is why the
// old FormDraftAutosave never worked.
//
// Deliberately NOT drafted: the private referee note (shared computers) and
// the destructive "Clear all stats" checkboxes.
// ---------------------------------------------------------------------------

import * as React from "react";
import { formatInstant } from "@/app/lib/datetime";

export type PlayerDraft = {
  played: boolean;
  captain: boolean;
  gk: boolean;
  /** position / player_number / goals / … as typed (strings). */
  stats: Record<string, string>;
};

export type StatsDraft = {
  /** Keyed `${teamId}:${playerId}` — a player can be on both rosters. */
  players: Record<string, PlayerDraft>;
  mvp: string;
  best_gk: string;
  penalty_a?: string;
  penalty_b?: string;
};

type StoredDraft = {
  v: 1;
  savedAt: number;
  /** Set when "Save all" was submitted with this exact draft. */
  submittedAt?: number;
  draft: StatsDraft;
};

const STAT_FIELDS = new Set([
  "position",
  "player_number",
  "goals",
  "assists",
  "own_goals",
  "yellow_cards",
  "red_cards",
  "blue_cards",
]);
const PART_RE = /^participants\[(\d+)\]\[(\d+)\]\[played\]$/;
const STAT_RE = /^players\[(\d+)\]\[(\d+)\]\[(\w+)\]$/;
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const SAVE_DEBOUNCE_MS = 400;

const storageKey = (matchId: number) => `unitedchamp:stats-draft:v1:${matchId}`;

/** Read the form into a draft. Later fields win, and the hidden "0"/"false"
 *  defaults always precede the real input, so this mirrors the server parse. */
function snapshotForm(form: HTMLFormElement): StatsDraft {
  const players: Record<string, PlayerDraft> = {};
  const player = (teamId: string, playerId: string) =>
    (players[`${teamId}:${playerId}`] ??= { played: false, captain: false, gk: false, stats: {} });
  const draft: StatsDraft = { players, mvp: "", best_gk: "" };

  for (const [name, value] of new FormData(form).entries()) {
    if (typeof value !== "string") continue;

    let m = PART_RE.exec(name);
    if (m) {
      player(m[1], m[2]).played = value === "true";
      continue;
    }
    m = STAT_RE.exec(name);
    if (m) {
      const p = player(m[1], m[2]);
      if (m[3] === "is_captain") p.captain = value === "true";
      else if (m[3] === "gk") p.gk = value === "true";
      else if (STAT_FIELDS.has(m[3])) p.stats[m[3]] = value;
      continue;
    }
    if (name === "mvp_player_id") draft.mvp = value;
    else if (name === "best_gk_player_id") draft.best_gk = value;
    // Pen inputs mount/unmount with the live score; only a typed value counts.
    else if (name === "penalty_a" && value !== "") draft.penalty_a = value;
    else if (name === "penalty_b" && value !== "") draft.penalty_b = value;
  }
  return draft;
}

function readStored(key: string): StoredDraft | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDraft;
    if (parsed?.v !== 1 || !parsed.draft || Date.now() - parsed.savedAt > MAX_AGE_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeStored(key: string, value: StoredDraft | null) {
  try {
    if (value) localStorage.setItem(key, JSON.stringify(value));
    else localStorage.removeItem(key);
  } catch {}
}

/** How many players / match-wide fields differ between two drafts. */
function countChanges(a: StatsDraft, b: StatsDraft): number {
  let n = 0;
  for (const k of new Set([...Object.keys(a.players), ...Object.keys(b.players)])) {
    if (JSON.stringify(a.players[k]) !== JSON.stringify(b.players[k])) n++;
  }
  if (a.mvp !== b.mvp) n++;
  if (a.best_gk !== b.best_gk) n++;
  if (a.penalty_a !== b.penalty_a || a.penalty_b !== b.penalty_b) n++;
  return n;
}

const DraftContext = React.createContext<StatsDraft | null>(null);

/** The restored draft, or null when editing from the saved data. Read it only
 *  in useState initialisers — applying a draft remounts the subtree. */
export function useStatsDraft(): StatsDraft | null {
  return React.useContext(DraftContext);
}

export default function StatsDraftAutosave({
  matchId,
  justSaved,
  children,
}: {
  matchId: number;
  /** The page was reached via saveAllStatsAction's `?saved=1` redirect. */
  justSaved: boolean;
  children: React.ReactNode;
}) {
  const key = storageKey(matchId);
  const anchorRef = React.useRef<HTMLDivElement>(null);
  const baselineRef = React.useRef<StatsDraft | null>(null);

  const [applied, setApplied] = React.useState<StatsDraft | null>(null);
  const [generation, setGeneration] = React.useState(0);
  // A stored draft waiting for Επαναφορά / Απόρριψη. Autosave is paused while
  // set, so stray edits can't overwrite it before the admin decides.
  const [pending, setPending] = React.useState<{ stored: StoredDraft; changes: number } | null>(null);
  const pendingRef = React.useRef(pending);
  pendingRef.current = pending;
  const [lastSavedAt, setLastSavedAt] = React.useState<number | null>(null);

  // On mount: record the server state, then decide what to do with any draft.
  React.useEffect(() => {
    const form = anchorRef.current?.closest("form");
    if (!form) return;
    const baseline = snapshotForm(form);
    baselineRef.current = baseline;

    const stored = readStored(key);
    if (!stored) return;
    const submitted = stored.submittedAt != null && stored.savedAt <= stored.submittedAt;
    const changes = countChanges(stored.draft, baseline);
    if ((justSaved && submitted) || changes === 0) {
      writeStored(key, null);
      return;
    }
    setPending({ stored, changes });
    setLastSavedAt(stored.savedAt);
    // Mount-only by design (justSaved deliberately omitted): the redirect after
    // "Save all" keeps this client tree mounted, which the effect below handles.
  }, [key]);

  // Back on the page after a successful "Save all" without a remount.
  React.useEffect(() => {
    if (!justSaved) return;
    const stored = readStored(key);
    if (stored?.submittedAt != null && stored.savedAt <= stored.submittedAt) {
      writeStored(key, null);
      setLastSavedAt(null);
    }
    const form = anchorRef.current?.closest("form");
    if (form) baselineRef.current = snapshotForm(form);
  }, [justSaved, key]);

  // Autosave on any edit, debounced; flushed on submit and when leaving.
  React.useEffect(() => {
    const form = anchorRef.current?.closest("form");
    if (!form) return;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const save = (submittedAt?: number) => {
      if (timer) clearTimeout(timer);
      timer = undefined;
      if (pendingRef.current || !baselineRef.current) return;
      const draft = snapshotForm(form);
      if (countChanges(draft, baselineRef.current) === 0) {
        writeStored(key, null);
        setLastSavedAt(null);
        return;
      }
      const savedAt = submittedAt ?? Date.now();
      writeStored(key, { v: 1, savedAt, submittedAt, draft });
      setLastSavedAt(savedAt);
    };

    // "click" covers the MVP/Best GK toggles, whose hidden inputs only update
    // after React re-renders — the debounce lets that land first.
    const onActivity = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(save, SAVE_DEBOUNCE_MS);
    };
    // Blocked by HTML validation (e.g. required pens) → no submit event, fine.
    const onSubmit = () => save(Date.now());
    const onHide = () => {
      if (timer) save();
    };

    form.addEventListener("input", onActivity);
    form.addEventListener("change", onActivity);
    form.addEventListener("click", onActivity);
    form.addEventListener("submit", onSubmit);
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      form.removeEventListener("input", onActivity);
      form.removeEventListener("change", onActivity);
      form.removeEventListener("click", onActivity);
      form.removeEventListener("submit", onSubmit);
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onHide);
      if (timer) clearTimeout(timer);
    };
  }, [key]);

  const restore = () => {
    if (!pending) return;
    setApplied(pending.stored.draft);
    setGeneration((g) => g + 1);
    setPending(null);
  };

  const discardPending = () => {
    writeStored(key, null);
    setPending(null);
    setLastSavedAt(null);
  };

  const discardChanges = () => {
    if (!window.confirm("Απόρριψη όλων των μη αποθηκευμένων αλλαγών και επιστροφή στα αποθηκευμένα στοιχεία;")) return;
    writeStored(key, null);
    setApplied(null);
    setGeneration((g) => g + 1);
    setLastSavedAt(null);
  };

  return (
    <div ref={anchorRef}>
      {pending ? (
        <div className="mb-4 rounded-lg border border-cyan-400/40 bg-cyan-500/10 p-4">
          <p className="text-sm font-semibold text-cyan-100">
            Βρέθηκε μη αποθηκευμένο πρόχειρο ({formatInstant(new Date(pending.stored.savedAt).toISOString())})
          </p>
          <p className="mt-1 text-xs text-cyan-100/80">
            {pending.changes === 1 ? "1 αλλαγή" : `${pending.changes} αλλαγές`} σε σχέση με τα
            αποθηκευμένα στοιχεία. Η αυτόματη αποθήκευση είναι σε παύση μέχρι να επιλέξεις.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={restore}
              className="rounded bg-cyan-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-cyan-500"
            >
              Επαναφορά
            </button>
            <button
              type="button"
              onClick={discardPending}
              className="rounded border border-white/25 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10"
            >
              Απόρριψη
            </button>
          </div>
        </div>
      ) : lastSavedAt ? (
        <div className="mb-3 flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs text-white/60">
          <span>
            Πρόχειρο σε αυτή τη συσκευή ·{" "}
            {formatInstant(new Date(lastSavedAt).toISOString(), { timeStyle: "medium" })}
          </span>
          <button
            type="button"
            onClick={discardChanges}
            className="text-white/70 underline-offset-2 hover:text-white hover:underline"
          >
            Απόρριψη αλλαγών
          </button>
        </div>
      ) : null}

      <DraftContext.Provider value={applied}>
        <React.Fragment key={generation}>{children}</React.Fragment>
      </DraftContext.Provider>
    </div>
  );
}
