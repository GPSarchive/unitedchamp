"use client";

// Ports the non-visual logic of preview/InlineMatchPlanner.tsx (merged rows,
// group filter, applyPatch, add/remove/regenerate) over the same store actions.

import { useEffect, useMemo, useState } from "react";
import type { NewTournamentPayload } from "@/app/lib/types";
import type {
  TeamDraft,
  DraftMatch,
} from "@/app/dashboard/tournaments/TournamentCURD/TournamentWizard";
import {
  useTournamentStore,
  type TournamentState,
} from "@/app/dashboard/tournaments/TournamentCURD/submit/tournamentStore";
import { generateDraftMatches } from "@/app/dashboard/tournaments/TournamentCURD/util/Generators";

import { useEffectiveStageIdx } from "../../hooks/useEffectiveStageIdx";
import {
  rrPairKey,
  rowSignature,
  safeOverlay,
  ensureOverlayForRow,
  fixRoundRobinIntegrity,
} from "./helpers";

const selDraftMatches = (s: TournamentState) => s.draftMatches as DraftMatch[];
const selDbOverlayByUid = (s: TournamentState) =>
  s.dbOverlayByUid as Record<
    string,
    Partial<DraftMatch> & { db_id?: number | null; updated_at?: string | null }
  >;

export type MatchPatch = Partial<
  Pick<DraftMatch, "matchday" | "round" | "bracket_pos" | "team_a_id" | "team_b_id" | "match_date">
>;

export function useStageFixtures({
  payload,
  teams,
  index,
}: {
  payload: NewTournamentPayload;
  teams: TeamDraft[];
  index: number;
}) {
  const allStages = payload.stages;
  const effectiveStageIdx = useEffectiveStageIdx(allStages, index);

  const draftMatches = useTournamentStore(selDraftMatches);
  const dbOverlayByUid = useTournamentStore(selDbOverlayByUid);
  const stagesById = useTournamentStore((s) => s.entities?.stagesById ?? {});
  const stageIdByIndex = useTournamentStore((s) => s.ids?.stageIdByIndex ?? {});
  const groupIdByStage = useTournamentStore((s) => s.ids?.groupIdByStage ?? {});
  const groupsById = useTournamentStore((s) => s.entities?.groupsById ?? {});
  const updateMatches = useTournamentStore((s) => s.updateMatches);
  const listGroupTeamIds = useTournamentStore((s) => s.listGroupTeamIds);
  const getTeamName = useTournamentStore(
    (s) => s.getTeamName as (id: number | string | null) => string
  );
  const removeMatch = useTournamentStore((s) => s.removeMatch);
  const reindexKOPointers = useTournamentStore((s) => s.reindexKOPointers);
  const setKORoundPos = useTournamentStore((s) => s.setKORoundPos);

  // Stage-filtered teams honoring cfg.stage_team_ids (same as StageCard)
  const stage = allStages[index] as any;
  const cfg = (stage?.config ?? {}) as any;
  const stageFilteredTeams = useMemo(() => {
    const stageTeamIds: number[] = Array.isArray(cfg?.stage_team_ids) ? cfg.stage_team_ids : [];
    if (stageTeamIds.length === 0) return teams;
    const set = new Set(stageTeamIds);
    return teams.filter((t) => set.has(t.id));
  }, [cfg?.stage_team_ids, teams]);

  // miniPayload as built in StageCard (~lines 300-314)
  const miniPayload: NewTournamentPayload = useMemo(
    () => ({
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
    }),
    [allStages, stageFilteredTeams]
  );

  const nameOf = useMemo(() => {
    const local = new Map<number, { name: string; logo: string | null }>();
    (stageFilteredTeams ?? []).forEach((t) => {
      if (t && typeof t.id === "number")
        local.set(t.id, {
          name: t.name ?? `Team #${t.id}`,
          logo: t.logo ?? null,
        });
    });
    return (id: number | string | null) => {
      if (id == null) return { name: "—", logo: null as string | null };
      if (typeof id === "number") {
        const team = local.get(id);
        if (team) return team;
      }
      return { name: getTeamName(id), logo: null as string | null };
    };
  }, [stageFilteredTeams, getTeamName]);

  const kindFromStore = useMemo(() => {
    const sid = (stageIdByIndex as Record<number, number | undefined>)?.[effectiveStageIdx];
    return sid ? ((stagesById as any)[sid]?.kind ?? "league") : "league";
  }, [stageIdByIndex, stagesById, effectiveStageIdx]);

  // Merged rows for this stage (draft + uid-keyed overlay, db_id fallback)
  const allRowsForStage = useMemo(() => {
    const rows = draftMatches.filter((r) => r.stageIdx === effectiveStageIdx);
    return rows.map((r) => {
      const ovRaw =
        (r.uid ? dbOverlayByUid[r.uid] : undefined) ||
        ((r as any).db_id != null
          ? Object.values(dbOverlayByUid).find((v) => v?.db_id === (r as any).db_id)
          : undefined);
      const ov = safeOverlay(ovRaw);
      return ov ? ({ ...r, ...ov } as DraftMatch) : r;
    });
  }, [draftMatches, dbOverlayByUid, effectiveStageIdx]);

  const hasAnyGrouped = useMemo(
    () => allRowsForStage.some((r) => r.groupIdx != null),
    [allRowsForStage]
  );

  const isGroups = kindFromStore === "groups" || hasAnyGrouped;
  const isKO = kindFromStore === "knockout";

  // Groups for the filter
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

  const teamOptions = useMemo(() => {
    const effectiveGroupForOptions = groupIdx != null && groupIdx >= 0 ? groupIdx : 0;
    const ids =
      isGroups && !useAllGroups
        ? listGroupTeamIds(effectiveStageIdx, effectiveGroupForOptions)
        : miniPayload.tournament_team_ids ?? [];
    return ids.map((id) => ({ id, label: nameOf(id).name }));
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

  const applyPatch = (target: DraftMatch, patch: MatchPatch) => {
    if (isKO) {
      const currR = target.round ?? 1,
        currP = target.bracket_pos ?? 1;
      const newR = patch.round ?? currR,
        newP = patch.bracket_pos ?? currP;

      if (newR !== currR || newP !== currP) {
        ensureRowExists(effectiveStageIdx, newR, newP);
        // Identity is the uid — moving a tie to another slot needs no overlay
        // key migration anymore.
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
              ensureOverlayForRow(merged);
            }
            return next;
          });
        }
        return;
      }
    }

    updateMatches(effectiveStageIdx, (stageRows) => {
      const effectiveGroup = isGroups && groupIdx != null && groupIdx >= 0 ? groupIdx : 0;
      const teamsInGroup =
        isGroups && !useAllGroups
          ? listGroupTeamIds(effectiveStageIdx, effectiveGroup).length
          : miniPayload.tournament_team_ids?.length ?? 0;

      const fixedRows = fixRoundRobinIntegrity(target, patch, stageRows, teamsInGroup);
      const next = fixedRows.slice();

      // Locate the edited row: uid is authoritative; db_id and the structural
      // signature remain as safety nets for rows from stale closures.
      const dbId = (target as any).db_id as number | null | undefined;
      let idx = target.uid ? next.findIndex((r) => r.uid === target.uid) : -1;
      if (idx < 0 && dbId != null) idx = next.findIndex((r) => (r as any).db_id === dbId);
      if (idx < 0) idx = next.findIndex((r) => rowSignature(r) === rowSignature(target));

      const base = idx >= 0 ? next[idx] : target;
      // Deviation from InlineMatchPlanner: it always pins matchday to the base row
      // (its table has no matchday editor). The mobile sheet does allow moving a
      // match to another matchday, so honor patch.matchday when provided.
      const merged: DraftMatch = {
        ...base,
        ...patch,
        matchday: patch.matchday !== undefined ? patch.matchday : base.matchday ?? null,
      };

      ensureOverlayForRow(merged);

      if (idx >= 0) next[idx] = merged;
      else next.push(merged);
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

      const stageRows =
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

  // KO: add a match to a specific round at the next free bracket position
  const addKoRowInRound = (round: number) => {
    const stageRows = draftMatches.filter((r) => r.stageIdx === effectiveStageIdx);
    const used = stageRows
      .filter((r) => r.round === round && r.bracket_pos != null)
      .map((r) => r.bracket_pos as number);
    const nextPos = used.length ? Math.max(...used) + 1 : 1;
    ensureRowExists(effectiveStageIdx, round, nextPos);
    reindexKOPointers(effectiveStageIdx);
  };

  const removeRow = (m: DraftMatch) => {
    // removeMatch removes by uid and reads db_id from the overlay or the row
    // itself — no overlay pre-stuffing needed. m is a merged row, so it carries
    // both uid and db_id.
    removeMatch(m);
    if (isKO) reindexKOPointers(effectiveStageIdx);
  };

  const regenerateStage = () => {
    const fresh = generateDraftMatches({
      payload: miniPayload,
      teams: stageFilteredTeams,
    });
    const freshHere = fresh.filter((m) => m.stageIdx === effectiveStageIdx);
    const key = (m: DraftMatch) => {
      // Include leg so the two legs of a two-legged tie aren't collapsed to one key.
      if (m.round != null && m.bracket_pos != null)
        return `KO|R${m.round}|B${m.bracket_pos}|L${(m as any).leg ?? 0}`;
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
              // Carry the old row's uid so the regenerated row KEEPS its identity
              // (overlay entry, dirty state, db linkage) instead of being treated
              // as a brand-new match.
              uid: old.uid ?? undefined,
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
    // Re-wire KO source pointers so the bracket reflects the regenerated tree.
    if (isKO) reindexKOPointers(effectiveStageIdx);
  };

  // Non-KO: rows grouped by matchday (sorted)
  const matchdayGroups = useMemo(() => {
    if (isKO) return [] as Array<{ matchday: number; rows: DraftMatch[] }>;
    const sorted = [...visible].sort((a, b) => (a.matchday ?? 0) - (b.matchday ?? 0));
    const byMd = new Map<number, DraftMatch[]>();
    sorted.forEach((m) => {
      const md = m.matchday ?? 0;
      if (!byMd.has(md)) byMd.set(md, []);
      byMd.get(md)!.push(m);
    });
    return Array.from(byMd.entries()).map(([matchday, rows]) => ({ matchday, rows }));
  }, [isKO, visible]);

  // KO: rows grouped by round (sorted by round, then bracket_pos)
  const koRounds = useMemo(() => {
    if (!isKO) return [] as Array<{ round: number; rows: DraftMatch[] }>;
    const sorted = [...visible].sort(
      (a, b) =>
        (a.round ?? 0) - (b.round ?? 0) || (a.bracket_pos ?? 0) - (b.bracket_pos ?? 0)
    );
    const byRound = new Map<number, DraftMatch[]>();
    sorted.forEach((m) => {
      const r = m.round ?? 0;
      if (!byRound.has(r)) byRound.set(r, []);
      byRound.get(r)!.push(m);
    });
    return Array.from(byRound.entries()).map(([round, rows]) => ({ round, rows }));
  }, [isKO, visible]);

  return {
    effectiveStageIdx,
    kindFromStore,
    isGroups,
    isKO,
    stageFilteredTeams,
    miniPayload,
    nameOf,
    allRowsForStage,
    visible,
    storeGroups,
    groupIdx,
    setGroupIdx,
    useAllGroups,
    teamOptions,
    matchdayGroups,
    koRounds,
    applyPatch,
    addRow,
    addKoRowInRound,
    removeRow,
    regenerateStage,
  };
}
