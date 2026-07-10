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
    // Include leg so the two legs of a two-legged tie (same round/bracket_pos)
    // don't collapse to one overlay key. Single-leg rows are L0.
    return `KO|S${m.stageIdx ?? -1}|R${m.round}|B${m.bracket_pos}|L${m.leg ?? 0}`;
  }
  const g = m.groupIdx ?? -1;
  const md = m.matchday ?? 0;
  const pair = rrPairKey(m.team_a_id, m.team_b_id);
  return `RR|S${m.stageIdx ?? -1}|G${g}|MD${md}|${pair}`;
}

function reactKey(m: DraftMatch, i: number) {
  // uid is the stable per-row identity; the fallbacks only cover rows that
  // haven't passed through the store yet.
  if (m.uid) return m.uid;
  const id = (m as any)?.db_id as number | null | undefined;
  const sig = rowSignature(m);
  return id != null ? `M#${id}|${sig}` : `${sig}|I${i}`;
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
  s.dbOverlayByUid as Record<
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
const selSetKOLegCount = (s: TournamentState) =>
  s.setKOLegCount as (stageIdx: number, where: { round: number; bracket_pos: number }, legs: 1 | 2) => void;
const selSetKORoundPos = (s: TournamentState) =>
  s.setKORoundPos as (
    stageIdx: number,
    from: { round: number; bracket_pos: number },
    to: { round: number; bracket_pos: number }
  ) => void;

/* ---------------- overlay sync helpers ---------------- */
// Overlays are keyed by the row's uid, which never changes when a row is
// edited — the old key-migration helpers (migrateOverlayKey /
// migrateOverlayByDbIdToKey) existed only for signature drift and are gone.

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

/** Push a merged row's DB bits (db_id/scores/status) into its uid-keyed overlay entry. */
function ensureOverlayForRow(row: DraftMatch) {
  if (!row.uid) return; // rows from the store always carry a uid
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
  const overlay = useTournamentStore.getState().dbOverlayByUid as Record<
    string,
    Partial<DraftMatch> & { db_id?: number | null; updated_at?: string | null }
  >;
  const curr = overlay[row.uid];
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
    dbOverlayByUid: { ...overlay, [row.uid]: nextVal },
  });
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
  const dbOverlayByUid = useTournamentStore(selDbOverlayBySig);
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
  const setKOLegCount = useTournamentStore(selSetKOLegCount);

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
  // When adding a match from the "All groups" view of a groups stage, we prompt
  // the admin to pick which group the new match belongs to (avoids orphaning).
  const [pendingAddGroup, setPendingAddGroup] = useState(false);
  // KO stages: adding a match always goes through a prompt (round / bracket
  // position / legs). Blindly appending to round 1 is how brackets end up with
  // duplicate "later round" matches that no progression can ever reach.
  const [pendingAddKO, setPendingAddKO] = useState(false);
  const [koAdd, setKoAdd] = useState<{ round: number; pos: number; legs: 1 | 2 }>({
    round: 1,
    pos: 1,
    legs: 1,
  });

  // Dismiss the group picker on Escape (proper dialog behaviour).
  useEffect(() => {
    if (!pendingAddGroup) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPendingAddGroup(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pendingAddGroup]);

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
    if (isKO) {
      const currR = target.round ?? 1,
        currP = target.bracket_pos ?? 1;
      const newR = patch.round ?? currR,
        newP = patch.bracket_pos ?? currP;

      if (newR !== currR || newP !== currP) {
        // NOTE: do NOT pre-create the destination row here. Creating an empty
        // placeholder at the target coords used to flip setKORoundPos from a
        // "move" into a "swap" with that fresh ghost row, leaving stray empty
        // round-1 rows behind and making round edits appear to never stick.
        // setKORoundPos moves the whole slot (both legs of a two-legged tie)
        // and swaps with the occupant slot only if one genuinely exists.
        // Identity is the uid — moving a tie needs no overlay key migration.
        const dbId = (target as any).db_id as number | null | undefined;
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
            // Target the edited row, not just "whatever sits at the new coords":
            // both legs of a two-legged tie share round/bracket_pos.
            let i = target.uid ? next.findIndex((r) => r.uid === target.uid) : -1;
            if (i < 0 && dbId != null) i = next.findIndex((r) => (r as any).db_id === dbId);
            if (i < 0)
              i = next.findIndex(
                (r) =>
                  r.stageIdx === effectiveStageIdx &&
                  r.round === newR &&
                  r.bracket_pos === newP &&
                  (r.leg ?? 0) === (target.leg ?? 0)
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
      // Get team count for integrity check
      const effectiveGroup = isGroups && groupIdx != null && groupIdx >= 0 ? groupIdx : 0;
      const teamsInGroup =
        isGroups && !useAllGroups
          ? listGroupTeamIds(effectiveStageIdx, effectiveGroup).length
          : miniPayload.tournament_team_ids?.length ?? 0;

      const fixedRows = fixRoundRobinIntegrity(target, patch, stageRows, teamsInGroup);
      const next = fixedRows.slice();

      // Locate the edited row: uid is authoritative; db_id and the structural
      // signature remain as safety nets for rows passed in from stale closures.
      const dbId = (target as any).db_id as number | null | undefined;
      let idx = target.uid ? next.findIndex((r) => r.uid === target.uid) : -1;
      if (idx < 0 && dbId != null) idx = next.findIndex((r) => (r as any).db_id === dbId);
      if (idx < 0) idx = next.findIndex((r) => rowSignature(r) === rowSignature(target));

      const base = idx >= 0 ? next[idx] : target;
      const merged: DraftMatch = {
        ...base,
        ...patch,
        matchday: base.matchday ?? null,
      };

      ensureOverlayForRow(merged);

      if (idx >= 0) next[idx] = merged;
      else next.push(merged);
      return next;
    });
  };

  // When adding a match in a groups stage, a concrete group MUST be chosen —
  // otherwise the row is created with groupIdx=null and gets silently orphaned
  // (never counts toward any group's standings). If the planner is on the
  // "All groups" view, prompt the admin to pick a group first instead of
  // creating an ambiguous, un-assignable match.
  const addRow = (forcedGroupIdx?: number) => {
    if (isKO) {
      // Ask what to create (round / bracket position / legs) before adding.
      const rounds = allRowsForStage.map((r) => r.round).filter((r): r is number => r != null);
      const defaultRound = rounds.length ? Math.max(...rounds) : 1;
      const defaultLegs: 1 | 2 = allRowsForStage.some((r) => r.leg != null) ? 2 : 1;
      setKoAdd({ round: defaultRound, pos: nextFreeKOPos(defaultRound), legs: defaultLegs });
      setPendingAddKO(true);
      return;
    }
    if (isGroups && storeGroups.length > 0) {
      const chosen =
        forcedGroupIdx != null
          ? forcedGroupIdx
          : useAllGroups
          ? null
          : groupIdx;
      if (chosen == null || chosen < 0) {
        // Ask which group this match belongs to before creating it.
        setPendingAddGroup(true);
        return;
      }
      addRowForGroup(chosen);
      return;
    }
    addRowForGroup(null);
  };

  /** Next unused bracket position in the given KO round of this stage. */
  const nextFreeKOPos = (round: number) => {
    const used = allRowsForStage
      .filter((r) => r.round === round && r.bracket_pos != null)
      .map((r) => r.bracket_pos as number);
    return used.length ? Math.max(...used) + 1 : 1;
  };

  const koSlotTaken = (round: number, pos: number) =>
    allRowsForStage.some((r) => r.round === round && r.bracket_pos === pos);

  /** Create a KO tie at the chosen coords (one row, or leg-1 + leg-2 siblings). */
  const addKORow = ({ round, pos, legs }: { round: number; pos: number; legs: 1 | 2 }) => {
    if (koSlotTaken(round, pos)) return;
    ensureRowExists(effectiveStageIdx, round, pos);
    if (legs === 2) setKOLegCount(effectiveStageIdx, { round, bracket_pos: pos }, 2);
    reindexKOPointers(effectiveStageIdx);
    setPendingAddKO(false);
  };

  const addRowForGroup = (forcedGroupIdx: number | null) => {
    if (isKO) {
      // KO creation goes through the add-match prompt (addKORow); nothing to do here.
      return;
    } else {
      // A groups stage always resolves to a concrete group here (the addRow guard
      // guarantees forcedGroupIdx is set for groups stages); league/KO stays null.
      const effectiveGroup = isGroups
        ? forcedGroupIdx ?? (useAllGroups ? null : groupIdx ?? 0)
        : null;
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
    // removeMatch removes by uid and reads db_id from the overlay or the row
    // itself — no overlay pre-stuffing needed. m is a merged row, so it
    // carries both uid and db_id.
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
      if (m.round != null && m.bracket_pos != null)
        // Include leg so the two legs of a two-legged tie aren't collapsed to one key.
        return `KO|R${m.round}|B${m.bracket_pos}|L${m.leg ?? 0}`;
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
              // Carry the old row's uid so the regenerated row KEEPS its
              // identity (overlay entry, dirty state, db linkage) instead of
              // being treated as a brand-new match.
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
    // Re-wire KO source pointers so the bracket canvas (which draws edges/layout
    // from home/away_source_round+bracket_pos) reflects the regenerated tree.
    if (isKO) reindexKOPointers(effectiveStageIdx);
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
            onClick={() => addRow()}
          >
            + Add match
          </button>
        </div>
      </header>

      {/* Group picker — bottom sheet on mobile, centered modal on desktop.
          Rendered at section level (not anchored to the button) so it never
          clips off-screen when the header controls wrap on narrow viewports. */}
      {pendingAddGroup && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Add match to which group"
        >
          {/* backdrop — tap outside to dismiss */}
          <button
            type="button"
            aria-label="Cancel"
            className="absolute inset-0 bg-black/60"
            onClick={() => setPendingAddGroup(false)}
          />
          <div
            className="relative w-full rounded-t-2xl border border-white/15 bg-slate-950 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl sm:mb-0 sm:w-80 sm:rounded-2xl sm:p-5"
          >
            <div className="mb-3 text-sm font-medium text-white/90">
              Add match to which group?
            </div>
            <div className="flex flex-col gap-2">
              {storeGroups.map((g) => (
                <button
                  key={g.idx}
                  className="min-h-[48px] w-full rounded-lg border border-white/15 px-4 text-left text-sm text-white hover:bg-white/10 active:bg-white/15"
                  onClick={() => {
                    setPendingAddGroup(false);
                    setGroupIdx(g.idx);
                    addRow(g.idx);
                  }}
                >
                  {g.name}
                </button>
              ))}
              <button
                className="mt-1 min-h-[44px] w-full rounded-lg px-4 text-sm text-white/60 hover:bg-white/5"
                onClick={() => setPendingAddGroup(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KO add-match prompt — same section-level bottom-sheet/modal pattern as
          the group picker. Adding a KO match must specify where it lives in the
          bracket (round / position / legs); blindly appending to round 1 is how
          brackets end up with duplicate "later round" matches no progression
          can reach. */}
      {pendingAddKO && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="New knockout match"
        >
          <button
            type="button"
            aria-label="Cancel"
            className="absolute inset-0 bg-black/60"
            onClick={() => setPendingAddKO(false)}
          />
          <div className="relative w-full rounded-t-2xl border border-white/15 bg-slate-950 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl sm:mb-0 sm:w-80 sm:rounded-2xl sm:p-5 space-y-3">
            <div className="text-sm font-medium text-white/90">New knockout match</div>
            <label className="flex min-h-[44px] items-center justify-between gap-2 text-sm text-white/80">
              Round
              <input
                type="number"
                min={1}
                className="w-24 bg-slate-950 border border-white/15 rounded px-2 py-1.5 text-white"
                value={koAdd.round}
                onChange={(e) => {
                  if (e.target.value === "") return;
                  const round = Math.max(1, Number(e.target.value) || 1);
                  setKoAdd((k) => ({ ...k, round, pos: nextFreeKOPos(round) }));
                }}
              />
            </label>
            <label className="flex min-h-[44px] items-center justify-between gap-2 text-sm text-white/80">
              Bracket pos
              <input
                type="number"
                min={1}
                className="w-24 bg-slate-950 border border-white/15 rounded px-2 py-1.5 text-white"
                value={koAdd.pos}
                onChange={(e) => {
                  if (e.target.value === "") return;
                  setKoAdd((k) => ({ ...k, pos: Math.max(1, Number(e.target.value) || 1) }));
                }}
              />
            </label>
            <label className="flex min-h-[44px] items-center justify-between gap-2 text-sm text-white/80">
              Legs
              <select
                className="w-32 bg-slate-950 border border-white/15 rounded px-2 py-1.5 text-white"
                value={koAdd.legs}
                onChange={(e) =>
                  setKoAdd((k) => ({ ...k, legs: Number(e.target.value) === 2 ? 2 : 1 }))
                }
              >
                <option value={1}>Single match</option>
                <option value={2}>Two legs</option>
              </select>
            </label>
            {koSlotTaken(koAdd.round, koAdd.pos) && (
              <div className="text-xs text-amber-300/90">
                Round {koAdd.round}, position {koAdd.pos} already has a match — pick a free
                position.
              </div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button
                className="min-h-[44px] rounded px-3 text-sm text-white/60 hover:bg-white/5"
                onClick={() => setPendingAddKO(false)}
              >
                Cancel
              </button>
              <button
                className="min-h-[44px] rounded border border-emerald-400/40 px-3 text-sm text-emerald-200 hover:bg-emerald-500/10 disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={koSlotTaken(koAdd.round, koAdd.pos)}
                onClick={() => addKORow(koAdd)}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

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
                    editingMatch && editingMatch.uid != null && editingMatch.uid === m.uid;
                  return (
                    <>
                      <tr key={key} className="odd:bg-zinc-950/60 even:bg-zinc-900/40 h-24">
                        <td className="px-4 py-4">
                          <input
                            type="number"
                            min={1}
                            className="w-20 bg-slate-950 border border-white/15 rounded px-2 py-1 text-white"
                            value={m.round ?? 1}
                            onChange={(e) => {
                              // Ignore the transient empty state while typing —
                              // coercing "" back to 1 used to fire a bogus move
                              // to round 1 on every cleared keystroke.
                              if (e.target.value === "") return;
                              applyPatch(m, {
                                round: Math.max(1, Number(e.target.value) || 1),
                                matchday: null,
                              });
                            }}
                          />
                        </td>
                        <td className="px-4 py-4">
                          <input
                            type="number"
                            min={1}
                            className="w-24 bg-slate-950 border border-white/15 rounded px-2 py-1 text-white"
                            value={m.bracket_pos ?? 1}
                            onChange={(e) => {
                              if (e.target.value === "") return;
                              applyPatch(m, {
                                bracket_pos: Math.max(1, Number(e.target.value) || 1),
                              });
                            }}
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
                          editingMatch && editingMatch.uid != null && editingMatch.uid === m.uid;
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