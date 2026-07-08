import { describe, it, expect } from "vitest";
import type { DraftMatch } from "../../../TournamentWizard";
import {
  nextPow2,
  seedOrder,
  pairArray,
  roundRobinRounds,
  expandToTwoLegs,
  makeLeg2Row,
  expandSelectedToTwoLegs,
  wireKnockoutSources,
} from "../common";

describe("nextPow2", () => {
  it("returns the next power of two ≥ n", () => {
    expect(nextPow2(0)).toBe(1);
    expect(nextPow2(1)).toBe(1);
    expect(nextPow2(2)).toBe(2);
    expect(nextPow2(3)).toBe(4);
    expect(nextPow2(5)).toBe(8);
    expect(nextPow2(8)).toBe(8);
    expect(nextPow2(9)).toBe(16);
    expect(nextPow2(16)).toBe(16);
    expect(nextPow2(17)).toBe(32);
  });
});

describe("seedOrder", () => {
  // Contract: n must be a power of two (callers always pass nextPow2 output).
  it("produces the standard bracket order", () => {
    expect(seedOrder(1)).toEqual([1]);
    expect(seedOrder(2)).toEqual([1, 2]);
    expect(seedOrder(4)).toEqual([1, 4, 2, 3]);
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });

  it("is a permutation of 1..n where adjacent pairs sum to n+1", () => {
    for (const n of [2, 4, 8, 16, 32]) {
      const order = seedOrder(n);
      expect([...order].sort((a, b) => a - b)).toEqual(
        Array.from({ length: n }, (_, i) => i + 1)
      );
      for (let i = 0; i < n; i += 2) {
        expect(order[i] + order[i + 1]).toBe(n + 1);
      }
    }
  });

  it("keeps the top two seeds in opposite halves", () => {
    for (const n of [4, 8, 16]) {
      const order = seedOrder(n);
      const half = n / 2;
      expect(order.indexOf(1)).toBeLessThan(half);
      expect(order.indexOf(2)).toBeGreaterThanOrEqual(half);
    }
  });
});

describe("pairArray", () => {
  it("pairs even-length arrays fully", () => {
    expect(pairArray([1, 2, 3, 4])).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });
  it("pads the trailing odd element with null", () => {
    expect(pairArray([1, 2, 3])).toEqual([
      [1, 2],
      [3, null],
    ]);
  });
});

describe("roundRobinRounds", () => {
  const pairKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

  it("returns [] for fewer than 2 teams", () => {
    expect(roundRobinRounds([])).toEqual([]);
    expect(roundRobinRounds([7])).toEqual([]);
  });

  it.each([
    [4, 3, 2],
    [6, 5, 3],
    [8, 7, 4],
  ])("even n=%i → %i rounds of %i pairs, every pair exactly once", (n, rounds, perRound) => {
    const ids = Array.from({ length: n }, (_, i) => 100 + i);
    const rr = roundRobinRounds(ids);
    expect(rr).toHaveLength(rounds);
    const seen = new Set<string>();
    for (const round of rr) {
      expect(round).toHaveLength(perRound);
      const inRound = new Set<number>();
      for (const [a, b] of round) {
        expect(inRound.has(a)).toBe(false);
        expect(inRound.has(b)).toBe(false);
        inRound.add(a);
        inRound.add(b);
        const k = pairKey(a, b);
        expect(seen.has(k)).toBe(false);
        seen.add(k);
      }
    }
    expect(seen.size).toBe((n * (n - 1)) / 2);
  });

  it("odd n gets a bye: n rounds, each team rests exactly once per cycle", () => {
    const ids = [1, 2, 3, 4, 5];
    const rr = roundRobinRounds(ids);
    expect(rr).toHaveLength(5); // m-1 rounds with m = n+1 (bye)
    const seen = new Set<string>();
    const restCount = new Map<number, number>(ids.map((id) => [id, 0]));
    for (const round of rr) {
      expect(round).toHaveLength(2); // one team rests
      const playing = new Set(round.flat());
      for (const id of ids) {
        if (!playing.has(id)) restCount.set(id, (restCount.get(id) ?? 0) + 1);
      }
      for (const [a, b] of round) seen.add(pairKey(a, b));
    }
    expect(seen.size).toBe(10); // C(5,2)
    for (const id of ids) expect(restCount.get(id)).toBe(1);
  });
});

/* ---------- two-leg expansion ---------- */

const semi1 = {
  stageIdx: 0,
  round: 1,
  bracket_pos: 1,
  team_a_id: 11,
  team_b_id: 12,
  is_ko: true,
} as DraftMatch;
const semi2 = {
  stageIdx: 0,
  round: 1,
  bracket_pos: 2,
  team_a_id: 13,
  team_b_id: 14,
  is_ko: true,
} as DraftMatch;
const final = {
  stageIdx: 0,
  round: 2,
  bracket_pos: 1,
  team_a_id: null,
  team_b_id: null,
  is_ko: true,
  home_source_match_idx: 0,
  away_source_match_idx: 1,
  home_source_outcome: "W",
  away_source_outcome: "W",
  home_source_round: 1,
  home_source_bracket_pos: 1,
  away_source_round: 1,
  away_source_bracket_pos: 2,
} as DraftMatch;

describe("expandToTwoLegs", () => {
  const out = expandToTwoLegs([semi1, semi2, final]);

  it("emits leg 1 + leg 2 per tie, adjacent, sharing (round, bracket_pos)", () => {
    expect(out).toHaveLength(6);
    for (let i = 0; i < 6; i += 2) {
      expect(out[i].leg).toBe(1);
      expect(out[i + 1].leg).toBe(2);
      expect(out[i + 1].round).toBe(out[i].round);
      expect(out[i + 1].bracket_pos).toBe(out[i].bracket_pos);
    }
  });

  it("links each leg 2 to its leg-1 sibling by output index", () => {
    expect(out[1].tie_leg1_match_idx).toBe(0);
    expect(out[3].tie_leg1_match_idx).toBe(2);
    expect(out[5].tie_leg1_match_idx).toBe(4);
  });

  it("swaps home/away on leg 2 (teams, pointers, outcomes, coords)", () => {
    const s1leg2 = out[1];
    expect(s1leg2.team_a_id).toBe(12);
    expect(s1leg2.team_b_id).toBe(11);

    const finalLeg2 = out[5];
    // leg 2 of the final: sides swapped AND idx pointers retargeted to the
    // parents' leg-2 (decider) rows: semi2 leg2 = index 3, semi1 leg2 = index 1
    expect(finalLeg2.home_source_match_idx).toBe(3);
    expect(finalLeg2.away_source_match_idx).toBe(1);
    expect(finalLeg2.home_source_round).toBe(1);
    expect(finalLeg2.home_source_bracket_pos).toBe(2);
    expect(finalLeg2.away_source_bracket_pos).toBe(1);
  });

  it("keeps leg 1 orientation but retargets idx pointers to the deciders", () => {
    const finalLeg1 = out[4];
    expect(finalLeg1.home_source_match_idx).toBe(1); // semi1's leg 2
    expect(finalLeg1.away_source_match_idx).toBe(3); // semi2's leg 2
    expect(finalLeg1.home_source_bracket_pos).toBe(1); // coords unchanged
  });
});

describe("makeLeg2Row", () => {
  it("swaps orientation and never inherits results or identity", () => {
    const leg1 = {
      ...semi1,
      leg: 1,
      db_id: 555,
      status: "finished",
      team_a_score: 3,
      team_b_score: 1,
      winner_team_id: 11,
      penalty_a: 5,
      penalty_b: 4,
    } as DraftMatch;
    const leg2 = makeLeg2Row(leg1);
    expect(leg2.leg).toBe(2);
    expect(leg2.db_id).toBeNull();
    expect(leg2.tie_leg1_match_idx).toBeNull();
    expect(leg2.team_a_id).toBe(12);
    expect(leg2.team_b_id).toBe(11);
    expect(leg2.status).toBe("scheduled");
    expect(leg2.team_a_score).toBeNull();
    expect(leg2.team_b_score).toBeNull();
    expect(leg2.winner_team_id).toBeNull();
    expect(leg2.penalty_a).toBeNull();
    expect(leg2.penalty_b).toBeNull();
  });
});

describe("expandSelectedToTwoLegs", () => {
  it("expands only matching KO ties, passes the rest through", () => {
    const rr = { stageIdx: 0, groupIdx: 0, matchday: 1, team_a_id: 1, team_b_id: 2 } as DraftMatch;
    const out = expandSelectedToTwoLegs([rr, semi1, semi2], (m) => m.bracket_pos === 2);
    expect(out).toHaveLength(4);
    expect(out[0]).toBe(rr); // untouched non-KO row
    expect(out[1].leg).toBeUndefined; // semi1 not expanded
    expect(out[1].bracket_pos).toBe(1);
    expect(out[2].leg).toBe(1);
    expect(out[3].leg).toBe(2);
    expect(out[3].team_a_id).toBe(14);
  });
});

describe("wireKnockoutSources", () => {
  it("wires each child to its two parents with outcome W", () => {
    const draft = [
      { ...semi1 },
      { ...semi2 },
      { stageIdx: 0, round: 2, bracket_pos: 1, is_ko: true } as DraftMatch,
    ];
    wireKnockoutSources(draft);
    expect(draft[2].home_source_match_idx).toBe(0);
    expect(draft[2].away_source_match_idx).toBe(1);
    expect(draft[2].home_source_outcome).toBe("W");
    expect(draft[2].away_source_outcome).toBe("W");
  });
});
