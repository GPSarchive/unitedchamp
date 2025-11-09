"use client";

import { useEffect, useMemo, useState } from "react";
import type { NewTournamentPayload } from "@/app/lib/types";
import type { TeamDraft, DraftMatch } from "../TournamentWizard";
import { useTournamentStore } from "@/app/dashboard/tournaments/TournamentCURD/submit/tournamentStore";
import type { TournamentState } from "@/app/dashboard/tournaments/TournamentCURD/submit/tournamentStore";
import { generateDraftMatches } from "../util/Generators";
import MatchControlPanel from "./MatchControlPanel";

/* ---------------- helpers ---------------- */
function rrPairKey(a?: number | null, b?: number | null) {
  const x = a ?? 0,
    y = b ?? 0;
  return x < y ? `${x}-${y}` : `${y}-${x}`;
}

function rowSignature(m: DraftMatch) {
  if (m.round != null && m.bracket_pos != null) {
    return `KO|S${m.stageIdx ?? -1}|R${m.round}|B${m.bracket_pos}`;
  }
  const g = m.groupIdx ?? -1;
  const md = m.matchday ?? 0;
  const pair = rrPairKey(m.team_a_id, m.team_b_id);
  return `RR|S${m.stageIdx ?? -1}|G${g}|MD${md}|${pair}`;
}

function reactKey(m: DraftMatch, i: number) {
  const id = (m as any)?.db_id as number | null | undefined;
  const sig = rowSignature(m);
  return id != null ? `M#${id}|${sig}` : `${sig}|I${i}`;
}

function legacyRowSignature(m: DraftMatch) {
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

function isoToLocalInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

function localInputToISO(localStr?: string) {
  if (!localStr) return null;
  const m = localStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, yStr, moStr, dStr, hhStr, mmStr] = m;
  return new Date(Date.UTC(+yStr, +moStr - 1, +dStr, +hhStr, +mmStr, 0, 0)).toISOString();
}

/* ---------------- selectors ---------------- */
const selDraftMatches = (s: TournamentState) => s.draftMatches as DraftMatch[];
const selDbOverlayBySig = (s: TournamentState) =>
  s.dbOverlayBySig as Record<
    string,
    Partial<DraftMatch> & { db_id?: number | null; updated_at?: string | null }
  >;
const selStagesById = (s: TournamentState) => s.entities?.stagesById ?? {};
const selStageIdByIndex = (s: TournamentState) => s.ids?.stageIdByIndex ?? {};
const selStageIndexById = (s: TournamentState) => s.ids?.stageIndexById ?? {};
const selGroupIdByStage = (s: TournamentState) => s.ids?.groupIdByStage ?? {};
const selGroupsById = (s: TournamentState) => s.entities?.groupsById ?? {};
const selUpdateMatches = (s: TournamentState) =>
  s.updateMatches as (
    stageIdx: number,
    recipe: (stageRows: DraftMatch[]) => DraftMatch[]
  ) => void;
const selListGroupTeamIds = (s: TournamentState) =>
  s.listGroupTeamIds as (stageIdx: number, groupIdx: number) => number[];
const selGetTeamName = (s: TournamentState) =>
  s.getTeamName as (id: number | string | null) => string;
const selRemoveMatch = (s: TournamentState) =>
  s.removeMatch as (row: DraftMatch) => void;
const selReindexKOPointers = (s: TournamentState) =>
  s.reindexKOPointers as (stageIdx: number) => void;
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
    db_id != null ||
    status != null ||
    team_a_score != null ||
    team_b_score != null ||
    winner_team_id != null;
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
    status: status ?? curr?.status ?? "scheduled",
    team_a_score: team_a_score ?? curr?.team_a_score ?? null,
    team_b_score: team_b_score ?? curr?.team_b_score ?? null,
    winner_team_id: winner_team_id ?? curr?.winner_team_id ?? null,
    home_source_round: row.home_source_round ?? (curr as any)?.home_source_round ?? null,
    home_source_bracket_pos: row.home_source_bracket_pos ?? (curr as any)?.home_source_bracket_pos ?? null,
    away_source_round: row.away_source_round ?? (curr as any)?.away_source_round ?? null,
    away_source_bracket_pos: row.away_source_bracket_pos ?? (curr as any)?.away_source_bracket_pos ?? null,
  } as const;
  useTournamentStore.setState({
    dbOverlayBySig: { ...overlay, [key]: nextVal },
  });
}

function migrateOverlayByDbIdToKey(dbId: number, newKey: string) {
  const overlay = useTournamentStore.getState().dbOverlayBySig as Record<
    string,
    Partial<DraftMatch> & { db_id?: number | null; updated_at?: string | null }
  >;
  const found = Object.entries(overlay).find(([, v]) => v?.db_id === dbId);
  if (!found) return;
  migrateOverlayKey(found[0], newKey);
}

/* ---------------- Round-Robin Integrity Fix ---------------- */
/**
 * Determines which "repeat cycle" a match belongs to based on matchday.
 * For multi-round RR (double, triple, etc.), we need to group matches by their repeat.
 *
 * @param matchday - The matchday number (1-based)
 * @param teamsCount - Number of teams in the group/league
 * @returns The repeat number (1 for first cycle, 2 for second, etc.)
 */
function getRepeatFromMatchday(matchday: number, teamsCount: number): number {
  if (!matchday || !teamsCount || teamsCount < 2) return 1;

  // In round-robin, each cycle has (teamsCount - 1) matchdays for even counts
  // or teamsCount matchdays for odd counts (due to BYE rotation)
  const matchdaysPerCycle = teamsCount % 2 === 0 ? teamsCount - 1 : teamsCount;

  // Calculate which repeat this matchday belongs to (1-based)
  return Math.ceil(matchday / matchdaysPerCycle);
}

function fixRoundRobinIntegrity(
  target: DraftMatch,
  patch: Partial<Pick<DraftMatch, "team_a_id" | "team_b_id">>,
  allStageMatches: DraftMatch[],
  teamsInGroup: number
): DraftMatch[] {
  // Only apply to non-KO matches
  if (target.round != null || target.bracket_pos != null) return allStageMatches;

  const hasTeamChange = patch.team_a_id !== undefined || patch.team_b_id !== undefined;
  if (!hasTeamChange) return allStageMatches;

  const originalTeamA = target.team_a_id || null;
  const originalTeamB = target.team_b_id || null;
  const newTeamA = patch.team_a_id !== undefined ? patch.team_a_id : originalTeamA;
  const newTeamB = patch.team_b_id !== undefined ? patch.team_b_id : originalTeamB;

  // Determine which team was replaced
  let teamThatStayed: number | null = null;
  let teamReplaced: number | null = null;

  if (patch.team_a_id !== undefined && patch.team_a_id !== originalTeamA) {
    teamThatStayed = originalTeamB;
    teamReplaced = originalTeamA;
  } else if (patch.team_b_id !== undefined && patch.team_b_id !== originalTeamB) {
    teamThatStayed = originalTeamA;
    teamReplaced = originalTeamB;
  }

  if (teamThatStayed == null || teamReplaced == null) return allStageMatches;

  // Calculate which repeat cycle this match belongs to
  const targetRepeat = getRepeatFromMatchday(target.matchday ?? 1, teamsInGroup);
  const newPairKey = rrPairKey(newTeamA, newTeamB);

  // Find duplicate match in THE SAME REPEAT CYCLE and same group
  const duplicateMatch = allStageMatches.find((m) => {
    if (m === target) return false;
    if (m.stageIdx !== target.stageIdx) return false;
    if (m.groupIdx !== target.groupIdx) return false;
    if (m.round != null || m.bracket_pos != null) return false;

    // ✅ KEY FIX: Only consider duplicates in the same repeat cycle
    const mRepeat = getRepeatFromMatchday(m.matchday ?? 1, teamsInGroup);
    if (mRepeat !== targetRepeat) return false;

    return rrPairKey(m.team_a_id, m.team_b_id) === newPairKey;
  });

  if (duplicateMatch) {
    console.log("[RR Integrity Fix]", {
      duplicate: duplicateMatch,
      teamThatStayed,
      teamReplaced,
      targetRepeat,
      targetMatchday: target.matchday,
      duplicateMatchday: duplicateMatch.matchday
    });

    return allStageMatches.map((m) => {
      if (m !== duplicateMatch) return m;

      // Swap the replaced team into the duplicate match
      if (m.team_a_id === teamThatStayed) {
        const fixed = { ...m, team_b_id: teamReplaced };
        ensureOverlayForRow(fixed);
        return fixed;
      } else if (m.team_b_id === teamThatStayed) {
        const fixed = { ...m, team_a_id: teamReplaced };
        ensureOverlayForRow(fixed);
        return fixed;
      }
      return m;
    });
  }

  return allStageMatches;
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
  const stagesById = useTournamentStore(selStagesById);
  const stageIdByIndex = useTournamentStore(selStageIdByIndex);
  const stageIndexById = useTournamentStore(selStageIndexById);
  const groupIdByStage = useTournamentStore(selGroupIdByStage);
  const groupsById = useTournamentStore(selGroupsById);
  const updateMatches = useTournamentStore(selUpdateMatches);
  const listGroupTeamIds = useTournamentStore(selListGroupTeamIds);
  const getTeamName = useTournamentStore(selGetTeamName);
  const removeMatch = useTournamentStore(selRemoveMatch);
  const reindexKOPointers = useTournamentStore(selReindexKOPointers);
  const setKORoundPos = useTournamentStore(selSetKORoundPos);

  useEffect(() => {
    (window as any).useTournamentStore = useTournamentStore;
    return () => {
      if ((window as any).useTournamentStore === useTournamentStore)
        delete (window as any).useTournamentStore;
    };
  }, []);

  const nameOf = useMemo(() => {
    const local = new Map<number, { name: string; logo: string | null }>();
    (teams ?? []).forEach((t) => {
      if (t && typeof t.id === "number")
        local.set(t.id, {
          name: t.name ?? `Team #${t.id}`,
          logo: t.logo ?? null,
        });
    });
    return (id: number | string | null) => {
      if (id == null) return { name: "—", logo: null };
      if (typeof id === "number") {
        const team = local.get(id);
        if (team) return team;
      }
      return { name: getTeamName(id), logo: null };
    };
  }, [teams, getTeamName]);

  // ✅ SIMPLIFIED: Use forceStageIdx directly - each StageCard renders its own planner
  const effectiveStageIdx = forceStageIdx;

  const kindFromStore = useMemo(() => {
    const sid = (stageIdByIndex as Record<number, number | undefined>)?.[effectiveStageIdx];
    return sid ? ((stagesById as any)[sid]?.kind ?? "league") : "league";
  }, [stageIdByIndex, stagesById, effectiveStageIdx]);

  // ✅ FILTER: Only matches for THIS stage
  const allRowsForStage = useMemo(() => {
    const rows = draftMatches.filter((r) => r.stageIdx === effectiveStageIdx);
    return rows.map((r) => {
      const sigLegacy = legacyRowSignature(r);
      const ovRaw =
        dbOverlayBySig[rowSignature(r)] ||
        dbOverlayBySig[sigLegacy] ||
        ((r as any).db_id != null
          ? Object.values(dbOverlayBySig).find((v) => v?.db_id === (r as any).db_id)
          : undefined);
      const ov = safeOverlay(ovRaw);
      return ov ? ({ ...r, ...ov } as DraftMatch) : r;
    });
  }, [draftMatches, dbOverlayBySig, effectiveStageIdx]);

  const hasAnyGrouped = useMemo(
    () => allRowsForStage.some((r) => r.groupIdx != null),
    [allRowsForStage]
  );

  const isGroups = kindFromStore === "groups" || hasAnyGrouped;
  const isKO = kindFromStore === "knockout";

  const rawGroupMap = (groupIdByStage as Record<number, any>)?.[effectiveStageIdx];
  const normalizedGroupMap: Record<number, number> = useMemo(() => {
    if (!rawGroupMap) return {};
    if (typeof rawGroupMap === "number") return { 0: rawGroupMap };
    return rawGroupMap as Record<number, number>;
  }, [rawGroupMap]);

  const fallbackGroups = useMemo(() => {
    const sid = (stageIdByIndex as Record<number, number | undefined>)?.[effectiveStageIdx];
    if (!sid && sid !== 0) return [];
    return Object.values(groupsById as any)
      .filter((g: any) => g.stage_id === sid)
      .sort(
        (a: any, b: any) =>
          (a.ordering ?? 0) - (b.ordering ?? 0) ||
          String(a.name).localeCompare(String(b.name))
      )
      .map((g: any, i: number) => ({
        idx: i,
        id: g.id,
        name: g.name ?? `Group ${i + 1}`,
      }));
  }, [groupsById, stageIdByIndex, effectiveStageIdx]);

  const storeGroups = useMemo(() => {
    return Object.keys(normalizedGroupMap).length
      ? Object.keys(normalizedGroupMap)
          .map((idxStr) => ({
            idx: Number(idxStr),
            id: normalizedGroupMap[Number(idxStr)],
          }))
          .sort((a, b) => a.idx - b.idx)
          .map(({ idx, id }) => ({
            idx,
            id,
            name: (groupsById as any)?.[id]?.name ?? `Group ${idx + 1}`,
          }))
      : fallbackGroups;
  }, [normalizedGroupMap, groupsById, fallbackGroups]);

  const [groupIdx, setGroupIdx] = useState<number>(storeGroups.length ? 0 : -1);

  useEffect(() => {
    if (!isGroups) setGroupIdx(-1);
  }, [isGroups]);

  const useAllGroups = isGroups && (!storeGroups.length || groupIdx === -1);

  const visible = useMemo(() => {
    if (isGroups)
      return useAllGroups
        ? allRowsForStage
        : allRowsForStage.filter((r) => r.groupIdx === (groupIdx ?? 0));
    if (isKO) return allRowsForStage;
    return allRowsForStage.filter((r) => r.groupIdx == null);
  }, [allRowsForStage, isGroups, isKO, groupIdx, useAllGroups]);

  const [teamQuery1, setTeamQuery1] = useState("");
  const [teamQuery2, setTeamQuery2] = useState("");
  const [editingMatch, setEditingMatch] = useState<DraftMatch | null>(null);

  const filteredVisible = useMemo(() => {
    const q1 = teamQuery1.trim().toLowerCase();
    const q2 = teamQuery2.trim().toLowerCase();
    
    // If neither field has input, show all
    if (!q1 && !q2) return visible;
    
    // If both fields have input, search for both teams
    if (q1 && q2) {
      return visible.filter((m) => {
        const a = nameOf(m.team_a_id ?? null).name.toLowerCase();
        const b = nameOf(m.team_b_id ?? null).name.toLowerCase();
        
        return (a.includes(q1) && b.includes(q2)) || 
               (a.includes(q2) && b.includes(q1));
      });
    }
    
    // If only one field has input, search for that team
    const q = q1 || q2;
    return visible.filter((m) => {
      const a = nameOf(m.team_a_id ?? null).name.toLowerCase();
      const b = nameOf(m.team_b_id ?? null).name.toLowerCase();
      return a.includes(q) || b.includes(q);
    });
  }, [visible, teamQuery1, teamQuery2, nameOf]);

  const teamOptions = useMemo(() => {
    const effectiveGroupForOptions = groupIdx != null && groupIdx >= 0 ? groupIdx : 0;
    const ids =
      isGroups && !useAllGroups
        ? listGroupTeamIds(effectiveStageIdx, effectiveGroupForOptions)
        : miniPayload.tournament_team_ids ?? [];
    return ids.map((id) => ({
      id,
      label: nameOf(id).name,
    }));
  }, [isGroups, useAllGroups, groupIdx, effectiveStageIdx, listGroupTeamIds, nameOf, miniPayload.tournament_team_ids]);

  function ensureRowExists(stageIdxArg: number, round: number, bracket_pos: number) {
    updateMatches(stageIdxArg, (stageRows) => {
      if (
        stageRows.some(
          (r) =>
            r.stageIdx === stageIdxArg && r.round === round && r.bracket_pos === bracket_pos
        )
      )
        return stageRows;
      return [
        ...stageRows,
        {
          stageIdx: stageIdxArg,
          groupIdx: null,
          matchday: null,
          round,
          is_ko: true,
          bracket_pos,
          team_a_id: null,
          team_b_id: null,
          match_date: null,
          home_source_round: null,
          home_source_bracket_pos: null,
          away_source_round: null,
          away_source_bracket_pos: null,
        },
      ];
    });
  }

  type Patch = Partial<
    Pick<DraftMatch, "matchday" | "round" | "bracket_pos" | "team_a_id" | "team_b_id" | "match_date">
  >;
  const applyPatch = (target: DraftMatch, patch: Patch) => {
    const beforeLegacy = legacyRowSignature(target);

    if (isKO) {
      const currR = target.round ?? 1,
        currP = target.bracket_pos ?? 1;
      const newR = patch.round ?? currR,
        newP = patch.bracket_pos ?? currP;

      if (newR !== currR || newP !== currP) {
        ensureRowExists(effectiveStageIdx, newR, newP);
        const afterLegacyTmp = legacyRowSignature({
          ...target,
          round: newR,
          bracket_pos: newP,
        });
        const dbId = (target as any).db_id as number | null | undefined;
        if (dbId != null) migrateOverlayByDbIdToKey(dbId, afterLegacyTmp);
        else migrateOverlayKey(beforeLegacy, afterLegacyTmp);

        setKORoundPos(
          effectiveStageIdx,
          { round: currR, bracket_pos: currP },
          { round: newR, bracket_pos: newP }
        );
        reindexKOPointers(effectiveStageIdx);

        const { round: _r, bracket_pos: _p, ...rest } = patch;
        if (Object.keys(rest).length > 0) {
          updateMatches(effectiveStageIdx, (stageRows) => {
            const next = stageRows.slice();
            const i = next.findIndex(
              (r) =>
                r.stageIdx === effectiveStageIdx &&
                r.round === newR &&
                r.bracket_pos === newP
            );
            if (i >= 0) {
              const merged = { ...next[i], ...rest };
              next[i] = merged;
              const afterLegacy = legacyRowSignature(merged);
              if (afterLegacy !== afterLegacyTmp) {
                const mDbId = (merged as any).db_id;
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

    updateMatches(effectiveStageIdx, (stageRows) => {
      // Get team count for integrity check
      const effectiveGroup = isGroups && groupIdx != null && groupIdx >= 0 ? groupIdx : 0;
      const teamsInGroup =
        isGroups && !useAllGroups
          ? listGroupTeamIds(effectiveStageIdx, effectiveGroup).length
          : miniPayload.tournament_team_ids?.length ?? 0;

      const fixedRows = fixRoundRobinIntegrity(target, patch, stageRows, teamsInGroup);
      const next = fixedRows.slice();

      const dbId = (target as any).db_id as number | null | undefined;
      const beforeStruct = rowSignature(target);

      let idx = -1;
      if (dbId != null) idx = next.findIndex((r) => (r as any).db_id === dbId);
      if (idx < 0) idx = next.findIndex((r) => rowSignature(r) === beforeStruct);
      if (idx < 0) idx = next.findIndex((r) => legacyRowSignature(r) === beforeLegacy);

      const base = idx >= 0 ? next[idx] : target;
      const merged: DraftMatch = {
        ...base,
        ...patch,
        matchday: base.matchday ?? null,
      };

      const afterLegacy = legacyRowSignature(merged);
      if (afterLegacy !== beforeLegacy) {
        const mDbId = (merged as any).db_id;
        if (mDbId != null) migrateOverlayByDbIdToKey(mDbId, afterLegacy);
        else migrateOverlayKey(beforeLegacy, afterLegacy);
      }

      ensureOverlayForRow(merged);

      if (idx >= 0) {
        next[idx] = merged;
      } else {
        const afterStruct = rowSignature(merged);
        const j = next.findIndex((r) => rowSignature(r) === afterStruct);
        if (j >= 0) next[j] = merged;
        else next.push(merged);
      }
      return next;
    });
  };

  const addRow = () => {
    if (isKO) {
      const stageRows = draftMatches.filter((r) => r.stageIdx === effectiveStageIdx);
      const round = 1;
      const used = stageRows
        .filter((r) => r.round === round && r.bracket_pos != null)
        .map((r) => r.bracket_pos as number);
      const nextPos = used.length ? Math.max(...used) + 1 : 1;
      ensureRowExists(effectiveStageIdx, round, nextPos);
      reindexKOPointers(effectiveStageIdx);
    } else {
      const effectiveGroup = isGroups && !useAllGroups ? (groupIdx ?? 0) : null;
      const teamIds =
        effectiveGroup !== null
          ? listGroupTeamIds(effectiveStageIdx, effectiveGroup)
          : miniPayload.tournament_team_ids ?? [];
      const teamCount = teamIds.length;
      const matchesPerDay = Math.floor(teamCount / 2);

      let stageRows =
        effectiveGroup !== null
          ? allRowsForStage.filter((r) => r.groupIdx === effectiveGroup)
          : allRowsForStage;

      const matchdayCounts = stageRows.reduce((acc: Record<number, number>, r) => {
        const md = r.matchday ?? 0;
        acc[md] = (acc[md] || 0) + 1;
        return acc;
      }, {});
      const sortedMds = Object.keys(matchdayCounts)
        .map(Number)
        .sort((a, b) => a - b);
      const lastMd = sortedMds[sortedMds.length - 1] ?? 0;
      const targetMd =
        sortedMds.length === 0
          ? 1
          : matchdayCounts[lastMd] < matchesPerDay
          ? lastMd
          : lastMd + 1;

      updateMatches(effectiveStageIdx, (rows) => [
        ...rows,
        {
          stageIdx: effectiveStageIdx,
          groupIdx: effectiveGroup,
          matchday: targetMd,
          round: null,
          bracket_pos: null,
          team_a_id: null,
          team_b_id: null,
          match_date: null,
          is_ko: false,
        },
      ]);
    }
  };

  const removeRow = (m: DraftMatch) => {
    // ✅ FIXED: Ensure db_id is in overlay before removal
    const dbId = (m as any).db_id;
    if (dbId != null) {
      const key = legacyRowSignature(m);
      const overlay = useTournamentStore.getState().dbOverlayBySig as Record<string, any>;
      const curr = overlay[key];
      if (!curr || curr.db_id == null) {
        useTournamentStore.setState({
          dbOverlayBySig: {
            ...overlay,
            [key]: { ...(curr ?? {}), db_id: dbId },
          },
        });
      }
    }

    console.debug("[planner.delete]", { db_id: dbId ?? null, key: legacyRowSignature(m) });
    removeMatch(m);
    if (isKO) reindexKOPointers(effectiveStageIdx);
  };

  const regenerateStage = () => {
    const fresh = generateDraftMatches({
      payload: miniPayload,
      teams,
    });
    const freshHere = fresh.filter((m) => m.stageIdx === effectiveStageIdx);
    const key = (m: DraftMatch) => {
      if (m.round != null && m.bracket_pos != null) return `KO|R${m.round}|B${m.bracket_pos}`;
      return `RR|G${m.groupIdx ?? -1}|MD${m.matchday ?? 0}|${rrPairKey(
        m.team_a_id,
        m.team_b_id
      )}`;
    };
    const oldByKey = new Map(allRowsForStage.map((m) => [key(m), m]));
    const merged = freshHere
      .map((f) => {
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
      })
      .sort((a, b) => (a.matchday ?? 0) - (b.matchday ?? 0));
    updateMatches(effectiveStageIdx, () => merged);
  };

  const debugLine = `stageIdx=${effectiveStageIdx} | kind=${kindFromStore} | rows=${allRowsForStage.length} | visible=${visible.length} | filtered=${filteredVisible.length}`;

  const sortedFilteredVisible = useMemo(() => {
    return [...filteredVisible].sort((a, b) => (a.matchday ?? 0) - (b.matchday ?? 0));
  }, [filteredVisible]);

  const matchdayGroups = useMemo(() => {
    if (isKO) return {};
    return sortedFilteredVisible.reduce((acc, m) => {
      const md = m.matchday ?? 0;
      if (!acc[md]) acc[md] = [];
      acc[md].push(m);
      return acc;
    }, {} as Record<number, DraftMatch[]>);
  }, [isKO, sortedFilteredVisible]);

  return (
    <section className="rounded-lg border border-white/10 bg-slate-950/50 p-3 space-y-3">
      <div className="text-[11px] text-white/40">{debugLine}</div>

      <header className="flex flex-wrap items-center gap-2">
        <div className="text-white/80 text-sm">
          <span className="font-medium text-white/90">Fixtures (Stage #{effectiveStageIdx + 1})</span>{" "}
          <span className="text-white/60">• {kindFromStore}</span>
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
                <span className="ml-2 text-amber-300/80 text-xs align-middle">
                  groups not mapped – showing all matches
                </span>
              )}
            </>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-white/70 text-xs">Search match:</span>
          <input
            type="text"
            className="px-2 py-1.5 rounded border border-white/15 bg-slate-950 text-white text-xs w-32"
            placeholder="Team A"
            value={teamQuery1}
            onChange={(e) => setTeamQuery1(e.target.value)}
          />
          <span className="text-white/50 text-xs font-medium">vs</span>
          <input
            type="text"
            className="px-2 py-1.5 rounded border border-white/15 bg-slate-950 text-white text-xs w-32"
            placeholder="Team B"
            value={teamQuery2}
            onChange={(e) => setTeamQuery2(e.target.value)}
          />
          <button
            className="px-2 py-1.5 rounded border border-cyan-400/30 text-cyan-200 hover:bg-cyan-500/10 text-xs"
            onClick={regenerateStage}
            title="Rebuild this stage's fixtures (keeps scores/status where possible)"
          >
            Regenerate stage
          </button>
          <button
            className="px-2 py-1.5 rounded border border-white/15 text-white hover:bg-white/10 text-xs"
            onClick={addRow}
          >
            + Add match
          </button>
        </div>
      </header>

      {filteredVisible.length === 0 ? (
        <p className="text-white/70 text-sm">
          No matches for this selection.
          {visible.length > 0 && (teamQuery1 || teamQuery2) && (
            <span className="ml-2 text-white/50">(Try clearing the search.)</span>
          )}
          {allRowsForStage.length > 0 && isGroups && !teamQuery1 && !teamQuery2 && (
            <span className="ml-2 text-white/50">
              (There are {allRowsForStage.length} matches; try "All groups".)
            </span>
          )}
        </p>
      ) : (
        <div className="overflow-auto rounded border border-white/10">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-900/70 text-white">
              <tr>
                {isKO && (
                  <>
                    <th className="px-2 py-1 text-left">Round</th>
                    <th className="px-2 py-1 text-left">Bracket pos</th>
                  </>
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
              {isKO ? (
                filteredVisible.map((m, i) => {
                  const key = reactKey(m, i);
                  const isEditing =
                    editingMatch && rowSignature(editingMatch) === rowSignature(m);
                  return (
                    <>
                      <tr key={key} className="odd:bg-zinc-950/60 even:bg-zinc-900/40 h-24">
                        <td className="px-4 py-4">
                          <input
                            type="number"
                            className="w-20 bg-slate-950 border border-white/15 rounded px-2 py-1 text-white"
                            value={m.round ?? 1}
                            onChange={(e) =>
                              applyPatch(m, {
                                round: Number(e.target.value) || 1,
                                matchday: null,
                              })
                            }
                          />
                        </td>
                        <td className="px-4 py-4">
                          <input
                            type="number"
                            className="w-24 bg-slate-950 border border-white/15 rounded px-2 py-1 text-white"
                            value={m.bracket_pos ?? 1}
                            onChange={(e) =>
                              applyPatch(m, {
                                bracket_pos: Number(e.target.value) || 1,
                              })
                            }
                          />
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            {nameOf(m.team_a_id ?? null).logo ? (
                              <img
                                src={nameOf(m.team_a_id ?? null).logo!}
                                alt="Team A"
                                className="w-12 h-12 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-gray-600 flex items-center justify-center text-white text-xs">
                                No Logo
                              </div>
                            )}
                            <select
                              className="min-w-48 bg-slate-950 border border-white/15 rounded px-2 py-1 text-white"
                              value={m.team_a_id ?? ""}
                              onChange={(e) =>
                                applyPatch(m, {
                                  team_a_id: e.target.value ? Number(e.target.value) : null,
                                })
                              }
                            >
                              <option value="">— Select Team A —</option>
                              {teamOptions.map((opt) => (
                                <option key={opt.id} value={opt.id}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            {nameOf(m.team_b_id ?? null).logo ? (
                              <img
                                src={nameOf(m.team_b_id ?? null).logo!}
                                alt="Team B"
                                className="w-12 h-12 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-gray-600 flex items-center justify-center text-white text-xs">
                                No Logo
                              </div>
                            )}
                            <select
                              className="min-w-48 bg-slate-950 border border-white/15 rounded px-2 py-1 text-white"
                              value={m.team_b_id ?? ""}
                              onChange={(e) =>
                                applyPatch(m, {
                                  team_b_id: e.target.value ? Number(e.target.value) : null,
                                })
                              }
                            >
                              <option value="">— Select Team B —</option>
                              {teamOptions.map((opt) => (
                                <option key={opt.id} value={opt.id}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          {(() => {
                            const a = ((m as any).team_a_score ?? null) as number | null;
                            const b = ((m as any).team_b_score ?? null) as number | null;
                            return a != null || b != null ? (
                              `${a ?? 0} – ${b ?? 0}`
                            ) : (
                              <span className="text-white/50">—</span>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={[
                              "inline-flex items-center rounded px-2 py-0.5 text-xs",
                              ((m as any).status ?? "scheduled") === "finished"
                                ? "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/30"
                                : "bg-zinc-500/10 text-zinc-300 ring-1 ring-white/10",
                            ].join(" ")}
                          >
                            {((m as any).status ?? "scheduled")}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <input
                            type="datetime-local"
                            className="bg-slate-950 text-white border border-white/15 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white transition-all duration-300 ease-in-out hover:bg-gray-800"
                            value={isoToLocalInput(m.match_date as string | null)}
                            onChange={(e) =>
                              applyPatch(m, {
                                match_date: localInputToISO(e.target.value),
                              })
                            }
                          />
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              className={`px-2 py-1 rounded border text-xs ${
                                isEditing
                                  ? 'border-blue-400/50 bg-blue-500/20 text-blue-200'
                                  : 'border-blue-400/30 text-blue-200 hover:bg-blue-500/10'
                              }`}
                              onClick={() => setEditingMatch(isEditing ? null : m)}
                              title="Edit match details and player stats"
                            >
                              {isEditing ? 'Close' : 'Edit'}
                            </button>
                            <button
                              className="px-2 py-1 rounded border border-white/15 hover:bg-white/10 text-xs"
                              onClick={() =>
                                applyPatch(m, {
                                  team_a_id: m.team_b_id ?? null,
                                  team_b_id: m.team_a_id ?? null,
                                })
                              }
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
                      {isEditing && (
                        <tr key={`${key}-expanded`}>
                          <td colSpan={8} className="p-0">
                            <div className="border-t-2 border-blue-400/30">
                              <MatchControlPanel
                                match={m}
                                teams={teams}
                                onClose={() => setEditingMatch(null)}
                              />
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })
              ) : (
                Object.entries(matchdayGroups).map(([mdStr, ms]) => {
                  const md = Number(mdStr);
                  return (
                    <>
                      <tr className="bg-zinc-800/50" key={`md-${md}`}>
                        <td colSpan={6} className="px-4 py-2 font-bold underline text-white text-center">
                          Matchday&nbsp;
                          <input
                            type="number"
                            className="w-16 bg-transparent border-b border-white/50 text-white text-center font-bold focus:outline-none focus:border-white"
                            value={md}
                            min={1}
                            onChange={(e) => {
                              const newMd = Number(e.target.value) || md;
                              ms.forEach((m) => applyPatch(m, { matchday: newMd }));
                            }}
                          />
                        </td>
                      </tr>
                      {ms.map((m, i) => {
                        const key = reactKey(m, i);
                        const isEditing =
                          editingMatch && rowSignature(editingMatch) === rowSignature(m);
                        return (
                          <>
                            <tr key={key} className="odd:bg-zinc-950/60 even:bg-zinc-900/40 h-24">
                              <td className="px-4 py-4">
                                <div className="flex items-center gap-2">
                                  {nameOf(m.team_a_id ?? null).logo ? (
                                    <img
                                      src={nameOf(m.team_a_id ?? null).logo!}
                                      alt="Team A"
                                      className="w-12 h-12 rounded-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-12 h-12 rounded-full bg-gray-600 flex items-center justify-center text-white text-xs">
                                      No Logo
                                    </div>
                                  )}
                                  <select
                                    className="min-w-48 bg-slate-950 border border-white/15 rounded px-2 py-1 text-white"
                                    value={m.team_a_id ?? ""}
                                    onChange={(e) =>
                                      applyPatch(m, {
                                        team_a_id: e.target.value ? Number(e.target.value) : null,
                                      })
                                    }
                                  >
                                    <option value="">— Select Team A —</option>
                                    {teamOptions.map((opt) => (
                                      <option key={opt.id} value={opt.id}>
                                        {opt.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                <div className="flex items-center gap-2">
                                  {nameOf(m.team_b_id ?? null).logo ? (
                                    <img
                                      src={nameOf(m.team_b_id ?? null).logo!}
                                      alt="Team B"
                                      className="w-12 h-12 rounded-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-12 h-12 rounded-full bg-gray-600 flex items-center justify-center text-white text-xs">
                                      No Logo
                                    </div>
                                  )}
                                  <select
                                    className="min-w-48 bg-slate-950 border border-white/15 rounded px-2 py-1 text-white"
                                    value={m.team_b_id ?? ""}
                                    onChange={(e) =>
                                      applyPatch(m, {
                                        team_b_id: e.target.value ? Number(e.target.value) : null,
                                      })
                                    }
                                  >
                                    <option value="">— Select Team B —</option>
                                    {teamOptions.map((opt) => (
                                      <option key={opt.id} value={opt.id}>
                                        {opt.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                {(() => {
                                  const a = ((m as any).team_a_score ?? null) as number | null;
                                  const b = ((m as any).team_b_score ?? null) as number | null;
                                  return a != null || b != null ? (
                                    `${a ?? 0} – ${b ?? 0}`
                                  ) : (
                                    <span className="text-white/50">—</span>
                                  );
                                })()}
                              </td>
                              <td className="px-4 py-4">
                                <span
                                  className={[
                                    "inline-flex items-center rounded px-2 py-0.5 text-xs",
                                    ((m as any).status ?? "scheduled") === "finished"
                                      ? "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/30"
                                      : "bg-zinc-500/10 text-zinc-300 ring-1 ring-white/10",
                                  ].join(" ")}
                                >
                                  {((m as any).status ?? "scheduled")}
                                </span>
                              </td>
                              <td className="px-4 py-4">
                                <input
                                  type="datetime-local"
                                  className="bg-slate-950 text-white border border-white/15 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white transition-all duration-300 ease-in-out hover:bg-gray-800"
                                  value={isoToLocalInput(m.match_date as string | null)}
                                  onChange={(e) =>
                                    applyPatch(m, {
                                      match_date: localInputToISO(e.target.value),
                                    })
                                  }
                                />
                              </td>
                              <td className="px-4 py-4">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    className={`px-2 py-1 rounded border text-xs ${
                                      isEditing
                                        ? 'border-blue-400/50 bg-blue-500/20 text-blue-200'
                                        : 'border-blue-400/30 text-blue-200 hover:bg-blue-500/10'
                                    }`}
                                    onClick={() => setEditingMatch(isEditing ? null : m)}
                                    title="Edit match details and player stats"
                                  >
                                    {isEditing ? 'Close' : 'Edit'}
                                  </button>
                                  <button
                                    className="px-2 py-1 rounded border border-white/15 hover:bg-white/10 text-xs"
                                    onClick={() =>
                                      applyPatch(m, {
                                        team_a_id: m.team_b_id ?? null,
                                        team_b_id: m.team_a_id ?? null,
                                      })
                                    }
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
                            {isEditing && (
                              <tr key={`${key}-expanded`}>
                                <td colSpan={6} className="p-0">
                                  <div className="border-t-2 border-blue-400/30">
                                    <MatchControlPanel
                                      match={m}
                                      teams={teams}
                                      onClose={() => setEditingMatch(null)}
                                    />
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })}
                    </>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
      {/* Match Control Panel appears below the edited row */}
    </section>
  );
}