import { describe, expect, it } from "vitest";
import { HOUSE_ACCENT, PAGE_BG, contrast, inkOn, parseHex, teamAccent } from "./accent";
import { countdownParts, dayLabel, kickoffEpoch } from "./clock";
import {
  competitionLabel,
  isKeeper,
  orderSquad,
  playerTotals,
  resultNote,
  seasonRecord,
  sideResult,
  splitSchedule,
  tableWindow,
  totalsTuple,
  type MatchLike,
  type Outcome,
  type SquadPlayer,
  type StatRow,
  type TeamMatch,
} from "./model";

const US = 1;
const THEM = 2;

const raw = (extra: Partial<MatchLike> = {}): MatchLike => ({
  id: 10,
  team_a_id: US,
  team_b_id: THEM,
  team_a_score: 0,
  team_b_score: 0,
  status: "finished",
  ...extra,
});

describe("sideResult", () => {
  it("reads a league match from either side", () => {
    const m = raw({ team_a_score: 3, team_b_score: 1 });
    expect(sideResult(m, US, false)).toEqual({ own: 3, opp: 1, outcome: "W", pens: null, tie: null });
    expect(sideResult(m, THEM, false)).toEqual({ own: 1, opp: 3, outcome: "L", pens: null, tie: null });
    expect(sideResult(raw({ team_a_score: 2, team_b_score: 2 }), US, false)?.outcome).toBe("D");
  });

  it("answers nothing for a match that is not finished, or not this team's", () => {
    expect(sideResult(raw({ status: "scheduled" }), US, false)).toBeNull();
    expect(sideResult(raw(), 99, false)).toBeNull();
  });

  it("gives a level knockout match to the shootout winner", () => {
    const m = raw({ team_a_score: 4, team_b_score: 4, penalty_a: 4, penalty_b: 5 });
    expect(sideResult(m, US, true)).toEqual({ own: 4, opp: 4, outcome: "L", pens: { own: 4, opp: 5 }, tie: null });
    expect(sideResult(m, THEM, true)).toEqual({ own: 4, opp: 4, outcome: "W", pens: { own: 5, opp: 4 }, tie: null });
    // The same score in a league match is simply a draw.
    expect(sideResult(m, US, false)?.outcome).toBe("D");
  });

  it("marks a first leg as waiting for the second", () => {
    const res = sideResult(raw({ leg: 1, team_a_score: 2, team_b_score: 1 }), US, true);
    expect(res?.outcome).toBe("W");
    expect(res?.tie).toEqual({ leg: 1, firstLeg: null, verdict: "pending", via: null });
  });

  it("settles a two-legged tie on the second leg, the sides having swapped", () => {
    // Leg 1: we win 2–1 at home. Leg 2: we lose 0–1 away. One leg win each → penalties.
    const leg1 = raw({ id: 1, leg: 1, team_a_score: 2, team_b_score: 1 });
    const leg2 = raw({
      id: 2,
      leg: 2,
      tie_leg1_match_id: 1,
      team_a_id: THEM,
      team_b_id: US,
      team_a_score: 1,
      team_b_score: 0,
      penalty_a: 3,
      penalty_b: 5,
    });
    const res = sideResult(leg2, US, true, leg1);
    expect(res).toEqual({
      own: 0,
      opp: 1,
      outcome: "L",
      pens: { own: 5, opp: 3 },
      tie: { leg: 2, firstLeg: { own: 2, opp: 1 }, verdict: "advanced", via: "penalties" },
    });
    expect(resultNote(res!)).toBe("1ος αγώνας 2–1, Πρόκριση στα πέναλτι 5–3");
    expect(sideResult(leg2, THEM, true, leg1)?.tie?.verdict).toBe("eliminated");
  });
});

const match = (id: number, extra: Partial<TeamMatch> = {}): TeamMatch => ({
  id,
  opponent: { id: THEM, name: "Αντίπαλος", logo: null },
  date: null,
  status: "scheduled",
  competition: null,
  stageName: null,
  groupName: null,
  matchday: null,
  leg: null,
  ko: false,
  result: null,
  ...extra,
});

const played = (id: number, date: string | null, own: number, opp: number): TeamMatch =>
  match(id, {
    date,
    status: "finished",
    result: { own, opp, outcome: own > opp ? "W" : own < opp ? "L" : "D", pens: null, tie: null },
  });

describe("splitSchedule", () => {
  const now = "2026-11-14T20:00:00";
  const schedule = splitSchedule(
    [
      match(1, { date: "2026-11-20T21:00:00" }),
      match(2, { date: "2026-11-14T21:30:00+00:00" }), // later today: the zone suffix is ignored
      match(3, { date: "2026-11-14T19:00:00" }), // kicked off an hour ago
      match(4, { matchday: 9 }), // no date yet
      match(9, { matchday: 7 }), // no date yet, but meant to be played earlier
      match(5, { status: "postponed" }),
      played(6, "2026-11-01T21:00:00", 2, 0),
      played(7, "2026-11-08T21:00:00", 1, 1),
      played(8, null, 0, 3), // a result without a date
    ],
    now,
  );
  const ids = (list: TeamMatch[]) => list.map((m) => m.id);

  it("puts the soonest kick-off still ahead first", () => {
    expect(schedule.next?.id).toBe(2);
    expect(ids(schedule.upcoming)).toEqual([2, 1]);
  });

  it("separates what is waiting for a result, postponed, or without a date", () => {
    expect(ids(schedule.awaiting)).toEqual([3]);
    expect(ids(schedule.postponed)).toEqual([5]);
    // Without a date they go by matchday.
    expect(ids(schedule.undated)).toEqual([9, 4]);
  });

  it("lists results newest first, an undated one as the oldest", () => {
    expect(ids(schedule.results)).toEqual([7, 6, 8]);
    expect(schedule.form).toEqual(["L", "W", "D"]);
  });

  it("keeps only the last five results in the form guide", () => {
    const many = Array.from({ length: 7 }, (_, i) => played(i + 1, `2026-10-${String(i + 1).padStart(2, "0")}T21:00:00`, i, 3));
    expect(splitSchedule(many, now).form).toEqual(["L", "D", "W", "W", "W"]);
  });

  it("adds up the season", () => {
    expect(seasonRecord(schedule.results)).toEqual({
      played: 3,
      won: 1,
      drawn: 1,
      lost: 1,
      goalsFor: 3,
      goalsAgainst: 4,
    });
  });
});

describe("labels", () => {
  it("names a league match by its matchday and a knockout match by its round", () => {
    const competition = { id: 1, name: "ULTRA LEAGUE" };
    expect(competitionLabel(match(1, { competition, matchday: 5, groupName: "Όμιλος Α" }))).toBe(
      "ULTRA LEAGUE, 5η αγωνιστική, Όμιλος Α",
    );
    expect(competitionLabel(match(1, { competition, ko: true, stageName: "Ημιτελικά", leg: 2, matchday: 1 }))).toBe(
      "ULTRA LEAGUE, Ημιτελικά, Ρεβάνς",
    );
    expect(competitionLabel(match(1))).toBe("");
  });

  it("explains a shootout", () => {
    expect(resultNote({ own: 4, opp: 4, outcome: "W", pens: { own: 5, opp: 4 }, tie: null })).toBe(
      "Νίκη στα πέναλτι 5–4",
    );
    expect(resultNote({ own: 2, opp: 0, outcome: "W", pens: null, tie: null })).toBeNull();
  });
});

const line = (matchId: number, playerId: number, extra: Partial<StatRow> = {}): StatRow => ({
  matchId,
  playerId,
  goals: 0,
  assists: 0,
  yellow: 0,
  red: 0,
  blue: 0,
  mvp: false,
  bestGk: false,
  gk: false,
  ...extra,
});

describe("playerTotals", () => {
  const outcomes = new Map<number, Outcome>([
    [1, "W"],
    [2, "L"],
    [3, "W"],
  ]);

  it("adds up each player's match sheets, wins by the team's result", () => {
    const totals = playerTotals(outcomes, [
      line(1, 7, { goals: 2, mvp: true }),
      line(2, 7, { goals: 1, assists: 1, yellow: 1 }),
      line(3, 7, { assists: 2 }),
      line(1, 8, { gk: true, bestGk: true }),
      line(2, 8, { gk: true }),
    ]);
    expect(totalsTuple(totals.get(7)!)).toEqual([3, 2, 3, 3, 1, 0, 1, 0, 0]);
    expect(totalsTuple(totals.get(8)!)).toEqual([2, 1, 0, 0, 0, 1, 0, 0, 0]);
  });

  it("ignores a line of an unknown match and a second line of the same player", () => {
    const totals = playerTotals(outcomes, [
      line(1, 7, { goals: 1 }),
      line(1, 7, { goals: 5 }),
      line(99, 7, { goals: 5 }),
    ]);
    expect(totals.get(7)).toMatchObject({ apps: 1, goals: 1 });
  });

  it("tells a goalkeeper by the match sheets", () => {
    expect(isKeeper({ apps: 4, gkApps: 2 })).toBe(true);
    expect(isKeeper({ apps: 5, gkApps: 2 })).toBe(false); // less than half his matches
    expect(isKeeper({ apps: 1, gkApps: 1 })).toBe(false); // once is not enough
    expect(isKeeper(null)).toBe(false);
  });
});

// [matches, wins, goals, assists, mvp, best_gk, yellow, red, blue]
const squadPlayer = (
  id: number,
  last: string,
  numbers: [matches: number, goals: number, assists: number, mvp: number] | null,
  extra: Partial<SquadPlayer> = {},
): SquadPlayer => ({
  id,
  first: "Γιώργος",
  last,
  photo: null,
  former: false,
  href: null,
  left: false,
  keeper: false,
  numbers: numbers ? [numbers[0], 0, numbers[1], numbers[2], numbers[3], 0, 0, 0, 0] : null,
  ...extra,
});

describe("orderSquad", () => {
  it("puts the regulars first, then most goals, then surname; no appearances last", () => {
    const squad = [
      squadPlayer(1, "Ωμέγας", null),
      squadPlayer(2, "Βήτας", [5, 1, 0, 0]),
      squadPlayer(3, "Άλφας", null),
      squadPlayer(4, "Γάμμας", [9, 0, 0, 0]),
      squadPlayer(5, "Δέλτας", [5, 4, 0, 0]),
      squadPlayer(6, "Έψιλον", [5, 4, 0, 0]),
    ];
    expect(orderSquad(squad).map((p) => p.last)).toEqual(["Γάμμας", "Δέλτας", "Έψιλον", "Βήτας", "Άλφας", "Ωμέγας"]);
    expect(squad[0].last).toBe("Ωμέγας"); // the list given is left alone
  });
});

describe("tableWindow", () => {
  const rows = [1, 2, 3, 4, 5, 6, 7, 8];

  it("shows two places either side of the team", () => {
    expect(tableWindow(rows, 3)).toEqual([2, 3, 4, 5, 6]);
  });

  it("slides at the top and the bottom so it stays five rows long", () => {
    expect(tableWindow(rows, 0)).toEqual([1, 2, 3, 4, 5]);
    expect(tableWindow(rows, 7)).toEqual([4, 5, 6, 7, 8]);
  });

  it("shows a short table whole, and nothing for a team that is not in it", () => {
    expect(tableWindow([1, 2, 3], 1)).toEqual([1, 2, 3]);
    expect(tableWindow(rows, -1)).toEqual([]);
  });
});

describe("teamAccent", () => {
  it("keeps a colour that already reads on the page", () => {
    expect(teamAccent("#FB923C")).toEqual({ kit: "#fb923c", accent: "#fb923c", ink: "#0a0a0f" });
  });

  it("lifts a dark colour until it reads, keeping its hue", () => {
    const { kit, accent } = teamAccent("#1e3a8a");
    expect(kit).toBe("#1e3a8a");
    expect(accent).not.toBe("#1e3a8a");
    expect(contrast(accent, PAGE_BG)).toBeGreaterThanOrEqual(4.5);
    // Still a blue: the blue channel leads.
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(accent.slice(i, i + 2), 16));
    expect(b).toBeGreaterThan(r);
    expect(b).toBeGreaterThan(g);
  });

  it("falls back to the site's orange for black, white, grey or no colour", () => {
    for (const colour of ["#000000", "#ffffff", "#808080", null, "", "red"]) {
      expect(teamAccent(colour).accent).toBe(HOUSE_ACCENT);
    }
    expect(teamAccent("#000").kit).toBe("#000000");
    expect(teamAccent("red").kit).toBeNull();
  });

  it("reads hex colours with or without the hash, three or six digits", () => {
    expect(parseHex("ABC")).toBe("#aabbcc");
    expect(parseHex(" #12ab34 ")).toBe("#12ab34");
    expect(parseHex("#12ab3")).toBeNull();
    expect(inkOn("#ffe08a")).toBe("#0a0a0f");
    expect(inkOn("#1e3a8a")).toBe("#ffffff");
  });
});

describe("clock", () => {
  it("finds the real instant of an Athens kick-off, summer and winter", () => {
    expect(kickoffEpoch("2026-07-01T21:00:00")).toBe(Date.UTC(2026, 6, 1, 18, 0, 0)); // UTC+3
    expect(kickoffEpoch("2026-12-01T21:00:00+00:00")).toBe(Date.UTC(2026, 11, 1, 19, 0, 0)); // UTC+2
    expect(kickoffEpoch(null)).toBeNull();
  });

  it("names the day by the Athens calendar", () => {
    // 23:30 in Athens on the 14th (21:30 UTC).
    const now = new Date(Date.UTC(2026, 10, 14, 21, 30, 0));
    expect(dayLabel("2026-11-14T23:45:00", now)).toBe("Σήμερα");
    expect(dayLabel("2026-11-15T00:15:00", now)).toBe("Αύριο");
    expect(dayLabel("2026-11-20T21:00:00", now)).toBe("σε 6 μέρες");
    expect(dayLabel("2026-11-13T21:00:00", now)).toBe("");
    expect(dayLabel(null, now)).toBe("");
  });

  it("counts down and stops at zero", () => {
    expect(countdownParts(90_061_000, 0)).toEqual({ days: 1, hours: 1, minutes: 1, seconds: 1, done: false });
    expect(countdownParts(1000, 5000)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0, done: true });
  });
});
