import type { DraftMatch } from "../../TournamentWizard";
import { roundRobinRounds } from "./common";

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

  // Build base single-round pairings using the shared circle method
  // basePairs[r] = list of [teamA, teamB] pairs for round r+1
  const basePairs = roundRobinRounds(opts.teamIds);
  const rounds = basePairs.length;
  if (rounds === 0) return []; // fewer than 2 teams

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






