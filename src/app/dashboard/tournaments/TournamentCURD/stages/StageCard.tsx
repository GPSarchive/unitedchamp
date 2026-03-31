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

// ----------------- Local style helpers (black & white only) -----------------
const fieldBase =
  "w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-white placeholder-zinc-500 " +
  "focus:outline-none focus:ring-2 focus:ring-indigo-500/60 focus:border-indigo-500/60 transition-colors";

const selectBase = fieldBase;

const btnGhost =
  "px-2.5 py-1.5 rounded-lg text-sm font-medium text-zinc-200 hover:text-white hover:bg-zinc-700 " +
  "border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors";

const helperText = "mt-1 text-xs text-zinc-500";

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

  // ---- Per-stage team selection ----
  const stageTeamIds: number[] | undefined = (cfg as any).stage_team_ids;
  const hasStageFilter = Array.isArray(stageTeamIds) && stageTeamIds.length > 0;
  const [teamPickerOpen, setTeamPickerOpen] = useState(false);
  const [teamSearch, setTeamSearch] = useState("");

  const stageTeamSet = useMemo(
    () => new Set(hasStageFilter ? stageTeamIds : teams.map((t) => t.id)),
    [hasStageFilter, stageTeamIds, teams]
  );

  const toggleStageTeam = (id: number) => {
    const current = new Set(stageTeamSet);
    if (current.has(id)) current.delete(id);
    else current.add(id);
    setCfg({ stage_team_ids: Array.from(current) });
  };

  const selectAllStageTeams = () => {
    setCfg({ stage_team_ids: teams.map((t) => t.id) });
  };

  const clearStageTeams = () => {
    setCfg({ stage_team_ids: [] });
  };

  // Filtered teams for this stage (used by InlineMatchPlanner)
  const stageFilteredTeams = useMemo(() => {
    if (!hasStageFilter) return teams;
    const set = new Set(stageTeamIds);
    return teams.filter((t) => set.has(t.id));
  }, [hasStageFilter, stageTeamIds, teams]);

  const searchedPickerTeams = useMemo(() => {
    const term = teamSearch.trim().toLowerCase();
    if (!term) return teams;
    return teams.filter((t) => {
      const name = ((t as any).name ?? catalog[t.id]?.name ?? `Team #${t.id}`).toLowerCase();
      return name.includes(term) || String(t.id).includes(term);
    });
  }, [teams, teamSearch, catalog]);

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
    tournament_team_ids: stageFilteredTeams.map((t) => t.id),
  };

  const srcIdx = Number.isFinite((cfg as any)?.from_stage_idx as any)
    ? Number((cfg as any).from_stage_idx)
    : null;
  const srcStage = srcIdx != null ? (allStages[srcIdx] as any) : null;

  return (
    <div className="rounded-2xl border border-white/8 bg-[#0d0f14] p-5 sm:p-6 shadow-xl space-y-5">
      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-md">
          Στάδιο <span className="text-white">#{effectiveStageIdx + 1}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={onMoveUp} className="px-2 py-1.5 rounded-lg text-sm font-medium border border-zinc-700 text-zinc-300 hover:bg-zinc-700 transition-colors" title="Move up" aria-label="Move up">↑</button>
          <button onClick={onMoveDown} className="px-2 py-1.5 rounded-lg text-sm font-medium border border-zinc-700 text-zinc-300 hover:bg-zinc-700 transition-colors" title="Move down" aria-label="Move down">↓</button>
          <button
            onClick={() => {
              if (confirm("Διαγραφή αυτού του σταδίου; Αυτό δεν μπορεί να αναιρεθεί.")) {
                onRemove();
              }
            }}
            className="px-2.5 py-1.5 rounded-lg text-sm font-medium border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500/40"
            title="Delete stage"
            aria-label="Delete stage"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="h-px bg-white/6" />

      {/* Basics */}
      <div className="grid sm:grid-cols-3 gap-4">
        <div>
          <input
            className={fieldBase}
            placeholder="Όνομα Σταδίου"
            value={stage.name}
            onChange={(e) => onChange({ name: e.target.value } as any)}
          />
          <p className={helperText}>Δώστε το όνομα του σταδίου (π.χ. «Κανονική Περίοδος»).</p>
        </div>
        <div>
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
                is_ko: nextKind === "knockout",  // Ensure is_ko is set when changing to knockout
              } as any);
            }}
          >
            <option value="league">Πρωτάθλημα (League)</option>
            <option value="groups">Όμιλοι (Groups)</option>
            <option value="knockout">Knockout</option>
          </select>
          <p className={helperText}>Επιλέξτε τον τύπο του σταδίου.</p>
        </div>
        <div>
          <input
            type="number"
            className={fieldBase}
            placeholder="Σειρά"
            value={stage.ordering ?? index + 1}
            onChange={(e) => onChange({ ordering: Number(e.target.value) } as any)}
          />
          <p className={helperText}>Σειρά εμφάνισης του σταδίου στη διοργάνωση.</p>
        </div>
      </div>

      {/* Visuals */}
      {isGroups && (
        <>
          {intakeEnabled ? (
            <div className="mt-2 text-xs text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-3 py-2">
              Οι όμιλοι θα γεμίσουν δυναμικά από το Knockout (δεν επιτρέπονται χειροκίνητες αναθέσεις).
            </div>
          ) : null}

          <div className="mt-3">
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
          <div className="mt-2 rounded-lg border border-white/8 bg-zinc-900/60 px-4 py-3">
            <label className="inline-flex items-center gap-2 text-sm text-zinc-200 font-medium">
              <input
                type="checkbox"
                className="accent-indigo-500"
                checked={(cfg as any).allow_draws ?? true}
                onChange={(e) => setCfg({ allow_draws: e.target.checked })}
              />
              Επιτρέπονται ισοπαλίες (Όμιλοι)
            </label>
          </div>
        </>
      )}

      {(isLeague || isGroups) && (
        
        <div className="rounded-lg border border-white/8 bg-zinc-900/40 p-4 space-y-4 mt-2">



    <div>
      <label className="block w-32 text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Αγώνες ανά αντίπαλο</label>
      <input
        type="number"
        min={1}
        className={fieldBase}
        value={Number(cfg.rounds_per_opponent ?? (cfg as any).αγώνες_ανά_αντίπαλο ?? (cfg.double_round ? 2 : 1))}
        onChange={(e) => setCfg({ rounds_per_opponent: Math.max(1, Number(e.target.value) || 1) })}
      />
      
    </div>

    <div>
      <label className="w-32 text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Μέγιστες αγωνιστικές</label>
      <input
        type="number"
        min={0}
        className={`${fieldBase} w-24`} // Adjust the width here
        value={Number(cfg.limit_matchdays ?? (cfg as any).μέγιστες_αγωνιστικές ?? 0)}
        onChange={(e) => setCfg({ limit_matchdays: Math.max(0, Number(e.target.value) || 0) })}
      />
      <p className={helperText}>0 = χωρίς όριο.</p>
    </div>
          <StageStandingsMini
            stageIdx={effectiveStageIdx}
            kind={isLeague ? "league" : "groups"}
            stageIdOverride={payloadStageId}
          />
        </div>
      )}

      {isKnockout && (
        <div className="mt-2 rounded-xl border border-white/8 bg-zinc-950 p-4">
          <KnockoutBoard stageIdx={effectiveStageIdx} teamsMap={teamsMap} />
        </div>
      )}

      {/* Per-stage team picker */}
      <div className="rounded-xl border border-white/8 bg-zinc-900/40">
        <button
          type="button"
          onClick={() => setTeamPickerOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-zinc-200 hover:bg-white/4 transition-colors rounded-xl"
        >
          <span>
            Ομάδες σταδίου{" "}
            <span className="text-zinc-500 font-normal">
              ({hasStageFilter ? stageTeamIds.length : teams.length}/{teams.length})
            </span>
          </span>
          <span className="text-zinc-500 text-xs">
            {teamPickerOpen ? "▲" : "▼"}
          </span>
        </button>

        {teamPickerOpen && (
          <div className="border-t border-white/8 p-4 space-y-3">
            {/* Search + actions */}
            <div className="flex gap-2">
              <input
                className={`${fieldBase} flex-1`}
                placeholder="Αναζήτηση ομάδας..."
                value={teamSearch}
                onChange={(e) => setTeamSearch(e.target.value)}
              />
              <button onClick={selectAllStageTeams} className={btnGhost} title="Επιλογή όλων">
                Όλες
              </button>
              <button onClick={clearStageTeams} className={btnGhost} title="Καθαρισμός">
                Καμία
              </button>
            </div>

            {/* Team list */}
            <ul className="max-h-56 overflow-auto divide-y divide-white/6 rounded-lg border border-white/8">
              {searchedPickerTeams.map((t) => {
                const name = (t as any).name ?? catalog[t.id]?.name ?? `Team #${t.id}`;
                const logo = (t as any).logo ?? catalog[t.id]?.logo ?? null;
                const checked = stageTeamSet.has(t.id);
                return (
                  <li key={t.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/4 transition-colors">
                    <input
                      type="checkbox"
                      className="accent-indigo-500"
                      checked={checked}
                      onChange={() => toggleStageTeam(t.id)}
                    />
                    {logo && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logo} alt="" className="h-6 w-6 rounded-full object-cover ring-1 ring-white/10" />
                    )}
                    <span className="text-sm text-zinc-100 truncate flex-1">{name}</span>
                    <span className="text-xs text-zinc-600">#{t.id}</span>
                  </li>
                );
              })}
              {searchedPickerTeams.length === 0 && (
                <li className="px-3 py-4 text-center text-sm text-zinc-500">
                  Δεν βρέθηκαν ομάδες.
                </li>
              )}
            </ul>

            <p className="text-xs text-zinc-500">
              Επιλέξτε ποιες ομάδες θα συμμετέχουν σε αυτό το στάδιο. Πατήστε «Regenerate» στο match planner για να ανανεώσετε τα ματς.
            </p>
          </div>
        )}
      </div>

      {/* Inline match planner */}
      <div className="rounded-xl border border-white/8 bg-zinc-950/80 p-4">
        <InlineMatchPlanner
          miniPayload={miniPayload}
          teams={stageFilteredTeams}
          forceStageIdx={effectiveStageIdx}
        />
      </div>

      {/* Config: Groups */}
      {isGroups && (
        <div className="mt-4">
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

      {/* Config: League */}
      {isLeague && (
        <div className="mt-4">
          {/*<LeagueConfig cfg={cfg} setCfg={(p) => setCfg(p)} />*/}
        </div>
      )}

      {/* Config: Knockout */}
      {isKnockout && (
        <div className="mt-4">
          <KnockoutConfigFromLeague
            cfg={cfg}
            setCfg={(p: Partial<StageConfig>) => setCfg(p)}
            allStages={allStages}
            stageIndex={index}
          />
        </div>
      )}
    </div>
  );
}

