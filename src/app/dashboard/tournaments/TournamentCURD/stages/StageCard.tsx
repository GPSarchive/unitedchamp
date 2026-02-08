"use client";

import { useEffect, useMemo, useState } from "react";
import type { NewTournamentPayload } from "@/app/lib/types";
import type { TeamDraft } from "../TournamentWizard";
import  KnockoutConfigFromLeague from "./leauge/KnockoutConfigFromLeague";
import GroupsBoard from "./groups/GroupsBoard";
import KnockoutBoard from "./KnockoutTree/newknockout/KnockoutBoard";
import GroupsConfigKOIntake from "./groups/GroupsConfigKOIntake";
import InlineMatchPlanner from "../preview/InlineMatchPlanner";
import StageStandingsMini from "./StageStandingsMini";

import type { StageConfig } from "@/app/lib/types";
import { computeGroupsSignature } from "@/app/dashboard/tournaments/TournamentCURD/util/groupsSignature";
import { useTournamentStore } from "@/app/dashboard/tournaments/TournamentCURD/submit/tournamentStore";

// ----------------- Helpers -----------------
const asCfg = (x: unknown): StageConfig => (x ?? {}) as StageConfig;
type UiGroup = { id?: number; name: string };

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

async function safeJson(res: Response) {
  try {
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) return await res.json();
  } catch {}
  return null;
}

type CatalogRow = { id: number; name: string; logo?: string | null };

// ----------------- Local style helpers (unified violet/indigo theme) -----------------
const fieldBase =
  "w-full rounded-lg bg-white/[0.05] border border-white/[0.1] px-3 py-2.5 text-white placeholder-white/30 " +
  "focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-400/30 transition";

const selectBase = fieldBase;

const btnGhost =
  "px-2.5 py-1.5 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/[0.08] " +
  "border border-white/[0.08] transition";

const helperText = "mt-1 text-xs text-white/30";

export default function StageCard({
  value,
  index,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  allStages,
  teams,
  onTeamGroupChange,
}: {
  value: NewTournamentPayload["stages"][number];
  index: number;
  onChange: (patch: Partial<NewTournamentPayload["stages"][number]>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  allStages: NewTournamentPayload["stages"];
  teams: TeamDraft[];
  onTeamGroupChange?: (teamId: number, stageIdx: number, groupIdx: number | null) => void;
}) {
  const draftMatches = useTournamentStore((s) => s.draftMatches);
  const replaceAllDraftMatches = useTournamentStore((s) => s.replaceAllDraftMatches);
  const stageIdByIndex = useTournamentStore((s) => s.ids.stageIdByIndex);
  const stageIndexById = useTournamentStore((s) => s.ids.stageIndexById);
  const stagesById = useTournamentStore((s) => s.entities.stagesById);

  const onDraftChange = (next: any[]) => replaceAllDraftMatches(next as any);

  const stage = value as any;
  const cfg = asCfg(stage.config);
  const setCfg = (patch: Partial<StageConfig>) =>
    onChange({ config: setCfgMirror(cfg, patch) } as any);

  const isKnockout = stage.kind === "knockout";
  const isGroups = stage.kind === "groups";
  const isLeague = stage.kind === "league";

  const payloadStageId = (allStages as any)?.[index]?.id as number | undefined;

  const matchesPerIdx = useMemo(() => {
    const map = new Map<number, number>();
    draftMatches.forEach((m) => {
      const si = (m.stageIdx ?? -1) as number;
      if (si >= 0) map.set(si, (map.get(si) ?? 0) + 1);
    });
    return map;
  }, [draftMatches]);

  const effectiveStageIdx = useMemo(() => {
    const preferred = payloadStageId != null ? stageIndexById[payloadStageId] : undefined;
    const preferIdx =
      typeof preferred === "number" && (matchesPerIdx.get(preferred) ?? 0) > 0
        ? preferred
        : undefined;
    if (preferIdx != null) return preferIdx;
    if ((matchesPerIdx.get(index) ?? 0) > 0) return index;

    // ✅ FIX: For new stages with no matches, always use the actual index
    // Don't fall back to other stages' matches - this causes stages to show wrong data
    return typeof preferred === "number" ? preferred : index;
  }, [payloadStageId, stageIndexById, stageIdByIndex, stagesById, index, matchesPerIdx]);

  const intakeEnabled =
    Number.isFinite((cfg as any)?.from_knockout_stage_idx as any) &&
    ((cfg as any)?.groups_intake?.length ?? 0) > 0;

  const idsNeeded = useMemo(() => {
    const ids = new Set<number>();
    teams.forEach((t) => ids.add(t.id));
    draftMatches
      .filter((m) => m.stageIdx === effectiveStageIdx)
      .forEach((m) => {
        if (m.team_a_id != null) ids.add(m.team_a_id as number);
        if (m.team_b_id != null) ids.add(m.team_b_id as number);
      });
    return Array.from(ids.values());
  }, [teams, draftMatches, effectiveStageIdx]);

  const [catalog, setCatalog] = useState<Record<number, CatalogRow>>({});

  useEffect(() => {
    let aborted = false;
    (async () => {
      if (idsNeeded.length === 0) return;
      const url = new URL("/api/teams", window.location.origin);
      url.searchParams.set("sign", "1");
      url.searchParams.set("ids", idsNeeded.join(","));
      const res = await fetch(url.toString(), { credentials: "include" });
      const body = await safeJson(res);
      if (!res.ok) {
        console.warn("StageCard: team fetch failed", body?.error || res.statusText);
        return;
      }
      const rows: CatalogRow[] = (body?.teams ?? []).map((t: any) => ({
        id: Number(t.id),
        name: t.name,
        logo: t.logo ?? null,
      }));
      if (aborted) return;
      setCatalog(Object.fromEntries(rows.map((r) => [r.id, r])));
    })();
    return () => {
      aborted = true;
    };
  }, [idsNeeded.join(",")]);

  const teamsMap: Record<
    number | string,
    { name: string; seed?: number | null; logo?: string | null }
  > = useMemo(() => {
    const base = new Map<number, { name: string; logo?: string | null; seed?: number | null }>();
    teams.forEach((t) => {
      base.set(t.id, {
        name: (t as any)?.name ?? `Team #${t.id}`,
        logo: (t as any)?.logo ?? null,
        seed: t.seed ?? null,
      });
    });
    Object.values(catalog).forEach((r) => {
      base.set(r.id, { name: r.name, logo: r.logo ?? null, seed: base.get(r.id)?.seed ?? null });
    });

    const out: Record<number | string, { name: string; logo?: string | null; seed?: number | null }> = {};
    for (const [id, rec] of base.entries()) {
      out[id] = rec;
      out[String(id)] = rec;
    }
    return out;
  }, [teams, catalog]);

  const groupsArr: UiGroup[] = (isGroups ? stage.groups ?? [] : []) as UiGroup[];
  const groupsOccupancy: Record<number, TeamDraft[]> = {};
  if (isGroups) {
    groupsArr.forEach((_, gi) => (groupsOccupancy[gi] = []));
    if (!intakeEnabled) {
      teams.forEach((t) => {
        const gi = (t as any).groupsByStage?.[index];
        if (gi != null && gi >= 0 && gi in groupsOccupancy) groupsOccupancy[gi].push(t);
      });
    }
  }

  // Teams available for assignment: in the tournament pool but not yet assigned
  // to any group in THIS stage
  const availableTeams = useMemo(() => {
    if (!isGroups || intakeEnabled) return [];
    const assignedIds = new Set<number>();
    teams.forEach((t) => {
      const gi = (t as any).groupsByStage?.[index];
      if (gi != null && gi >= 0) assignedIds.add(t.id);
    });
    return teams
      .filter((t) => !assignedIds.has(t.id))
      .map((t) => ({
        id: t.id,
        name: (t as any).name ?? catalog[t.id]?.name ?? `Team #${t.id}`,
        logo: (t as any).logo ?? catalog[t.id]?.logo ?? null,
      }));
  }, [isGroups, intakeEnabled, teams, index, catalog]);

  useEffect(() => {
    if (!isGroups) return;
    const sig = computeGroupsSignature(groupsArr as Array<{ name: string }>);
    if ((cfg as any).groups_signature !== sig) {
      setCfg({ groups_signature: sig });
    }
  }, [isGroups, groupsArr]); // eslint-disable-line

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

  const addGroup = () => {
    const gs = stage.groups ?? [];
    onChange({ groups: [...gs, { id: undefined, name: `Όμιλος ${gs.length + 1}` }] } as any);
  };
  const setGroupName = (gi: number, name: string) =>
    onChange({
      groups: (groupsArr as any).map((g: any, i: number) => (i === gi ? { id: g?.id, name } : g)),
    } as any);
  const removeGroup = (gi: number) =>
    onChange({
      groups: (groupsArr as any).filter((_: any, i: number) => i !== gi),
    } as any);
  const setGroupCount = (n: number) =>
    onChange({
      groups: Array.from({ length: Math.max(1, n) }, (_, i) =>
        groupsArr[i]
          ? { id: (groupsArr as any)[i]?.id, name: (groupsArr as any)[i]?.name }
          : { id: undefined, name: `Όμιλος ${i + 1}` }
      ),
    } as any);

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

  const srcIdx = Number.isFinite((cfg as any)?.from_stage_idx as any)
    ? Number((cfg as any).from_stage_idx)
    : null;
  const srcStage = srcIdx != null ? (allStages[srcIdx] as any) : null;

  const kindLabels: Record<string, { label: string; color: string }> = {
    league: { label: "League", color: "bg-blue-500/15 text-blue-300 border-blue-400/20" },
    groups: { label: "Groups", color: "bg-amber-500/15 text-amber-300 border-amber-400/20" },
    knockout: { label: "Knockout", color: "bg-rose-500/15 text-rose-300 border-rose-400/20" },
  };
  const kindBadge = kindLabels[stage.kind] ?? kindLabels.league;

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-slate-900/80 to-indigo-950/60 shadow-2xl overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06] bg-white/[0.02]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/25 to-indigo-600/25 border border-violet-400/20 flex items-center justify-center text-sm font-bold text-violet-300">
            {effectiveStageIdx + 1}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-white font-medium truncate">{stage.name || `Stage ${effectiveStageIdx + 1}`}</span>
              <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium border ${kindBadge.color}`}>
                {kindBadge.label}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={onMoveUp} className={btnGhost} title="Move up" aria-label="Move up">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" /></svg>
          </button>
          <button onClick={onMoveDown} className={btnGhost} title="Move down" aria-label="Move down">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
          </button>
          <button
            onClick={() => {
              if (confirm("Delete this stage? This cannot be undone.")) {
                onRemove();
              }
            }}
            className="px-2.5 py-1.5 rounded-lg text-sm border border-rose-400/20 text-rose-300/80 hover:bg-rose-500/10 transition"
            title="Delete stage"
            aria-label="Delete stage"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-5 space-y-4">
        {/* Basics */}
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Stage Name</label>
            <input
              className={fieldBase}
              placeholder="e.g. Group Stage"
              value={stage.name}
              onChange={(e) => onChange({ name: e.target.value } as any)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Type</label>
            <select
              className={selectBase}
              value={stage.kind}
              onChange={(e) => {
                const nextKind = e.target.value as "league" | "groups" | "knockout";
                const cfgPatch =
                  nextKind === "knockout"
                    ? setCfgMirror(cfg, { allow_draws: false })
                    : setCfgMirror(cfg, { allow_draws: (cfg as any).allow_draws ?? true });
                onChange({
                  kind: nextKind as any,
                  ...(nextKind !== "groups" ? { groups: [] } : {}),
                  config: cfgPatch,
                  is_ko: nextKind === "knockout",
                } as any);
              }}
            >
              <option value="league">League</option>
              <option value="groups">Groups</option>
              <option value="knockout">Knockout</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Display Order</label>
            <input
              type="number"
              className={fieldBase}
              placeholder="Order"
              value={stage.ordering ?? index + 1}
              onChange={(e) => onChange({ ordering: Number(e.target.value) } as any)}
            />
          </div>
        </div>

      {/* Visuals */}
      {isGroups && (
        <>
          {intakeEnabled ? (
            <div className="text-xs text-amber-200/80 bg-amber-500/10 border border-amber-400/20 rounded-lg px-3 py-2">
              Groups will be dynamically filled from the Knockout stage (manual assignment disabled).
            </div>
          ) : null}

          <div>
            <GroupsBoard
              groupsArr={groupsArr}
              groupsOccupancy={groupsOccupancy}
              onAddGroup={addGroup}
              onRemoveGroup={removeGroup}
              onRenameGroup={setGroupName}
              onSetGroupCount={setGroupCount}
              intakeMode={intakeEnabled}
              availableTeams={availableTeams}
              onAssignTeam={
                onTeamGroupChange
                  ? (teamId, groupIdx) => onTeamGroupChange(teamId, index, groupIdx)
                  : undefined
              }
              onUnassignTeam={
                onTeamGroupChange
                  ? (teamId) => onTeamGroupChange(teamId, index, null)
                  : undefined
              }
            />
          </div>

          {/* Groups setting: Allow draws */}
          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
            <label className="inline-flex items-center gap-2.5 text-white/80 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="accent-violet-500"
                checked={(cfg as any).allow_draws ?? true}
                onChange={(e) => setCfg({ allow_draws: e.target.checked })}
              />
              Allow draws in groups
            </label>
          </div>
        </>
      )}

      {(isLeague || isGroups) && (
        <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4 space-y-4">
          <div className="text-xs font-medium text-white/40 uppercase tracking-wider">Match Settings</div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Rounds per opponent</label>
              <input
                type="number"
                min={1}
                className={fieldBase}
                value={Number(cfg.rounds_per_opponent ?? (cfg as any).αγώνες_ανά_αντίπαλο ?? (cfg.double_round ? 2 : 1))}
                onChange={(e) => setCfg({ rounds_per_opponent: Math.max(1, Number(e.target.value) || 1) })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Max matchdays</label>
              <input
                type="number"
                min={0}
                className={fieldBase}
                value={Number(cfg.limit_matchdays ?? (cfg as any).μέγιστες_αγωνιστικές ?? 0)}
                onChange={(e) => setCfg({ limit_matchdays: Math.max(0, Number(e.target.value) || 0) })}
              />
              <p className={helperText}>0 = unlimited</p>
            </div>
          </div>
          <StageStandingsMini
            stageIdx={effectiveStageIdx}
            kind={isLeague ? "league" : "groups"}
            stageIdOverride={payloadStageId}
          />
        </div>
      )}

      {isKnockout && (
        <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
          <div className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">Knockout Bracket</div>
          <KnockoutBoard stageIdx={effectiveStageIdx} teamsMap={teamsMap} />
        </div>
      )}

      {/* Inline match planner */}
      <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
        <div className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">Match Planner</div>
        <InlineMatchPlanner
          miniPayload={newMiniPayload(allStages, teams)}
          teams={teams}
          forceStageIdx={effectiveStageIdx}
        />
      </div>

      {/* Config: Groups Intake */}
      {isGroups && (
        <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
          <div className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">Advanced: Group Intake Configuration</div>
          <GroupsConfigKOIntake
            cfg={cfg}
            setCfg={(p: Partial<StageConfig>) => setCfg(p)}
            groupsArr={groupsArr}
            koMatchesLite={koMatchesLite}
            allStages={allStages}
            stageIndex={index}
          />
        </div>
      )}

      {/* Config: Knockout Source */}
      {isKnockout && (
        <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
          <div className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">Knockout Source Configuration</div>
          <KnockoutConfigFromLeague
            cfg={cfg}
            setCfg={(p: Partial<StageConfig>) => setCfg(p)}
            allStages={allStages}
            stageIndex={index}
          />
        </div>
      )}
      </div>
    </div>
  );
}

function newMiniPayload(
  allStages: NewTournamentPayload["stages"],
  teams: TeamDraft[] 
): NewTournamentPayload {
  return {
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
}
