import { describe, expect, it } from "vitest";
import type { DirectoryPlayer, StatTuple } from "../paiktes-v2/model";
import { ordinal, seasonStanding } from "./standing";

// [matches, wins, goals, assists, mvp, best_gk, yellow, red, blue]
const stats = (goals: number, assists = 0, mvp = 0, bestGk = 0): StatTuple => [5, 2, goals, assists, mvp, bestGk, 0, 0, 0];

const player = (id: number, season: StatTuple | null): DirectoryPlayer => ({
  id,
  first: `First${id}`,
  last: `Last${id}`,
  photo: null,
  position: "",
  teamIds: [],
  season,
  byTournament: {},
});

const league = [
  player(1, stats(20, 3)),
  player(2, stats(15, 9, 2)),
  player(3, stats(15, 0)),
  player(4, stats(7, 9)),
  player(5, stats(0, 1)),
  player(6, null),
];

describe("seasonStanding", () => {
  it("ranks against everyone, with the season's best alongside", () => {
    const s = seasonStanding(league, 4);
    expect(s?.players).toBe(6);
    expect(s?.goals).toMatchObject({ value: 7, rank: 4, best: 20 });
  });

  it("gives equal values the same rank, and the next one skips", () => {
    expect(seasonStanding(league, 2)?.goals.rank).toBe(2);
    expect(seasonStanding(league, 3)?.goals.rank).toBe(2);
    expect(seasonStanding(league, 4)?.goals.rank).toBe(4);
    // two players share first place in assists
    expect(seasonStanding(league, 2)?.assists.rank).toBe(1);
    expect(seasonStanding(league, 4)?.assists.rank).toBe(1);
    expect(seasonStanding(league, 1)?.assists.rank).toBe(3);
  });

  it("says when a place is shared", () => {
    expect(seasonStanding(league, 2)?.goals.shared).toBe(true);
    expect(seasonStanding(league, 1)?.goals.shared).toBe(false);
    expect(seasonStanding(league, 4)?.assists.shared).toBe(true);
    // zeros are not "sharing" anything
    expect(seasonStanding(league, 1)?.best_gk.shared).toBe(false);
  });

  it("names the next step up: the nearest higher value and the place it holds", () => {
    // 7 goals → the next value above is 15, held jointly in 2nd place
    expect(seasonStanding(league, 4)?.goals.next).toEqual({ value: 15, rank: 2 });
    // 15 goals → 20 is first place
    expect(seasonStanding(league, 2)?.goals.next).toEqual({ value: 20, rank: 1 });
    // 3 assists → 9 is shared first place
    expect(seasonStanding(league, 1)?.assists.next).toEqual({ value: 9, rank: 1 });
  });

  it("has no next step at the top, shared or not", () => {
    expect(seasonStanding(league, 1)?.goals.next).toBeNull();
    expect(seasonStanding(league, 2)?.assists.next).toBeNull();
    expect(seasonStanding(league, 4)?.assists.next).toBeNull();
  });

  it("does not rank a zero", () => {
    const s = seasonStanding(league, 5);
    expect(s?.goals).toMatchObject({ value: 0, rank: null, best: 20 });
    expect(s?.assists.rank).toBe(4);
  });

  it("treats a player with no appearances as all zeros", () => {
    const s = seasonStanding(league, 6);
    expect(s?.goals.rank).toBeNull();
    expect(s?.mvp).toMatchObject({ value: 0, rank: null, best: 2 });
  });

  it("reports a best of 0 when nobody has the stat", () => {
    expect(seasonStanding(league, 1)?.best_gk).toEqual({ value: 0, rank: null, best: 0, shared: false, next: null });
  });

  it("returns null for a player who is not in the list", () => {
    expect(seasonStanding(league, 99)).toBeNull();
  });
});

describe("ordinal", () => {
  it("accents the ending only where the word is stressed on it", () => {
    expect([1, 5, 10, 11, 13, 21, 110].map((n) => ordinal(n))).toEqual(["1ος", "5ος", "10ος", "11ος", "13ος", "21ος", "110ος"]);
    expect([20, 30, 100, 120, 200].map((n) => ordinal(n))).toEqual(["20ός", "30ός", "100ός", "120ός", "200ός"]);
  });

  it("has a feminine form, for «θέση»", () => {
    expect([1, 4, 10, 13].map((n) => ordinal(n, "f"))).toEqual(["1η", "4η", "10η", "13η"]);
    expect([20, 100, 120].map((n) => ordinal(n, "f"))).toEqual(["20ή", "100ή", "120ή"]);
  });
});
