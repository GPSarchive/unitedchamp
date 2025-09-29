//app/dashboard/tournaments/TournamentCURD/util/functions/roundRobin.ts
import type { DraftMatch } from "../../TournamentWizard";

/** Standard round-robin (circle method), with N repeats and optional BYE handling. */
export function genRoundRobin(opts: {
  stageIdx: number;
  groupIdx: number | null;   // null for League, 0.. for Groups
  teamIds: number[];         // real team IDs
  repeats: number;           // 1 = single, 2 = double, 3+ = multi
  startDate: Date | null;    // not used for generation here
  intervalDays: number;      // not used for generation here
}): DraftMatch[] {
  const { stageIdx, groupIdx } = opts;
  const repeats = Math.max(1, Math.floor(opts.repeats || 1));

  const ids = opts.teamIds.slice();
  const n = ids.length;
  if (n < 2) return [];

  // For odd team counts, add a BYE sentinel (-1) just for pairing
  const hasBye = n % 2 === 1;
  if (hasBye) ids.push(-1);

  const m = ids.length;
  const rounds = m - 1;         // matchdays per single round
  const half = m / 2;

  // Build base single-round pairings (by matchday) using circle method
  let ring = ids.slice();
  const basePairs: Array<Array<[number, number]>> = []; // basePairs[r] = list of [A,B] for md r+1

  for (let r = 0; r < rounds; r++) {
    const pairs: Array<[number, number]> = [];
    for (let i = 0; i < half; i++) {
      const a = ring[i];
      const b = ring[m - 1 - i];
      if (a !== -1 && b !== -1) pairs.push([a, b]); // skip BYE matches
    }
    basePairs.push(pairs);

    // rotate ring (keep index 0 fixed, rotate the rest to the right by 1)
    const fixed = ring[0];
    const rest = ring.slice(1);
    ring = [fixed, rest[rest.length - 1], ...rest.slice(0, rest.length - 1)];
  }

  // Emit repeats: repeat #1 = base orientation, #2 flips home/away, #3 same as #1, etc.
  const out: DraftMatch[] = [];
  for (let rep = 1; rep <= repeats; rep++) {
    const flip = rep % 2 === 0; // even repeats flip home/away

    for (let r = 0; r < rounds; r++) {
      const md = (rep - 1) * rounds + (r + 1);
      for (const [A, B] of basePairs[r]) {
        out.push({
          stageIdx,
          groupIdx,
          matchday: md,
          team_a_id: flip ? B : A,
          team_b_id: flip ? A : B,
          match_date: null,
          round: null,
          bracket_pos: null,
        });
      }
    }
  }

  return out;
}
