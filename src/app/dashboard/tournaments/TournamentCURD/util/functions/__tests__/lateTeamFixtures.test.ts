import { describe, it, expect } from "vitest";
import { genRoundRobin } from "../roundRobin";
import { inferRepeats, planLateTeamFixtures } from "../lateTeamFixtures";

const pairKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

const schedule = (teamIds: number[], repeats: number) =>
  genRoundRobin({ stageIdx: 0, groupIdx: 0, teamIds, repeats });

/** Teams playing on each matchday of a schedule (rows + planned fixtures). */
function playingByMatchday(rows: Array<{ matchday?: number | null; team_a_id?: number | null; team_b_id?: number | null }>) {
  const by = new Map<number, number[]>();
  for (const r of rows) {
    const list = by.get(r.matchday!) ?? [];
    list.push(r.team_a_id!, r.team_b_id!);
    by.set(r.matchday!, list);
  }
  return by;
}

describe("planLateTeamFixtures", () => {
  it("odd group: the late team plays the resting team on every existing matchday", () => {
    const rows = schedule([1, 2, 3, 4, 5], 1); // 5 matchdays, one team rests each
    const out = planLateTeamFixtures({ rows, newTeamIds: [9], teamIds: [1, 2, 3, 4, 5, 9], repeats: 1 });

    expect(out).toHaveLength(5);
    expect(out.every((f) => !f.shared)).toBe(true);
    expect(new Set(out.map((f) => f.opponentId))).toEqual(new Set([1, 2, 3, 4, 5]));
    expect(out.map((f) => f.matchday).sort()).toEqual([1, 2, 3, 4, 5]);

    // After merging, every team plays exactly once per matchday.
    for (const teams of playingByMatchday([...rows, ...out]).values()) {
      expect(teams).toHaveLength(6);
      expect(new Set(teams).size).toBe(6);
    }
  });

  it("odd group, double round: second meetings land in the second half with home/away flipped", () => {
    const rows = schedule([1, 2, 3, 4, 5], 2); // 10 matchdays
    const out = planLateTeamFixtures({ rows, newTeamIds: [9], teamIds: [1, 2, 3, 4, 5, 9], repeats: 2 });

    expect(out).toHaveLength(10);
    expect(out.every((f) => !f.shared)).toBe(true);
    for (const opp of [1, 2, 3, 4, 5]) {
      const legs = out.filter((f) => f.opponentId === opp).sort((a, b) => a.matchday - b.matchday);
      expect(legs).toHaveLength(2);
      expect(legs[0].matchday).toBeLessThanOrEqual(5);
      expect(legs[1].matchday).toBeGreaterThan(5);
      expect(legs[0].team_a_id).toBe(legs[1].team_b_id);
    }
  });

  it("even group: fixtures go on existing matchdays as extra games", () => {
    const rows = schedule([1, 2, 3, 4], 1); // 3 matchdays, nobody rests
    const out = planLateTeamFixtures({ rows, newTeamIds: [9], teamIds: [1, 2, 3, 4, 9], repeats: 1 });

    expect(out).toHaveLength(4);
    expect(new Set(out.map((f) => f.opponentId))).toEqual(new Set([1, 2, 3, 4]));
    expect(out.every((f) => [1, 2, 3].includes(f.matchday))).toBe(true);
    expect(out.every((f) => f.shared)).toBe(true);
    // Spread out: the late team plays at most twice on any matchday.
    const perMd = new Map<number, number>();
    out.forEach((f) => perMd.set(f.matchday, (perMd.get(f.matchday) ?? 0) + 1));
    expect(Math.max(...perMd.values())).toBe(2);
  });

  it("never touches or duplicates existing pairs, and is idempotent", () => {
    const rows = [
      ...schedule([1, 2, 3, 4, 5], 1),
      { matchday: 2, team_a_id: 9, team_b_id: 3 }, // admin already added one by hand
    ];
    const out = planLateTeamFixtures({ rows, newTeamIds: [9], teamIds: [1, 2, 3, 4, 5, 9], repeats: 1 });
    expect(out.map((f) => f.opponentId).sort()).toEqual([1, 2, 4, 5]);

    const again = planLateTeamFixtures({
      rows: [...rows, ...out],
      newTeamIds: [9],
      teamIds: [1, 2, 3, 4, 5, 9],
      repeats: 1,
    });
    expect(again).toEqual([]);
  });

  it("two late teams meet each other exactly once", () => {
    const rows = schedule([1, 2, 3, 4, 5], 1);
    const out = planLateTeamFixtures({ rows, newTeamIds: [8, 9], teamIds: [1, 2, 3, 4, 5, 8, 9], repeats: 1 });

    const keys = out.map((f) => pairKey(f.team_a_id, f.team_b_id));
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.filter((k) => k === "8-9")).toHaveLength(1);
    expect(out).toHaveLength(5 + 5 + 1);
  });

  it("balances home and away for the late team", () => {
    const rows = schedule([1, 2, 3, 4, 5, 6, 7], 1);
    const out = planLateTeamFixtures({ rows, newTeamIds: [9], teamIds: [1, 2, 3, 4, 5, 6, 7, 9], repeats: 1 });
    const home = out.filter((f) => f.team_a_id === 9).length;
    expect(Math.abs(home - (out.length - home))).toBeLessThanOrEqual(1);
  });

  it("ignores TBD rows and falls back to fresh matchdays when there is no schedule", () => {
    const out = planLateTeamFixtures({
      rows: [{ matchday: null, team_a_id: null, team_b_id: null }],
      newTeamIds: [9],
      teamIds: [1, 2, 9],
      repeats: 1,
    });
    expect(out.map((f) => f.matchday)).toEqual([1, 2]);
  });
});

describe("inferRepeats", () => {
  it("reads meetings per pair from the schedule", () => {
    expect(inferRepeats(schedule([1, 2, 3, 4], 1))).toBe(1);
    expect(inferRepeats(schedule([1, 2, 3, 4], 2))).toBe(2);
    expect(inferRepeats([{ matchday: 1, team_a_id: null, team_b_id: 2 }])).toBe(0);
  });
});
