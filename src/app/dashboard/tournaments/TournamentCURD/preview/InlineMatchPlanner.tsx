// app/dashboard/tournaments/TournamentCURD/MatchPlanner/InlineMatchPlanner.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { NewTournamentPayload } from "@/app/lib/types";
import type { TeamDraft, DraftMatch } from "../TournamentWizard";
import { useTournamentStore } from "@/app/dashboard/tournaments/TournamentCURD/submit/tournamentStore";
import type { TournamentState } from "@/app/dashboard/tournaments/TournamentCURD/submit/tournamentStore";
import { generateDraftMatches } from "../util/Generators";

/* ---------------- helpers ---------------- */
function rrPairKey(a?: number | null, b?: number | null): string {
  const x = a ?? 0,
    y = b ?? 0;
  return x < y ? `${x}-${y}` : `${y}-${x}`;
}

function rowSignature(m: DraftMatch): string {
  if (m.round != null && m.bracket_pos != null) {
    return `KO|S${m.stageIdx ?? -1}|R${m.round}|B${m.bracket_pos}`;
  }
  const g = m.groupIdx ?? -1;
  const md = m.matchday ?? 0;
  const pair = rrPairKey(m.team_a_id, m.team_b_id);
  return `RR|S${m.stageIdx ?? -1}|G${g}|MD${md}|${pair}`;
}

function reactKey(m: DraftMatch, i: number): string {
  const id = (m as any)?.db_id as number | null | undefined;
  const sig = rowSignature(m);
  return id != null ? `M#${id}|${sig}` : `${sig}|I${i}`;
}

function legacyRowSignature(m: DraftMatch): string {
  const parts = [
    m.stageIdx ?? "",
    m.groupIdx ?? "",
    m.matchday ?? "",
    m.round ?? "",
    m.bracket_pos ?? "",
    m.team_a_id ?? "",
    m.team_b_id ?? "",
    m.match_date ?? "",
  ];
  return parts.join("|");
}

function isoToLocalInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(
    d.getUTCHours()
  )}:${pad(d.getUTCMinutes())}`;
}
function localInputToISO(localStr?: string): string | null {
  if (!localStr) return null;
  const m = localStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, yStr, moStr, dStr, hhStr, mmStr] = m;
  const utc = new Date(Date.UTC(+yStr, +moStr - 1, +dStr, +hhStr, +mmStr, 0, 0));
  return utc.toISOString();
}

/* ---------------- selectors ---------------- */
const selDraftMatches = (s: TournamentState) => s.draftMatches as DraftMatch[];
const selDbOverlayBySig = (s: TournamentState) =>
  s.dbOverlayBySig as Record<string, Partial<DraftMatch> & { db_id?: number | null; updated_at?: string | null }>;
const selStagesById = (s: TournamentState) => s.entities?.stagesById ?? {};
const selStageIdByIndex = (s: TournamentState) => s.ids?.stageIdByIndex ?? {};
const selStageIndexById = (s: TournamentState) => s.ids?.stageIndexById ?? {};
const selGroupIdByStage = (s: TournamentState) => s.ids?.groupIdByStage ?? {};
const selGroupsById = (s: TournamentState) => s.entities?.groupsById ?? {};
const selUpdateMatches = (s: TournamentState) =>
  s.updateMatches as (stageIdx: number, recipe: (stageRows: DraftMatch[]) => DraftMatch[]) => void;
const selListGroupTeamIds = (s: TournamentState) =>
  s.listGroupTeamIds as (stageIdx: number, groupIdx: number) => number[];
const selGetTeamName = (s: TournamentState) => s.getTeamName as (id: number | string | null) => string;
const selRemoveMatch = (s: TournamentState) => s.removeMatch as (row: DraftMatch) => void;
const selReindexKOPointers = (s: TournamentState) => s.reindexKOPointers as (stageIdx: number) => void;
const selSetKORoundPos = (s: TournamentState) =>
  s.setKORoundPos as (
    stageIdx: number,
    from: { round: number; bracket_pos: number },
    to: { round: number; bracket_pos: number }
  ) => void;

/* ---------------- overlay sync helpers ---------------- */
function migrateOverlayKey(oldKey: string, newKey: string) {
  if (!oldKey || !newKey || oldKey === newKey) return;
  const overlay = useTournamentStore.getState().dbOverlayBySig as Record<
    string,
    Partial<DraftMatch> & { db_id?: number | null; updated_at?: string | null }
  >;
  const ov = overlay[oldKey];
  if (!ov) return;
  const next = { ...overlay };
  next[newKey] = { ...ov };
  delete next[oldKey];
  useTournamentStore.setState({ dbOverlayBySig: next });
}

function safeOverlay(
  ov?: Partial<DraftMatch> & { db_id?: number | null; updated_at?: string | null }
) {
  if (!ov) return undefined;
  const {
    match_date,
    stageIdx,
    groupIdx,
    matchday,
    round,
    bracket_pos,
    team_a_id,
    team_b_id,
    ...rest
  } = ov as any;
  return rest as typeof ov;
}

function ensureOverlayForRow(row: DraftMatch) {
  const db_id = (row as any).db_id as number | null | undefined;
  const status = (row as any).status;
  const team_a_score = (row as any).team_a_score;
  const team_b_score = (row as any).team_b_score;
  const winner_team_id = (row as any).winner_team_id;
  const updated_at = (row as any).updated_at;

  const hasDbBits =
    db_id != null || status != null || team_a_score != null || team_b_score != null || winner_team_id != null;

  if (!hasDbBits) return;

  const key = legacyRowSignature(row);
  const overlay = useTournamentStore.getState().dbOverlayBySig as Record<
    string,
    Partial<DraftMatch> & { db_id?: number | null; updated_at?: string | null }
  >;

  const curr = overlay[key];

  const nextVal = {
    db_id: db_id ?? curr?.db_id ?? null,
    updated_at: updated_at ?? curr?.updated_at ?? null,
    status: (status ?? curr?.status ?? "scheduled") as DraftMatch["status"],
    team_a_score: (team_a_score ?? curr?.team_a_score ?? null) as number | null,
    team_b_score: (team_b_score ?? curr?.team_b_score ?? null) as number | null,
    winner_team_id: (winner_team_id ?? curr?.winner_team_id ?? null) as number | null,
    home_source_round: row.home_source_round ?? (curr as any)?.home_source_round ?? null,
    home_source_bracket_pos: row.home_source_bracket_pos ?? (curr as any)?.home_source_bracket_pos ?? null,
    away_source_round: row.away_source_round ?? (curr as any)?.away_source_round ?? null,
    away_source_bracket_pos: row.away_source_bracket_pos ?? (curr as any)?.away_source_bracket_pos ?? null,
  } as const;

  const next = { ...overlay, [key]: nextVal };
  useTournamentStore.setState({ dbOverlayBySig: next });
}

function migrateOverlayByDbIdToKey(dbId: number, newKey: string) {
  const overlay = useTournamentStore.getState().dbOverlayBySig as Record<
    string,
    Partial<DraftMatch> & { db_id?: number | null; updated_at?: string | null }
  >;
  const found = Object.entries(overlay).find(([, v]) => v?.db_id === dbId);
  if (!found) return;
  const [oldKey] = found;
  migrateOverlayKey(oldKey, newKey);
}

/* ---------------- component ---------------- */
export default function InlineMatchPlanner({
  miniPayload,
  teams,
  forceStageIdx,
}: {
  miniPayload: NewTournamentPayload;
  teams: TeamDraft[];
  forceStageIdx: number;
}) {
  const draftMatches = useTournamentStore(selDraftMatches);
  const dbOverlayBySig = useTournamentStore(selDbOverlayBySig);

  const stagesById = useTournamentStore(selStagesById) as Record<number, any>;
  const stageIdByIndex = useTournamentStore(selStageIdByIndex) as Record<number, number>;
  const stageIndexById = useTournamentStore(selStageIndexById) as Record<number, number>;

  const groupIdByStage = useTournamentStore(selGroupIdByStage);
  const groupsById = useTournamentStore(selGroupsById) as Record<number, any>;

  const updateMatches = useTournamentStore(selUpdateMatches);
  const listGroupTeamIds = useTournamentStore(selListGroupTeamIds);
  const getTeamName = useTournamentStore(selGetTeamName);
  const removeMatch = useTournamentStore(selRemoveMatch);
  const reindexKOPointers = useTournamentStore(selReindexKOPointers);
  const setKORoundPos = useTournamentStore(selSetKORoundPos);

  useEffect(() => {
    (window as any).useTournamentStore = useTournamentStore;
    return () => {
      if ((window as any).useTournamentStore === useTournamentStore) delete (window as any).useTournamentStore;
    };
  }, []);

  const nameOf = useMemo(() => {
    const local = new Map<number, string>();
    (teams ?? []).forEach((t: TeamDraft) => {
      if (t && typeof t.id === "number") local.set(t.id, (t as any).name ?? `Team #${t.id}`);
    });
    return (id: number | string | null) => {
      if (id == null) return "—";
      if (typeof id === "number") {
        const n = local.get(id);
        if (n) return n;
      }
      return getTeamName(id);
    };
  }, [teams, getTeamName]);

  /* ---------- Robust stage index ---------- */
  const propStageId = (miniPayload?.stages as any)?.[forceStageIdx]?.id as number | undefined;

  const stageIdxFromId = useMemo<number | undefined>(() => {
    if (propStageId && typeof stageIndexById[propStageId] === "number") {
      return stageIndexById[propStageId]!;
    }
    return undefined;
  }, [propStageId, stageIndexById]);

  const matchesPerIdx = useMemo(() => {
    const map = new Map<number, number>();
    draftMatches.forEach((m: DraftMatch) => {
      const idx = (m.stageIdx ?? -1) as number;
      if (idx >= 0) map.set(idx, (map.get(idx) ?? 0) + 1);
    });
    return map;
  }, [draftMatches]);

  const effectiveStageIdx = useMemo(() => {
    const preferred = typeof stageIdxFromId === "number" ? stageIdxFromId : undefined;
    if (preferred != null && (matchesPerIdx.get(preferred) ?? 0) > 0) return preferred;
    if ((matchesPerIdx.get(forceStageIdx) ?? 0) > 0) return forceStageIdx;

    const kindAt = (idx: number) => {
      const sid = stageIdByIndex[idx];
      return sid ? stagesById[sid]?.kind : undefined;
    };
    const wantKind = kindAt(stageIdxFromId ?? forceStageIdx);

    let bestIdx: number | undefined;
    let bestCount = -1;
    matchesPerIdx.forEach((count, idx) => {
      if (!count) return;
      if (wantKind && kindAt(idx) !== wantKind) return;
      if (count > bestCount) {
        bestCount = count;
        bestIdx = idx;
      }
    });
    if (bestIdx != null) return bestIdx;

    matchesPerIdx.forEach((count, idx) => {
      if (count > 0 && bestIdx == null) bestIdx = idx;
    });
    return bestIdx ?? (stageIdxFromId ?? forceStageIdx);
  }, [stageIdxFromId, forceStageIdx, matchesPerIdx, stageIdByIndex, stagesById]);

  /* ---------- Kind & groups ---------- */
  const kindFromStore = useMemo<"league" | "groups" | "knockout" | undefined>(() => {
    const sid = stageIdByIndex?.[effectiveStageIdx];
    return sid ? (stagesById?.[sid]?.kind ?? "league") : undefined;
  }, [stageIdByIndex, stagesById, effectiveStageIdx]);

  const allRowsForStage = useMemo(() => {
    const rows = draftMatches.filter((r: DraftMatch) => r.stageIdx === effectiveStageIdx);
    return rows.map((r: DraftMatch) => {
      const sigLegacy = legacyRowSignature(r);
      const ovRaw =
        dbOverlayBySig[rowSignature(r)] ||
        dbOverlayBySig[sigLegacy] ||
        ((r as any).db_id != null
          ? Object.values(
              dbOverlayBySig as Record<string, Partial<DraftMatch> & { db_id?: number | null; updated_at?: string | null }>
            ).find((v) => v?.db_id === (r as any).db_id)
          : undefined);
      const ov = safeOverlay(ovRaw);
      return ov ? ({ ...r, ...ov } as DraftMatch) : r;
    });
  }, [draftMatches, dbOverlayBySig, effectiveStageIdx]);

  const hasAnyGrouped = useMemo(() => allRowsForStage.some((r: DraftMatch) => r.groupIdx != null), [allRowsForStage]);

  const isGroups = (kindFromStore ?? "league") === "groups" || hasAnyGrouped;
  const isKO = (kindFromStore ?? "league") === "knockout";

  const rawGroupMap = (groupIdByStage as Record<number, number | Record<number, number> | undefined>)?.[
    effectiveStageIdx
  ];

  const normalizedGroupMap: Record<number, number> = useMemo(() => {
    if (!rawGroupMap) return {};
    if (typeof rawGroupMap === "number") return { 0: rawGroupMap };
    return rawGroupMap as Record<number, number>;
  }, [rawGroupMap]);

  const fallbackGroups = useMemo(
    () =>
      Object.values(groupsById)
        .filter((g: any) => g.stage_id === stageIdByIndex?.[effectiveStageIdx])
        .sort(
          (a: any, b: any) =>
            (a.ordering ?? 0) - (b.ordering ?? 0) || String(a.name).localeCompare(String(b.name))
        )
        .map((g: any, i: number) => ({ idx: i, id: g.id, name: g.name ?? `Group ${i + 1}` })),
    [groupsById, stageIdByIndex, effectiveStageIdx]
  );

  const storeGroups = useMemo(() => {
    const entries = Object.keys(normalizedGroupMap).length
      ? Object.keys(normalizedGroupMap)
          .map((idxStr: string) => ({ idx: Number(idxStr), id: normalizedGroupMap[Number(idxStr)] }))
          .sort((a, b) => a.idx - b.idx)
          .map(({ idx, id }) => ({ idx, id, name: (groupsById as any)?.[id]?.name ?? `Group ${idx + 1}` }))
      : fallbackGroups;
    return entries;
  }, [normalizedGroupMap, groupsById, fallbackGroups]);

  const [groupIdx, setGroupIdx] = useState<number>(storeGroups.length ? 0 : -1);
  useEffect(() => {
    if (!isGroups) setGroupIdx(-1);
  }, [isGroups]);

  const useAllGroups = isGroups && (!storeGroups.length || groupIdx === -1);

  const visible = useMemo(() => {
    if (isGroups) {
      if (useAllGroups) return allRowsForStage;
      return allRowsForStage.filter((r: DraftMatch) => r.groupIdx === (groupIdx ?? 0));
    }
    if (isKO) return allRowsForStage;
    return allRowsForStage.filter((r: DraftMatch) => r.groupIdx == null);
  }, [allRowsForStage, isGroups, isKO, groupIdx, useAllGroups]);

  /* ---------- Team search filter ---------- */
  const [teamQuery, setTeamQuery] = useState("");
  const filteredVisible = useMemo(() => {
    const q = teamQuery.trim().toLowerCase();
    if (!q) return visible;
    const norm = (s: string) => s.toLowerCase();
    return visible.filter((m: DraftMatch) => {
      const a = norm(nameOf(m.team_a_id ?? null));
      const b = norm(nameOf(m.team_b_id ?? null));
      return a.includes(q) || b.includes(q);
    });
  }, [visible, teamQuery, nameOf]);

  const teamOptions = useMemo(() => {
    const effectiveGroupForOptions = groupIdx != null && groupIdx >= 0 ? groupIdx : 0;
    const ids: number[] =
      isGroups && !useAllGroups
        ? listGroupTeamIds(effectiveStageIdx, effectiveGroupForOptions)
        : (miniPayload.tournament_team_ids as number[]) ?? [];
    return ids.map((id: number) => ({ id, label: nameOf(id) }));
  }, [isGroups, useAllGroups, groupIdx, effectiveStageIdx, listGroupTeamIds, nameOf, miniPayload.tournament_team_ids]);

  /* ---------- KO helpers ---------- */
  function ensureRowExists(stageIdxArg: number, round: number, bracket_pos: number) {
    updateMatches(stageIdxArg, (stageRows: DraftMatch[]) => {
      const exists = stageRows.some(
        (r: DraftMatch) => r.stageIdx === stageIdxArg && r.round === round && r.bracket_pos === bracket_pos
      );
      if (exists) return stageRows;
      const newRow: DraftMatch = {
        stageIdx: stageIdxArg,
        groupIdx: null,
        matchday: null,
        round,
        bracket_pos,
        team_a_id: null,
        team_b_id: null,
        match_date: null,
        home_source_round: null,
        home_source_bracket_pos: null,
        away_source_round: null,
        away_source_bracket_pos: null,
      };
      return [...stageRows, newRow];
    });
  }

  type Patch = Partial<
    Pick<DraftMatch, "matchday" | "round" | "bracket_pos" | "team_a_id" | "team_b_id" | "match_date">
  >;

  const applyPatch = (target: DraftMatch, patch: Patch) => {
    const beforeLegacy = legacyRowSignature(target);

    if (isKO) {
      const currR = target.round ?? 1;
      const currP = target.bracket_pos ?? 1;
      const newR = patch.round ?? currR;
      const newP = patch.bracket_pos ?? currP;

      if (newR !== currR || newP !== currP) {
        ensureRowExists(effectiveStageIdx, newR, newP);

        const afterLegacyTmp = legacyRowSignature({ ...target, round: newR, bracket_pos: newP });
        const dbId = (target as any).db_id as number | null | undefined;
        if (dbId != null) migrateOverlayByDbIdToKey(dbId, afterLegacyTmp);
        else migrateOverlayKey(beforeLegacy, afterLegacyTmp);

        setKORoundPos(effectiveStageIdx, { round: currR, bracket_pos: currP }, { round: newR, bracket_pos: newP });
        reindexKOPointers(effectiveStageIdx);

        const { round: _r, bracket_pos: _p, ...rest } = patch;
        if (Object.keys(rest).length > 0) {
          updateMatches(effectiveStageIdx, (stageRows: DraftMatch[]) => {
            const next = stageRows.slice();
            const i = next.findIndex(
              (r: DraftMatch) => r.stageIdx === effectiveStageIdx && r.round === newR && r.bracket_pos === newP
            );
            if (i >= 0) {
              const merged = { ...next[i], ...rest } as DraftMatch;
              next[i] = merged;
              const afterLegacy = legacyRowSignature(merged);
              if (afterLegacy !== afterLegacyTmp) {
                const mDbId = (merged as any).db_id as number | null | undefined;
                if (mDbId != null) migrateOverlayByDbIdToKey(mDbId, afterLegacy);
                else migrateOverlayKey(afterLegacyTmp, afterLegacy);
              }
              ensureOverlayForRow(merged);
            }
            return next;
          });
        }
        return;
      }
    }

    updateMatches(effectiveStageIdx, (stageRows: DraftMatch[]) => {
      const next = stageRows.slice();
      const idx = next.findIndex((r: DraftMatch) => legacyRowSignature(r) === beforeLegacy);
      const merged: DraftMatch = { ...(idx >= 0 ? next[idx] : target), ...patch };
      const afterLegacy = legacyRowSignature(merged);

      if (afterLegacy !== beforeLegacy) {
        const dbId = (merged as any).db_id as number | null | undefined;
        if (dbId != null) migrateOverlayByDbIdToKey(dbId, afterLegacy);
        else migrateOverlayKey(beforeLegacy, afterLegacy);
      }

      ensureOverlayForRow(merged);
      if (idx >= 0) next[idx] = merged;
      else next.push(merged);
      return next;
    });
  };

  const addRow = () => {
    if (isKO) {
      const stageRows = draftMatches.filter((r: DraftMatch) => r.stageIdx === effectiveStageIdx);
      const round = 1;
      const used = stageRows
        .filter((r: DraftMatch) => r.round === round && r.bracket_pos != null)
        .map((r: DraftMatch) => r.bracket_pos as number);
      const nextPos = used.length ? Math.max(...used) + 1 : 1;
      ensureRowExists(effectiveStageIdx, round, nextPos);
      reindexKOPointers(effectiveStageIdx);
    } else {
      const md = ((visible[visible.length - 1]?.matchday as number | null) ?? 0) + 1;
      const newRow: DraftMatch = {
        stageIdx: effectiveStageIdx,
        groupIdx: isGroups && !useAllGroups ? (groupIdx ?? 0) : null,
        matchday: md,
        round: null,
        bracket_pos: null,
        team_a_id: null,
        team_b_id: null,
        match_date: null,
      };
      updateMatches(effectiveStageIdx, (rows: DraftMatch[]) => [...rows, newRow]);
    }
  };

  const removeRow = (m: DraftMatch) => {
    const dbId = ((m as any).db_id as number | null | undefined) ??
                 ((m as any).id as number | null | undefined) ?? null;
  
    if (dbId != null) {
      const key = legacyRowSignature(m);
      const overlay = useTournamentStore.getState().dbOverlayBySig as Record<string, any>;
      const curr = overlay[key];
      if (!curr || curr.db_id == null) {
        useTournamentStore.setState({ dbOverlayBySig: { ...overlay, [key]: { ...(curr ?? {}), db_id: dbId } } });
      }
    }
  
    // eslint-disable-next-line no-console
    console.debug("[planner.delete]", { db_id: dbId ?? 0, key: legacyRowSignature(m) });

    // Ensure deleteIds[] is populated for /save-all
    removeMatch({ ...(m as any), db_id: dbId ?? 0, id: dbId ?? undefined } as any);

    

    if (isKO) reindexKOPointers(effectiveStageIdx);
  };

  const regenerateStage = () => {
    const fresh = generateDraftMatches({ payload: miniPayload, teams });
    const freshHere = fresh.filter((m: DraftMatch) => m.stageIdx === effectiveStageIdx);

    const key = (m: DraftMatch) =>
      [
        m.groupIdx ?? "",
        m.round ?? "",
        m.bracket_pos ?? "",
        m.matchday ?? "",
        m.home_source_round ?? "",
        m.home_source_bracket_pos ?? "",
        m.away_source_round ?? "",
        m.away_source_bracket_pos ?? "",
      ].join("|");

    const currentStageRows = allRowsForStage;
    const oldByKey = new Map<string, DraftMatch>(currentStageRows.map((m: DraftMatch) => [key(m), m]));

    const merged = freshHere.map((f: DraftMatch) => {
      const old = oldByKey.get(key(f));
      const mergedRow = old
        ? ({
            ...f,
            db_id: (old as any).db_id ?? null,
            status: (old as any).status ?? null,
            team_a_score: (old as any).team_a_score ?? null,
            team_b_score: (old as any).team_b_score ?? null,
            winner_team_id: (old as any).winner_team_id ?? null,
          } as DraftMatch)
        : f;

      ensureOverlayForRow(mergedRow);
      return mergedRow;
    });

    updateMatches(effectiveStageIdx, () => merged);
  };

  const debugLine =
    `stageIdx=${effectiveStageIdx} | rows=${allRowsForStage.length} | visible=${visible.length} | ` +
    `filtered=${filteredVisible.length} | isGroups=${isGroups} | storeGroups=${storeGroups.length} | ` +
    `inferredGroupsFromRows=${hasAnyGrouped}`;

  return (
    <section className="rounded-lg border border-white/10 bg-slate-950/50 p-3 space-y-3">
      <div className="text-[11px] text-white/40">{debugLine}</div>

      <header className="flex flex-wrap items-center gap-2">
        <div className="text-white/80 text-sm">
          <span className="font-medium text-white/90">Fixtures (Stage #{effectiveStageIdx + 1})</span>{" "}
          <span className="text-white/60">
            • {kindFromStore ?? (isKO ? "knockout" : isGroups ? "groups" : "league")}
          </span>

          {isGroups && (
            <>
              <span className="text-white/60"> • Group</span>
              <select
                className="ml-2 bg-slate-950 border border-white/15 rounded px-2 py-1 text-white"
                value={useAllGroups ? -1 : groupIdx}
                onChange={(e) => setGroupIdx(Number(e.target.value))}
              >
                <option value={-1}>All groups</option>
                {storeGroups.map((g) => (
                  <option key={g.idx} value={g.idx}>
                    {g.name}
                  </option>
                ))}
              </select>

              {storeGroups.length === 0 && (
                <span className="ml-2 text-amber-300/80 text-xs align-middle">groups not mapped — showing all matches</span>
              )}
            </>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <input
            type="text"
            className="px-2 py-1.5 rounded border border-white/15 bg-slate-950 text-white text-xs w-56"
            placeholder="Search teams…"
            value={teamQuery}
            onChange={(e) => setTeamQuery(e.target.value)}
          />
          {teamQuery ? (
            <button
              className="px-2 py-1.5 rounded border border-white/15 text-white hover:bg-white/10 text-xs"
              onClick={() => setTeamQuery("")}
              title="Clear search"
            >
              Clear
            </button>
          ) : null}

          <button
            className="px-2 py-1.5 rounded border border-cyan-400/30 text-cyan-200 hover:bg-cyan-500/10 text-xs"
            onClick={regenerateStage}
            title="Rebuild this stage's fixtures (keeps scores/status where possible)"
          >
            Regenerate stage
          </button>
          <button className="px-2 py-1.5 rounded border border-white/15 text-white hover:bg-white/10 text-xs" onClick={addRow}>
            + Add match
          </button>
        </div>
      </header>

      {filteredVisible.length === 0 ? (
        <p className="text-white/70 text-sm">
          No matches for this selection.
          {visible.length > 0 && teamQuery && <span className="ml-2 text-white/50">(Try clearing the search.)</span>}
          {allRowsForStage.length > 0 && isGroups && !teamQuery && (
            <span className="ml-2 text-white/50">(There are {allRowsForStage.length} matches; try “All groups”.)</span>
          )}
        </p>
      ) : (
        <div className="overflow-auto rounded border border-white/10">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-900/70 text-white">
              <tr>
                {isKO ? (
                  <>
                    <th className="px-2 py-1 text-left">Round</th>
                    <th className="px-2 py-1 text-left">Bracket pos</th>
                  </>
                ) : (
                  <th className="px-2 py-1 text-left">Matchday</th>
                )}
                <th className="px-2 py-1 text-left">Team A</th>
                <th className="px-2 py-1 text-left">Team B</th>
                <th className="px-2 py-1 text-left">Score</th>
                <th className="px-2 py-1 text-left">Status</th>
                <th className="px-2 py-1 text-left">Date (UTC)</th>
                <th className="px-2 py-1 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredVisible.map((m: DraftMatch, i: number) => {
                const key = reactKey(m, i);
                return (
                  <tr key={key} className="odd:bg-zinc-950/60 even:bg-zinc-900/40">
                    {isKO ? (
                      <>
                        <td className="px-2 py-1">
                          <input
                            type="number"
                            className="w-20 bg-slate-950 border border-white/15 rounded px-2 py-1 text-white"
                            value={(m.round as number | null) ?? 1}
                            onChange={(e) => applyPatch(m, { round: Number(e.target.value) || 1, matchday: null })}
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="number"
                            className="w-24 bg-slate-950 border border-white/15 rounded px-2 py-1 text-white"
                            value={(m.bracket_pos as number | null) ?? 1}
                            onChange={(e) => applyPatch(m, { bracket_pos: Number(e.target.value) || 1 })}
                          />
                        </td>
                      </>
                    ) : (
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          className="w-16 bg-slate-950 border border-white/15 rounded px-2 py-1 text-white"
                          value={(m.matchday as number | null) ?? 1}
                          onChange={(e) => applyPatch(m, { matchday: Number(e.target.value) || 1 })}
                        />
                      </td>
                    )}

                    <td className="px-2 py-1">
                      <select
                        className="min-w-48 bg-slate-950 border border-white/15 rounded px-2 py-1 text-white"
                        value={m.team_a_id ?? ""}
                        onChange={(e) => applyPatch(m, { team_a_id: e.target.value ? Number(e.target.value) : null })}
                      >
                        <option value="">— Team —</option>
                        {teamOptions.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="px-2 py-1">
                      <select
                        className="min-w-48 bg-slate-950 border border-white/15 rounded px-2 py-1 text-white"
                        value={m.team_b_id ?? ""}
                        onChange={(e) => applyPatch(m, { team_b_id: e.target.value ? Number(e.target.value) : null })}
                      >
                        <option value="">— Team —</option>
                        {teamOptions.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="px-2 py-1">
                      {(() => {
                        const a = (m as any).team_a_score as number | null;
                        const b = (m as any).team_b_score as number | null;
                        return a != null || b != null ? `${a ?? 0} – ${b ?? 0}` : <span className="text-white/50">—</span>;
                      })()}
                    </td>

                    <td className="px-2 py-1">
                      <span
                        className={[
                          "inline-flex items-center rounded px-2 py-0.5 text-xs",
                          ((m as any).status as any) === "finished"
                            ? "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/30"
                            : "bg-zinc-500/10 text-zinc-300 ring-1 ring-white/10",
                        ].join(" ")}
                      >
                        {((m as any).status as any) ?? "scheduled"}
                      </span>
                    </td>

                    <td className="px-2 py-1">
                      <input
                        type="datetime-local"
                        className="bg-slate-950 border border-white/15 rounded px-2 py-1 text-white"
                        value={isoToLocalInput(m.match_date as string | null)}
                        onChange={(e) => applyPatch(m, { match_date: localInputToISO(e.target.value) })}
                      />
                    </td>

                    <td className="px-2 py-1">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          className="px-2 py-1 rounded border border-white/15 hover:bg-white/10 text-xs"
                          onClick={() => applyPatch(m, { team_a_id: m.team_b_id ?? null, team_b_id: m.team_a_id ?? null })}
                          title="Swap teams"
                        >
                          Swap
                        </button>
                        <button
                          className="px-2 py-1 rounded border border-rose-400/30 text-rose-200 hover:bg-rose-500/10 text-xs"
                          onClick={() => removeRow(m)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
