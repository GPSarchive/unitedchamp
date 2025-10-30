import type { DraftMatch } from "../../TournamentWizard";

/** 
 * Standard round-robin (circle method), with N repeats.
 * Generates matches for league/groups stages only.
 * 
 * @param opts.stageIdx - Stage index in tournament
 * @param opts.groupIdx - Group index (null for League, 0+ for Groups)
 * @param opts.teamIds - Array of team IDs to schedule
 * @param opts.repeats - Number of times to repeat the cycle (1=single, 2=double, etc.)
 * @param opts.startDate - (Not used for generation, kept for API compatibility)
 * @param opts.intervalDays - (Not used for generation, kept for API compatibility)
 */
export function genRoundRobin(opts: {
  stageIdx: number;
  groupIdx: number | null;   // null for League, 0.. for Groups
  teamIds: number[];         // real team IDs
  repeats: number;           // 1 = single, 2 = double, 3+ = multi
  startDate?: Date | null;   // optional, not used for generation
  intervalDays?: number;     // optional, not used for generation
}): DraftMatch[] {
  const { stageIdx, groupIdx } = opts;
  const repeats = Math.max(1, Math.floor(opts.repeats || 1));

  const ids = opts.teamIds.slice();
  const n = ids.length;
  
  // Need at least 2 teams for round-robin
  if (n < 2) return [];

  // For odd team counts, add a BYE sentinel (-1) just for pairing algorithm
  const hasBye = n % 2 === 1;
  if (hasBye) ids.push(-1);

  const m = ids.length;      // total including BYE
  const rounds = m - 1;      // matchdays per single round
  const half = m / 2;        // pairs per matchday

  // Build base single-round pairings using circle method
  // basePairs[r] = list of [teamA, teamB] pairs for round r+1
  let ring = ids.slice();
  const basePairs: Array<Array<[number, number]>> = [];

  for (let r = 0; r < rounds; r++) {
    const pairs: Array<[number, number]> = [];
    
    // Pair up teams: first half vs second half (reversed)
    for (let i = 0; i < half; i++) {
      const a = ring[i];
      const b = ring[m - 1 - i];
      
      // Skip matches involving the BYE
      if (a !== -1 && b !== -1) {
        pairs.push([a, b]);
      }
    }
    
    basePairs.push(pairs);

    // Rotate ring for next round (circle method)
    // Keep first position fixed, rotate rest clockwise
    const fixed = ring[0];
    const rest = ring.slice(1);
    ring = [fixed, rest[rest.length - 1], ...rest.slice(0, rest.length - 1)];
  }

  // Generate matches with repeats
  // - Repeat 1 (odd): Home/Away as generated
  // - Repeat 2 (even): Flip Home/Away for return fixtures
  // - Repeat 3+ (odd): Same as Repeat 1, etc.
  const out: DraftMatch[] = [];
  let globalMatchday = 1;

  for (let rep = 1; rep <= repeats; rep++) {
    const flipHomeAway = rep % 2 === 0; // Even repeats flip home/away

    for (let round = 0; round < rounds; round++) {
      const matchday = globalMatchday++;

      for (const [teamA, teamB] of basePairs[round]) {
        out.push({
          stageIdx,
          groupIdx,
          matchday,
          team_a_id: flipHomeAway ? teamB : teamA,
          team_b_id: flipHomeAway ? teamA : teamB,
          match_date: null,
          // Round-robin matches never have round/bracket_pos
          round: null,
          bracket_pos: null,
          is_ko: false,
        });
      }
    }
  }

  return out;
}






