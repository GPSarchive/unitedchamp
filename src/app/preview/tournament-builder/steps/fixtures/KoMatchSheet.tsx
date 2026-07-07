"use client";

import { useMemo, useState } from "react";
import type {
  DraftMatch,
  TeamDraft,
} from "@/app/dashboard/tournaments/TournamentCURD/TournamentWizard";
import { useTournamentStore } from "@/app/dashboard/tournaments/TournamentCURD/submit/tournamentStore";
import MatchControlPanel from "@/app/dashboard/tournaments/TournamentCURD/preview/MatchControlPanel";
import ConfirmDialog from "@/app/dashboard/tournaments/TournamentCURD/stages/ConfirmDialog";

import Sheet from "../../ui/Sheet";
import Button from "../../ui/Button";
import Field from "../../ui/Field";
import { field as fieldCls, select as selectCls, helperText } from "../../ui/tokens";
import type { MatchPatch } from "./useStageFixtures";

type KOCoord = { round: number; bracket_pos: number };
type Side = "home" | "away";

const coordKey = (c: KOCoord) => `${c.round}|${c.bracket_pos}`;
const parseCoord = (v: string): KOCoord | null => {
  if (!v) return null;
  const [r, p] = v.split("|").map(Number);
  return Number.isFinite(r) && Number.isFinite(p) ? { round: r, bracket_pos: p } : null;
};

/**
 * Mobile knockout match editor: explicit pickers replace the canvas's
 * drag-to-connect. Sources map to setKOLink + reindexKOPointers; teams to
 * setKOTeams; position moves reuse applyPatch (which migrates overlay keys
 * and calls setKORoundPos). Scores/stats via the embedded MatchControlPanel.
 */
export default function KoMatchSheet({
  open,
  onClose,
  match,
  allRows,
  stageIdx,
  teams,
  nameOf,
  teamOptions,
  applyPatch,
  removeRow,
  roundLabel,
}: {
  open: boolean;
  onClose: () => void;
  match: DraftMatch | null;
  /** all merged KO rows of this stage (for source pickers + fan-out guard) */
  allRows: DraftMatch[];
  stageIdx: number;
  teams: TeamDraft[];
  nameOf: (id: number | string | null) => { name: string; logo: string | null };
  teamOptions: Array<{ id: number; label: string }>;
  applyPatch: (target: DraftMatch, patch: MatchPatch) => void;
  removeRow: (m: DraftMatch) => void;
  roundLabel: (round: number) => string;
}) {
  const setKOLink = useTournamentStore((s) => s.setKOLink);
  const setKOTeams = useTournamentStore((s) => s.setKOTeams);
  const reindexKOPointers = useTournamentStore((s) => s.reindexKOPointers);

  const [confirmDelete, setConfirmDelete] = useState(false);

  const m = match as any;
  const round = match?.round ?? 1;
  const pos = match?.bracket_pos ?? 1;

  // Candidate sources: matches in EARLIER rounds of this stage
  const sourceOptions = useMemo(() => {
    if (!match) return [];
    return allRows
      .filter((r) => (r.round ?? 0) < round && r.bracket_pos != null)
      .sort(
        (a, b) =>
          (a.round ?? 0) - (b.round ?? 0) || (a.bracket_pos ?? 0) - (b.bracket_pos ?? 0)
      );
  }, [allRows, match, round]);

  // Fan-out guard: sources already feeding some child (side-specific pointers)
  const usedSources = useMemo(() => {
    const used = new Map<string, string>(); // sourceKey -> childKey|side
    allRows.forEach((r) => {
      if (r.round == null || r.bracket_pos == null) return;
      const childKey = coordKey({ round: r.round, bracket_pos: r.bracket_pos });
      if (r.home_source_round != null && r.home_source_bracket_pos != null) {
        used.set(
          coordKey({ round: r.home_source_round, bracket_pos: r.home_source_bracket_pos }),
          `${childKey}|home`
        );
      }
      if (r.away_source_round != null && r.away_source_bracket_pos != null) {
        used.set(
          coordKey({ round: r.away_source_round, bracket_pos: r.away_source_bracket_pos }),
          `${childKey}|away`
        );
      }
    });
    return used;
  }, [allRows]);

  if (!match) return null;

  const selfKey = coordKey({ round, bracket_pos: pos });

  const sideState = (side: Side) => {
    const sr = side === "home" ? m.home_source_round : m.away_source_round;
    const sp = side === "home" ? m.home_source_bracket_pos : m.away_source_bracket_pos;
    const outcome =
      (side === "home" ? m.home_source_outcome : m.away_source_outcome) ?? "W";
    const linked = sr != null && sp != null;
    return {
      linked,
      value: linked ? coordKey({ round: sr, bracket_pos: sp }) : "",
      outcome: outcome as "W" | "L",
    };
  };

  const changeSource = (side: Side, v: string, outcome: "W" | "L") => {
    const parent = parseCoord(v);
    setKOLink(stageIdx, { round, bracket_pos: pos }, side, parent, outcome);
    reindexKOPointers(stageIdx);
  };

  const changeTeams = (teamAId: number | null, teamBId: number | null) => {
    setKOTeams(stageIdx, { round, bracket_pos: pos }, teamAId, teamBId);
  };

  const home = sideState("home");
  const away = sideState("away");
  const anyLinked = home.linked || away.linked;

  const moveTo = (next: KOCoord) => {
    if (next.round === round && next.bracket_pos === pos) return;
    if (next.round < 1 || next.bracket_pos < 1) return;
    applyPatch(match, { round: next.round, bracket_pos: next.bracket_pos });
  };

  const sourceSelect = (side: Side) => {
    const st = side === "home" ? home : away;
    const other = side === "home" ? away : home;
    return (
      <div className="space-y-2">
        <select
          className={selectCls}
          value={st.value}
          onChange={(e) => changeSource(side, e.target.value, st.outcome)}
        >
          <option value="">— Χωρίς προέλευση (απευθείας ομάδα) —</option>
          {sourceOptions.map((s) => {
            const key = coordKey({ round: s.round!, bracket_pos: s.bracket_pos! });
            const usedBy = usedSources.get(key);
            const usedElsewhere = usedBy != null && usedBy !== `${selfKey}|${side}`;
            const isOtherSide = key === other.value;
            const a = nameOf(s.team_a_id ?? null).name;
            const b = nameOf(s.team_b_id ?? null).name;
            return (
              <option key={key} value={key} disabled={usedElsewhere || isOtherSide}>
                {roundLabel(s.round!)} · Θέση {s.bracket_pos} ({a} – {b})
                {usedElsewhere ? " — σε χρήση" : ""}
              </option>
            );
          })}
        </select>
        {st.linked && (
          <div className="flex gap-1.5">
            {(["W", "L"] as const).map((o) => (
              <button
                key={o}
                onClick={() => changeSource(side, st.value, o)}
                className={[
                  "flex-1 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                  st.outcome === o
                    ? "border-indigo-500/50 bg-indigo-500/15 text-indigo-200"
                    : "border-zinc-700 text-zinc-400 hover:text-white",
                ].join(" ")}
              >
                {o === "W" ? "Νικητής" : "Ηττημένος"}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Sheet open={open} onClose={onClose} title={`${roundLabel(round)} · Θέση ${pos}`} wide>
      <div className="space-y-5">
        {/* Position */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Γύρος">
            <input
              type="number"
              min={1}
              className={fieldCls}
              value={round}
              onChange={(e) => {
                const r = Number(e.target.value);
                if (Number.isFinite(r) && r >= 1) moveTo({ round: r, bracket_pos: pos });
              }}
            />
          </Field>
          <Field label="Θέση bracket">
            <input
              type="number"
              min={1}
              className={fieldCls}
              value={pos}
              onChange={(e) => {
                const p = Number(e.target.value);
                if (Number.isFinite(p) && p >= 1) moveTo({ round, bracket_pos: p });
              }}
            />
          </Field>
        </div>

        {/* Sources */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
            Προέλευση ομάδων
          </h3>
          <Field label="Έδρα (Α)">{sourceSelect("home")}</Field>
          <Field label="Φιλοξενούμενη (Β)">{sourceSelect("away")}</Field>
          <p className={helperText}>
            Με προέλευση, η ομάδα συμπληρώνεται αυτόματα από το αποτέλεσμα του γονικού αγώνα.
          </p>
        </div>

        {/* Direct team pick (disabled while linked, mirroring setKOTeams guard) */}
        {!anyLinked && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Ομάδα Α">
              <select
                className={selectCls}
                value={match.team_a_id ?? ""}
                onChange={(e) =>
                  changeTeams(
                    e.target.value ? Number(e.target.value) : null,
                    match.team_b_id ?? null
                  )
                }
              >
                <option value="">—</option>
                {teamOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Ομάδα Β">
              <select
                className={selectCls}
                value={match.team_b_id ?? ""}
                onChange={(e) =>
                  changeTeams(
                    match.team_a_id ?? null,
                    e.target.value ? Number(e.target.value) : null
                  )
                }
              >
                <option value="">—</option>
                {teamOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}

        <div className="flex justify-end">
          <Button variant="danger" onClick={() => setConfirmDelete(true)}>
            Διαγραφή αγώνα
          </Button>
        </div>

        {/* Scores / status / player stats — existing panel, unchanged */}
        <MatchControlPanel match={match} teams={teams} onClose={onClose} />
      </div>

      {confirmDelete && (
        <ConfirmDialog
          open={confirmDelete}
          title="Διαγραφή αγώνα;"
          message="Οι συνδέσεις προς αυτόν τον αγώνα θα καθαριστούν και ο αγώνας θα διαγραφεί κατά την αποθήκευση."
          confirmLabel="Διαγραφή"
          cancelLabel="Άκυρο"
          onConfirm={() => {
            setConfirmDelete(false);
            // Clear own links + teams (mirror BracketCanvas.clearSlot)
            setKOLink(stageIdx, { round, bracket_pos: pos }, "home", null);
            setKOLink(stageIdx, { round, bracket_pos: pos }, "away", null);
            setKOTeams(stageIdx, { round, bracket_pos: pos }, null, null);
            // Also clear children that source from this match (avoid dangling pointers)
            allRows.forEach((r) => {
              if (r.round == null || r.bracket_pos == null) return;
              const child = { round: r.round, bracket_pos: r.bracket_pos };
              if (r.home_source_round === round && r.home_source_bracket_pos === pos) {
                setKOLink(stageIdx, child, "home", null);
              }
              if (r.away_source_round === round && r.away_source_bracket_pos === pos) {
                setKOLink(stageIdx, child, "away", null);
              }
            });
            removeRow(match);
            onClose();
          }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </Sheet>
  );
}
