// app/dashboard/tournaments/TournamentCURD/stages/StageCard.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { NewTournamentPayload, StageConfig } from "@/app/lib/types";
import type { TeamDraft, DraftMatch } from "../TournamentWizard";

import GroupsBoard from "./groups/GroupsBoard";
import KnockoutBoard from "./KnockoutTree/newknockout/KnockoutBoard";
import GroupsConfigKOIntake from "./groups/GroupsConfigKOIntake";
import KnockoutConfigFromGroups from "./KnockoutTree/newknockout/KnockoutConfigFromGroups";
import InlineMatchPlanner from "../preview/InlineMatchPlanner";
import StageStandingsMini from "./StageStandingsMini";

import { computeGroupsSignature } from "@/app/dashboard/tournaments/TournamentCURD/util/groupsSignature";
import { useTournamentStore } from "@/app/dashboard/tournaments/TournamentCURD/submit/tournamentStore";

/* ----------------- Exported types ----------------- */
export type StageDraft = {
  id?: number;
  name: string;
  kind: "league" | "groups" | "knockout";
  ordering?: number;
  groups?: Array<{ id?: number; name: string }>;
  config?: StageConfig;
};

/* ----------------- Local draft types (narrow) ----------------- */
type GroupDraft = { id?: number; name: string };

type CatalogRow = { id: number; name: string; logo?: string | null };

/* ----------------- Helpers ----------------- */
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

async function safeJson(res: Response) {
  try {
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) return await res.json();
  } catch {}
  return null;
}

/* ----------------- Local style helpers (monochrome) ----------------- */
const fieldBase =
  "w-full rounded-lg bg-black border border-gray-700 px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/40";
const selectBase = fieldBase;
const btnGhost =
  "px-2.5 py-1.5 rounded-lg text-sm text-white/90 hover:text-white hover:bg-white/10 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-white/30";
const helperText = "mt-1 text-xs text-gray-400";

export default function StageCard({
  value,
  index,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  allStages,
  teams,
}: {
  value: StageDraft;
  index: number;
  onChange: (patch: Partial<StageDraft>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  allStages: StageDraft[];
  teams: TeamDraft[];
}) {
  const draftMatches = useTournamentStore((s) => s.draftMatches);
  const stageIdByIndex = useTournamentStore((s) => s.ids.stageIdByIndex);
  const stageIndexById = useTournamentStore((s) => s.ids.stageIndexById);
  const stagesById = useTournamentStore((s) => s.entities.stagesById);

  const stage = value;
  const cfg = asCfg(stage.config);
  const setCfg = (patch: Partial<StageConfig>) => onChange({ config: setCfgMirror(cfg, patch) });

  const isKnockout = stage.kind === "knockout";
  const isGroups = stage.kind === "groups";
  const isLeague = stage.kind === "league";

  const payloadStageId = allStages?.[index]?.id as number | undefined;

  const matchesPerIdx = useMemo(() => {
    const map = new Map<number, number>();
    draftMatches.forEach((m: DraftMatch) => {
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

    const kindAt = (idx: number) => {
      const sid = stageIdByIndex[idx];
      return sid ? stagesById[sid]?.kind : undefined;
    };
    const wantKind = kindAt(typeof preferred === "number" ? preferred : index);

    let best: number | undefined;
    let bestCount = -1;
    matchesPerIdx.forEach((count, idx) => {
      if (!count) return;
      if (wantKind && kindAt(idx) !== wantKind) return;
      if (count > bestCount) {
        bestCount = count;
        best = idx;
      }
    });
    if (best != null) return best;

    for (const [idx2, count] of matchesPerIdx.entries()) {
      if (count > 0) return idx2;
    }
    return typeof preferred === "number" ? preferred : index;
  }, [payloadStageId, stageIndexById, stageIdByIndex, stagesById, index, matchesPerIdx]);

  const intakeEnabled =
    Number.isFinite((cfg as any)?.from_knockout_stage_idx as any) &&
    ((cfg as any)?.groups_intake?.length ?? 0) > 0;

  const idsNeeded = useMemo(() => {
    const ids = new Set<number>();
    teams.forEach((t: TeamDraft) => ids.add(t.id));
    draftMatches
      .filter((m: DraftMatch) => m.stageIdx === effectiveStageIdx)
      .forEach((m: DraftMatch) => {
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
        console.warn("StageCard: team fetch failed", (body as any)?.error || res.statusText);
        return;
      }
      const rows: CatalogRow[] = ((body as any)?.teams ?? []).map((t: any) => ({
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

  const teamsMap: Record<number | string, { name: string; seed?: number | null; logo?: string | null }> =
    useMemo(() => {
      const base = new Map<number, { name: string; logo?: string | null; seed?: number | null }>();
      teams.forEach((t: TeamDraft) => {
        base.set(t.id, {
          name: t?.name ?? `Team #${t.id}`,
          logo: t?.logo ?? null,
          seed: t.seed ?? null,
        });
      });
      Object.values(catalog).forEach((r: CatalogRow) => {
        base.set(r.id, { name: r.name, logo: r.logo ?? null, seed: base.get(r.id)?.seed ?? null });
      });

      const out: Record<number | string, { name: string; logo?: string | null; seed?: number | null }> = {};
      for (const [id, rec] of base.entries()) {
        out[id] = rec;
        out[String(id)] = rec;
      }
      return out;
    }, [teams, catalog]);

  const groupsArr: GroupDraft[] = (isGroups ? stage.groups ?? [] : []) as GroupDraft[];
  const groupsOccupancy: Record<number, TeamDraft[]> = {};
  if (isGroups) {
    groupsArr.forEach((_, gi: number) => (groupsOccupancy[gi] = []));
    if (!intakeEnabled) {
      teams.forEach((t: TeamDraft) => {
        const gi = t.groupsByStage?.[index];
        if (gi != null && gi >= 0 && gi in groupsOccupancy) groupsOccupancy[gi].push(t);
      });
    }
  }

  useEffect(() => {
    if (!isGroups) return;
    const sig = computeGroupsSignature(groupsArr.map((g) => ({ name: g.name })));
    if ((cfg as any).groups_signature !== sig) {
      setCfg({ groups_signature: sig });
    }
  }, [isGroups, groupsArr]); // eslint-disable-line

  const koSrcIdx = Number.isFinite((cfg as any)?.from_knockout_stage_idx as any)
    ? Number((cfg as any).from_knockout_stage_idx)
    : null;

  const koMatchesLite: Array<{ round: number; bracket_pos: number }> =
    koSrcIdx != null
      ? draftMatches
          .filter((m: DraftMatch) => m.stageIdx === koSrcIdx)
          .map((m: DraftMatch) => ({ round: m.round ?? 0, bracket_pos: m.bracket_pos ?? 0 }))
          .sort(
            (
              a: { round: number; bracket_pos: number },
              b: { round: number; bracket_pos: number }
            ) => a.round - b.round || a.bracket_pos - b.bracket_pos
          )
      : [];

  const addGroup = () => {
    const gs = stage.groups ?? [];
    onChange({ groups: [...gs, { id: undefined, name: `Όμιλος ${gs.length + 1}` }] });
  };
  const setGroupName = (gi: number, name: string) =>
    onChange({
      groups: groupsArr.map((g, i) => (i === gi ? { id: g?.id, name } : g)),
    });
  const removeGroup = (gi: number) =>
    onChange({
      groups: groupsArr.filter((_, i) => i !== gi),
    });
  const setGroupCount = (n: number) =>
    onChange({
      groups: Array.from({ length: Math.max(1, n) }, (_, i) =>
        groupsArr[i] ? { id: groupsArr[i]?.id, name: groupsArr[i]?.name } : { id: undefined, name: `Όμιλος ${i + 1}` }
      ),
    });

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
    stages: allStages as unknown as NewTournamentPayload["stages"],
    tournament_team_ids: teams.map((t) => t.id),
  };

  const srcIdx = Number.isFinite((cfg as any)?.from_stage_idx as any)
    ? Number((cfg as any).from_stage_idx)
    : null;
  const srcStage = srcIdx != null ? (allStages[srcIdx] as StageDraft | null) : null;

  return (
    <div className="rounded-xl border border-gray-800 bg-gradient-to-br from-black to-neutral-900 p-4 sm:p-5 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)] backdrop-blur">
      {/* Actions */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs uppercase tracking-wide text-gray-400">
          Στάδιο <span className="text-white">#{effectiveStageIdx + 1}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={onMoveUp} className={btnGhost} title="Move up" aria-label="Move up">↑</button>
          <button onClick={onMoveDown} className={btnGhost} title="Move down" aria-label="Move down">↓</button>
          <button
            onClick={() => {
              if (confirm("Διαγραφή αυτού του σταδίου; Αυτό δεν μπορεί να αναιρεθεί.")) onRemove();
            }}
            className="px-2.5 py-1.5 rounded-lg text-sm border border-gray-700 text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/30"
            title="Delete stage"
            aria-label="Delete stage"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Basics */}
      <div className="grid sm:grid-cols-3 gap-4">
        <div>
          <input
            className={fieldBase}
            placeholder="Όνομα Σταδίου"
            value={stage.name}
            onChange={(e) => onChange({ name: e.target.value })}
          />
          <p className={helperText}>Δώστε το όνομα του σταδίου (π.χ. «Κανονική Περίοδος»).</p>
        </div>
        <div>
          <select
            className={selectBase}
            value={stage.kind}
            onChange={(e) => {
              const nextKind = e.target.value as StageDraft["kind"];
              const cfgPatch =
                nextKind === "knockout"
                  ? setCfgMirror(cfg, { allow_draws: false })
                  : setCfgMirror(cfg, { allow_draws: (cfg as any).allow_draws ?? true });
              onChange({
                kind: nextKind,
                ...(nextKind !== "groups" ? { groups: [] as GroupDraft[] } : {}),
                config: cfgPatch,
              });
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
            onChange={(e) => onChange({ ordering: Number(e.target.value) })}
          />
          <p className={helperText}>Σειρά εμφάνισης του σταδίου στη διοργάνωση.</p>
        </div>
      </div>

      {/* Visuals */}
      {isGroups && (
        <>
          {intakeEnabled ? (
            <div className="mt-2 text-xs text-white/80 bg-white/5 border border-gray-700 rounded-md px-2 py-1">
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
            />
          </div>

          {/* Groups setting: Allow draws */}
          <div className="mt-3 rounded-md border border-gray-800 bg-black p-3">
            <label className="inline-flex items-center gap-2 text-white text-sm">
              <input
                type="checkbox"
                className="accent-white"
                checked={(cfg as any).allow_draws ?? true}
                onChange={(e) => setCfg({ allow_draws: e.target.checked })}
              />
              Επιτρέπονται ισοπαλίες (Όμιλοι)
            </label>
          </div>
        </>
      )}

      {(isLeague || isGroups) && (
        <div className="mt-4">
          <StageStandingsMini
            stageIdx={effectiveStageIdx}
            kind={isLeague ? "league" : "groups"}
            stageIdOverride={payloadStageId}
          />
        </div>
      )}

      {isKnockout && (
        <div className="mt-3 rounded-lg border border-gray-800 bg-black p-3">
          <KnockoutBoard stageIdx={effectiveStageIdx} teamsMap={teamsMap} />
        </div>
      )}

      {/* Inline match planner */}
      <div className="mt-4 rounded-xl border border-gray-800 bg-black p-3">
        <InlineMatchPlanner
          miniPayload={newMiniPayload(allStages, teams)}
          teams={teams}
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
            allStages={allStages as unknown as NewTournamentPayload["stages"]}
            stageIndex={index}
          />
        </div>
      )}

      {/* Config: League */}
      {isLeague && (
        <div className="mt-4">
          <LeagueConfig cfg={cfg} setCfg={(p) => setCfg(p)} />
        </div>
      )}

      {/* Config: Knockout */}
      {isKnockout && (
        <div className="mt-4">
          {(() => {
            const fromIdx = Number.isFinite((cfg as any)?.from_stage_idx as any)
              ? Number((cfg as any).from_stage_idx)
              : null;
            const fromStage = fromIdx != null ? (allStages[fromIdx] as StageDraft | null) : null;
            return fromStage?.kind === "groups" ? (
              <KnockoutConfigFromGroups
                cfg={cfg}
                setCfg={(p: Partial<StageConfig>) => setCfg(p)}
                allStages={allStages as unknown as NewTournamentPayload["stages"]}
                stageIndex={index}
              />
            ) : (
              <KnockoutConfigFromLeague
                cfg={cfg}
                setCfg={(p: Partial<StageConfig>) => setCfg(p)}
                allStages={allStages as unknown as NewTournamentPayload["stages"]}
                stageIndex={index}
              />
            );
          })()}
        </div>
      )}
    </div>
  );
}

function newMiniPayload(
  allStages: StageDraft[],
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
    stages: allStages as unknown as NewTournamentPayload["stages"],
    tournament_team_ids: teams.map((t) => t.id),
  };
}

/* -------------------------------------------------------
   League config (rounds per opponent, double round, shuffle)
   ------------------------------------------------------- */
function LeagueConfig({
  cfg,
  setCfg,
}: {
  cfg: StageConfig;
  setCfg: (patch: Partial<StageConfig>) => void;
}) {
  const repeats =
    (cfg as any).rounds_per_opponent ??
    (cfg as any)["αγώνες_ανά_αντίπαλο"] ??
    ((cfg as any).double_round || (cfg as any)["διπλός_γύρος"] ? 2 : 1);

  const doubleRound = !!((cfg as any).double_round ?? (cfg as any)["διπλός_γύρος"]);
  const shuffle = !!((cfg as any).shuffle ?? (cfg as any)["τυχαία_σειρά"]);
  const limitMds = (cfg as any).limit_matchdays ?? (cfg as any)["μέγιστες_αγωνιστικές"] ?? "";
  const allowDraws = (cfg as any).allow_draws ?? true;

  return (
    <fieldset className="rounded-lg border border-gray-800 bg-black p-4 space-y-3">
      <legend className="px-1 text-white/90 text-sm">Ρυθμίσεις Πρωταθλήματος</legend>

      <div className="grid sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-white text-sm mb-1">Αγώνες ανά αντίπαλο</label>
          <input
            type="number"
            min={1}
            className="w-28 rounded-lg bg-black border border-gray-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/40"
            value={repeats}
            onChange={(e) =>
              setCfg({ rounds_per_opponent: Math.max(1, Number(e.target.value) || 1) })
            }
          />
          <p className={helperText}>1 = μονός γύρος, 2 = διπλός, κ.ο.κ.</p>
        </div>

        <div className="flex items-end">
          <label className="inline-flex items-center gap-2 text-white text-sm">
            <input
              type="checkbox"
              className="accent-white"
              checked={doubleRound}
              onChange={(e) => setCfg({ double_round: e.target.checked })}
            />
            Διπλός γύρος (συντόμευση)
          </label>
        </div>

        <div className="flex items/end">
          <label className="inline-flex items-center gap-2 text-white text-sm">
            <input
              type="checkbox"
              className="accent-white"
              checked={shuffle}
              onChange={(e) => setCfg({ shuffle: e.target.checked })}
            />
            Τυχαία σειρά
          </label>
        </div>

        <div className="sm:col-span-3">
          <label className="block text-white text-sm mb-1">
            Μέγιστες αγωνιστικές (προαιρετικό)
          </label>
          <input
            type="number"
            min={1}
            className="w-36 rounded-lg bg-black border border-gray-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/40"
            value={limitMds}
            onChange={(e) =>
              setCfg({
                limit_matchdays:
                  e.target.value === "" ? undefined : Math.max(1, Number(e.target.value) || 1),
              })
            }
          />
          <p className={helperText}>Αν οριστεί, κόβει το πρόγραμμα στις πρώτες Ν αγωνιστικές.</p>
        </div>

        <div className="sm:col-span-3">
          <label className="inline-flex items-center gap-2 text-white text-sm">
            <input
              type="checkbox"
              className="accent-white"
              checked={allowDraws}
              onChange={(e) => setCfg({ allow_draws: e.target.checked })}
            />
            Επιτρέπονται ισοπαλίες
          </label>
        </div>
      </div>
    </fieldset>
  );
}

/* -------------------------------------------------------
   Inline KO-from-League (and Standalone) config
   ------------------------------------------------------- */
function KnockoutConfigFromLeague({
  cfg,
  setCfg,
  allStages,
  stageIndex,
}: {
  cfg: StageConfig;
  setCfg: (patch: Partial<StageConfig>) => void;
  allStages: NewTournamentPayload["stages"];
  stageIndex: number;
}) {
  const koSourceSelectValue = Number.isFinite((cfg as any).from_stage_idx as any)
    ? String((cfg as any).from_stage_idx)
    : "";

  const srcKind =
    Number.isFinite((cfg as any).from_stage_idx as any)
      ? (allStages[Number((cfg as any).from_stage_idx)] as any)?.kind
      : null;

  const isFromLeague = srcKind === "league";

  const advancersCount = (cfg as any).advancers_total ?? 4;
  const standaloneSize = (cfg as any).standalone_bracket_size ?? "";

  return (
    <fieldset className="rounded-lg border border-gray-800 bg-black p-4 space-y-4">
      <legend className="px-1 text-white/90 text-sm">
        Knockout — Προέλευση (Πρωτάθλημα ή Αυτόνομο)
      </legend>

      <div>
        <label className="block text-white text-sm mb-1">Προέλευση</label>
        <select
          className={selectBase}
          value={koSourceSelectValue}
          onChange={(e) => {
            const v = e.target.value;
            if (!v) {
              setCfg({ from_stage_idx: undefined });
            } else {
              setCfg({ from_stage_idx: Math.max(0, Number(v) || 0) });
            }
          }}
        >
          <option value="">Αυτόνομο (μόνο seeds)</option>
          {(allStages as unknown as StageDraft[]).map((s: StageDraft, i) =>
            s.kind === "league" && i < stageIndex ? (
              <option key={i} value={i}>
                #{i} — {s.name || "Πρωτάθλημα"}
              </option>
            ) : null
          )}
          {(allStages as unknown as StageDraft[]).map((s: StageDraft, i) =>
            s.kind === "groups" && i < stageIndex ? (
              <option key={`g-${i}`} value={i}>
                #{i} — {s.name || "Όμιλοι"}
              </option>
            ) : null
          )}
        </select>
        <p className={helperText}>
          Επιλέξτε προηγούμενο στάδιο Πρωταθλήματος (League) ή αφήστε «Αυτόνομο» για bracket μόνο από
          seeds.
        </p>
      </div>

      {isFromLeague ? (
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-white text-sm mb-1">Σύνολο Προκρινόμενων</label>
            <input
              type="number"
              min={2}
              className="w-36 rounded-lg bg-black border border-gray-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white/30"
              value={advancersCount}
              onChange={(e) =>
                setCfg({
                  advancers_total: Math.max(2, Number(e.target.value) || 2),
                })
              }
            />
            <p className={helperText}>
              Π.χ. 4, 8, 16… Οι ομάδες προκύπτουν από την <strong>τελική βαθμολογία</strong>.
            </p>
          </div>
          <div className="rounded-md border border-gray-800 bg-black p-3 sm:col-span-2">
            <p className="text-xs text-gray-200">
              Η επιλογή γίνεται με βάση την <strong>κατάταξη</strong> του πρωταθλήματος (όχι seed).
            </p>
          </div>
        </div>
      ) : (
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-white text-sm mb-1">Μέγεθος Πλέι-οφ</label>
            <select
              className={selectBase}
              value={standaloneSize}
              onChange={(e) =>
                setCfg({
                  standalone_bracket_size: e.target.value
                    ? Math.max(2, Number(e.target.value) || 0)
                    : undefined,
                })
              }
            >
              <option value="">Αυτόματο (όλες οι ομάδες)</option>
              <option value={4}>4</option>
              <option value={8}>8</option>
              <option value={16}>16</option>
              <option value={32}>32</option>
            </select>
            <p className={helperText}>
              Αν δεν είναι δύναμη του 2, δημιουργούνται byes με βάση τα seeds.
            </p>
          </div>
          <div className="rounded-md border border-gray-800 bg-black p-3 sm:col-span-2">
            <p className="text-xs text-gray-200">
              Το αυτόνομο νοκ-άουτ γεμίζει με τις κορυφαίες ομάδες κατά <strong>seed</strong>.
            </p>
          </div>
        </div>
      )}
    </fieldset>
  );
}
