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
 *  - { kind: "undecided" }  → leg wins are level and no/equal penalties: winner cannot be determined
 *  - { kind: "decided", winnerTeamId, via } → winner resolved; `via` says whether
 *    leg wins or penalties decided it (callers null pens when decided by wins).
 */
export type TieResolution =
  | { kind: "single" }
  | { kind: "pending" }
  | { kind: "undecided" }
  | { kind: "decided"; winnerTeamId: Id; via: "wins" | "penalties" };

/** Score that `teamId` put up in `m` (teams can occupy either slot). Returns 0 if not in this match. */
export function scoreForTeam(m: TieLegLite, teamId: Id): number {
  if (m.team_a_id === teamId) return m.team_a_score ?? 0;
  if (m.team_b_id === teamId) return m.team_b_score ?? 0;
  return 0;
}

/** Winner of a single leg by score (null on a draw or missing scores). Teams may occupy either slot. */
function legWinner(m: TieLegLite, teamA: Id, teamB: Id): Id | null {
  const sa = scoreForTeam(m, teamA);
  const sb = scoreForTeam(m, teamB);
  if (sa > sb) return teamA;
  if (sb > sa) return teamB;
  return null; // drawn leg → no leg win
}

/**
 * Decide a two-legged tie from the leg-2 (decider) row + its leg-1 sibling.
 *
 * Winner is decided on **leg wins**, NOT aggregate goals:
 *  - One team wins both legs (2–0)            → that team advances.
 *  - One team wins one leg, the other is drawn → the team that won advances (1–0 in wins).
 *  - Each team wins one leg (1–1)             → penalties decide.
 *  - Both legs drawn (0–0 in wins)            → penalties decide.
 * Aggregate goal totals never decide the tie. Penalties are recorded on the
 * leg-2 row (team_a/team_b orientation) and are required whenever leg wins are level.
 * Pure given both rows — shared by progression and the API/action layers.
 */
export function decideTwoLeggedTie(leg2: TieLegLite, leg1: TieLegLite): TieResolution {
  const teamA = leg2.team_a_id;
  const teamB = leg2.team_b_id;
  if (teamA == null || teamB == null) return { kind: "single" };

  const winners = [legWinner(leg1, teamA, teamB), legWinner(leg2, teamA, teamB)];
  const winsA = winners.filter((w) => w === teamA).length;
  const winsB = winners.filter((w) => w === teamB).length;

  if (winsA > winsB) return { kind: "decided", winnerTeamId: teamA, via: "wins" };
  if (winsB > winsA) return { kind: "decided", winnerTeamId: teamB, via: "wins" };

  // Leg wins are level (1–1 or 0–0) → penalties (recorded on the leg-2 row).
  const pa = leg2.penalty_a;
  const pb = leg2.penalty_b;
  if (pa == null || pb == null || pa === pb) return { kind: "undecided" };
  return { kind: "decided", winnerTeamId: pa > pb ? teamA : teamB, via: "penalties" };
}
