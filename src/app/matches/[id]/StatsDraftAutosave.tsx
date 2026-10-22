"use client";

// ---------------------------------------------------------------------------
// Local draft autosave for the admin stats form (#stats-form).
//
// "Save all" is not a temporary save: it finishes the match and runs
// progression. So the in-progress inputs are kept in localStorage instead
// (this browser/device only) and applied automatically on the next visit.
// Επαναφορά shows the DB values (draft kept until the next edit); Απόρριψη
// deletes the draft.
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

/** The applied draft, or null when editing from the saved data. Read it only
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
  const saveNowRef = React.useRef<() => void>(() => {});

  const [applied, setApplied] = React.useState<StatsDraft | null>(null);
  const [generation, setGeneration] = React.useState(0);
  // The editors show the DB values while a stored draft is kept aside (after
  // Επαναφορά). The draft is only overwritten by a real edit.
  const [viewingSaved, setViewingSaved] = React.useState(false);
  const viewingSavedRef = React.useRef(viewingSaved);
  viewingSavedRef.current = viewingSaved;
  const [lastSavedAt, setLastSavedAt] = React.useState<number | null>(null);

  const showDraft = (draft: StatsDraft | null) => {
    setApplied(draft);
    setGeneration((g) => g + 1);
  };

  // On mount: record the server state, then apply any stored draft.
  React.useEffect(() => {
    const form = anchorRef.current?.closest("form");
    if (!form) return;
    const baseline = snapshotForm(form);
    baselineRef.current = baseline;

    const stored = readStored(key);
    if (!stored) return;
    const submitted = stored.submittedAt != null && stored.savedAt <= stored.submittedAt;
    if ((justSaved && submitted) || countChanges(stored.draft, baseline) === 0) {
      writeStored(key, null);
      return;
    }
    showDraft(stored.draft);
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
      setViewingSaved(false);
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
      if (!baselineRef.current) return;
      const draft = snapshotForm(form);
      if (countChanges(draft, baselineRef.current) === 0) {
        // Showing the DB values with a draft kept aside: no edit yet, keep it.
        if (viewingSavedRef.current) return;
        writeStored(key, null);
        setLastSavedAt(null);
        return;
      }
      const savedAt = submittedAt ?? Date.now();
      writeStored(key, { v: 1, savedAt, submittedAt, draft });
      setLastSavedAt(savedAt);
      setViewingSaved(false);
    };
    saveNowRef.current = () => {
      if (timer) save();
    };

    // "click" covers the MVP/Best GK toggles, whose hidden inputs only update
    // after React re-renders — the debounce lets that land first. The draft
    // bar's own buttons are not edits.
    const onActivity = (e: Event) => {
      if ((e.target as Element | null)?.closest?.("[data-draft-bar]")) return;
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

  /** Επαναφορά — show the DB values; the draft stays stored for later. */
  const showSaved = () => {
    saveNowRef.current(); // don't lose keystrokes still in the debounce
    if (!readStored(key)) return;
    setViewingSaved(true);
    showDraft(null);
  };

  /** Εφαρμογή πρόχειρου — back from the DB view to the kept draft. */
  const reapplyDraft = () => {
    const stored = readStored(key);
    setViewingSaved(false);
    if (stored) showDraft(stored.draft);
  };

  /** Απόρριψη — delete the draft for good and show the DB values. */
  const wipeDraft = () => {
    if (!window.confirm("Διαγραφή του πρόχειρου; Οι μη αποθηκευμένες αλλαγές χάνονται οριστικά.")) return;
    writeStored(key, null);
    setLastSavedAt(null);
    setViewingSaved(false);
    showDraft(null);
  };

  const savedAtLabel = lastSavedAt
    ? formatInstant(new Date(lastSavedAt).toISOString(), { timeStyle: "medium" })
    : "";
  const barButton = "rounded border px-2.5 py-1 text-xs font-medium transition-colors";

  return (
    <div ref={anchorRef}>
      {lastSavedAt ? (
        <div
          data-draft-bar
          className={`mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 ${
            viewingSaved ? "border-white/20 bg-white/5" : "border-cyan-400/40 bg-cyan-500/10"
          }`}
        >
          <span className={`text-xs ${viewingSaved ? "text-white/70" : "text-cyan-100"}`}>
            {viewingSaved ? (
              <>
                Εμφανίζονται τα <strong>αποθηκευμένα</strong> στοιχεία. Το πρόχειρο ({savedAtLabel})
                κρατιέται μέχρι την επόμενη αλλαγή σου.
              </>
            ) : (
              <>
                <strong>Πρόχειρο</strong> σε αυτή τη συσκευή · {savedAtLabel}
              </>
            )}
          </span>
          <div className="flex gap-2">
            {viewingSaved ? (
              <button
                type="button"
                onClick={reapplyDraft}
                className={`${barButton} border-cyan-500 bg-cyan-600 text-white hover:bg-cyan-500`}
              >
                Εφαρμογή πρόχειρου
              </button>
            ) : (
              <button
                type="button"
                onClick={showSaved}
                title="Εμφάνιση των στοιχείων της βάσης — το πρόχειρο δεν διαγράφεται"
                className={`${barButton} border-white/25 text-white/85 hover:bg-white/10`}
              >
                Επαναφορά
              </button>
            )}
            <button
              type="button"
              onClick={wipeDraft}
              title="Οριστική διαγραφή του πρόχειρου"
              className={`${barButton} border-red-400/40 text-red-200 hover:bg-red-500/15`}
            >
              Απόρριψη
            </button>
          </div>
        </div>
      ) : null}

      <DraftContext.Provider value={applied}>
        <React.Fragment key={generation}>{children}</React.Fragment>
      </DraftContext.Provider>
    </div>
  );
}
