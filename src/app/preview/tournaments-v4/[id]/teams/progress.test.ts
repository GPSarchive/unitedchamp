import { describe, expect, it } from "vitest";
import type { TMatch, TTeam, Table } from "../../../tournaments-v3/[id]/model";
import { pointsRun, record, standingIn, tableWindow, teamResults } from "./progress";

const team = (id: number): TTeam => ({ id, name: `T${id}`, logo: null });

function match(id: number, a: number, b: number, score: [number, number] | null, extra: Partial<TMatch> = {}): TMatch {
  return {
    id,
    stageId: 1,
    groupId: null,
    matchday: null,
    round: null,
    bracketPos: null,
    date: `2026-11-${String(id).padStart(2, "0")}T20:00:00`,
    status: score ? "finished" : "scheduled",
    a: team(a),
    b: team(b),
    score: score ? { a: score[0], b: score[1] } : null,
    pens: null,
    winnerTeamId: null,
    leg: null,
    leg1Id: null,
    ko: false,
    sources: { a: null, b: null },
    ...extra,
  };
}

const row = (id: number, rank: number) => ({
  team: team(id),
  rank,
  played: 0,
  won: 0,
  drawn: 0,
  lost: 0,
  gf: 0,
  ga: 0,
  gd: 0,
  points: 0,
});

describe("teamResults", () => {
  it("turns each finished match to the team's side, earliest first", () => {
    const results = teamResults(
      [match(3, 2, 1, [1, 1]), match(1, 1, 2, [3, 0]), match(2, 3, 1, [2, 1]), match(4, 1, 3, null), match(5, 2, 3, [1, 0])],
      1,
    );
    expect(results.map((r) => [r.match.id, r.own, r.opp, r.outcome, r.opponent?.id])).toEqual([
      [1, 3, 0, "W", 2],
      [2, 1, 2, "L", 3],
      [3, 1, 1, "D", 2],
    ]);
    expect(record(results)).toEqual({ won: 1, drawn: 1, lost: 1 });
  });

  it("puts a match with no date after the dated ones", () => {
    const results = teamResults([match(1, 1, 2, [1, 0], { date: null }), match(2, 1, 3, [0, 1])], 1);
    expect(results.map((r) => r.match.id)).toEqual([2, 1]);
  });

  it("counts a level knockout match settled on penalties as a win or a loss", () => {
    const final = match(1, 1, 2, [2, 2], { ko: true, pens: { a: 3, b: 4 } });
    expect(teamResults([final], 1)[0]).toMatchObject({ outcome: "L", pens: { own: 3, opp: 4 } });
    expect(teamResults([final], 2)[0]).toMatchObject({ outcome: "W", pens: { own: 4, opp: 3 } });
  });
});

describe("pointsRun", () => {
  it("adds up 3, 1, 0 over the table stage's matches only", () => {
    const results = teamResults(
      [
        match(1, 1, 2, [3, 0]),
        match(2, 3, 1, [1, 1]),
        match(3, 1, 4, [0, 2]),
        match(4, 1, 5, [5, 0], { ko: true, stageId: 2 }),
        match(5, 1, 6, [2, 1]),
      ],
      1,
    );
    expect(pointsRun(results, 1)).toEqual([3, 4, 4, 7]);
    expect(pointsRun(results, 2)).toEqual([]);
  });
});

describe("standingIn and tableWindow", () => {
  const table: Table = { key: "1", groupName: null, rows: [1, 2, 3, 4, 5, 6, 7, 8].map((id, i) => row(id, i + 1)) };
  const stages = [{ stage: { id: 1, name: "S", kind: "league" as const, groups: [], advancers: null }, tables: [table] }];

  it("finds the team's row and its place", () => {
    expect(standingIn(stages, 6)).toMatchObject({ index: 5, row: { rank: 6 } });
    expect(standingIn(stages, 99)).toBeNull();
  });

  it("shows the rows around the team, pinned at the ends of the table", () => {
    const ranks = (index: number) => tableWindow(table, index).rows.map((r) => r.rank);
    expect(ranks(0)).toEqual([1, 2, 3, 4, 5]);
    expect(ranks(4)).toEqual([3, 4, 5, 6, 7]);
    expect(ranks(7)).toEqual([4, 5, 6, 7, 8]);
    expect(tableWindow({ ...table, rows: table.rows.slice(0, 3) }, 1).rows).toHaveLength(3);
  });
});
