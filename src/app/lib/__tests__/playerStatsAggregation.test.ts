import { describe, it, expect } from "vitest";
import {
  aggregateCareerBuckets,
  aggregateTournamentBuckets,
  aggregateLegacyTotals,
  chunk,
  type MpsRow,
} from "../playerStatsAggregation";

function row(partial: Partial<MpsRow> & Pick<MpsRow, "player_id" | "match_id" | "team_id">): MpsRow {
  return {
    goals: 0,
    assists: 0,
    yellow_cards: 0,
    red_cards: 0,
    blue_cards: 0,
    mvp: false,
    best_goalkeeper: false,
    ...partial,
  };
}

describe("chunk", () => {
  it("splits into fixed-size pieces with a short tail", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 2)).toEqual([]);
  });
});

describe("aggregateCareerBuckets", () => {
  it("sums stats, counts mvp/gk flags, and treats null stat fields as zero", () => {
    const rows = [
      row({ player_id: 1, match_id: 10, team_id: 100, goals: 2, assists: 1, mvp: true }),
      row({
        player_id: 1,
        match_id: 11,
        team_id: 100,
        goals: null,
        assists: null,
        yellow_cards: null,
        red_cards: null,
        blue_cards: null,
        mvp: null,
        best_goalkeeper: true,
      }),
    ];
    const out = aggregateCareerBuckets(rows, new Map());
    expect(out.get(1)).toEqual({
      total_matches: 2,
      total_goals: 2,
      total_assists: 1,
      total_yellow_cards: 0,
      total_red_cards: 0,
      total_blue_cards: 0,
      total_mvp: 1,
      total_best_gk: 1,
      total_wins: 0,
      primary_team_id: 100,
    });
  });

  it("credits a win only when the row's team matches the match winner", () => {
    const winners = new Map<number, number | null>([
      [10, 100], // team 100 won match 10
      [11, null], // draw / no winner
    ]);
    const rows = [
      row({ player_id: 1, match_id: 10, team_id: 100 }), // winner side
      row({ player_id: 2, match_id: 10, team_id: 200 }), // loser side
      row({ player_id: 1, match_id: 11, team_id: 100 }), // draw
    ];
    const out = aggregateCareerBuckets(rows, winners);
    expect(out.get(1)!.total_wins).toBe(1);
    expect(out.get(2)!.total_wins).toBe(0);
  });

  it("two-legged tie: leg 1 (winner null) credits nothing, the decider credits exactly one win", () => {
    // Model as stamped by resolveKoFinishPatch: leg 1 keeps winner_team_id
    // null even for a decisive on-the-night result; the tie winner is stamped
    // only on the leg-2 decider.
    const winners = new Map<number, number | null>([
      [20, null], // leg 1: team 100 won 3-0 on the night, but no winner stored
      [21, 100], // leg 2 decider: tie winner = 100 (even if leg 2 itself was lost)
    ]);
    const rows = [
      row({ player_id: 1, match_id: 20, team_id: 100, goals: 3 }),
      row({ player_id: 1, match_id: 21, team_id: 100 }),
      row({ player_id: 2, match_id: 20, team_id: 200 }),
      row({ player_id: 2, match_id: 21, team_id: 200, goals: 1 }),
    ];
    const out = aggregateCareerBuckets(rows, winners);
    // one win for the whole tie — not one per leg, never double-counted
    expect(out.get(1)!.total_wins).toBe(1);
    expect(out.get(1)!.total_matches).toBe(2);
    // the losing side of the tie gets zero even though it won leg 2 on the night
    expect(out.get(2)!.total_wins).toBe(0);
  });

  it("forfeit: a match with a winner but no stats rows credits no one", () => {
    const winners = new Map<number, number | null>([[30, 100]]);
    const out = aggregateCareerBuckets([], winners, [1]);
    expect(out.get(1)!.total_wins).toBe(0);
    expect(out.get(1)!.total_matches).toBe(0);
  });

  it("counts distinct matches even if duplicate rows sneak in", () => {
    const rows = [
      row({ player_id: 1, match_id: 10, team_id: 100, goals: 1 }),
      row({ player_id: 1, match_id: 10, team_id: 100, goals: 1 }),
    ];
    const out = aggregateCareerBuckets(rows, new Map());
    expect(out.get(1)!.total_matches).toBe(1);
    // sums still add per row (source table enforces one row per match anyway)
    expect(out.get(1)!.total_goals).toBe(2);
  });

  it("seeds zero buckets for players whose stats were all deleted", () => {
    const out = aggregateCareerBuckets([], new Map(), [7]);
    expect(out.get(7)).toMatchObject({ total_matches: 0, total_goals: 0, primary_team_id: null });
  });

  it("does not seed players that are not in seedPlayerIds", () => {
    const out = aggregateCareerBuckets([], new Map(), [7]);
    expect(out.has(8)).toBe(false);
  });

  it("primary team = most appearances; ties resolve to the first team in row order", () => {
    const rows = [
      row({ player_id: 1, match_id: 10, team_id: 100 }),
      row({ player_id: 1, match_id: 11, team_id: 200 }),
      row({ player_id: 1, match_id: 12, team_id: 200 }),
      // player 2: 1 appearance each — tie resolves to team 300 (seen first)
      row({ player_id: 2, match_id: 13, team_id: 300 }),
      row({ player_id: 2, match_id: 14, team_id: 400 }),
    ];
    const out = aggregateCareerBuckets(rows, new Map());
    expect(out.get(1)!.primary_team_id).toBe(200);
    expect(out.get(2)!.primary_team_id).toBe(300);
  });

  it("mid-season team change: stats accumulate across teams, wins follow the row's team", () => {
    const winners = new Map<number, number | null>([
      [10, 100],
      [11, 200],
    ]);
    const rows = [
      row({ player_id: 1, match_id: 10, team_id: 100, goals: 1 }), // won with old team
      row({ player_id: 1, match_id: 11, team_id: 200, goals: 2 }), // won with new team
    ];
    const out = aggregateCareerBuckets(rows, winners);
    expect(out.get(1)).toMatchObject({ total_goals: 3, total_wins: 2, total_matches: 2 });
  });
});

describe("aggregateTournamentBuckets", () => {
  it("aggregates per player and leaves seeded players at 0 matches (delete signal)", () => {
    const winners = new Map<number, number | null>([[10, 100]]);
    const rows = [
      row({ player_id: 1, match_id: 10, team_id: 100, goals: 1, mvp: true }),
    ];
    const out = aggregateTournamentBuckets(rows, winners, [1, 2]);
    expect(out.get(1)).toEqual({
      matches: 1,
      goals: 1,
      assists: 0,
      yellow_cards: 0,
      red_cards: 0,
      blue_cards: 0,
      mvp_count: 1,
      best_gk_count: 0,
      wins: 1,
    });
    // player 2 had all stats removed → 0-match bucket, caller deletes the row
    expect(out.get(2)!.matches).toBe(0);
  });

  it("matches the career aggregator on the shared fields for the same rows", () => {
    const winners = new Map<number, number | null>([
      [10, 100],
      [11, null],
      [12, 200],
    ]);
    const rows = [
      row({ player_id: 1, match_id: 10, team_id: 100, goals: 2, assists: 1, yellow_cards: 1 }),
      row({ player_id: 1, match_id: 11, team_id: 100, goals: 1, blue_cards: 1, best_goalkeeper: true }),
      row({ player_id: 1, match_id: 12, team_id: 100, red_cards: 1 }),
    ];
    const career = aggregateCareerBuckets(rows, winners).get(1)!;
    const tourney = aggregateTournamentBuckets(rows, winners).get(1)!;
    expect(tourney).toEqual({
      matches: career.total_matches,
      goals: career.total_goals,
      assists: career.total_assists,
      yellow_cards: career.total_yellow_cards,
      red_cards: career.total_red_cards,
      blue_cards: career.total_blue_cards,
      mvp_count: career.total_mvp,
      best_gk_count: career.total_best_gk,
      wins: career.total_wins,
    });
  });
});

describe("aggregateLegacyTotals", () => {
  it("sums the five legacy fields and seeds zero rows for cleared players", () => {
    const rows = [
      { player_id: 1, goals: 2, assists: 1, yellow_cards: 1, red_cards: 0, blue_cards: null },
      { player_id: 1, goals: 1, assists: null, yellow_cards: 0, red_cards: 1, blue_cards: 1 },
    ];
    const out = aggregateLegacyTotals(rows, [1, 2]);
    expect(out.get(1)).toEqual({
      total_goals: 3,
      total_assists: 1,
      yellow_cards: 1,
      red_cards: 1,
      blue_cards: 1,
    });
    expect(out.get(2)).toEqual({
      total_goals: 0,
      total_assists: 0,
      yellow_cards: 0,
      red_cards: 0,
      blue_cards: 0,
    });
  });

  it("agrees with the career aggregator on goals/assists/cards", () => {
    const rows = [
      row({ player_id: 1, match_id: 10, team_id: 100, goals: 4, assists: 2, yellow_cards: 1 }),
      row({ player_id: 1, match_id: 11, team_id: 100, goals: 1, red_cards: 1, blue_cards: 2 }),
    ];
    const legacy = aggregateLegacyTotals(rows).get(1)!;
    const career = aggregateCareerBuckets(rows, new Map()).get(1)!;
    expect(legacy.total_goals).toBe(career.total_goals);
    expect(legacy.total_assists).toBe(career.total_assists);
    expect(legacy.yellow_cards).toBe(career.total_yellow_cards);
    expect(legacy.red_cards).toBe(career.total_red_cards);
    expect(legacy.blue_cards).toBe(career.total_blue_cards);
  });
});
