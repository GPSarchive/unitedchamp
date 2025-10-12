// app/dashboard/tournaments/TournamentCURD/stages/StageCard.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { NewTournamentPayload } from "@/app/lib/types";
import type { TeamDraft } from "../TournamentWizard";

import GroupsBoard from "./groups/GroupsBoard";
import KnockoutBoard from "./KnockoutTree/newknockout/KnockoutBoard";
import GroupsConfigKOIntake from "./groups/GroupsConfigKOIntake";
import KnockoutConfigFromGroups from "./KnockoutTree/newknockout/KnockoutConfigFromGroups";
import InlineMatchPlanner from "../preview/InlineMatchPlanner";

import type { StageConfig } from "@/app/lib/types";
import { computeGroupsSignature } from "@/app/dashboard/tournaments/TournamentCURD/util/groupsSignature";

// ✅ store (make sure this import path matches everywhere)
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

// Small fetch helper
async function safeJson(res: Response) {
  try {
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) return await res.json();
  } catch {}
  return null;
}

type CatalogRow = { id: number; name: string; logo?: string | null };

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
  value: NewTournamentPayload["stages"][number];
  index: number;
  onChange: (patch: Partial<NewTournamentPayload["stages"][number]>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  allStages: NewTournamentPayload["stages"];
  teams: TeamDraft[];
}) {
  // ---- store slices ----
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

  // ---------- Pick an effective stageIdx based on the STORE ----------
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

    // match by kind if possible
    const kindAt = (idx: number) => {
      const sid = stageIdByIndex[idx];
      return sid ? (stagesById as any)[sid]?.kind : undefined;
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

    // last resort
    for (const [idx, count] of matchesPerIdx.entries()) {
      if (count > 0) return idx;
    }
    return typeof preferred === "number" ? preferred : index;
  }, [payloadStageId, stageIndexById, stageIdByIndex, stagesById, index, matchesPerIdx]);

  // ----- Intake mode toggle (KO → Groups) -----
  const intakeEnabled =
    Number.isFinite((cfg as any)?.from_knockout_stage_idx as any) &&
    ((cfg as any)?.groups_intake?.length ?? 0) > 0;

  // ======= Team catalog hydration (pull names/logos by id) =======
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

  // Build teamsMap from hydrated catalog, with dual keys (number + string)
  const teamsMap: Record<number | string, { name: string; seed?: number | null; logo?: string | null }> =
    useMemo(() => {
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

  // ------- Groups occupancy -------
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

  // 🔐 Persist groups signature whenever the groups array changes
  useEffect(() => {
    if (!isGroups) return;
    const sig = computeGroupsSignature(groupsArr as Array<{ name: string }>);
    if ((cfg as any).groups_signature !== sig) {
      setCfg({ groups_signature: sig });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGroups, groupsArr]);

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
    onChange({ groups: [...gs, { id: undefined, name: `Όμιλος ${gs.length + 1}` }] } as any);
  };
  const setGroupName = (gi: number, name: string) =>
    onChange({
      groups: (groupsArr as any).map((g: any, i: number) =>
        i === gi ? { id: g?.id, name } : g
      ),
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

  // Helper: what kind is the KO source (if any)?
  const srcIdx = Number.isFinite((cfg as any)?.from_stage_idx as any)
    ? Number((cfg as any).from_stage_idx)
    : null;
  const srcStage = srcIdx != null ? (allStages[srcIdx] as any) : null;

  return (
    <div className="rounded-lg border border-cyan-400/20 bg-gradient-to-br from-slate-900/60 to-indigo-950/50 p-3 space-y-4">
      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-white/70">Στάδιο #{effectiveStageIdx + 1}</div>
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
          <p className="mt-1 text-xs text-white/60">Δώστε το όνομα του σταδίου (π.χ. «Κανονική Περίοδος»).</p>
        </div>
        <div>
          <select
            className="w-full bg-slate-950 border border-cyan-400/20 rounded-md px-3 py-2 text-white"
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
              } as any);
            }}
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
            intakeMode={intakeEnabled}
          />

          {/* Groups setting: Allow draws */}
          <div className="mt-2 rounded-md border border-cyan-400/15 p-2">
            <label className="inline-flex items-center gap-2 text-white/90 text-sm">
              <input
                type="checkbox"
                checked={(cfg as any).allow_draws ?? true}
                onChange={(e) => setCfg({ allow_draws: e.target.checked })}
              />
              Επιτρέπονται ισοπαλίες (Όμιλοι)
            </label>
          </div>
        </>
      )}

      {isKnockout && (
        <KnockoutBoard
          stageIdx={effectiveStageIdx}   
          teamsMap={teamsMap}
        />
      )}

      {/* Inline match planner */}
      <InlineMatchPlanner
        miniPayload={newMiniPayload(allStages, teams)}
        teams={teams}
        forceStageIdx={effectiveStageIdx} 
      />

      {/* Config: Groups (incl. KO → Groups intake) */}
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

      {/* Config: League */}
      {isLeague && <LeagueConfig cfg={cfg} setCfg={(p) => setCfg(p)} />}

      {/* Config: Knockout */}
      {isKnockout && (
        <>
          {(() => {
            const srcIdx = Number.isFinite((cfg as any)?.from_stage_idx as any)
              ? Number((cfg as any).from_stage_idx)
              : null;
            const srcStage = srcIdx != null ? (allStages[srcIdx] as any) : null;
            return srcStage?.kind === "groups" ? (
              <KnockoutConfigFromGroups
                cfg={cfg}
                setCfg={(p: Partial<StageConfig>) => setCfg(p)}
                allStages={allStages}
                stageIndex={index}
              />
            ) : (
              <KnockoutConfigFromLeague
                cfg={cfg}
                setCfg={(p: Partial<StageConfig>) => setCfg(p)}
                allStages={allStages}
                stageIndex={index}
              />
            );
          })()}
        </>
      )}
    </div>
  );
}

function newMiniPayload(allStages: NewTournamentPayload["stages"], teams: TeamDraft[]): NewTournamentPayload {
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
    <fieldset className="rounded-md border border-cyan-400/15 p-3 space-y-3">
      <legend className="px-1 text-cyan-200 text-sm">Ρυθμίσεις Πρωταθλήματος</legend>

      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-white/90 text-sm mb-1">Αγώνες ανά αντίπαλο</label>
          <input
            type="number"
            min={1}
            className="w-28 bg-slate-950 border border-cyan-400/20 rounded-md px-3 py-2 text-white"
            value={repeats}
            onChange={(e) =>
              setCfg({ rounds_per_opponent: Math.max(1, Number(e.target.value) || 1) })
            }
          />
          <p className="mt-1 text-xs text-white/60">1 = μονός γύρος, 2 = διπλός, κ.ο.κ.</p>
        </div>

        <div className="flex items-end">
          <label className="inline-flex items-center gap-2 text-white/90 text-sm">
            <input
              type="checkbox"
              checked={doubleRound}
              onChange={(e) => setCfg({ double_round: e.target.checked })}
            />
            Διπλός γύρος (συντόμευση)
          </label>
        </div>

        <div className="flex items-end">
          <label className="inline-flex items-center gap-2 text-white/90 text-sm">
            <input
              type="checkbox"
              checked={shuffle}
              onChange={(e) => setCfg({ shuffle: e.target.checked })}
            />
            Τυχαία σειρά
          </label>
        </div>

        <div className="sm:col-span-3">
          <label className="block text-white/90 text-sm mb-1">Μέγιστες αγωνιστικές (προαιρετικό)</label>
          <input
            type="number"
            min={1}
            className="w-36 bg-slate-950 border border-cyan-400/20 rounded-md px-3 py-2 text-white"
            value={limitMds}
            onChange={(e) =>
              setCfg({
                limit_matchdays:
                  e.target.value === "" ? undefined : Math.max(1, Number(e.target.value) || 1),
              })
            }
          />
          <p className="mt-1 text-xs text-white/60">Αν οριστεί, κόβει το πρόγραμμα στις πρώτες Ν αγωνιστικές.</p>
        </div>

        {/* Allow draws */}
        <div className="sm:col-span-3">
          <label className="inline-flex items-center gap-2 text-white/90 text-sm">
            <input
              type="checkbox"
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

  // ✅ League→KO uses advancers_total; standalone uses standalone_bracket_size
  const advancersCount = (cfg as any).advancers_total ?? 4;
  const standaloneSize = (cfg as any).standalone_bracket_size ?? "";

  return (
    <fieldset className="rounded-md border border-cyan-400/15 p-3 space-y-4">
      <legend className="px-1 text-cyan-200 text-sm">Knockout — Προέλευση (Πρωτάθλημα ή Αυτόνομο)</legend>

      <div>
        <label className="block text-white/90 text-sm mb-1">Προέλευση</label>
        <select
          className="w-full bg-slate-950 border border-cyan-400/20 rounded-md px-3 py-2 text-white"
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
          {allStages.map((s, i) =>
            (s as any)?.kind === "league" && i < stageIndex ? (
              <option key={i} value={i}>
                #{i} — {(s as any)?.name || "Πρωτάθλημα"}
              </option>
            ) : null
          )}
          {allStages.map((s, i) =>
            (s as any)?.kind === "groups" && i < stageIndex ? (
              <option key={`g-${i}`} value={i}>
                #{i} — {(s as any)?.name || "Όμιλοι"}
              </option>
            ) : null
          )}
        </select>
        <p className="mt-1 text-xs text-white/60">
          Επιλέξτε προηγούμενο στάδιο Πρωταθλήματος (League) ή αφήστε «Αυτόνομο» για bracket μόνο από seeds.
        </p>
      </div>

      {isFromLeague ? (
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-white/90 text-sm mb-1">Σύνολο Προκρινόμενων</label>
            <input
              type="number"
              min={2}
              className="w-36 bg-slate-950 border border-cyan-400/20 rounded-md px-3 py-2 text-white"
              value={advancersCount}
              onChange={(e) =>
                setCfg({
                  advancers_total: Math.max(2, Number(e.target.value) || 2),
                })
              }
            />
            <p className="mt-1 text-xs text-white/60">
              Π.χ. 4, 8, 16… Οι ομάδες προκύπτουν από την <strong>τελική βαθμολογία</strong>.
            </p>
          </div>
          <div className="rounded-md border border-white/10 bg-white/5 p-2 sm:col-span-2">
            <p className="text-xs text-white/70">
              Η επιλογή γίνεται με βάση την <strong>κατάταξη</strong> του πρωταθλήματος (όχι seed).
            </p>
          </div>
        </div>
      ) : (
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-white/90 text-sm mb-1">Μέγεθος Πλέι-οφ</label>
            <select
              className="bg-slate-950 border border-cyan-400/20 rounded-md px-3 py-2 text-white"
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
            <p className="mt-1 text-xs text-white/60">
              Αν δεν είναι δύναμη του 2, δημιουργούνται byes με βάση τα seeds.
            </p>
          </div>
          <div className="rounded-md border border-white/10 bg-white/5 p-2 sm:col-span-2">
            <p className="text-xs text-white/70">
              Το αυτόνομο νοκ-άουτ γεμίζει με τις κορυφαίες ομάδες κατά <strong>seed</strong>.
            </p>
          </div>
        </div>
      )}
    </fieldset>
  );
}
