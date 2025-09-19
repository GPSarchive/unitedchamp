// app/components/DashboardPageComponents/TournamentCURD/TournamentWizard.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import TournamentBasicsForm from "./basics/TournamentBasicsForm";
import StageList from "./stages/StageList";
import TeamPicker from "./teams/TeamPicker";

import ValidationSummary from "./shared/ValidationSummary";
import ReviewAndSubmit from "./submit/ReviewAndSubmit";
import WizardPreview from "./preview/WizardPreview";
import { generateDraftMatches } from "./util/Generators";
import type { NewTournamentPayload } from "@/app/lib/types";

import TournamentFlowPreview from "./preview/TournamentFlowPreview";

/* =========================================================
   Local types used across the builder
   ========================================================= */
export type TeamDraft = {
  id: number;
  seed?: number | null;
  name?: string;
  logo?: string | null;
  /** number-indexed groups mapping; values can be null */
  groupsByStage?: Record<number, number | null>;
};

export type DraftMatch = {
  stageIdx: number;
  groupIdx?: number | null;
  bracket_pos?: number | null;
  matchday?: number | null;
  match_date?: string | null;
  team_a_id?: number | null;
  team_b_id?: number | null;
  round?: number | null;

  // transient (only for in-memory wiring by build index)
  home_source_match_idx?: number | null;
  away_source_match_idx?: number | null;
  home_source_outcome?: "W" | "L";
  away_source_outcome?: "W" | "L";

  // ✅ stable pointers (round + bracket_pos) that survive sorting/grouping and are persisted
  home_source_round?: number | null;
  home_source_bracket_pos?: number | null;
  away_source_round?: number | null;
  away_source_bracket_pos?: number | null;
};

export type WizardMode = "create" | "edit";
export type WizardMeta = { id: number; slug: string | null; updated_at: string; created_at: string };

const empty: NewTournamentPayload = {
  tournament: {
    name: "",
    slug: null,
    logo: null,
    season: null,
    status: "scheduled",
    format: "mixed",
    start_date: null,
    end_date: null,
    winner_team_id: null,
  },
  stages: [],
  tournament_team_ids: [],
};

/** Wrapper that chooses the right props for TournamentFlowPreview */
function FlowPreviewMount({
  mode,
  meta,
  payload,
  teams,
  draftMatches,
  className,
  // optional editing hooks passed through when in "create" mode
  editable,
  eligibleTeamIds,
  onAutoAssignTeamSeeds,
  onAssignSlot,
  onSwapPair,
  onBulkAssignFirstRound,
  onClearFirstRound,
}: {
  mode: WizardMode;
  meta: WizardMeta | null;
  payload: NewTournamentPayload;
  teams: TeamDraft[];
  draftMatches: DraftMatch[];
  className?: string;
  editable?: boolean;
  eligibleTeamIds?: number[];
  onAutoAssignTeamSeeds?: () => Promise<number[]> | number[];
  onAssignSlot?: (matchId: number, slot: "A" | "B", teamId: number | null) => void;
  onSwapPair?: (matchId: number) => void;
  onBulkAssignFirstRound?: (
    rows: Array<{ matchId: number; team_a_id: number | null; team_b_id: number | null }>
  ) => void;
  onClearFirstRound?: () => void;
}) {
  if (mode === "edit" && meta?.id) {
    // Server-backed preview (read-only)
    return <TournamentFlowPreview tournamentId={meta.id} className={className} />;
  }

  // Client draft preview (can be editable)
  const passEditableProps =
    editable
      ? {
          editable: true,
          eligibleTeamIds,
          onAutoAssignTeamSeeds,
          onAssignSlot,
          onSwapPair,
          onBulkAssignFirstRound,
          onClearFirstRound,
        }
      : {};

  // Cast keeps us source-compatible even if TournamentFlowPreview
  // hasn't declared these optional props yet.
  return (
    <TournamentFlowPreview
      payload={payload}
      teams={teams}
      draftMatches={draftMatches}
      className={className}
      {...(passEditableProps as any)}
    />
  );
}

export default function TournamentWizard({
  mode = "create",
  meta = null,
  initialPayload = null,
  initialTeams = [],
  initialDraftMatches = [],
}: {
  mode?: WizardMode;
  meta?: WizardMeta | null;
  initialPayload?: NewTournamentPayload | null;
  initialTeams?: TeamDraft[];
  initialDraftMatches?: DraftMatch[];
}) {
  // --- core state -----------------------------------------------------------
  const [payload, setPayload] = useState<NewTournamentPayload>(initialPayload ?? empty);
  const [teams, setTeams] = useState<TeamDraft[]>(initialTeams ?? []);
  const [draftMatches, setDraftMatches] = useState<DraftMatch[]>(initialDraftMatches ?? []);

  // --- derived: groups context ---------------------------------------------
  const groupStageIndices = useMemo(
    () => payload.stages.map((s, i) => (s.kind === "groups" ? i : -1)).filter((i) => i >= 0),
    [payload.stages]
  );

  const [assignStageIdx, setAssignStageIdx] = useState<number | undefined>(undefined);
  useEffect(() => {
    setAssignStageIdx((prev) => (prev != null && groupStageIndices.includes(prev) ? prev : groupStageIndices[0]));
  }, [groupStageIndices]);

  // --- validation summary (advisory; does not block saving) ----------------
  const errors = useMemo(() => {
    const out: string[] = [];
    if (!payload.tournament.name || !payload.tournament.name.trim()) {
      out.push("Συμπλήρωσε όνομα διοργάνωσης.");
    }
    if (teams.length < 2) {
      out.push("Πρόσθεσε τουλάχιστον 2 ομάδες.");
    }
    if (payload.stages.length === 0) {
      out.push("Χρειάζεσαι τουλάχιστον 1 στάδιο.");
    }
    payload.stages.forEach((s, i) => {
      if (s.kind === "groups") {
        const names = (s.groups ?? []).map((g: any) => String(g.name || "").trim()).filter(Boolean);
        if (names.length === 0) {
          out.push(`Το στάδιο «${s.name || `#${i + 1}`}» χρειάζεται τουλάχιστον 1 όμιλο.`);
        }
      }
    });
    return out;
  }, [payload.tournament.name, payload.stages, teams.length]);

  // --- helpers --------------------------------------------------------------

  // Reassign contiguous seeds (1..N) based on current ordering:
  // - Teams with an existing seed come first (ascending),
  // - then unseeded teams (by name/id),
  // - write seeds back into state,
  // - return ordered team ids by seed (for auto-pairing).
  const handleAutoAssignTeamSeeds = (): number[] => {
    const seeded = teams
      .map((t) => ({ ...t, seedNorm: t.seed ?? null }))
      .sort((a, b) => {
        const A = a.seedNorm, B = b.seedNorm;
        if (A != null && B != null) return A - B;
        if (A != null) return -1;
        if (B != null) return 1;
        // both unseeded → fallback by name then id
        const an = (a.name ?? "").toLowerCase();
        const bn = (b.name ?? "").toLowerCase();
        if (an !== bn) return an < bn ? -1 : 1;
        return a.id - b.id;
      });

    const reassigned = seeded.map((t, i) => ({ ...t, seed: i + 1 }));
    setTeams(reassigned);
    return reassigned.map((t) => t.id);
  };

  // The following are no-ops here because the *mapping from visible matchId to DraftMatch index*
  // is owned by TournamentFlowPreview. It can call back up with a transformed DraftMatch[] later
  // if you want the wizard to persist edits. For now we forward the hooks down.
  const noopAssign = (_matchId: number, _slot: "A" | "B", _id: number | null) => {};
  const noopSwap = (_matchId: number) => {};
  const noopBulk = (_rows: Array<{ matchId: number; team_a_id: number | null; team_b_id: number | null }>) => {};
  const noopClear = () => {};

  // --- UI: single-page editor ----------------------------------------------
  return (
    <div className="space-y-6">
      {/* Advisory validation panel */}
      {errors.length > 0 && <ValidationSummary errors={errors} />}

      {/* 1) Basics */}
      <TournamentBasicsForm
        value={payload.tournament}
        onChange={(t) => setPayload((p) => ({ ...p, tournament: t }))}
      />

      {/* 2) Setup: Teams + Stages (with live flow) */}
      <div className="grid gap-4 xl:grid-cols-[minmax(320px,1fr)_2fr]">
        {/* Left column: Teams & group assignment */}
        <div className="space-y-4">
          {groupStageIndices.length > 0 && (
            <div className="rounded-md border border-white/10 p-2 text-sm text-white/80">
              <label className="mr-2">Assign groups for stage:</label>
              <select
                className="bg-slate-950 border border-cyan-400/20 rounded-md px-2 py-1 text-white"
                value={assignStageIdx ?? ""}
                onChange={(e) => {
                  const val = e.target.value === "" ? undefined : Number(e.target.value);
                  setAssignStageIdx(val);
                }}
              >
                {groupStageIndices.map((i) => (
                  <option key={i} value={i}>
                    {(payload.stages[i]?.name || `Stage ${i + 1}`) + " (groups)"}
                  </option>
                ))}
              </select>
            </div>
          )}

          <TeamPicker
            teams={teams}
            groupsStageIndex={assignStageIdx}
            groupNames={
              typeof assignStageIdx === "number"
                ? (payload.stages as any)[assignStageIdx]?.groups?.map((g: any) => g.name) ?? []
                : []
            }
            onChange={(t) => {
              setTeams(t);
              setPayload((p) => ({ ...p, tournament_team_ids: t.map((x) => x.id) }));
            }}
          />
        </div>

        {/* Right column: Stages + Live flow */}
        <div className="space-y-4">
          <StageList
            stages={payload.stages}
            onChange={(stages) => setPayload((p) => ({ ...p, stages }))}
            teams={teams}
            draftMatches={draftMatches}
            onDraftChange={setDraftMatches}
          />

          {payload.stages.length > 0 && (
            <div className="pt-2">
              <h4 className="text-sm font-medium text-white/80 mb-2">Live flow</h4>
              <FlowPreviewMount
                mode={mode}
                meta={meta}
                payload={payload}
                teams={teams}
                draftMatches={draftMatches}
                // enable editing in CREATE mode
                editable={mode === "create"}
                eligibleTeamIds={teams.map((t) => t.id)}
                onAutoAssignTeamSeeds={handleAutoAssignTeamSeeds}
                // Until TournamentFlowPreview returns updated draftMatches back up,
                // keep these as no-ops (or wire them once you add a callback there).
                onAssignSlot={noopAssign}
                onSwapPair={noopSwap}
                onBulkAssignFirstRound={noopBulk}
                onClearFirstRound={noopClear}
              />
            </div>
          )}
        </div>
      </div>

      {/* 3) Preview + Match Planner */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-cyan-200 font-semibold">Preview</h3>
          <button
            type="button"
            onClick={() => setDraftMatches(generateDraftMatches({ payload, teams }))}
            className="ml-auto px-3 py-2 rounded-md border border-cyan-400/30 text-cyan-200 hover:bg-cyan-500/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
          >
            Regenerate fixtures
          </button>
        </div>

        <WizardPreview
          payload={payload}
          teams={teams}
          draftMatches={draftMatches}
          onBack={() => {}}
          onProceed={() => {}}
          onRegenerate={() => setDraftMatches(generateDraftMatches({ payload, teams }))}
          onDraftChange={setDraftMatches}
          onTeamsChange={setTeams}
          hideActions
        />
      </div>

      {/* 4) Single Save button at the bottom */}
      <ReviewAndSubmit
        mode={mode}
        meta={meta ?? undefined}
        payload={payload}
        teams={teams}
        draftMatches={draftMatches}
        onBack={() => {}}
      />
    </div>
  );
}
