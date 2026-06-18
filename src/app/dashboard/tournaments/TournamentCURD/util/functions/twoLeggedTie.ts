// Pure two-legged KO tie resolution.
//
// Lives in its own (non-"use server") module so it can be imported by the
// progression Server Actions module, the match-page actions, and any client-
// agnostic caller. A "use server" file may only export async Server Actions, so
// these synchronous helpers cannot live there.

type Id = number;

/** Minimal shape needed to resolve a tie — works with any match-like row. */
export type TieLegLite = {
  team_a_id: Id | null;
  team_b_id: Id | null;
  team_a_score: number | null;
  team_b_score: number | null;
  penalty_a?: number | null;
  penalty_b?: number | null;
};

/**
 * Result of deciding a two-legged tie:
 *  - { kind: "single" }     → not a two-legged decider (leg null, or leg 1 deleted): use single-match logic
 *  - { kind: "pending" }    → leg 1 not finished yet: do not propagate
 *  - { kind: "undecided" }  → aggregate level and no/equal penalties: winner cannot be determined
 *  - { kind: "decided", winnerTeamId } → winner resolved (aggregate, then penalties)
 */
export type TieResolution =
  | { kind: "single" }
  | { kind: "pending" }
  | { kind: "undecided" }
  | { kind: "decided"; winnerTeamId: Id };

/** Score that `teamId` put up in `m` (teams can occupy either slot). Returns 0 if not in this match. */
export function scoreForTeam(m: TieLegLite, teamId: Id): number {
  if (m.team_a_id === teamId) return m.team_a_score ?? 0;
  if (m.team_b_id === teamId) return m.team_b_score ?? 0;
  return 0;
}

/**
 * Decide a two-legged tie from the leg-2 (decider) row + its leg-1 sibling.
 * Aggregates per team id (teams swap home/away between legs); penalties break a level aggregate.
 * Pure given both rows — shared by progression and the API/action layers.
 */
export function decideTwoLeggedTie(leg2: TieLegLite, leg1: TieLegLite): TieResolution {
  const teamA = leg2.team_a_id;
  const teamB = leg2.team_b_id;
  if (teamA == null || teamB == null) return { kind: "single" };

  const aggA = scoreForTeam(leg2, teamA) + scoreForTeam(leg1, teamA);
  const aggB = scoreForTeam(leg2, teamB) + scoreForTeam(leg1, teamB);

  if (aggA > aggB) return { kind: "decided", winnerTeamId: teamA };
  if (aggB > aggA) return { kind: "decided", winnerTeamId: teamB };

  // Level on aggregate → penalties (recorded on the leg-2 row, in team_a/team_b orientation)
  const pa = leg2.penalty_a;
  const pb = leg2.penalty_b;
  if (pa == null || pb == null || pa === pb) return { kind: "undecided" };
  return { kind: "decided", winnerTeamId: pa > pb ? teamA : teamB };
}
