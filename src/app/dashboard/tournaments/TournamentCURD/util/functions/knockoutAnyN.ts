//app/dashboard/tournaments/TournamentCURD/util/functions/knockoutAnyN.ts
import type { DraftMatch } from "../../TournamentWizard";

/**
 * Build a seeded knockout for any N.
 * - Compute next power-of-two P
 * - Place seeds in the standard bracket order for P
 * - Seeds > N are ghosts → byes for the opposing real seed
 * - Create R1 only for real-vs-real; byes advance real seed to R2
 * - For R>=2, wire matches with stable (round, bracket_pos) pointers + outcome="W"
 */
export function genKnockoutAnyN(
  ids: number[],
  stageIdx: number,
  seeded: Array<{ id: number; seed: number }>
): DraftMatch[] {
  const N = ids.length;
  if (N <= 0) return [];

  const P = nextPow2(N); // seed against the next power-of-two
  const order = seedOrder(P); // e.g. 16 -> [1,16,8,9,4,13,5,12,2,15,7,10,3,14,6,11]

  const bySeed = new Map<number, number>(); // seed -> teamId
  seeded.forEach((s) => bySeed.set(s.seed, s.id));

  type Entry = { teamId?: number; from?: { round: number; pos: number } };
  const entries: Entry[][] = [];
  entries[1] = [];

  // Fill Round 1 slots by seed order (ghosts are undefined)
  for (let i = 0; i < P; i++) {
    const seed = order[i];
    const teamId = seed <= N ? bySeed.get(seed) : undefined;
    entries[1].push({ teamId });
  }

  const matches: DraftMatch[] = [];

  // Round 1: create only for real-vs-real; otherwise advance the real seed to R2
  const r1Count = P / 2;
  entries[2] = [];
  for (let pos = 1; pos <= r1Count; pos++) {
    const a = entries[1][2 * (pos - 1)];
    const b = entries[1][2 * (pos - 1) + 1];

    if (a?.teamId && b?.teamId) {
      matches.push({
        stageIdx,
        round: 1,
        bracket_pos: pos,
        team_a_id: a.teamId,
        team_b_id: b.teamId,
      });
      entries[2][pos - 1] = { from: { round: 1, pos } };
    } else {
      const adv = a?.teamId ?? b?.teamId; // one real or none
      entries[2][pos - 1] = { teamId: adv ?? undefined };
    }
  }

  // Rounds 2..log2(P): create matches; wire stable pointers, set outcome="W"
  let round = 2;
  while ((1 << (round - 1)) <= P) {
    const prev = entries[round];
    const count = prev.length / 2;
    if (count < 1) break;

    entries[round + 1] = [];
    for (let pos = 1; pos <= count; pos++) {
      const left = prev[2 * (pos - 1)];
      const right = prev[2 * (pos - 1) + 1];

      const m: DraftMatch = { stageIdx, round, bracket_pos: pos };

      if (left?.from) {
        m.home_source_round = left.from.round;
        m.home_source_bracket_pos = left.from.pos;
        m.home_source_outcome = "W"; // explicit single-elim winner feed
      } else {
        m.team_a_id = left?.teamId ?? null;
      }

      if (right?.from) {
        m.away_source_round = right.from.round;
        m.away_source_bracket_pos = right.from.pos;
        m.away_source_outcome = "W"; // explicit single-elim winner feed
      } else {
        m.team_b_id = right?.teamId ?? null;
      }

      matches.push(m);
      entries[round + 1][pos - 1] = { from: { round, pos } };
    }

    round += 1;
  }

  return matches;
}

/* ---------------- helpers ---------------- */

const nextPow2 = (n: number) => (n <= 1 ? 1 : 1 << Math.ceil(Math.log2(n)));

/** Standard seeded bracket order for size n (n must be power of two). */
function seedOrder(n: number): number[] {
  if (n === 1) return [1];
  const prev = seedOrder(n / 2);
  const out: number[] = [];
  for (const s of prev) {
    out.push(s);
    out.push(n + 1 - s);
  }
  return out;
}
