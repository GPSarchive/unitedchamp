import { describe, it, expect } from "vitest";
import { genRoundRobin } from "../roundRobin";
import { inferRepeats, planLateTeamFixtures, type LatePlan } from "../lateTeamFixtures";

const pairKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

type Row = {
  matchday?: number | null;
  team_a_id?: number | null;
  team_b_id?: number | null;
  status?: string | null;
  match_date?: string | null;
};

const schedule = (teamIds: number[], repeats: number): Row[] =>
  genRoundRobin({ stageIdx: 0, groupIdx: 0, teamIds, repeats });

/** Existing rows with the plan's moves applied, plus the new fixtures. */
function applyPlan(rows: Row[], plan: LatePlan): Row[] {
  const moved = new Map(plan.moves.map((m) => [m.rowIndex, m.to]));
  return [
    ...rows.map((r, i) => (moved.has(i) ? { ...r, matchday: moved.get(i)! } : r)),
    ...plan.fixtures,
  ];
}

/** Every team plays at most once per matchday. */
function expectNoDoubleBookings(rows: Row[]) {
  const seen = new Set<string>();
  for (const r of rows) {
    for (const team of [r.team_a_id, r.team_b_id]) {
      const k = `${r.matchday}|${team}`;
      expect(seen.has(k), `team ${team} twice on matchday ${r.matchday}`).toBe(false);
      seen.add(k);
    }
  }
}

describe("planLateTeamFixtures", () => {
  it("odd group: the late team plays the resting team on every matchday, nothing moves", () => {
    const rows = schedule([1, 2, 3, 4, 5], 1); // 5 matchdays, one team rests each
    const plan = planLateTeamFixtures({ rows, newTeamIds: [9], teamIds: [1, 2, 3, 4, 5, 9], repeats: 1 });

    expect(plan.fixtures).toHaveLength(5);
    expect(plan.moves).toEqual([]);
    expect(plan.newMatchdays).toEqual([]);
    expect(plan.fixtures.map((f) => f.matchday).sort()).toEqual([1, 2, 3, 4, 5]);
    expectNoDoubleBookings(applyPlan(rows, plan));
  });

  it("odd group, double round: second meetings land in the second half with home/away flipped", () => {
    const rows = schedule([1, 2, 3, 4, 5], 2); // 10 matchdays
    const plan = planLateTeamFixtures({ rows, newTeamIds: [9], teamIds: [1, 2, 3, 4, 5, 9], repeats: 2 });

    expect(plan.fixtures).toHaveLength(10);
    expect(plan.moves).toEqual([]);
    for (const opp of [1, 2, 3, 4, 5]) {
      const legs = plan.fixtures.filter((f) => f.opponentId === opp).sort((a, b) => a.matchday - b.matchday);
      expect(legs).toHaveLength(2);
      expect(legs[0].matchday).toBeLessThanOrEqual(5);
      expect(legs[1].matchday).toBeGreaterThan(5);
      expect(legs[0].team_a_id).toBe(legs[1].team_b_id);
    }
  });

  it("even group: swaps the late team into each matchday and appends the moved matches", () => {
    const rows = schedule([1, 2, 3, 4], 1); // 3 matchdays, nobody rests
    const plan = planLateTeamFixtures({ rows, newTeamIds: [9], teamIds: [1, 2, 3, 4, 9], repeats: 1 });

    expect(plan.fixtures).toHaveLength(4);
    expect(plan.moves.length).toBeGreaterThan(0);
    // 5 teams need 5 matchdays: the 3 existing ones + 2 new (vs 4 new without swaps).
    expect(plan.newMatchdays).toEqual([4, 5]);
    const after = applyPlan(rows, plan);
    expectNoDoubleBookings(after);
    // still a complete round robin: every pair exactly once
    const keys = after.map((r) => pairKey(r.team_a_id!, r.team_b_id!));
    expect(new Set(keys).size).toBe(10);
    expect(keys).toHaveLength(10);
  });

  it("never touches played matchdays: no new games there and nothing moved from them", () => {
    const rows = schedule([1, 2, 3, 4], 1).map((m) => ({
      ...m,
      status: m.matchday === 1 ? "finished" : "scheduled",
    }));
    const plan = planLateTeamFixtures({ rows, newTeamIds: [9], teamIds: [1, 2, 3, 4, 9], repeats: 1 });

    expect(plan.fixtures.some((f) => f.matchday === 1)).toBe(false);
    expect(plan.moves.every((m) => m.from !== 1)).toBe(true);
    expectNoDoubleBookings(applyPlan(rows, plan));
  });

  it("never moves a match off a matchday that has dates (free slots there are still used)", () => {
    const rows = schedule([1, 2, 3, 4, 5], 1).map((m) => ({
      ...m,
      match_date: m.matchday === 2 ? "2026-11-01T10:00:00Z" : null,
    }));
    const plan = planLateTeamFixtures({ rows, newTeamIds: [8, 9], teamIds: [1, 2, 3, 4, 5, 8, 9], repeats: 1 });

    expect(plan.moves.every((m) => m.from !== 2)).toBe(true);
    expectNoDoubleBookings(applyPlan(rows, plan));
  });

  it("tournament 65: two late teams in a 14-team league with matchday 1 played and matchday 2 dated", () => {
    const existing = Array.from({ length: 14 }, (_, i) => 190 + i);
    const rows = schedule(existing, 1).map((m) => ({
      ...m,
      status: m.matchday === 1 ? "finished" : "scheduled",
      match_date: m.matchday === 2 ? "2026-11-01T10:00:00Z" : null,
    }));
    const plan = planLateTeamFixtures({ rows, newTeamIds: [211, 212], teamIds: [...existing, 211, 212], repeats: 1 });

    expect(plan.fixtures).toHaveLength(29);
    // the newcomers meet on matchday 2 (dated, so nothing moves there)
    const mutual = plan.fixtures.find((f) => pairKey(f.team_a_id, f.team_b_id) === "211-212")!;
    expect(mutual.matchday).toBe(2);
    // matchdays 3–13 each give up one match; 3 new matchdays at the end
    expect(plan.moves.map((m) => m.from).sort((a, b) => a - b)).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    expect(plan.newMatchdays).toEqual([14, 15, 16]);

    const after = applyPlan(rows, plan);
    expectNoDoubleBookings(after);
    // all 16 teams play on every matchday 3–13
    for (let md = 3; md <= 13; md++) expect(after.filter((r) => r.matchday === md)).toHaveLength(8);
    // complete 16-team round robin, nothing lost
    const keys = after.map((r) => pairKey(r.team_a_id!, r.team_b_id!));
    expect(keys).toHaveLength(120);
    expect(new Set(keys).size).toBe(120);
  });

  it("is deterministic", () => {
    const existing = Array.from({ length: 14 }, (_, i) => 190 + i);
    const rows = schedule(existing, 1);
    const run = () =>
      planLateTeamFixtures({ rows, newTeamIds: [211, 212], teamIds: [...existing, 211, 212], repeats: 1 });
    expect(run()).toEqual(run());
  });

  it("never touches or duplicates existing pairs, and is idempotent", () => {
    const rows: Row[] = [
      ...schedule([1, 2, 3, 4, 5], 1),
      { matchday: 2, team_a_id: 9, team_b_id: 3 }, // admin already added one by hand
    ];
    const plan = planLateTeamFixtures({ rows, newTeamIds: [9], teamIds: [1, 2, 3, 4, 5, 9], repeats: 1 });
    expect(plan.fixtures.map((f) => f.opponentId).sort()).toEqual([1, 2, 4, 5]);

    const again = planLateTeamFixtures({
      rows: applyPlan(rows, plan),
      newTeamIds: [9],
      teamIds: [1, 2, 3, 4, 5, 9],
      repeats: 1,
    });
    expect(again.fixtures).toEqual([]);
    expect(again.moves).toEqual([]);
  });

  it("two late teams meet each other exactly once", () => {
    const rows = schedule([1, 2, 3, 4, 5], 1);
    const plan = planLateTeamFixtures({ rows, newTeamIds: [8, 9], teamIds: [1, 2, 3, 4, 5, 8, 9], repeats: 1 });

    const keys = plan.fixtures.map((f) => pairKey(f.team_a_id, f.team_b_id));
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.filter((k) => k === "8-9")).toHaveLength(1);
    expect(plan.fixtures).toHaveLength(5 + 5 + 1);
    expectNoDoubleBookings(applyPlan(rows, plan));
  });

  it("double round: a moved match is always the last meeting of its pair", () => {
    const rows = schedule([1, 2, 3, 4], 2); // 6 matchdays, nobody rests
    const plan = planLateTeamFixtures({ rows, newTeamIds: [9], teamIds: [1, 2, 3, 4, 9], repeats: 2 });

    expect(plan.fixtures).toHaveLength(8);
    const after = applyPlan(rows, plan);
    expectNoDoubleBookings(after);
    for (const m of plan.moves) {
      const r = rows[m.rowIndex];
      const k = pairKey(r.team_a_id!, r.team_b_id!);
      const others = rows.filter((x, i) => i !== m.rowIndex && pairKey(x.team_a_id!, x.team_b_id!) === k);
      for (const o of others) expect(o.matchday!).toBeLessThan(m.from);
    }
    for (const opp of [1, 2, 3, 4]) {
      const legs = plan.fixtures.filter((f) => f.opponentId === opp).sort((a, b) => a.matchday - b.matchday);
      expect(legs[0].matchday).toBeLessThan(legs[1].matchday);
      expect(legs[0].team_a_id).toBe(legs[1].team_b_id);
    }
  });

  it("balances home and away for the late team", () => {
    const rows = schedule([1, 2, 3, 4, 5, 6, 7], 1);
    const plan = planLateTeamFixtures({ rows, newTeamIds: [9], teamIds: [1, 2, 3, 4, 5, 6, 7, 9], repeats: 1 });
    const home = plan.fixtures.filter((f) => f.team_a_id === 9).length;
    expect(Math.abs(home - (plan.fixtures.length - home))).toBeLessThanOrEqual(1);
  });

  it("ignores TBD rows and starts at matchday 1 when there is no schedule", () => {
    const plan = planLateTeamFixtures({
      rows: [{ matchday: null, team_a_id: null, team_b_id: null }],
      newTeamIds: [9],
      teamIds: [1, 2, 9],
      repeats: 1,
    });
    expect(plan.fixtures.map((f) => f.matchday).sort()).toEqual([1, 2]);
    expect(plan.moves).toEqual([]);
  });
});

describe("inferRepeats", () => {
  it("reads meetings per pair from the schedule", () => {
    expect(inferRepeats(schedule([1, 2, 3, 4], 1))).toBe(1);
    expect(inferRepeats(schedule([1, 2, 3, 4], 2))).toBe(2);
    expect(inferRepeats([{ matchday: 1, team_a_id: null, team_b_id: 2 }])).toBe(0);
  });
});
