//app/dashboard/tournaments/TournamentCURD/util/functions/common.ts
import type { DraftMatch } from "../../TournamentWizard";

export function shuffleArray<T>(a: T[]): T[] {
  const arr = a.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function pairArray<T>(arr: T[]): [T, T | null][] {
  const out: [T, T | null][] = [];
  for (let i = 0; i < arr.length; i += 2) out.push([arr[i], arr[i + 1] ?? null]);
  return out;
}

/** Next power of two ≥ n. */
export const nextPow2 = (n: number) => (n <= 1 ? 1 : 1 << Math.ceil(Math.log2(n)));

/** Standard seeded bracket order for size n (power of two), e.g. 8 -> [1,8,4,5,2,7,3,6]. */
export function seedOrder(n: number): number[] {
  if (n <= 1) return [1];
  const prev = seedOrder(n / 2);
  const out: number[] = [];
  for (const s of prev) {
    out.push(s);
    out.push(n + 1 - s);
  }
  return out;
}

/**
 * Circle-method round-robin core: one single round-robin over the given ids.
 * Returns one entry per matchday, each a list of [home, away] pairings.
 * Odd team counts get an internal BYE; pairings against the BYE are omitted.
 */
export function roundRobinRounds(teamIds: number[]): Array<[number, number][]> {
  const ids = teamIds.slice();
  if (ids.length < 2) return [];
  if (ids.length % 2 === 1) ids.push(-1); // BYE sentinel
  const m = ids.length;
  const half = m / 2;
  let ring = ids;
  const rounds: Array<[number, number][]> = [];
  for (let r = 0; r < m - 1; r++) {
    const pairs: [number, number][] = [];
    for (let i = 0; i < half; i++) {
      const a = ring[i];
      const b = ring[m - 1 - i];
      if (a !== -1 && b !== -1) pairs.push([a, b]);
    }
    rounds.push(pairs);
    // keep first fixed, rotate the rest clockwise
    ring = [ring[0], ring[m - 1], ...ring.slice(1, m - 1)];
  }
  return rounds;
}

/**
 * Expand a single-leg KO draft into a two-legged one.
 *
 * For each input match we emit two rows sharing (round, bracket_pos):
 *  - leg 1: same orientation as the original.
 *  - leg 2: home/away swapped (teams, source pointers, and outcomes), with
 *    `tie_leg1_match_idx` pointing at its leg-1 sibling.
 *
 * Children reference parents by (round, bracket_pos); since both legs share
 * those coords, progression is responsible for only propagating from the
 * leg-2 (decider) row — see progression.ts. To keep transient idx pointers
 * (`*_source_match_idx`) valid, we remap them to the parent's **leg-2** index.
 *
 * Output ordering: leg 1 and leg 2 are emitted as a pair, so the new index of
 * an original match at position `i` is `2*i` (leg 1) and `2*i + 1` (leg 2).
 */
export function expandToTwoLegs(draft: DraftMatch[]): DraftMatch[] {
  const leg2IdxOf = (origIdx: number) => 2 * origIdx + 1; // parent's decider row

  const out: DraftMatch[] = [];
  draft.forEach((m, i) => {
    // ----- Leg 1: unchanged orientation -----
    const leg1: DraftMatch = {
      ...m,
      leg: 1,
      // Point any transient idx pointer at the parent's leg-2 (decider) row.
      home_source_match_idx:
        m.home_source_match_idx != null ? leg2IdxOf(m.home_source_match_idx) : m.home_source_match_idx,
      away_source_match_idx:
        m.away_source_match_idx != null ? leg2IdxOf(m.away_source_match_idx) : m.away_source_match_idx,
    };

    // ----- Leg 2: swap home/away across teams, pointers and outcomes -----
    const leg2: DraftMatch = {
      ...m,
      leg: 2,
      tie_leg1_match_idx: 2 * i, // index of leg 1 in the output array

      team_a_id: m.team_b_id ?? null,
      team_b_id: m.team_a_id ?? null,

      home_source_match_idx:
        m.away_source_match_idx != null ? leg2IdxOf(m.away_source_match_idx) : m.away_source_match_idx ?? null,
      away_source_match_idx:
        m.home_source_match_idx != null ? leg2IdxOf(m.home_source_match_idx) : m.home_source_match_idx ?? null,
      home_source_outcome: m.away_source_outcome ?? null,
      away_source_outcome: m.home_source_outcome ?? null,
      home_source_round: m.away_source_round ?? null,
      home_source_bracket_pos: m.away_source_bracket_pos ?? null,
      away_source_round: m.home_source_round ?? null,
      away_source_bracket_pos: m.home_source_bracket_pos ?? null,
    };

    out.push(leg1, leg2);
  });

  return out;
}

/** Wire knockout source references between successive rounds (W winners). */
export function wireKnockoutSources(draft: DraftMatch[]) {
  const rounds = new Map<number, { idx: number; pos: number }[]>();
  draft.forEach((m, i) => {
    const r = m.round ?? 0;
    const arr = rounds.get(r) ?? [];
    arr.push({ idx: i, pos: m.bracket_pos ?? arr.length + 1 });
    rounds.set(r, arr);
  });

  const roundNums = [...rounds.keys()].sort((a, b) => a - b);
  for (let i = 0; i < roundNums.length - 1; i++) {
    const r = roundNums[i];
    const nextR = roundNums[i + 1];

    const curr = (rounds.get(r) ?? []).sort((a, b) => a.pos - b.pos);
    const next = (rounds.get(nextR) ?? []).sort((a, b) => a.pos - b.pos);

    for (let j = 0; j < next.length; j++) {
      const target = draft[next[j].idx];
      const aSrc = curr[2 * j]?.idx;
      const bSrc = curr[2 * j + 1]?.idx;
      if (aSrc != null) {
        target.home_source_match_idx = aSrc;
        target.home_source_outcome = "W";
      }
      if (bSrc != null) {
        target.away_source_match_idx = bSrc;
        target.away_source_outcome = "W";
      }
    }
  }
}
