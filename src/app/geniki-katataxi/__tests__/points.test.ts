import { describe, it, expect } from "vitest";
import { POINTS, automaticSourceKey, makeCancelTag, NO_SEASON_LABEL } from "../rules";
import {
  computeStandingsFromInputs,
  type MatchRow,
  type StandingsInputs,
} from "../engine";

const S1 = "2025-2026";
const S0 = "2024-2025";

function match(over: Partial<MatchRow> & { tournament_id: number | null }): MatchRow {
  return {
    stage_id: null,
    team_a_id: null,
    team_b_id: null,
    team_a_score: null,
    team_b_score: null,
    winner_team_id: null,
    status: "finished",
    round: null,
    bracket_pos: null,
    leg: null,
    match_date: null,
    ...over,
  };
}

/**
 * Season 2025-2026: tournament 1 (league stage 100 → knockout stage 101, won by
 * team 10 over team 11 in the final) and tournament 3 (scheduled, never started).
 * Season 2024-2025: tournament 2 (one league match).
 * Adjustments: a withdrawal for team 12, and a counter-adjustment cancelling
 * team 10's title.
 */
function fixture(): StandingsInputs {
  return {
    tournaments: [
      { id: 1, name: "Winter Cup", season: S1, status: "completed", winner_team_id: 10, start_date: "2025-11-01" },
      { id: 2, name: "Old League", season: S0, status: "running", winner_team_id: null, start_date: null },
      { id: 3, name: "Not started", season: S1, status: "scheduled", winner_team_id: null, start_date: null },
    ],
    stages: [
      { id: 100, tournament_id: 1, kind: "league", ordering: 1 },
      { id: 101, tournament_id: 1, kind: "knockout", ordering: 2 },
      { id: 200, tournament_id: 2, kind: "league", ordering: 1 },
      { id: 300, tournament_id: 3, kind: "league", ordering: 1 },
    ],
    participations: [
      { tournament_id: 1, team_id: 10, stage_id: 100 },
      { tournament_id: 1, team_id: 11, stage_id: 100 },
      { tournament_id: 1, team_id: 12, stage_id: 100 },
      { tournament_id: 1, team_id: 10, stage_id: 101 },
      { tournament_id: 1, team_id: 11, stage_id: 101 },
      { tournament_id: 2, team_id: 20, stage_id: 200 },
      { tournament_id: 2, team_id: 21, stage_id: 200 },
      { tournament_id: 3, team_id: 30, stage_id: 300 },
    ],
    matches: [
      match({ tournament_id: 1, stage_id: 100, team_a_id: 10, team_b_id: 11, team_a_score: 2, team_b_score: 1, winner_team_id: 10, match_date: "2025-11-05" }),
      match({ tournament_id: 1, stage_id: 100, team_a_id: 11, team_b_id: 12, team_a_score: 1, team_b_score: 1, match_date: "2025-11-06" }),
      match({ tournament_id: 1, stage_id: 100, team_a_id: 10, team_b_id: 12, status: "scheduled" }),
      match({ tournament_id: 1, stage_id: 101, round: 1, bracket_pos: 1, team_a_id: 10, team_b_id: 11, team_a_score: 3, team_b_score: 0, winner_team_id: 10, match_date: "2025-12-01" }),
      match({ tournament_id: 2, stage_id: 200, team_a_id: 20, team_b_id: 21, team_a_score: 0, team_b_score: 2, winner_team_id: 21, match_date: "2025-03-01" }),
      // A match with no tournament belongs to no season and is ignored.
      match({ tournament_id: null, team_a_id: 10, team_b_id: 11, team_a_score: 9, team_b_score: 0 }),
    ],
    adjustments: [
      { id: 1, season: S1, team_id: 12, kind: "withdrawal", points: POINTS.withdrawal, reason: null },
      {
        id: 2,
        season: S1,
        team_id: 10,
        kind: "other",
        points: -POINTS.tournamentWinner,
        reason: "Ακύρωση " + makeCancelTag(automaticSourceKey(S1, 10, "title", 1)),
      },
    ],
    adjustmentsAvailable: true,
  };
}

const lineOf = (s: ReturnType<typeof computeStandingsFromInputs>, season: string, teamId: number) =>
  s.bySeason.get(season)!.find((l) => l.teamId === teamId)!;

describe("computeStandingsFromInputs", () => {
  it("lists seasons newest first and only from tournaments that started", () => {
    const s = computeStandingsFromInputs(fixture());
    expect(s.seasons).toEqual([S1, S0]);
    // Tournament 3 never started: team 30 earns nothing, not even participation.
    expect(s.bySeason.get(S1)!.some((l) => l.teamId === 30)).toBe(false);
    expect(s.adjustmentsAvailable).toBe(true);
  });

  it("awards participation, qualification, results, title and runner-up per the rules", () => {
    const s = computeStandingsFromInputs(fixture());
    const t10 = lineOf(s, S1, 10);
    const t11 = lineOf(s, S1, 11);
    const t12 = lineOf(s, S1, 12);

    // Team 10: 1 participation, entered 2 stages (1 advance), 2 wins, the title,
    // and the -500 counter-adjustment.
    expect(t10).toMatchObject({ participations: 1, qualifications: 1, wins: 2, draws: 0, losses: 0, titles: 1, runnerUps: 0, adjustmentPoints: -500, adjustmentCount: 1 });
    expect(t10.points).toBe(50 + 50 + 2 * 15 + 500 - 500);

    // Team 11: lost the final → runner-up; 1 draw, 2 losses, 1 advance.
    expect(t11).toMatchObject({ participations: 1, qualifications: 1, wins: 0, draws: 1, losses: 2, titles: 0, runnerUps: 1, adjustmentCount: 0 });
    expect(t11.points).toBe(50 + 50 + 5 - 20 + 200);

    // Team 12: one stage only, one draw, the withdrawal.
    expect(t12).toMatchObject({ participations: 1, qualifications: 0, draws: 1, adjustmentPoints: -100 });
    expect(t12.points).toBe(50 + 5 - 100);

    // Sorted by points desc.
    expect(s.bySeason.get(S1)!.map((l) => l.teamId)).toEqual([11, 10, 12]);
  });

  it("scores the other season independently", () => {
    const s = computeStandingsFromInputs(fixture());
    expect(lineOf(s, S0, 21).points).toBe(50 + 15);
    expect(lineOf(s, S0, 20).points).toBe(50 - 10);
  });

  it("pairs a counter-adjustment with the automatic event it cancels", () => {
    const s = computeStandingsFromInputs(fixture());
    const title = s.events.find((e) => e.kind === "title" && e.teamId === 10)!;
    expect(title.sourceKey).toBe(automaticSourceKey(S1, 10, "title", 1));
    expect(title.cancelledBy).toBe(2);
    const counter = s.events.find((e) => e.adjustmentId === 2)!;
    expect(counter.cancelsSourceKey).toBe(title.sourceKey);
    const plain = s.events.find((e) => e.adjustmentId === 1)!;
    expect(plain.cancelsSourceKey).toBeUndefined();
    expect(plain.label).toBe("Αποχώρηση από τουρνουά");
  });

  it("dates the title with the final and expands W/D/L into per-match details", () => {
    const s = computeStandingsFromInputs(fixture());
    const title = s.events.find((e) => e.kind === "title" && e.teamId === 10)!;
    expect(title.date).toBe("2025-12-01");
    expect(title.matches).toEqual([{ date: "2025-12-01", opponentId: 11, goalsFor: 3, goalsAgainst: 0 }]);
    const wins = s.events.find((e) => e.kind === "win" && e.teamId === 10)!;
    expect(wins.count).toBe(2);
    expect(wins.date).toBe("2025-11-05");
    expect(wins.matches!.map((m) => m.date)).toEqual(["2025-11-05", "2025-12-01"]);
  });

  it("seasonScope keeps exactly one season — lines, events and the season list", () => {
    const s = computeStandingsFromInputs(fixture(), S0);
    expect(s.seasons).toEqual([S0]);
    expect([...s.bySeason.keys()]).toEqual([S0]);
    expect(s.events.every((e) => e.season === S0)).toBe(true);
    // Adjustments of the other season are skipped too.
    expect(s.events.some((e) => e.kind === "adjustment")).toBe(false);
    // Same numbers as the unscoped compute for that season.
    const full = computeStandingsFromInputs(fixture());
    expect(s.bySeason.get(S0)).toEqual(full.bySeason.get(S0));
  });

  it("uses the ASSIGNED season label, never a date: a blank label is 'no season'", () => {
    const f = fixture();
    f.tournaments[1].season = "   ";
    const s = computeStandingsFromInputs(f);
    expect(s.seasons).toEqual([S1, NO_SEASON_LABEL]);
    expect(s.bySeason.get(NO_SEASON_LABEL)!.map((l) => l.teamId).sort()).toEqual([20, 21]);
  });

  it("treats a forfeit (winner without scores) as a win and a level leg as a draw", () => {
    const f = fixture();
    f.matches.push(
      match({ tournament_id: 2, stage_id: 200, team_a_id: 20, team_b_id: 21, winner_team_id: 20 }),
      match({ tournament_id: 2, stage_id: 200, team_a_id: 20, team_b_id: 21, team_a_score: 1, team_b_score: 1, winner_team_id: 21, leg: 2 }),
    );
    const s = computeStandingsFromInputs(fixture());
    const t = computeStandingsFromInputs(f);
    expect(lineOf(t, S0, 20).wins).toBe(lineOf(s, S0, 20).wins + 1);
    expect(lineOf(t, S0, 20).draws).toBe(1);
    expect(lineOf(t, S0, 21).draws).toBe(1);
  });
});
