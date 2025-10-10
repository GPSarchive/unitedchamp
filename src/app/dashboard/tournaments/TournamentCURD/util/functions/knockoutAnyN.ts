// app/dashboard/tournaments/TournamentCURD/util/functions/knockoutAnyN.ts
import type { DraftMatch } from "../../TournamentWizard";

/**
 * Build a seeded knockout for any N (robust + bye-friendly).
 * - Every team gets a unique seed in [1..N] (respect existing seeds).
 * - Expand to next power-of-two P; seeds in (N..P] are ghosts (byes).
 * - R1: create only real-vs-real matches; byes advance straight to R2.
 * - R>=2: if one side is a pointer and the other is a bye → always set:
 *      team_a_id = bye team, away_source_* = pointer  (so UI shows "Team vs TBD").
 *   If both are pointers: wire both sides as pointers.
 *   If both are teams: write both team ids.
 */
export function genKnockoutAnyN(
  ids: number[],
  stageIdx: number,
  seededIn: Array<{ id: number; seed: number }> = []
): DraftMatch[] {
  /* ---------- normalize team list ---------- */
  const uniqIds: number[] = [];
  const seen = new Set<number>();
  for (const id of ids) {
    if (typeof id === "number" && Number.isFinite(id) && !seen.has(id)) {
      uniqIds.push(id);
      seen.add(id);
    }
  }
  const N = uniqIds.length;
  if (N <= 0) return [];

  /* ---------- normalize seeds: cover all teams in [1..N] ---------- */
  const wanted = new Set(uniqIds);
  const usedSeeds = new Set<number>();
  const bySeed = new Map<number, number>(); // seed -> teamId
  const seededIds = new Set<number>();

  for (const { id, seed } of seededIn) {
    if (!wanted.has(id)) continue;
    if (!Number.isInteger(seed) || seed < 1 || seed > N) continue;
    if (usedSeeds.has(seed) || seededIds.has(id)) continue;
    bySeed.set(seed, id);
    usedSeeds.add(seed);
    seededIds.add(id);
  }

  const freeSeeds: number[] = [];
  for (let s = 1; s <= N; s++) if (!usedSeeds.has(s)) freeSeeds.push(s);

  let k = 0;
  for (const id of uniqIds) {
    if (seededIds.has(id)) continue;
    const s = freeSeeds[k++];
    bySeed.set(s, id);
  }

  /* ---------- seed into next power-of-two ---------- */
  const P = nextPow2(N);
  const order = seedOrder(P); // e.g. 8 -> [1,8,4,5,2,7,3,6]

  type Entry = { teamId?: number; from?: { round: number; pos: number } };
  const entries: Entry[][] = [];
  entries[1] = [];

  // R1 slots by seed order (ghosts => undefined)
  for (let i = 0; i < P; i++) {
    const seed = order[i];
    const teamId = seed <= N ? bySeed.get(seed) : undefined;
    entries[1].push({ teamId });
  }

  const matches: DraftMatch[] = [];

  /* ---------- Round 1 ---------- */
  const r1Count = P / 2;
  entries[2] = [];
  for (let pos = 1; pos <= r1Count; pos++) {
    const a = entries[1][2 * (pos - 1)];
    const b = entries[1][2 * (pos - 1) + 1];

    if (a?.teamId && b?.teamId) {
      matches.push({
        stageIdx,
        groupIdx: null,
        matchday: null,
        round: 1,
        bracket_pos: pos,
        team_a_id: a.teamId,
        team_b_id: b.teamId,
        match_date: null,
      });
      entries[2][pos - 1] = { from: { round: 1, pos } };
    } else {
      const adv = a?.teamId ?? b?.teamId; // exactly one or none
      entries[2][pos - 1] = { teamId: adv ?? undefined };
    }
  }

  /* ---------- Rounds 2.. ---------- */
  let round = 2;
  while ((1 << (round - 1)) <= P) {
    const prev = entries[round] ?? [];
    const count = Math.floor(prev.length / 2);
    if (count < 1) break;

    entries[round + 1] = [];

    for (let pos = 1; pos <= count; pos++) {
      const left  = prev[2 * (pos - 1)];
      const right = prev[2 * (pos - 1) + 1];

      const m: DraftMatch = {
        stageIdx,
        groupIdx: null,
        matchday: null,
        round,
        bracket_pos: pos,
        team_a_id: null,
        team_b_id: null,
        match_date: null,
      };

      const L_from = left?.from;
      const R_from = right?.from;
      const L_team = left?.teamId;
      const R_team = right?.teamId;

      if (L_from && R_from) {
        // two winners feed in
        m.home_source_round = L_from.round;
        m.home_source_bracket_pos = L_from.pos;
        (m as any).home_source_outcome = "W";

        m.away_source_round = R_from.round;
        m.away_source_bracket_pos = R_from.pos;
        (m as any).away_source_outcome = "W";
      } else if (!L_from && !R_from) {
        // both concrete teams (shouldn’t happen often beyond R1, but support it)
        m.team_a_id = L_team ?? null;
        m.team_b_id = R_team ?? null;
      } else {
        // MIXED CASE (one pointer + one bye) → always show "Team vs TBD"
        // Put the real team on team_a_id; the pointer on AWAY side.
        const byeTeam = L_team ?? R_team ?? null;
        const pointer = L_from ?? R_from ?? null;

        m.team_a_id = byeTeam;
        if (pointer) {
          m.away_source_round = pointer.round;
          m.away_source_bracket_pos = pointer.pos;
          (m as any).away_source_outcome = "W";
        }
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
