// app/components/DashboardPageComponents/TournamentCURD/util/generators/knockoutAnyN.ts
import type { DraftMatch } from "../../TournamentWizard";

/**
 * Any-N bracket with seed-aware prelim round and byes.
 * Wires sources incrementally as rounds are built.
 */
export function genKnockoutAnyN(
  teamIds: number[],
  stageIdx: number,
  seeded?: { id: number; seed: number }[]
): DraftMatch[] {
  const N = teamIds.length;
  if (N === 0) return [];

  // order by seed if provided, else by id asc
  let order: number[] = [];
  if (seeded && seeded.every((s) => Number.isFinite(s.seed))) {
    order = seeded.slice().sort((a, b) => a.seed - b.seed).map((s) => s.id);
  } else {
    order = [...teamIds].sort((a, b) => a - b);
  }

  const pow2 = (x: number) => 1 << Math.ceil(Math.log2(Math.max(1, x)));
  const T = pow2(N);
  const byes = T - N; // top seeds skip prelims

  // PRELIM: lower seeds only (center-cross pairing)
  const prelimEntrants = order.slice(byes);
  const prelimPairs: [number | null, number | null][] = [];
  const L = prelimEntrants.length; // even
  if (L > 0) {
    const half = Math.floor(L / 2);
    for (let k = 0; k < half; k++) {
      const a = prelimEntrants[half - 1 - k] ?? null; // toward mid-high
      const b = prelimEntrants[half + k] ?? null;     // toward low-high
      prelimPairs.push([a, b]);
    }
  }

  const draft: DraftMatch[] = [];
  const roundStarts: number[] = [];
  let roundNo = 1;

  if (prelimPairs.length > 0) {
    roundStarts.push(draft.length);
    prelimPairs.forEach((p, i) => {
      draft.push({
        stageIdx,
        round: roundNo,
        bracket_pos: i + 1,
        team_a_id: p[0] ?? null,
        team_b_id: p[1] ?? null,
      });
    });
    roundNo++;
  }

  // NEXT: interleave bye-seeds with prelim winners
  type Slot = { teamId?: number; fromIdx?: number };

  const winnersFromPrelim: Slot[] = [];
  if (prelimPairs.length > 0) {
    const start = roundStarts[roundStarts.length - 1];
    for (let i = 0; i < prelimPairs.length; i++) winnersFromPrelim.push({ fromIdx: start + i });
  }

  const byeSlots: Slot[] = order.slice(0, byes).map((id) => ({ teamId: id }));

  const interleaved: Slot[] = [];
  {
    const W = winnersFromPrelim.length;
    const B = byeSlots.length;
    const M = Math.max(B, W);
    for (let i = 0; i < M; i++) {
      if (i < B) interleaved.push(byeSlots[i]);          // BYE seed
      if (i < W) interleaved.push(winnersFromPrelim[i]); // then winner
    }
  }

  let curr: Slot[] = interleaved;

  while (curr.length > 1) {
    roundStarts.push(draft.length);
    const next: Slot[] = [];

    for (let i = 0; i < curr.length; i += 2) {
      const A = curr[i];
      const B = curr[i + 1];
      const idxInRound = i / 2;

      const match: DraftMatch = { stageIdx, round: roundNo, bracket_pos: idxInRound + 1 };
      if (A?.teamId != null) match.team_a_id = A.teamId;
      if (B?.teamId != null) match.team_b_id = B.teamId;

      draft.push(match);
      const thisIdx = draft.length - 1;
      next.push({ fromIdx: thisIdx });
    }

    // wire sources from the slots we just paired
    const thisRoundStart = roundStarts[roundStarts.length - 1];
    for (let k = thisRoundStart; k < draft.length; k++) {
      const pairIdx = k - thisRoundStart;
      const aSlot = curr[2 * pairIdx];
      const bSlot = curr[2 * pairIdx + 1];
      const m = draft[k];
      if (aSlot?.fromIdx != null) {
        m.home_source_match_idx = aSlot.fromIdx;
        m.home_source_outcome = "W";
      }
      if (bSlot?.fromIdx != null) {
        m.away_source_match_idx = bSlot.fromIdx;
        m.away_source_outcome = "W";
      }
    }

    curr = next;
    roundNo++;
  }

  return draft;
}
