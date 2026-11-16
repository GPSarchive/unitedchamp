import { describe, expect, it } from "vitest";
import type { StatTuple } from "@/app/preview/paiktes-v2/model";
import {
  awardStars,
  matchNote,
  orderSheet,
  scorerLines,
  seasonNote,
  topScorer,
  winnerSide,
  type MatchPlayer,
  type SheetRow,
  type StatLine,
} from "./model";

const player = (id: number, last: string, extra: Partial<MatchPlayer> = {}): MatchPlayer => ({
  id,
  first: "Γιώργος",
  last,
  photo: null,
  former: false,
  href: null,
  ...extra,
});

const line = (extra: Partial<StatLine> = {}): StatLine => ({
  goals: 0,
  assists: 0,
  ownGoals: 0,
  yellow: 0,
  red: 0,
  blue: 0,
  mvp: false,
  bestGk: false,
  captain: false,
  gk: false,
  number: null,
  ...extra,
});

const row = (id: number, last: string, extra: Partial<StatLine> | null = {}): SheetRow => ({
  player: player(id, last),
  line: extra === null ? null : line(extra),
});

// [matches, wins, goals, assists, mvp, best_gk, yellow, red, blue]
const season = (matches: number, goals: number, assists = 0): StatTuple => [
  matches, 0, goals, assists, 0, 0, 0, 0, 0,
];

const names = (rows: { player: MatchPlayer }[]) => rows.map((r) => r.player.last);

describe("orderSheet", () => {
  it("puts goals first, then assists, then awards, then the rest by surname", () => {
    const rows = [
      row(1, "Ωμέγας"),
      row(2, "Βήτας", null),
      row(3, "Άλφας", { mvp: true }),
      row(4, "Δέλτας", { assists: 2 }),
      row(5, "Γάμμας", { goals: 1 }),
      row(6, "Έψιλον", { goals: 2 }),
    ];
    expect(names(orderSheet(rows))).toEqual(["Έψιλον", "Γάμμας", "Δέλτας", "Άλφας", "Βήτας", "Ωμέγας"]);
  });

  it("does not change the list it is given", () => {
    const rows = [row(1, "Β"), row(2, "Α")];
    orderSheet(rows);
    expect(names(rows)).toEqual(["Β", "Α"]);
  });
});

describe("scorerLines", () => {
  it("lists only the team's scorers, most goals first", () => {
    const own = [row(1, "Ένας", { goals: 1 }), row(2, "Τρίας", { goals: 3 }), row(3, "Κανένας")];
    expect(scorerLines(own)).toEqual([
      { player: own[1].player, count: 3 },
      { player: own[0].player, count: 1 },
    ]);
  });

  it("leaves own goals out", () => {
    const own = [row(1, "Άτυχος", { ownGoals: 1 })];
    expect(scorerLines(own)).toEqual([]);
  });
});

describe("notes", () => {
  it("describes a match line", () => {
    expect(matchNote(line({ goals: 2, assists: 1 }))).toBe("2 γκολ · 1 ασίστ");
    expect(matchNote(line({ assists: 3 }))).toBe("3 ασίστ");
    expect(matchNote(line({ mvp: true }))).toBeNull();
    expect(matchNote(null)).toBeNull();
  });

  it("describes a season", () => {
    expect(seasonNote(season(9, 12))).toBe("12 γκολ σε 9 αγώνες τη σεζόν");
    expect(seasonNote(season(1, 1))).toBe("1 γκολ σε 1 αγώνα τη σεζόν");
  });
});

describe("awardStars", () => {
  const teamA = { id: 1, name: "Α", logo: null };
  const teamB = { id: 2, name: "Β", logo: null };

  it("gives a card to the MVP and to the best goalkeeper, MVP first", () => {
    const stars = awardStars(
      [
        { team: teamA, sheet: [row(1, "Τερματοφύλακας", { bestGk: true }), row(2, "Απλός", { goals: 1 })] },
        { team: teamB, sheet: [row(3, "Πολύτιμος", { mvp: true, goals: 2 })] },
      ],
      (id) => (id === 3 ? season(5, 7) : null),
    );
    expect(stars.map((s) => [s.player.last, s.label, s.team.name, s.note])).toEqual([
      ["Πολύτιμος", "MVP αγώνα", "Β", "2 γκολ"],
      ["Τερματοφύλακας", "Καλύτερος τερματοφύλακας", "Α", null],
    ]);
    expect(stars[0].season).toEqual(season(5, 7));
    expect(stars[1].season).toBeNull();
  });

  it("gives one card to a player holding both awards", () => {
    const stars = awardStars([{ team: teamA, sheet: [row(1, "Διπλός", { mvp: true, bestGk: true })] }], () => null);
    expect(stars).toHaveLength(1);
    expect(stars[0].label).toBe("MVP & καλύτερος τερματοφύλακας");
  });

  it("is empty when no award was given", () => {
    expect(awardStars([{ team: teamA, sheet: [row(1, "Απλός", { goals: 3 })] }], () => null)).toEqual([]);
  });
});

describe("topScorer", () => {
  const roster = [player(1, "Άλφας"), player(2, "Βήτας"), player(3, "Γάμμας"), player(4, "Δέλτας", { former: true })];

  it("picks the most goals, skipping archived players", () => {
    const stats = new Map([
      [1, season(8, 4)],
      [2, season(8, 9)],
      [4, season(8, 20)],
    ]);
    expect(topScorer(roster, (id) => stats.get(id) ?? null)?.player.last).toBe("Βήτας");
  });

  it("breaks a tie by assists, then by fewer matches, then by surname", () => {
    const byAssists = new Map([
      [1, season(8, 5, 1)],
      [2, season(8, 5, 3)],
    ]);
    expect(topScorer(roster, (id) => byAssists.get(id) ?? null)?.player.last).toBe("Βήτας");

    const byMatches = new Map([
      [1, season(9, 5)],
      [3, season(6, 5)],
    ]);
    expect(topScorer(roster, (id) => byMatches.get(id) ?? null)?.player.last).toBe("Γάμμας");

    const level = new Map([
      [3, season(8, 5)],
      [2, season(8, 5)],
    ]);
    expect(topScorer(roster, (id) => level.get(id) ?? null)?.player.last).toBe("Βήτας");
  });

  it("picks nobody when the squad has not scored", () => {
    const stats = new Map([[1, season(3, 0)]]);
    expect(topScorer(roster, (id) => stats.get(id) ?? null)).toBeNull();
    expect(topScorer([], () => null)).toBeNull();
  });
});

describe("winnerSide", () => {
  it("goes by the score, and by penalties only when the score is level", () => {
    expect(winnerSide({ a: 3, b: 1 }, null)).toBe("a");
    expect(winnerSide({ a: 0, b: 2 }, { a: 5, b: 4 })).toBe("b");
    expect(winnerSide({ a: 2, b: 2 }, { a: 3, b: 4 })).toBe("b");
    expect(winnerSide({ a: 2, b: 2 }, null)).toBeNull();
    expect(winnerSide(null, null)).toBeNull();
  });
});
