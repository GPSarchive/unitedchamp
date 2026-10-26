import { describe, it, expect } from "vitest";
import { genRoundRobin } from "../roundRobin";
import { inferRepeats, planLateTeamFixtures, type LateFixture } from "../lateTeamFixtures";

const pairKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

const schedule = (teamIds: number[], repeats: number) =>
  genRoundRobin({ stageIdx: 0, groupIdx: 0, teamIds, repeats });

type Row = { matchday?: number | null; team_a_id?: number | null; team_b_id?: number | null };

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
  it("odd group: the late team plays the resting team on every existing matchday", () => {
    const rows = schedule([1, 2, 3, 4, 5], 1); // 5 matchdays, one team rests each
    const out = planLateTeamFixtures({ rows, newTeamIds: [9], teamIds: [1, 2, 3, 4, 5, 9], repeats: 1 });

    expect(out).toHaveLength(5);
    expect(out.every((f) => !f.appended)).toBe(true);
    expect(new Set(out.map((f) => f.opponentId))).toEqual(new Set([1, 2, 3, 4, 5]));
    expect(out.map((f) => f.matchday).sort()).toEqual([1, 2, 3, 4, 5]);
    expectNoDoubleBookings([...rows, ...out]);
  });

  it("odd group, double round: second meetings land in the second half with home/away flipped", () => {
    const rows = schedule([1, 2, 3, 4, 5], 2); // 10 matchdays
    const out = planLateTeamFixtures({ rows, newTeamIds: [9], teamIds: [1, 2, 3, 4, 5, 9], repeats: 2 });

    expect(out).toHaveLength(10);
    expect(out.every((f) => !f.appended)).toBe(true);
    for (const opp of [1, 2, 3, 4, 5]) {
      const legs = out.filter((f) => f.opponentId === opp).sort((a, b) => a.matchday - b.matchday);
      expect(legs).toHaveLength(2);
      expect(legs[0].matchday).toBeLessThanOrEqual(5);
      expect(legs[1].matchday).toBeGreaterThan(5);
      expect(legs[0].team_a_id).toBe(legs[1].team_b_id);
    }
  });

  it("even group: no free slot, so every fixture goes on new matchdays after the last one", () => {
    const rows = schedule([1, 2, 3, 4], 1); // 3 matchdays, nobody rests
    const out = planLateTeamFixtures({ rows, newTeamIds: [9], teamIds: [1, 2, 3, 4, 9], repeats: 1 });

    expect(out).toHaveLength(4);
    expect(out.every((f) => f.appended)).toBe(true);
    expect(out.map((f) => f.matchday).sort()).toEqual([4, 5, 6, 7]);
    expectNoDoubleBookings([...rows, ...out]);
  });

  it("never uses a played matchday, even when the resting team is free there", () => {
    const rows = schedule([1, 2, 3, 4, 5], 1).map((m) => ({
      ...m,
      status: m.matchday! <= 2 ? "finished" : "scheduled",
    }));
    const out = planLateTeamFixtures({ rows, newTeamIds: [9], teamIds: [1, 2, 3, 4, 5, 9], repeats: 1 });

    expect(out).toHaveLength(5);
    expect(out.some((f) => f.matchday <= 2)).toBe(false);
    expect(out.filter((f) => !f.appended).map((f) => f.matchday).sort()).toEqual([3, 4, 5]);
    expect(out.filter((f) => f.appended).map((f) => f.matchday).sort()).toEqual([6, 7]);
    expectNoDoubleBookings([...rows, ...out]);
  });

  it("two late teams in a played 14-team league (tournament 65): they meet on the next open matchday, the rest is appended", () => {
    const existing = Array.from({ length: 14 }, (_, i) => 190 + i);
    const rows = schedule(existing, 1).map((m) => ({
      ...m,
      status: m.matchday === 1 ? "finished" : "scheduled",
    }));
    const out = planLateTeamFixtures({
      rows,
      newTeamIds: [211, 212],
      teamIds: [...existing, 211, 212],
      repeats: 1,
    });

    expect(out).toHaveLength(29);
    // Both newcomers are idle on the existing matchdays, so their mutual match
    // takes the first unplayed one (matchday 1 is played).
    const mutual = out.filter((f) => !f.appended);
    expect(mutual).toHaveLength(1);
    expect(pairKey(mutual[0].team_a_id, mutual[0].team_b_id)).toBe("211-212");
    expect(mutual[0].matchday).toBe(2);
    expect(new Set(out.filter((f) => f.appended).map((f) => f.matchday))).toEqual(
      new Set(Array.from({ length: 14 }, (_, i) => 14 + i))
    );
    expectNoDoubleBookings([...rows, ...out]);
    const keys = out.map((f) => pairKey(f.team_a_id, f.team_b_id));
    expect(new Set(keys).size).toBe(29);
  });

  it("never touches or duplicates existing pairs, and is idempotent", () => {
    const rows: Row[] = [
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
    expectNoDoubleBookings([...rows, ...out]);
  });

  it("double round with no free slots: return meetings come after the first ones", () => {
    const rows = schedule([1, 2, 3, 4], 2); // 6 matchdays, nobody rests
    const out = planLateTeamFixtures({ rows, newTeamIds: [9], teamIds: [1, 2, 3, 4, 9], repeats: 2 });

    expect(out).toHaveLength(8);
    expectNoDoubleBookings([...rows, ...out]);
    for (const opp of [1, 2, 3, 4]) {
      const legs = out.filter((f) => f.opponentId === opp).sort((a, b) => a.matchday - b.matchday);
      expect(legs[0].matchday).toBeLessThan(legs[1].matchday);
      expect(legs[0].team_a_id).toBe(legs[1].team_b_id);
    }
  });

  it("balances home and away for the late team", () => {
    const rows = schedule([1, 2, 3, 4, 5, 6, 7], 1);
    const out = planLateTeamFixtures({ rows, newTeamIds: [9], teamIds: [1, 2, 3, 4, 5, 6, 7, 9], repeats: 1 });
    const home = out.filter((f: LateFixture) => f.team_a_id === 9).length;
    expect(Math.abs(home - (out.length - home))).toBeLessThanOrEqual(1);
  });

  it("ignores TBD rows and starts at matchday 1 when there is no schedule", () => {
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
