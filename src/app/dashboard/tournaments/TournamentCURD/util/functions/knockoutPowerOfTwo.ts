//app/dashboard/tournaments/TournamentCURD/util/functions/knockoutPowerOfTwo.ts
import type { DraftMatch } from "../../TournamentWizard";
import { buildSeedPositions, pairArray, wireKnockoutSources } from "./common";

/** Proper seed placement for power-of-two brackets, with stable pointers + outcome="W". */
export function genKnockoutPowerOfTwo(teamIds: number[], stageIdx: number): DraftMatch[] {
  const N = teamIds.length;
  if (N === 0) return [];

  const positions = buildSeedPositions(N);
  const bySeed = teamIds.slice().map((id, i) => ({ seed: i + 1, id }));
  const slotTeams: Array<number | null> = new Array(N).fill(null);

  positions.forEach((seed, slotIdx) => {
    const team = bySeed.find((s) => s.seed === seed)?.id ?? null;
    slotTeams[slotIdx] = team;
  });

  const draft: DraftMatch[] = [];
  let currentRoundTeams = slotTeams.map((id) => id ?? null);
  let round = 1;

  while (currentRoundTeams.length > 1) {
    const nextRoundWinners: { fromIdx: number }[] = [];
    const pairs = pairArray(currentRoundTeams);

    pairs.forEach((pair, i) => {
      const [A, B] = pair;
      const match: DraftMatch = { stageIdx, round, bracket_pos: i + 1 };
      if (A != null) match.team_a_id = A;
      if (B != null) match.team_b_id = B;

      draft.push(match);
      nextRoundWinners.push({ fromIdx: draft.length - 1 });
    });

    currentRoundTeams = nextRoundWinners.map(() => null as number | null);
    round++;
  }

  // Write stable pointers
  wireKnockoutSources(draft);

  // Ensure explicit outcomes on all pointer-fed slots
  for (const m of draft) {
    if (m.home_source_round && m.home_source_bracket_pos && !m.home_source_outcome) {
      m.home_source_outcome = "W";
    }
    if (m.away_source_round && m.away_source_bracket_pos && !m.away_source_outcome) {
      m.away_source_outcome = "W";
    }
  }

  return draft;
}
