"use client";

// Verbatim ports of the non-visual helpers in
// preview/InlineMatchPlanner.tsx — overlay keying must stay byte-identical
// with the live planner or saves diverge. Keep in sync with that file.

import type { DraftMatch } from "@/app/dashboard/tournaments/TournamentCURD/TournamentWizard";
import { useTournamentStore } from "@/app/dashboard/tournaments/TournamentCURD/submit/tournamentStore";

export function rrPairKey(a?: number | null, b?: number | null) {
  const x = a ?? 0,
    y = b ?? 0;
  return x < y ? `${x}-${y}` : `${y}-${x}`;
}

export function rowSignature(m: DraftMatch) {
  if (m.round != null && m.bracket_pos != null) {
    // Include leg so the two legs of a two-legged tie (same round/bracket_pos)
    // don't collapse to one overlay key. Single-leg rows are L0.
    return `KO|S${m.stageIdx ?? -1}|R${m.round}|B${m.bracket_pos}|L${(m as any).leg ?? 0}`;
  }
  const g = m.groupIdx ?? -1;
  const md = m.matchday ?? 0;
  const pair = rrPairKey(m.team_a_id, m.team_b_id);
  return `RR|S${m.stageIdx ?? -1}|G${g}|MD${md}|${pair}`;
}

export function reactKey(m: DraftMatch, i: number) {
  const id = (m as any)?.db_id as number | null | undefined;
  const sig = rowSignature(m);
  return id != null ? `M#${id}|${sig}` : `${sig}|I${i}`;
}

export function legacyRowSignature(m: DraftMatch) {
  const parts = [
    m.stageIdx ?? "",
    m.groupIdx ?? "",
    m.matchday ?? "",
    m.round ?? "",
    m.bracket_pos ?? "",
    (m as any).leg ?? "", // keep the two legs of a two-legged tie distinct
    m.team_a_id ?? "",
    m.team_b_id ?? "",
    m.match_date ?? "",
  ];
  return parts.join("|");
}

export function isoToLocalInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export function localInputToISO(localStr?: string) {
  if (!localStr) return null;
  const m = localStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, yStr, moStr, dStr, hhStr, mmStr] = m;
  return new Date(Date.UTC(+yStr, +moStr - 1, +dStr, +hhStr, +mmStr, 0, 0)).toISOString();
}

type Overlay = Partial<DraftMatch> & { db_id?: number | null; updated_at?: string | null };

export function migrateOverlayKey(oldKey: string, newKey: string) {
  if (!oldKey || !newKey || oldKey === newKey) return;
  const overlay = useTournamentStore.getState().dbOverlayBySig as Record<string, Overlay>;
  const ov = overlay[oldKey];
  if (!ov) return;
  const next = { ...overlay };
  next[newKey] = { ...ov };
  delete next[oldKey];
  useTournamentStore.setState({ dbOverlayBySig: next });
}

export function safeOverlay(ov?: Overlay) {
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

export function ensureOverlayForRow(row: DraftMatch) {
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
  const overlay = useTournamentStore.getState().dbOverlayBySig as Record<string, Overlay>;
  const curr = overlay[key];
  const nextVal = {
    db_id: db_id ?? curr?.db_id ?? null,
    updated_at: updated_at ?? curr?.updated_at ?? null,
    status: status ?? curr?.status ?? "scheduled",
    team_a_score: team_a_score ?? curr?.team_a_score ?? null,
    team_b_score: team_b_score ?? curr?.team_b_score ?? null,
    winner_team_id: winner_team_id ?? curr?.winner_team_id ?? null,
    home_source_round: row.home_source_round ?? (curr as any)?.home_source_round ?? null,
    home_source_bracket_pos:
      row.home_source_bracket_pos ?? (curr as any)?.home_source_bracket_pos ?? null,
    away_source_round: row.away_source_round ?? (curr as any)?.away_source_round ?? null,
    away_source_bracket_pos:
      row.away_source_bracket_pos ?? (curr as any)?.away_source_bracket_pos ?? null,
  } as const;
  useTournamentStore.setState({
    dbOverlayBySig: { ...overlay, [key]: nextVal },
  });
}

export function migrateOverlayByDbIdToKey(dbId: number, newKey: string) {
  const overlay = useTournamentStore.getState().dbOverlayBySig as Record<string, Overlay>;
  const found = Object.entries(overlay).find(([, v]) => v?.db_id === dbId);
  if (!found) return;
  migrateOverlayKey(found[0], newKey);
}

export function getRepeatFromMatchday(matchday: number, teamsCount: number): number {
  if (!matchday || !teamsCount || teamsCount < 2) return 1;
  const matchdaysPerCycle = teamsCount % 2 === 0 ? teamsCount - 1 : teamsCount;
  return Math.ceil(matchday / matchdaysPerCycle);
}

export function fixRoundRobinIntegrity(
  target: DraftMatch,
  patch: Partial<Pick<DraftMatch, "team_a_id" | "team_b_id">>,
  allStageMatches: DraftMatch[],
  teamsInGroup: number
): DraftMatch[] {
  if (target.round != null || target.bracket_pos != null) return allStageMatches;

  const hasTeamChange = patch.team_a_id !== undefined || patch.team_b_id !== undefined;
  if (!hasTeamChange) return allStageMatches;

  const originalTeamA = target.team_a_id || null;
  const originalTeamB = target.team_b_id || null;
  const newTeamA = patch.team_a_id !== undefined ? patch.team_a_id : originalTeamA;
  const newTeamB = patch.team_b_id !== undefined ? patch.team_b_id : originalTeamB;

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

  const targetRepeat = getRepeatFromMatchday(target.matchday ?? 1, teamsInGroup);
  const newPairKey = rrPairKey(newTeamA, newTeamB);

  const duplicateMatch = allStageMatches.find((m) => {
    if (m === target) return false;
    if (m.stageIdx !== target.stageIdx) return false;
    if (m.groupIdx !== target.groupIdx) return false;
    if (m.round != null || m.bracket_pos != null) return false;
    const mRepeat = getRepeatFromMatchday(m.matchday ?? 1, teamsInGroup);
    if (mRepeat !== targetRepeat) return false;
    return rrPairKey(m.team_a_id, m.team_b_id) === newPairKey;
  });

  if (duplicateMatch) {
    return allStageMatches.map((m) => {
      if (m !== duplicateMatch) return m;
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
