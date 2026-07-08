import { describe, it, expect } from "vitest";
import { genRoundRobin } from "../roundRobin";
import { genGroupSkeletonRoundRobin } from "../groupsIntake";

const pairKey = (a: number | null | undefined, b: number | null | undefined) => {
  const x = a ?? 0;
  const y = b ?? 0;
  return x < y ? `${x}-${y}` : `${y}-${x}`;
};

describe("genRoundRobin", () => {
  it("single round: n=4 → 6 matches over 3 matchdays, 2 per matchday", () => {
    const out = genRoundRobin({ stageIdx: 0, groupIdx: null, teamIds: [1, 2, 3, 4], repeats: 1 });
    expect(out).toHaveLength(6);
    const mds = new Map<number, number>();
    for (const m of out) {
      mds.set(m.matchday!, (mds.get(m.matchday!) ?? 0) + 1);
      expect(m.round).toBeNull();
      expect(m.bracket_pos).toBeNull();
      expect(m.is_ko).toBe(false);
    }
    expect([...mds.keys()].sort((a, b) => a - b)).toEqual([1, 2, 3]);
    for (const count of mds.values()) expect(count).toBe(2);
    // all 6 pairings exactly once
    expect(new Set(out.map((m) => pairKey(m.team_a_id, m.team_b_id))).size).toBe(6);
  });

  it("double round: second cycle mirrors the first with home/away flipped", () => {
    const out = genRoundRobin({ stageIdx: 0, groupIdx: 2, teamIds: [1, 2, 3, 4], repeats: 2 });
    expect(out).toHaveLength(12);

    const first = out.filter((m) => m.matchday! <= 3);
    const second = out.filter((m) => m.matchday! > 3);
    expect(first).toHaveLength(6);
    expect(second).toHaveLength(6);

    for (const m2 of second) {
      const mirror = first.find(
        (m1) =>
          m1.matchday! + 3 === m2.matchday! &&
          m1.team_a_id === m2.team_b_id &&
          m1.team_b_id === m2.team_a_id
      );
      expect(mirror, `matchday ${m2.matchday}: ${m2.team_a_id}v${m2.team_b_id}`).toBeTruthy();
    }
    for (const m of out) expect(m.groupIdx).toBe(2);
  });

  it("odd team count uses a bye (n=5 → 10 matches over 5 matchdays)", () => {
    const out = genRoundRobin({ stageIdx: 0, groupIdx: null, teamIds: [1, 2, 3, 4, 5], repeats: 1 });
    expect(out).toHaveLength(10);
    expect(Math.max(...out.map((m) => m.matchday!))).toBe(5);
  });

  it("clamps repeats to at least 1 and handles tiny inputs", () => {
    expect(genRoundRobin({ stageIdx: 0, groupIdx: null, teamIds: [1, 2], repeats: 0 })).toHaveLength(1);
    expect(genRoundRobin({ stageIdx: 0, groupIdx: null, teamIds: [1], repeats: 3 })).toEqual([]);
    expect(genRoundRobin({ stageIdx: 0, groupIdx: null, teamIds: [], repeats: 1 })).toEqual([]);
  });
});

describe("genGroupSkeletonRoundRobin", () => {
  it("produces the round-robin shape with null teams (slots=4, repeats=1)", () => {
    const out = genGroupSkeletonRoundRobin({ stageIdx: 1, groupIdx: 0, slotsCount: 4, repeats: 1 });
    expect(out).toHaveLength(6);
    for (const m of out) {
      expect(m.team_a_id).toBeNull();
      expect(m.team_b_id).toBeNull();
      expect(m.is_ko).toBe(false);
    }
    const perMd = new Map<number, number>();
    out.forEach((m) => perMd.set(m.matchday!, (perMd.get(m.matchday!) ?? 0) + 1));
    expect([...perMd.values()]).toEqual([2, 2, 2]);
  });

  it("repeats duplicate the base layout on later matchdays", () => {
    const out = genGroupSkeletonRoundRobin({ stageIdx: 1, groupIdx: 0, slotsCount: 4, repeats: 2 });
    expect(out).toHaveLength(12);
    expect(Math.max(...out.map((m) => m.matchday!))).toBe(6);
  });

  it("odd slot counts get a bye; fewer than 2 slots → no matches", () => {
    const odd = genGroupSkeletonRoundRobin({ stageIdx: 0, groupIdx: 0, slotsCount: 5, repeats: 1 });
    expect(odd).toHaveLength(10); // C(5,2)
    expect(genGroupSkeletonRoundRobin({ stageIdx: 0, groupIdx: 0, slotsCount: 1, repeats: 1 })).toEqual([]);
  });

  it("matches genRoundRobin's shape for the same size (skeleton = uncast fixtures)", () => {
    const skeleton = genGroupSkeletonRoundRobin({ stageIdx: 0, groupIdx: 0, slotsCount: 6, repeats: 1 });
    const real = genRoundRobin({ stageIdx: 0, groupIdx: 0, teamIds: [1, 2, 3, 4, 5, 6], repeats: 1 });
    const countByMd = (rows: { matchday?: number | null }[]) => {
      const m = new Map<number, number>();
      rows.forEach((r) => m.set(r.matchday!, (m.get(r.matchday!) ?? 0) + 1));
      return [...m.entries()].sort((a, b) => a[0] - b[0]);
    };
    expect(countByMd(skeleton)).toEqual(countByMd(real));
  });
});
