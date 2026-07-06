import { describe, it, expect } from "vitest";
import type { DraftMatch } from "../../../TournamentWizard";
import { genKnockoutAnyN } from "../knockoutAnyN";
import { genKnockoutPowerOfTwo } from "../knockoutPowerOfTwo";
import { nextPow2 } from "../common";

const teamIds = (n: number) => Array.from({ length: n }, (_, i) => 100 + i);

/** Every concrete team id placed anywhere in the bracket. */
function placedTeams(matches: DraftMatch[]): number[] {
  const out: number[] = [];
  for (const m of matches) {
    if (m.team_a_id != null) out.push(m.team_a_id);
    if (m.team_b_id != null) out.push(m.team_b_id);
  }
  return out;
}

describe("genKnockoutAnyN — structural invariants", () => {
  it.each([2, 3, 4, 5, 6, 7, 8, 11, 16])("N=%i", (n) => {
    const ids = teamIds(n);
    const matches = genKnockoutAnyN(ids, 0);

    // Single elimination always needs exactly N-1 matches.
    expect(matches).toHaveLength(n - 1);

    // (round, bracket_pos) unique; all rows flagged KO.
    const coords = new Set(matches.map((m) => `${m.round}#${m.bracket_pos}`));
    expect(coords.size).toBe(matches.length);
    for (const m of matches) expect(m.is_ko).toBe(true);

    // Every input team is placed exactly once (byes surface in a later round).
    const placed = placedTeams(matches).sort((a, b) => a - b);
    expect(placed).toEqual(ids.slice().sort((a, b) => a - b));

    // Every source pointer references an existing earlier match.
    for (const m of matches) {
      for (const side of ["home", "away"] as const) {
        const r = (m as any)[`${side}_source_round`];
        const p = (m as any)[`${side}_source_bracket_pos`];
        if (r != null && p != null) {
          expect(coords.has(`${r}#${p}`)).toBe(true);
          expect(r).toBeLessThan(m.round!);
          expect((m as any)[`${side}_source_outcome`]).toBe("W");
        }
      }
    }

    // The final: exactly one match in the last round.
    const maxRound = Math.max(...matches.map((m) => m.round!));
    expect(matches.filter((m) => m.round === maxRound)).toHaveLength(1);
    if (n > 1) expect(1 << maxRound).toBe(nextPow2(n));
  });

  it("returns [] for empty input and dedupes/ignores junk ids", () => {
    expect(genKnockoutAnyN([], 0)).toEqual([]);
    const matches = genKnockoutAnyN([5, 5, NaN as any, 6], 0);
    expect(matches).toHaveLength(1); // two unique teams → one final
  });

  it("respects explicit seeds (top seed meets bottom seed in R1)", () => {
    const ids = teamIds(8);
    const seeded = ids.map((id, i) => ({ id, seed: i + 1 }));
    const matches = genKnockoutAnyN(ids, 0, seeded);
    const r1p1 = matches.find((m) => m.round === 1 && m.bracket_pos === 1)!;
    expect(r1p1.team_a_id).toBe(ids[0]); // seed 1
    expect(r1p1.team_b_id).toBe(ids[7]); // seed 8
  });

  it("ignores invalid/duplicate seeds without losing teams", () => {
    const ids = teamIds(4);
    const junkSeeds = [
      { id: ids[0], seed: 1 },
      { id: ids[1], seed: 1 }, // duplicate seed → ignored
      { id: ids[2], seed: 99 }, // out of range → ignored
      { id: 424242, seed: 2 }, // not a participant → ignored
    ];
    const matches = genKnockoutAnyN(ids, 0, junkSeeds);
    expect(matches).toHaveLength(3);
    expect(placedTeams(matches).sort((a, b) => a - b)).toEqual(ids);
  });

  it("gives byes to top seeds and shows Team-vs-TBD in the next round (N=6)", () => {
    const ids = teamIds(6);
    const seeded = ids.map((id, i) => ({ id, seed: i + 1 }));
    const matches = genKnockoutAnyN(ids, 0, seeded);

    // P=8 → seeds 1 and 2 face ghosts in R1 → no R1 match, they land in R2.
    const r1 = matches.filter((m) => m.round === 1);
    expect(r1).toHaveLength(2);
    const r1Teams = placedTeams(r1);
    expect(r1Teams).not.toContain(ids[0]);
    expect(r1Teams).not.toContain(ids[1]);

    const r2 = matches.filter((m) => m.round === 2);
    expect(r2).toHaveLength(2);
    for (const m of r2) {
      // bye team on the home side, pointer on the away side
      expect([ids[0], ids[1]]).toContain(m.team_a_id);
      expect(m.team_b_id ?? null).toBeNull();
      expect(m.away_source_round).toBe(1);
      expect((m as any).away_source_outcome).toBe("W");
    }
  });
});

describe("genKnockoutPowerOfTwo", () => {
  // Contract: power-of-two entry counts (the any-N generator handles the rest).
  it.each([2, 4, 8, 16])("N=%i builds a full bracket", (n) => {
    const ids = teamIds(n);
    const matches = genKnockoutPowerOfTwo(ids, 0);
    expect(matches).toHaveLength(n - 1);

    const coords = new Set(matches.map((m) => `${m.round}#${m.bracket_pos}`));
    expect(coords.size).toBe(n - 1);

    // R1 holds every team exactly once.
    const r1 = matches.filter((m) => m.round === 1);
    expect(r1).toHaveLength(n / 2);
    expect(placedTeams(r1).sort((a, b) => a - b)).toEqual(ids);

    // Later rounds are pointer-fed with outcome W on both sides.
    for (const m of matches.filter((m) => m.round! > 1)) {
      expect(m.home_source_outcome).toBe("W");
      expect(m.away_source_outcome).toBe("W");
      expect(m.home_source_match_idx).toBeTypeOf("number");
      expect(m.away_source_match_idx).toBeTypeOf("number");
    }
  });

  it("seeds 1 vs N and 2 vs N-1 style pairings in R1 (N=4)", () => {
    const ids = [101, 102, 103, 104]; // index order = seed order
    const [p1, p2] = genKnockoutPowerOfTwo(ids, 0).filter((m) => m.round === 1);
    expect([p1.team_a_id, p1.team_b_id]).toEqual([101, 104]); // 1 v 4
    expect([p2.team_a_id, p2.team_b_id]).toEqual([102, 103]); // 2 v 3
  });
});
