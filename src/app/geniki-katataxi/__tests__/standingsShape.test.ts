import { describe, it, expect } from "vitest";
import type { PointsEvent, TeamSeasonLine } from "../rules";
import {
  lineFromStoredRow,
  rankLines,
  storedRowFromLine,
  teamSeasonExtras,
  type SeasonStandingRow,
} from "../standingsShape";

function line(teamId: number, points: number, wins = 0): TeamSeasonLine {
  return {
    teamId,
    participations: 1,
    qualifications: 0,
    titles: 0,
    runnerUps: 0,
    wins,
    draws: 0,
    losses: 0,
    adjustmentPoints: 0,
    adjustmentCount: 0,
    points,
  };
}

function ev(
  kind: "win" | "draw" | "loss",
  matches: Array<[string | null, number | null, number | null]>,
): PointsEvent {
  return {
    season: "2025-2026",
    teamId: 1,
    kind,
    count: matches.length,
    points: 0,
    label: "T",
    matches: matches.map(([date, goalsFor, goalsAgainst]) => ({
      date,
      opponentId: 2,
      goalsFor,
      goalsAgainst,
    })),
  };
}

describe("rankLines", () => {
  it("dense-ranks by points: ties share a rank, the next distinct total gets rank+1", () => {
    const out = rankLines([line(1, 100), line(2, 100), line(3, 90), line(4, 90), line(5, 10)]);
    expect(out.map((l) => [l.teamId, l.rank])).toEqual([
      [1, 1],
      [2, 1],
      [3, 2],
      [4, 2],
      [5, 3],
    ]);
  });

  it("sorts a copy: points desc, wins desc, team id asc — input untouched", () => {
    const input = [line(9, 50, 1), line(3, 50, 2), line(1, 50, 2), line(7, 80)];
    const out = rankLines(input);
    expect(out.map((l) => l.teamId)).toEqual([7, 1, 3, 9]);
    expect(input.map((l) => l.teamId)).toEqual([9, 3, 1, 7]);
  });

  it("handles an empty season", () => {
    expect(rankLines([])).toEqual([]);
  });
});

describe("teamSeasonExtras", () => {
  it("sums GF/GA, counts clean sheets, and finds the longest win streak in date order", () => {
    const events = [
      // deliberately out of order across events: the streak must follow dates
      ev("loss", [["2026-02-01", 0, 2]]),
      ev("win", [
        ["2026-01-10", 3, 0],
        ["2026-01-20", 2, 1],
        ["2026-03-01", 1, 0],
        ["2026-03-08", 4, 0],
        ["2026-03-15", 2, 1],
      ]),
      ev("draw", [["2026-01-15", 1, 1]]),
    ];
    const x = teamSeasonExtras(events);
    // chronological: W(3-0) D(1-1) W(2-1) L(0-2) W(1-0) W(4-0) W(2-1)
    expect(x.matches_played).toBe(7);
    expect(x.goals_for).toBe(3 + 1 + 2 + 0 + 1 + 4 + 2);
    expect(x.goals_against).toBe(0 + 1 + 1 + 2 + 0 + 0 + 1);
    expect(x.clean_sheets).toBe(3);
    expect(x.longest_win_streak).toBe(3);
  });

  it("a forfeit win without a score counts as played and extends the streak but not GF/GA or clean sheets", () => {
    const x = teamSeasonExtras([
      ev("win", [
        ["2026-01-01", 2, 0],
        ["2026-01-08", null, null],
      ]),
    ]);
    expect(x).toEqual({
      matches_played: 2,
      goals_for: 2,
      goals_against: 0,
      clean_sheets: 1,
      longest_win_streak: 2,
    });
  });

  it("ignores non-result events and undated matches sort last", () => {
    const participation: PointsEvent = {
      season: "2025-2026",
      teamId: 1,
      kind: "participation",
      count: 1,
      points: 50,
      label: "T",
    };
    const x = teamSeasonExtras([
      participation,
      ev("loss", [[null, 0, 1]]),
      ev("win", [["2026-01-01", 1, 0]]),
    ]);
    expect(x.matches_played).toBe(2);
    expect(x.longest_win_streak).toBe(1);
  });

  it("no result events → all zeros", () => {
    expect(teamSeasonExtras([])).toEqual({
      matches_played: 0,
      goals_for: 0,
      goals_against: 0,
      clean_sheets: 0,
      longest_win_streak: 0,
    });
  });
});

describe("stored row ↔ engine line", () => {
  it("round-trips a ranked line through the stored shape", () => {
    const ranked = rankLines([line(4, 120, 5)])[0];
    const events = [ev("win", [["2026-01-01", 2, 0]])];
    const stored = storedRowFromLine("2025-2026", ranked, events);
    expect(stored).toMatchObject({
      season_label: "2025-2026",
      team_id: 4,
      rank: 1,
      points: 120,
      wins: 5,
      matches_played: 1,
      goals_for: 2,
      clean_sheets: 1,
      longest_win_streak: 1,
    });
    const row: SeasonStandingRow = { ...stored, refreshed_at: "2026-09-04T00:00:00Z" };
    const back = lineFromStoredRow(row);
    const { rank: _rank, ...withoutRank } = ranked;
    expect(back).toEqual(withoutRank);
  });
});
