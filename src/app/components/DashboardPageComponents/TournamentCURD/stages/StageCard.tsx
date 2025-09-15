"use client";

import type { NewTournamentPayload, BracketMatch } from "@/app/lib/types";
import type { TeamDraft, DraftMatch } from "../TournamentWizard";

import GroupsBoard from "./GroupsBoard";
import KnockoutBoard from "./KnockoutBoard";
import GroupsConfigKOIntake from "./GroupsConfigKOIntake";
import KnockoutConfigFromGroups from "./KnockoutConfigFromGroups";
import InlineMatchPlanner from "./InlineMatchPlanner";

import type { StageConfig } from "@/app/lib/types";

// ----------------- Helpers -----------------
const asCfg = (x: unknown): StageConfig => (x ?? {}) as StageConfig;

function setCfgMirror(cfg: StageConfig, patch: Partial<StageConfig>): StageConfig {
  const next: StageConfig = { ...cfg, ...patch };
  if ("διπλός_γύρος" in patch) next.double_round = !!patch.διπλός_γύρος;
  if ("double_round" in patch) next.διπλός_γύρος = !!patch.double_round;
  if ("τυχαία_σειρά" in patch) next.shuffle = !!patch.τυχαία_σειρά;
  if ("shuffle" in patch) next.τυχαία_σειρά = !!patch.shuffle;
  if ("αγώνες_ανά_αντίπαλο" in patch) next.rounds_per_opponent = patch.αγώνες_ανά_αντίπαλο;
  if ("rounds_per_opponent" in patch) next.αγώνες_ανά_αντίπαλο = patch.rounds_per_opponent;
  if ("μέγιστες_αγωνιστικές" in patch) next.limit_matchdays = patch.μέγιστες_αγωνιστικές;
  if ("limit_matchdays" in patch) next.μέγιστες_αγωνιστικές = patch.limit_matchdays;
  return next;
}

export default function StageCard({
  value,
  index,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  allStages,
  teams,
  draftMatches,
  onDraftChange,
}: {
  value: NewTournamentPayload["stages"][number];
  index: number;
  onChange: (patch: Partial<NewTournamentPayload["stages"][number]>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  allStages: NewTournamentPayload["stages"];
  teams: TeamDraft[];
  draftMatches: DraftMatch[];
  onDraftChange: (next: DraftMatch[]) => void;
}) {
  const stage = value as any;
  const cfg = asCfg(stage.config);
  const setCfg = (patch: Partial<StageConfig>) =>
    onChange({ config: setCfgMirror(cfg, patch) } as any);

  const isKnockout = stage.kind === "knockout";
  const isGroups = stage.kind === "groups";

  // ----- Intake mode toggle (KO → Groups) -----
  const intakeEnabled =
    Number.isFinite((cfg as any)?.from_knockout_stage_idx as any) &&
    ((cfg as any)?.groups_intake?.length ?? 0) > 0;

  // ------- Teams map & group occupancy -------
  const teamsMap: Record<
    number,
    { name: string; seed?: number | null; logo?: string | null }
  > = Object.fromEntries(
    teams.map((t) => [
      t.id,
      {
        name: (t as any)?.name ?? `Team #${t.id}`,
        seed: t.seed ?? null,
        logo: (t as any)?.logo ?? null,
      },
    ])
  );

  const groupsArr: Array<{ name: string }> = (isGroups ? stage.groups ?? [] : []) as any;

  const groupsOccupancy: Record<number, TeamDraft[]> = {};
  if (isGroups) {
    groupsArr.forEach((_, gi) => (groupsOccupancy[gi] = []));
    // Manual occupants only when NOT in intake mode
    if (!intakeEnabled) {
      teams.forEach((t) => {
        const gi = (t as any).groupsByStage?.[index];
        if (gi != null && gi >= 0 && gi in groupsOccupancy) groupsOccupancy[gi].push(t);
      });
    }
  }

  // ------- Draft matches scoped to this stage -------
  const stageEntries = draftMatches
    .map((m, idx) => ({ m, idx }))
    .filter((e) => e.m.stageIdx === index);

  const koMatches: BracketMatch[] = stageEntries.map((e, i) => ({
    id: i + 1,
    round: e.m.round ?? null,
    bracket_pos: e.m.bracket_pos ?? null,
    team_a_id: e.m.team_a_id ?? null,
    team_b_id: e.m.team_b_id ?? null,
    team_a_score: null,
    team_b_score: null,
    status: "scheduled",
    home_source_match_id:
      e.m.home_source_match_idx != null ? e.m.home_source_match_idx + 1 : null,
    away_source_match_id:
      e.m.away_source_match_idx != null ? e.m.away_source_match_idx + 1 : null,
  }));

  // ------- Index mapping helpers -------
  const viewIdToOrigIdx = (viewId: number): number | null => {
    const entry = stageEntries[viewId - 1];
    return entry ? entry.idx : null;
  };
  const updateAt = (origIdx: number, patch: Partial<DraftMatch>) => {
    const next = draftMatches.slice();
    next[origIdx] = { ...next[origIdx], ...patch };
    onDraftChange(next);
  };

  // ------- KO handlers passed to KnockoutBoard -------
  const assignSlot = (matchViewId: number, slot: "A" | "B", teamId: number | null) => {
    const origIdx = viewIdToOrigIdx(matchViewId);
    if (origIdx == null) return;
    updateAt(origIdx, { [slot === "A" ? "team_a_id" : "team_b_id"]: teamId } as Partial<DraftMatch>);
  };
  const swapPair = (matchViewId: number) => {
    const origIdx = viewIdToOrigIdx(matchViewId);
    if (origIdx == null) return;
    const row = draftMatches[origIdx];
    updateAt(origIdx, { team_a_id: row.team_b_id ?? null, team_b_id: row.team_a_id ?? null });
  };
  const bulkAssignFirstRound = (
    rows: Array<{ matchId: number; team_a_id: number | null; team_b_id: number | null }>
  ) => {
    const next = draftMatches.slice();
    rows.forEach((r) => {
      const origIdx = viewIdToOrigIdx(r.matchId);
      if (origIdx == null) return;
      next[origIdx] = { ...next[origIdx], team_a_id: r.team_a_id, team_b_id: r.team_b_id };
    });
    onDraftChange(next);
  };
  const clearFirstRound = () => {
    if (stageEntries.length === 0) return;
    const minRound = Math.min(...stageEntries.map((e) => e.m.round ?? 0));
    const next = draftMatches.slice();
    stageEntries.forEach((e) => {
      const isFirstCol = (e.m.round ?? 0) === minRound;
      if (isFirstCol) next[e.idx] = { ...next[e.idx], team_a_id: null, team_b_id: null };
    });
    onDraftChange(next);
  };

  // ------- KO→Groups lite list from source stage (for intake editor) -------
  const koSrcIdx = Number.isFinite((cfg as any)?.from_knockout_stage_idx as any)
    ? Number((cfg as any).from_knockout_stage_idx)
    : null;
  const koMatchesLite =
    koSrcIdx != null
      ? draftMatches
          .filter((m) => m.stageIdx === koSrcIdx)
          .map((m) => ({ round: m.round ?? 0, bracket_pos: m.bracket_pos ?? 0 }))
          .sort((a, b) => a.round - b.round || a.bracket_pos - b.bracket_pos)
      : [];

  // ------- Group CRUD helpers -------
  const addGroup = () => {
    const gs = stage.groups ?? [];
    onChange({ groups: [...gs, { name: `Όμιλος ${gs.length + 1}` }] } as any);
  };
  const setGroupName = (gi: number, name: string) =>
    onChange({ groups: groupsArr.map((g, i) => (i === gi ? { ...g, name } : g)) } as any);
  const removeGroup = (gi: number) =>
    onChange({ groups: groupsArr.filter((_, i) => i !== gi) } as any);
  const setGroupCount = (n: number) =>
    onChange({
      groups: Array.from({ length: Math.max(1, n) }, (_, i) => groupsArr[i] ?? { name: `Όμιλος ${i + 1}` }),
    } as any);

  // ------- Derived UI values -------
  const eligibleIds = teams.map((t) => t.id);

  // ------- Mini payload for inline planner -------
  const miniPayload: NewTournamentPayload = {
    tournament: {
      name: "",
      slug: null,
      season: null,
      status: "scheduled",
      format: "league",
      logo: null,
      start_date: null,
      end_date: null,
      winner_team_id: null,
    },
    stages: allStages as any,
    tournament_team_ids: teams.map((t) => t.id),
  };

  return (
    <div className="rounded-lg border border-cyan-400/20 bg-gradient-to-br from-slate-900/60 to-indigo-950/50 p-3 space-y-4">
      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-white/70">Στάδιο #{index + 1}</div>
        <div className="flex gap-2">
          <button
            onClick={onMoveUp}
            className="px-2 py-1 rounded-md border border-white/15 text-white/80 hover:text-white hover:border-white/30"
            title="Move up"
          >
            ↑
          </button>
          <button
            onClick={onMoveDown}
            className="px-2 py-1 rounded-md border border-white/15 text-white/80 hover:text-white hover:border-white/30"
            title="Move down"
          >
            ↓
          </button>
          <button
            onClick={() => {
              if (confirm("Διαγραφή αυτού του σταδίου; Αυτό δεν μπορεί να αναιρεθεί.")) {
                onRemove();
              }
            }}
            className="px-2 py-1 rounded-md border border-rose-400/40 text-rose-200 hover:bg-rose-500/10"
            title="Delete stage"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Basics */}
      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <input
            className="w-full bg-slate-950 border border-cyan-400/20 rounded-md px-3 py-2 text-white placeholder-white/40"
            placeholder="Όνομα Σταδίου"
            value={stage.name}
            onChange={(e) => onChange({ name: e.target.value } as any)}
          />
          <p className="mt-1 text-xs text-white/60">
            Δώστε το όνομα του σταδίου (π.χ. «Κανονική Περίοδος»).
          </p>
        </div>
        <div>
          <select
            className="w-full bg-slate-950 border border-cyan-400/20 rounded-md px-3 py-2 text-white"
            value={stage.kind}
            onChange={(e) =>
              onChange({
                kind: e.target.value as any,
                ...(e.target.value !== "groups" ? { groups: [] } : {}),
              } as any)
            }
          >
            <option value="league">Πρωτάθλημα (League)</option>
            <option value="groups">Όμιλοι (Groups)</option>
            <option value="knockout">Knockout</option>
          </select>
          <p className="mt-1 text-xs text-white/60">Επιλέξτε τον τύπο του σταδίου.</p>
        </div>
        <div>
          <input
            type="number"
            className="w-full bg-slate-950 border border-cyan-400/20 rounded-md px-3 py-2 text-white"
            placeholder="Σειρά"
            value={stage.ordering ?? index + 1}
            onChange={(e) => onChange({ ordering: Number(e.target.value) } as any)}
          />
          <p className="mt-1 text-xs text-white/60">Σειρά εμφάνισης του σταδίου στη διοργάνωση.</p>
        </div>
      </div>

      {/* Visuals */}
      {isGroups && (
        <>
          {intakeEnabled ? (
            <div className="text-xs text-white/60">
              Οι όμιλοι θα γεμίσουν δυναμικά από το Knockout (δεν επιτρέπονται χειροκίνητες αναθέσεις).
            </div>
          ) : null}

          <GroupsBoard
            groupsArr={groupsArr}
            groupsOccupancy={groupsOccupancy}
            onAddGroup={addGroup}
            onRemoveGroup={removeGroup}
            onRenameGroup={setGroupName}
            onSetGroupCount={setGroupCount}
            intakeMode={intakeEnabled} // NEW
          />
        </>
      )}

      {isKnockout && (
        <KnockoutBoard
          title="Knockout"
          matches={koMatches}
          teamsMap={teamsMap}
          eligibleTeamIds={eligibleIds}
          onAssignSlot={assignSlot}
          onSwapPair={swapPair}
          onBulkAssignFirstRound={bulkAssignFirstRound}
          onClearFirstRound={clearFirstRound}
        />
      )}

      {/* Inline match planner */}
      <InlineMatchPlanner
        miniPayload={miniPayload}
        teams={teams}
        draftMatches={draftMatches}
        onDraftChange={onDraftChange}
        forceStageIdx={index}
      />

      {/* Config: Groups (incl. KO → Groups intake) */}
      {isGroups && (
        <GroupsConfigKOIntake
          cfg={cfg}
          setCfg={(p) => setCfg(p)}
          groupsArr={groupsArr}
          koMatchesLite={koMatchesLite}
          allStages={allStages}
          stageIndex={index}
        />
      )}

      {/* Config: Knockout (Groups → KO) */}
      {isKnockout && (
        <KnockoutConfigFromGroups
          cfg={cfg}
          setCfg={(p) => setCfg(p)}
          allStages={allStages}
          stageIndex={index}
        />
      )}
    </div>
  );
}
