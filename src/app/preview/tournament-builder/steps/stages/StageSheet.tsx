"use client";

import { useMemo, useState } from "react";
import type { NewTournamentPayload, StageConfig } from "@/app/lib/types";
import type { TeamDraft } from "@/app/dashboard/tournaments/TournamentCURD/TournamentWizard";
import { useTournamentStore } from "@/app/dashboard/tournaments/TournamentCURD/submit/tournamentStore";
import GroupsConfigKOIntake from "@/app/dashboard/tournaments/TournamentCURD/stages/groups/GroupsConfigKOIntake";
import KnockoutConfigFromLeague from "@/app/dashboard/tournaments/TournamentCURD/stages/leauge/KnockoutConfigFromLeague";
import StageStandingsMini from "@/app/dashboard/tournaments/TournamentCURD/stages/StageStandingsMini";

import Sheet from "../../ui/Sheet";
import Button from "../../ui/Button";
import Field from "../../ui/Field";
import { field as fieldCls, select as selectCls, helperText } from "../../ui/tokens";
import { useEffectiveStageIdx } from "../../hooks/useEffectiveStageIdx";
import type { CatalogRow } from "../../hooks/useTeamCatalog";
import GroupListEditor from "./GroupListEditor";

type Stage = NewTournamentPayload["stages"][number];
const asCfg = (x: unknown): StageConfig => (x ?? {}) as StageConfig;

// Copy of StageCard.setCfgMirror (Greek/English config key mirroring)
function setCfgMirror(cfg: StageConfig, patch: Partial<StageConfig>): StageConfig {
  const next: StageConfig = { ...cfg, ...patch };
  if ("διπλός_γύρος" in patch) next.double_round = !!(patch as any).διπλός_γύρος;
  if ("double_round" in patch) (next as any).διπλός_γύρος = !!patch.double_round;
  if ("τυχαία_σειρά" in patch) next.shuffle = !!(patch as any).τυχαία_σειρά;
  if ("shuffle" in patch) (next as any).τυχαία_σειρά = !!patch.shuffle;
  if ("αγώνες_ανά_αντίπαλο" in patch) next.rounds_per_opponent = (patch as any).αγώνες_ανά_αντίπαλο;
  if ("rounds_per_opponent" in patch) (next as any).αγώνες_ανά_αντίπαλο = patch.rounds_per_opponent;
  if ("μέγιστες_αγωνιστικές" in patch) next.limit_matchdays = (patch as any).μέγιστες_αγωνιστικές;
  if ("limit_matchdays" in patch) (next as any).μέγιστες_αγωνιστικές = patch.limit_matchdays;
  return next;
}

export default function StageSheet({
  open,
  onClose,
  stage,
  index,
  allStages,
  teams,
  catalogById,
  onChange,
  onTeamGroupChange,
}: {
  open: boolean;
  onClose: () => void;
  stage: Stage & { [k: string]: any };
  index: number;
  allStages: NewTournamentPayload["stages"];
  teams: TeamDraft[];
  catalogById: Map<number, CatalogRow>;
  onChange: (patch: Partial<Stage>) => void;
  onTeamGroupChange?: (teamId: number, stageIdx: number, groupIdx: number | null) => void;
}) {
  const draftMatches = useTournamentStore((s) => s.draftMatches);
  const effectiveStageIdx = useEffectiveStageIdx(allStages, index);
  const payloadStageId = (allStages as any)?.[index]?.id as number | undefined;

  const cfg = asCfg(stage.config);
  const setCfg = (patch: Partial<StageConfig>) =>
    onChange({ config: setCfgMirror(cfg, patch) } as any);

  const isKnockout = stage.kind === "knockout";
  const isGroups = stage.kind === "groups";
  const isLeague = stage.kind === "league";

  const intakeEnabled =
    Number.isFinite((cfg as any)?.from_knockout_stage_idx as any) &&
    (((cfg as any)?.groups_intake?.length ?? 0) > 0);

  const teamName = (t: TeamDraft) =>
    (t as any).name ?? catalogById.get(t.id)?.name ?? `Team #${t.id}`;
  const teamLogo = (t: TeamDraft) =>
    (t as any).logo ?? catalogById.get(t.id)?.logo ?? null;

  // ---- groups model (copied from StageCard) ----
  const groupsArr: Array<{ id?: number; name: string }> = (
    isGroups ? stage.groups ?? [] : []
  ) as any;

  const groupsOccupancy: Record<number, TeamDraft[]> = useMemo(() => {
    const occ: Record<number, TeamDraft[]> = {};
    if (!isGroups) return occ;
    groupsArr.forEach((_, gi) => (occ[gi] = []));
    if (!intakeEnabled) {
      teams.forEach((t) => {
        const gi = (t as any).groupsByStage?.[index];
        if (gi != null && gi >= 0 && gi in occ) occ[gi].push(t);
      });
    }
    return occ;
  }, [isGroups, intakeEnabled, groupsArr, teams, index]);

  const availableTeams = useMemo(() => {
    if (!isGroups || intakeEnabled) return [];
    const assignedIds = new Set<number>();
    teams.forEach((t) => {
      const gi = (t as any).groupsByStage?.[index];
      if (gi != null && gi >= 0) assignedIds.add(t.id);
    });
    return teams
      .filter((t) => !assignedIds.has(t.id))
      .map((t) => ({ id: t.id, name: teamName(t), logo: teamLogo(t) }));
  }, [isGroups, intakeEnabled, teams, index, catalogById]);

  const addGroup = () => {
    const gs = stage.groups ?? [];
    onChange({ groups: [...gs, { id: undefined, name: `Όμιλος ${gs.length + 1}` }] } as any);
  };
  const setGroupName = (gi: number, name: string) =>
    onChange({
      groups: (groupsArr as any).map((g: any, i: number) => (i === gi ? { id: g?.id, name } : g)),
    } as any);
  const removeGroup = (gi: number) =>
    onChange({ groups: (groupsArr as any).filter((_: any, i: number) => i !== gi) } as any);
  const setGroupCount = (n: number) =>
    onChange({
      groups: Array.from({ length: Math.max(1, n) }, (_, i) =>
        groupsArr[i]
          ? { id: (groupsArr as any)[i]?.id, name: (groupsArr as any)[i]?.name }
          : { id: undefined, name: `Όμιλος ${i + 1}` }
      ),
    } as any);

  // ---- KO intake source matches (copied from StageCard) ----
  const koSrcIdx = Number.isFinite((cfg as any)?.from_knockout_stage_idx as any)
    ? Number((cfg as any).from_knockout_stage_idx)
    : null;
  const koMatchesLite = useMemo(
    () =>
      koSrcIdx != null
        ? draftMatches
            .filter((m) => m.stageIdx === koSrcIdx)
            .map((m) => ({ round: m.round ?? 0, bracket_pos: m.bracket_pos ?? 0 }))
            .sort((a, b) => a.round - b.round || a.bracket_pos - b.bracket_pos)
        : [],
    [koSrcIdx, draftMatches]
  );

  // ---- per-stage team filter (copied from StageCard) ----
  const stageTeamIds: number[] | undefined = (cfg as any).stage_team_ids;
  const hasStageFilter = Array.isArray(stageTeamIds) && stageTeamIds.length > 0;
  const [teamSearch, setTeamSearch] = useState("");

  const stageTeamSet = useMemo(
    () => new Set(hasStageFilter ? stageTeamIds! : teams.map((t) => t.id)),
    [hasStageFilter, stageTeamIds, teams]
  );

  const toggleStageTeam = (id: number) => {
    const current = new Set(stageTeamSet);
    if (current.has(id)) current.delete(id);
    else current.add(id);
    setCfg({ stage_team_ids: Array.from(current) } as any);
  };

  const searchedPickerTeams = useMemo(() => {
    const term = teamSearch.trim().toLowerCase();
    if (!term) return teams;
    return teams.filter(
      (t) => teamName(t).toLowerCase().includes(term) || String(t.id).includes(term)
    );
  }, [teams, teamSearch, catalogById]);

  return (
    <Sheet open={open} onClose={onClose} title={stage.name || `Στάδιο ${index + 1}`} wide>
      <div className="space-y-6">
        {/* Basics */}
        <div className="space-y-3">
          <Field label="Όνομα σταδίου" helper="π.χ. «Κανονική Περίοδος»">
            <input
              className={fieldCls}
              placeholder="Όνομα Σταδίου"
              value={stage.name}
              onChange={(e) => onChange({ name: e.target.value } as any)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Τύπος">
              <select
                className={selectCls}
                value={stage.kind}
                onChange={(e) => {
                  const nextKind = e.target.value as "league" | "groups" | "knockout";
                  const cfgPatch =
                    nextKind === "knockout"
                      ? setCfgMirror(cfg, { allow_draws: false } as any)
                      : setCfgMirror(cfg, {
                          allow_draws: (cfg as any).allow_draws ?? true,
                        } as any);
                  onChange({
                    kind: nextKind as any,
                    ...(nextKind !== "groups" ? { groups: [] } : {}),
                    config: cfgPatch,
                    is_ko: nextKind === "knockout",
                  } as any);
                }}
              >
                <option value="league">Πρωτάθλημα (League)</option>
                <option value="groups">Όμιλοι (Groups)</option>
                <option value="knockout">Knockout</option>
              </select>
            </Field>
            <Field label="Σειρά">
              <input
                type="number"
                className={fieldCls}
                value={(stage as any).ordering ?? index + 1}
                onChange={(e) => onChange({ ordering: Number(e.target.value) } as any)}
              />
            </Field>
          </div>
        </div>

        {/* Groups editor */}
        {isGroups && (
          <div className="space-y-3">
            {intakeEnabled && (
              <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/10 px-3 py-2 text-xs text-indigo-300">
                Οι όμιλοι θα γεμίσουν δυναμικά από το Knockout (δεν επιτρέπονται χειροκίνητες
                αναθέσεις).
              </div>
            )}
            <GroupListEditor
              groupsArr={groupsArr}
              groupsOccupancy={groupsOccupancy}
              onAddGroup={addGroup}
              onRemoveGroup={removeGroup}
              onRenameGroup={setGroupName}
              onSetGroupCount={setGroupCount}
              intakeMode={intakeEnabled}
              availableTeams={availableTeams}
              teamName={teamName}
              teamLogo={teamLogo}
              onAssignTeam={
                onTeamGroupChange
                  ? (teamId, groupIdx) => onTeamGroupChange(teamId, index, groupIdx)
                  : undefined
              }
              onUnassignTeam={
                onTeamGroupChange ? (teamId) => onTeamGroupChange(teamId, index, null) : undefined
              }
            />
            <label className="inline-flex items-center gap-2 rounded-lg border border-white/8 bg-zinc-900/60 px-3 py-2.5 text-sm font-medium text-zinc-200">
              <input
                type="checkbox"
                className="accent-indigo-500"
                checked={(cfg as any).allow_draws ?? true}
                onChange={(e) => setCfg({ allow_draws: e.target.checked } as any)}
              />
              Επιτρέπονται ισοπαλίες (Όμιλοι)
            </label>
          </div>
        )}

        {/* League/groups config + standings */}
        {(isLeague || isGroups) && (
          <div className="space-y-4 rounded-xl border border-white/8 bg-zinc-900/40 p-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Αγώνες ανά αντίπαλο">
                <input
                  type="number"
                  min={1}
                  className={fieldCls}
                  value={Number(
                    cfg.rounds_per_opponent ??
                      (cfg as any).αγώνες_ανά_αντίπαλο ??
                      (cfg.double_round ? 2 : 1)
                  )}
                  onChange={(e) =>
                    setCfg({ rounds_per_opponent: Math.max(1, Number(e.target.value) || 1) })
                  }
                />
              </Field>
              <Field label="Μέγ. αγωνιστικές" helper="0 = χωρίς όριο">
                <input
                  type="number"
                  min={0}
                  className={fieldCls}
                  value={Number(cfg.limit_matchdays ?? (cfg as any).μέγιστες_αγωνιστικές ?? 0)}
                  onChange={(e) =>
                    setCfg({ limit_matchdays: Math.max(0, Number(e.target.value) || 0) })
                  }
                />
              </Field>
            </div>
            <StageStandingsMini
              stageIdx={effectiveStageIdx}
              kind={isLeague ? "league" : "groups"}
              stageIdOverride={payloadStageId}
            />
          </div>
        )}

        {/* Per-stage team filter */}
        <div className="space-y-3 rounded-xl border border-white/8 bg-zinc-900/40 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-200">
              Ομάδες σταδίου{" "}
              <span className="font-normal text-zinc-500">
                ({hasStageFilter ? stageTeamIds!.length : teams.length}/{teams.length})
              </span>
            </h3>
            <div className="flex gap-1.5">
              <Button variant="ghost" className="!min-h-8 !px-2 text-xs" onClick={() => setCfg({ stage_team_ids: teams.map((t) => t.id) } as any)}>
                Όλες
              </Button>
              <Button variant="ghost" className="!min-h-8 !px-2 text-xs" onClick={() => setCfg({ stage_team_ids: [] } as any)}>
                Καμία
              </Button>
            </div>
          </div>
          <input
            className={fieldCls}
            placeholder="Αναζήτηση ομάδας…"
            value={teamSearch}
            onChange={(e) => setTeamSearch(e.target.value)}
          />
          <ul className="max-h-64 divide-y divide-white/6 overflow-auto rounded-lg border border-white/8">
            {searchedPickerTeams.map((t) => {
              const checked = stageTeamSet.has(t.id);
              const logo = teamLogo(t);
              return (
                <li key={t.id}>
                  <label className="flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2 hover:bg-white/4 transition-colors">
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
                    <span className="min-w-0 flex-1 truncate text-sm text-zinc-100">
                      {teamName(t)}
                    </span>
                    <span className="text-xs text-zinc-600">#{t.id}</span>
                  </label>
                </li>
              );
            })}
            {searchedPickerTeams.length === 0 && (
              <li className="px-3 py-4 text-center text-sm text-zinc-500">Δεν βρέθηκαν ομάδες.</li>
            )}
          </ul>
          <p className={helperText}>
            Επιλέξτε ποιες ομάδες συμμετέχουν στο στάδιο. Μετά πατήστε «Αναδημιουργία» στο βήμα
            «Αγώνες».
          </p>
        </div>

        {/* Kind-specific config (existing components, unchanged) */}
        {isGroups && (
          <GroupsConfigKOIntake
            cfg={cfg}
            setCfg={(p: Partial<StageConfig>) => setCfg(p)}
            groupsArr={groupsArr}
            koMatchesLite={koMatchesLite}
            allStages={allStages}
            stageIndex={index}
          />
        )}
        {isKnockout && (
          <KnockoutConfigFromLeague
            cfg={cfg}
            setCfg={(p: Partial<StageConfig>) => setCfg(p)}
            allStages={allStages}
            stageIndex={index}
          />
        )}

        <div className="flex justify-end">
          <Button variant="primary" onClick={onClose}>
            Τέλος
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
