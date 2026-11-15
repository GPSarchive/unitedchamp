import { describe, expect, it } from "vitest";
import {
  advancersOf,
  buildBracket,
  groupByDay,
  groupByRound,
  headline,
  isThirdPlace,
  knockoutRounds,
  matchNote,
  matchWinner,
  rankScorers,
  roundLabel,
  roundName,
  splitMatches,
  standingOf,
  tournamentLeaders,
  type BracketNode,
  type KnockoutRound,
  type LabelContext,
  type PlayerLine,
  type RawStage,
  type StageTables,
  type TMatch,
  type TStage,
  type TTeam,
  type TableRow,
} from "./model";

const team = (id: number, name = `Ομάδα ${id}`): TTeam => ({ id, name, logo: null });

const match = (id: number, extra: Partial<TMatch> = {}): TMatch => ({
  id,
  stageId: 1,
  groupId: null,
  matchday: null,
  round: null,
  bracketPos: null,
  date: null,
  status: "scheduled",
  a: team(1),
  b: team(2),
  score: null,
  pens: null,
  winnerTeamId: null,
  leg: null,
  leg1Id: null,
  ko: false,
  sources: { a: null, b: null },
  ...extra,
});

const done = (id: number, a: number, b: number, extra: Partial<TMatch> = {}): TMatch =>
  match(id, { status: "finished", score: { a, b }, ...extra });

describe("stages", () => {
  const stage = (id: number, kind: string, ordering: number, config: Record<string, unknown> | null = null): RawStage => ({
    id,
    name: `S${id}`,
    kind,
    ordering,
    config,
  });

  it("reads how many go through from the knockout stage that takes its teams from this one", () => {
    const league = stage(1, "league", 1);
    const groups = stage(2, "groups", 1);
    expect(advancersOf(league, [league, stage(9, "knockout", 2, { from_stage_id: 1, advancers_total: 4 })])).toBe(4);
    expect(advancersOf(league, [league, stage(9, "knockout", 2, { from_stage_id: 1, standalone_bracket_size: 16 })])).toBe(16);
    expect(advancersOf(groups, [groups, stage(9, "knockout", 2, { fromStageId: 2, advancers_per_group: 3 })])).toBe(3);
  });

  it("falls back to the engine's own defaults: 8 from a league, 2 from each group", () => {
    const league = stage(1, "league", 1);
    const groups = stage(2, "groups", 1);
    expect(advancersOf(league, [league, stage(9, "knockout", 2, { from_stage_id: 1 })])).toBe(8);
    expect(advancersOf(groups, [groups, stage(9, "knockout", 2, { from_stage_id: 2 })])).toBe(2);
  });

  it("says nothing when no later knockout stage points here", () => {
    const league = stage(1, "league", 2);
    expect(advancersOf(league, [league])).toBeNull();
    expect(advancersOf(league, [league, stage(9, "knockout", 3, { from_stage_id: 7 })])).toBeNull();
    // A knockout stage that comes BEFORE it cannot be fed by it.
    expect(advancersOf(league, [stage(9, "knockout", 1, { from_stage_id: 1 }), league])).toBeNull();
    expect(advancersOf(stage(9, "knockout", 1), [])).toBeNull();
  });
});

describe("matchWinner", () => {
  it("goes by the score", () => {
    expect(matchWinner(done(1, 3, 1))).toBe("a");
    expect(matchWinner(done(1, 0, 2))).toBe("b");
    expect(matchWinner(done(1, 2, 2))).toBeNull();
    expect(matchWinner(match(1))).toBeNull();
  });

  it("gives a level single knockout match to the shootout, but not a league match or a leg", () => {
    const pens = { a: 4, b: 5 };
    expect(matchWinner(done(1, 2, 2, { ko: true, pens }))).toBe("b");
    expect(matchWinner(done(1, 2, 2, { ko: false, pens }))).toBeNull();
    expect(matchWinner(done(1, 2, 2, { ko: true, leg: 2, pens }))).toBeNull();
  });
});

const stages: TStage[] = [
  { id: 1, name: "Κανονική περίοδος", kind: "league", groups: [], advancers: 4 },
  { id: 2, name: "Όμιλοι", kind: "groups", groups: [{ id: 7, name: "Όμιλος Α" }], advancers: null },
  { id: 3, name: "Gold", kind: "knockout", groups: [], advancers: null },
  { id: 4, name: "Silver", kind: "knockout", groups: [], advancers: null },
];

/** A label context with the knockout rounds given by hand: [match id, name, column]. */
const ctxOf = (list: TStage[], knockout: [number, string, number][] = []): LabelContext => ({
  stages: new Map(list.map((s) => [s.id, s])),
  knockout: new Map<number, KnockoutRound>(knockout.map(([id, name, order]) => [id, { name, order }])),
});

describe("round names", () => {
  it("goes by how many ties the round has", () => {
    expect(roundName(1)).toBe("Τελικός");
    expect(roundName(2)).toBe("Ημιτελικά");
    expect(roundName(4)).toBe("Προημιτελικά");
    expect(roundName(8)).toBe("Φάση των 16");
    expect(roundName(6)).toBe("Φάση των 12");
  });

  it("names a league match by its matchday and a knockout match by its place in the tree", () => {
    const ctx = ctxOf([stages[0], stages[2]], [
      [1, "Ημιτελικά", 0],
      [2, "Τελικός", 1],
      [3, "", 0],
    ]);
    expect(roundLabel(match(9, { stageId: 1, matchday: 5 }), ctx)).toBe("5η αγωνιστική");
    // The stored round number is not what names it.
    expect(roundLabel(match(1, { stageId: 3, ko: true, round: 2 }), ctx)).toBe("Ημιτελικά");
    expect(roundLabel(match(2, { stageId: 3, ko: true, round: 2 }), ctx)).toBe("Τελικός");
    // A single-round stage has no round name; a match outside any tree neither.
    expect(roundLabel(match(3, { stageId: 3, ko: true }), ctx)).toBe("Νοκ άουτ");
    expect(roundLabel(match(4, { stageId: 3, ko: true }), ctx)).toBe("Νοκ άουτ");
    expect(roundLabel(match(9, { stageId: 1 }), ctx)).toBe("");
  });

  it("adds the stage's name only when there is another stage of its kind", () => {
    const ctx = ctxOf(stages, [
      [1, "Τελικός", 0],
      [2, "", 0],
    ]);
    expect(roundLabel(match(1, { stageId: 3, ko: true }), ctx)).toBe("Gold, Τελικός");
    expect(roundLabel(match(2, { stageId: 4, ko: true }), ctx)).toBe("Silver");
    expect(roundLabel(match(9, { stageId: 1, matchday: 2 }), ctx)).toBe("Κανονική περίοδος, 2η αγωνιστική");
  });

  it("notes the group or the leg of a match", () => {
    const ctx = ctxOf(stages);
    expect(matchNote(match(1, { stageId: 2, groupId: 7 }), ctx)).toBe("Όμιλος Α");
    expect(matchNote(match(1, { stageId: 3, leg: 1 }), ctx)).toBe("1ος αγώνας");
    expect(matchNote(match(1, { stageId: 3, leg: 2 }), ctx)).toBe("Ρεβάνς");
    expect(matchNote(match(1, { stageId: 1 }), ctx)).toBeNull();
  });
});

describe("splitMatches", () => {
  const now = "2026-11-14T20:00:00";
  const all = [
    match(1, { date: "2026-11-20T21:00:00", matchday: 6 }),
    match(2, { date: "2026-11-14T21:30:00+00:00", matchday: 5 }), // later today: the zone suffix is ignored
    match(3, { date: "2026-11-14T19:00:00", matchday: 5 }), // kicked off an hour ago
    match(4, { matchday: 9 }),
    match(5, { matchday: 7 }),
    match(6, { status: "postponed", matchday: 3 }),
    done(7, 2, 0, { date: "2026-11-01T21:00:00", matchday: 3 }),
    done(8, 1, 1, { date: "2026-11-08T21:00:00", matchday: 4 }),
    done(9, 0, 3, { matchday: 1 }), // a result without a date
  ];
  const lists = splitMatches(all, now);
  const ids = (list: TMatch[]) => list.map((m) => m.id);

  it("puts the soonest kick-off still ahead first", () => {
    expect(ids(lists.upcoming)).toEqual([2, 1]);
  });

  it("separates what is waiting for a result, postponed, or without a date", () => {
    expect(ids(lists.awaiting)).toEqual([3]);
    expect(ids(lists.postponed)).toEqual([6]);
    expect(ids(lists.undated)).toEqual([5, 4]); // by matchday
  });

  it("lists results newest first, an undated one as the oldest", () => {
    expect(ids(lists.results)).toEqual([8, 7, 9]);
  });

  it("groups fixtures by day", () => {
    const days = groupByDay([
      match(1, { date: "2026-11-16T21:00:00" }),
      match(2, { date: "2026-11-16T22:00:00" }),
      match(3, { date: "2026-11-18T21:00:00" }),
    ]);
    expect(days.map((d) => [d.key, d.matches.map((m) => m.id)])).toEqual([
      ["2026-11-16", [1, 2]],
      ["2026-11-18", [3]],
    ]);
    expect(days[0].title).toBe("2026-11-16T21:00:00");
  });

  it("groups results by round, backwards through the competition, a late match staying with its matchday", () => {
    const results = [
      // Both stored as round 2: the tree is what tells the final from the semi-final.
      done(20, 1, 0, { stageId: 3, ko: true, round: 2, date: "2026-12-08T21:00:00" }),
      done(21, 1, 0, { stageId: 3, ko: true, round: 2, date: "2026-12-01T21:00:00" }),
      done(10, 1, 0, { matchday: 2, date: "2026-11-30T21:00:00" }), // matchday 2, played after matchday 3
      done(11, 1, 0, { matchday: 3, date: "2026-11-10T21:00:00" }),
      done(12, 1, 0, { matchday: 2, date: "2026-11-03T21:00:00" }),
      done(13, 1, 0, {}), // no matchday
    ];
    const ctx = ctxOf([stages[0], stages[2]], [
      [20, "Τελικός", 1],
      [21, "Ημιτελικά", 0],
    ]);
    const groups = groupByRound(results, ctx, [1, 3], true);
    expect(groups.map((g) => [g.title, g.matches.map((m) => m.id)])).toEqual([
      ["Τελικός", [20]],
      ["Ημιτελικά", [21]],
      ["3η αγωνιστική", [11]],
      ["2η αγωνιστική", [10, 12]],
      ["Άλλοι αγώνες", [13]],
    ]);
    expect(groupByRound(results, ctx, [1, 3], false).map((g) => g.title)).toEqual([
      "Άλλοι αγώνες",
      "2η αγωνιστική",
      "3η αγωνιστική",
      "Ημιτελικά",
      "Τελικός",
    ]);
  });
});

const row = (id: number, rank: number, points: number, played = 3): TableRow => ({
  team: team(id),
  rank,
  played,
  won: 0,
  drawn: 0,
  lost: 0,
  gf: 0,
  ga: 0,
  gd: 0,
  points,
});

const league: StageTables = {
  stage: stages[0],
  tables: [{ key: "1", groupName: null, rows: [row(1, 1, 9), row(2, 2, 6), row(3, 3, 3)] }],
};
const groups: StageTables = {
  stage: stages[1],
  tables: [
    { key: "2-7", groupName: "Όμιλος Α", rows: [row(2, 1, 4), row(1, 2, 1)] },
    { key: "2-8", groupName: "Όμιλος Β", rows: [row(3, 1, 6)] },
  ],
};

describe("standingOf", () => {
  it("finds the team in the latest stage that has it", () => {
    expect(standingOf([league, groups], 1)).toEqual({ rank: 2, points: 1, groupName: "Όμιλος Α" });
    expect(standingOf([league], 3)).toEqual({ rank: 3, points: 3, groupName: null });
    expect(standingOf([league, groups], 99)).toBeNull();
  });
});

describe("headline", () => {
  const some = [done(1, 1, 0), match(2), match(3)];

  it("names the champion above everything else", () => {
    expect(headline({ winner: team(5), status: "running", matches: some, tables: [league] })).toEqual({
      kind: "champion",
      team: team(5),
    });
  });

  it("says when it starts, while nothing has been played", () => {
    const fixtures = [match(1, { date: "2026-12-05T21:00:00" }), match(2, { date: "2026-12-01T19:00:00+00:00" }), match(3)];
    expect(headline({ winner: null, status: "scheduled", matches: fixtures, tables: [] })).toEqual({
      kind: "upcoming",
      firstDate: "2026-12-01T19:00:00+00:00",
    });
    expect(headline({ winner: null, status: "scheduled", matches: [match(1)], tables: [] })).toEqual({
      kind: "upcoming",
      firstDate: null,
    });
  });

  it("names the leader while a single table is being played", () => {
    expect(headline({ winner: null, status: "running", matches: some, tables: [league] })).toEqual({
      kind: "running",
      played: 1,
      total: 3,
      leader: { team: team(1), points: 9 },
    });
  });

  it("names no leader for groups, once the knockout has begun, or before the table has a match in it", () => {
    const leader = (input: Parameters<typeof headline>[0]) => {
      const h = headline(input);
      return h.kind === "running" ? h.leader : "not running";
    };
    expect(leader({ winner: null, status: "running", matches: some, tables: [league, groups] })).toBeNull();
    const knockout = [...some, done(9, 2, 1, { stageId: 3, ko: true, round: 1 }), match(10, { stageId: 3, ko: true, round: 2 })];
    expect(leader({ winner: null, status: "running", matches: knockout, tables: [league] })).toBeNull();
    const fresh: StageTables = { stage: stages[0], tables: [{ key: "1", groupName: null, rows: [row(1, 1, 0, 0)] }] };
    expect(leader({ winner: null, status: "running", matches: some, tables: [fresh] })).toBeNull();
  });

  it("says it is over when everything is played, or when it is marked completed", () => {
    expect(headline({ winner: null, status: "running", matches: [done(1, 1, 0)], tables: [] })).toEqual({
      kind: "over",
      played: 1,
    });
    expect(headline({ winner: null, status: "completed", matches: some, tables: [] })).toEqual({ kind: "over", played: 1 });
  });
});

/** A knockout match in slot (round, pos); its id is round×100 + pos. */
const tie = (round: number, pos: number, extra: Partial<TMatch> = {}): TMatch =>
  match(round * 100 + pos, { stageId: 3, ko: true, round, bracketPos: pos, a: null, b: null, ...extra });

/** A played one: team `a` beats team `b` 2–1. */
const won = (round: number, pos: number, a: number, b: number, extra: Partial<TMatch> = {}): TMatch =>
  tie(round, pos, { a: team(a), b: team(b), status: "finished", score: { a: 2, b: 1 }, ...extra });

/** The tree as nested «round-pos@column» keys. */
type Shape = [string, ...Shape[]];
const shape = (node: BracketNode): Shape => [`${node.tie.key}@${node.column}`, ...node.feeders.map(shape)];

describe("buildBracket", () => {
  it("is nothing without a round and a position", () => {
    expect(buildBracket([match(1)])).toBeNull();
    expect(buildBracket([])).toBeNull();
  });

  it("hangs every tie under the one it leads to, by position while no team is known", () => {
    const bracket = buildBracket([tie(1, 1), tie(1, 2), tie(1, 3), tie(1, 4), tie(2, 1), tie(2, 2), tie(3, 1)])!;
    expect(bracket.roots.map(shape)).toEqual([
      ["3-1@2", ["2-1@1", ["1-1@0"], ["1-2@0"]], ["2-2@1", ["1-3@0"], ["1-4@0"]]],
    ]);
    expect(bracket.columns).toBe(3);
    expect(bracket.roundNames).toEqual(["Προημιτελικά", "Ημιτελικά", "Τελικός"]);
    expect(bracket.top).toEqual(["3-1"]);
  });

  it("follows the stored sources, and leaves a third-place match on its own beside the final", () => {
    const from = (round: number, pos: number, loser = false) => ({ round, pos, loser });
    const bracket = buildBracket([
      tie(1, 1),
      tie(1, 2),
      tie(2, 1, { sources: { a: from(1, 2), b: from(1, 1) } }),
      tie(2, 2, { sources: { a: from(1, 1, true), b: from(1, 2, true) } }),
    ])!;
    expect(bracket.roots.map(shape)).toEqual([["2-1@1", ["1-1@0"], ["1-2@0"]], ["2-2@1"]]);
    expect(isThirdPlace(bracket.roots[1], bracket)).toBe(true);
    expect(isThirdPlace(bracket.roots[0], bracket)).toBe(false);
    expect([...knockoutRounds(bracket)].map(([id, r]) => [id, r.name, r.order])).toEqual([
      [201, "Τελικός", 1],
      [101, "Ημιτελικά", 0],
      [102, "Ημιτελικά", 0],
      [202, "Μικρός τελικός", 1],
    ]);
  });

  it("follows the teams when nothing is stored: a final entered in the same round as the semi-finals", () => {
    // As in prod tournament 35: four quarter-finals in round 1; the two semi-finals AND the final all
    // stored as round 2 (positions 1, 2, 3); no sources; the semi-finals not in position order.
    const bracket = buildBracket([
      won(1, 1, 11, 21),
      won(1, 2, 12, 22),
      won(1, 3, 13, 23),
      won(1, 4, 14, 24),
      won(2, 1, 14, 13), // winners of 1-4 and 1-3
      won(2, 2, 11, 12), // winners of 1-1 and 1-2
      won(2, 3, 14, 11), // the final: winners of 2-1 and 2-2
    ])!;
    expect(bracket.roots.map(shape)).toEqual([
      ["2-3@2", ["2-1@1", ["1-3@0"], ["1-4@0"]], ["2-2@1", ["1-1@0"], ["1-2@0"]]],
    ]);
    expect(bracket.roundNames).toEqual(["Προημιτελικά", "Ημιτελικά", "Τελικός"]);
    const rounds = knockoutRounds(bracket);
    expect(rounds.get(203)).toEqual({ name: "Τελικός", order: 2 });
    expect(rounds.get(201)).toEqual({ name: "Ημιτελικά", order: 1 });
    expect(rounds.get(104)).toEqual({ name: "Προημιτελικά", order: 0 });
  });

  it("does not hang a tie under one its team LOST on the way to: the losers' match stands alone", () => {
    // Two semi-finals, the final between the winners, and a third-place match between the losers,
    // all entered without sources.
    const bracket = buildBracket([
      won(1, 1, 1, 2),
      won(1, 2, 3, 4),
      won(2, 1, 1, 3),
      won(2, 2, 2, 4), // the two losers
    ])!;
    expect(bracket.roots.map(shape)).toEqual([["2-1@1", ["1-1@0"], ["1-2@0"]], ["2-2@1"]]);
    expect(isThirdPlace(bracket.roots[1], bracket)).toBe(true);
  });

  it("names a tree that has not reached its final by the ties it has got to", () => {
    // Quarter-finals played, the two semi-finals set, no final entered yet.
    const bracket = buildBracket([
      won(1, 1, 1, 2),
      won(1, 2, 3, 4),
      won(1, 3, 5, 6),
      won(1, 4, 7, 8),
      tie(2, 1, { a: team(1), b: team(3) }),
      tie(2, 2, { a: team(5), b: team(7) }),
    ])!;
    expect(bracket.top).toEqual(["2-1", "2-2"]);
    expect(bracket.roundNames).toEqual(["Προημιτελικά", "Ημιτελικά"]);
    expect(isThirdPlace(bracket.roots[1], bracket)).toBe(false);
  });

  it("gives a single round no round names", () => {
    const bracket = buildBracket([won(1, 1, 1, 2), won(1, 2, 3, 4), won(1, 3, 5, 6)])!;
    expect(bracket.columns).toBe(1);
    expect(bracket.roundNames).toEqual([]);
    expect(bracket.roots.map(shape)).toEqual([["1-1@0"], ["1-2@0"], ["1-3@0"]]);
    expect(knockoutRounds(bracket).get(101)).toEqual({ name: "", order: 0 });
  });

  it("keeps a tie with one feeder (the other team had a bye)", () => {
    const bracket = buildBracket([tie(1, 1), tie(2, 1, { sources: { a: { round: 1, pos: 1, loser: false }, b: null } })])!;
    expect(bracket.roots.map(shape)).toEqual([["2-1@1", ["1-1@0"]]]);
  });

  it("reads a single match: the score, the shootout, the winner", () => {
    const [root] = buildBracket([
      tie(1, 1, { status: "finished", score: { a: 4, b: 4 }, pens: { a: 5, b: 4 }, a: team(1), b: team(2) }),
    ])!.roots;
    expect(root.tie).toMatchObject({
      a: team(1),
      b: team(2),
      winner: "a",
      pens: { a: 5, b: 4 },
      matchId: 101,
    });
    expect(root.tie.legs).toEqual([{ id: 101, date: null, status: "finished", score: { a: 4, b: 4 } }]);
  });

  it("prefers the winner the engine stored, and names none when a level match has no shootout", () => {
    const stored = tie(1, 1, { a: team(1), b: team(2), status: "finished", score: { a: 0, b: 0 }, winnerTeamId: 2 });
    expect(buildBracket([stored])!.roots[0].tie.winner).toBe("b");
    const level = tie(1, 1, { a: team(1), b: team(2), status: "finished", score: { a: 4, b: 4 } });
    expect(buildBracket([level])!.roots[0].tie.winner).toBeNull();
  });

  it("turns both legs of a tie to the same sides, the teams having swapped between them", () => {
    // Leg 1: team 1 at home wins 2–1. Leg 2: team 2 at home wins 1–0. One leg each → penalties, on leg 2.
    const leg1 = match(11, {
      stageId: 3, ko: true, round: 1, bracketPos: 1, leg: 1,
      a: team(1), b: team(2), status: "finished", score: { a: 2, b: 1 },
    });
    const leg2 = match(12, {
      stageId: 3, ko: true, round: 1, bracketPos: 1, leg: 2, leg1Id: 11,
      a: team(2), b: team(1), status: "finished", score: { a: 1, b: 0 }, pens: { a: 3, b: 5 },
    });
    const bracket = buildBracket([leg2, leg1])!;
    const [root] = bracket.roots;
    // The tie takes its sides from the decider: team 2 first.
    expect(root.tie.a).toEqual(team(2));
    expect(root.tie.legs.map((l) => l.score)).toEqual([
      { a: 1, b: 2 },
      { a: 1, b: 0 },
    ]);
    expect(root.tie.pens).toEqual({ a: 3, b: 5 });
    expect(root.tie.winner).toBe("b"); // team 1, on penalties
    expect(root.tie.matchId).toBe(12);
    // Both legs belong to the tie's round.
    expect([...knockoutRounds(bracket).keys()].sort()).toEqual([11, 12]);
  });

  it("opens the leg still to be played", () => {
    const leg1 = match(11, { stageId: 3, ko: true, round: 1, bracketPos: 1, leg: 1, status: "finished", score: { a: 1, b: 1 } });
    const leg2 = match(12, { stageId: 3, ko: true, round: 1, bracketPos: 1, leg: 2, a: team(2), b: team(1) });
    const [root] = buildBracket([leg1, leg2])!.roots;
    expect(root.tie.matchId).toBe(12);
    expect(root.tie.winner).toBeNull();
    expect(root.tie.pens).toBeNull();
    expect(root.tie.legs.map((l) => l.score)).toEqual([{ a: 1, b: 1 }, null]);
  });
});

// [matches, wins, goals, assists, mvp, best_gk, yellow, red, blue]
const player = (
  id: number,
  last: string,
  [matches, goals, assists, mvp, bestGk]: [number, number, number, number, number],
): PlayerLine => ({
  id,
  first: "Γιώργος",
  last,
  photo: null,
  former: false,
  href: null,
  teams: [team(1)],
  numbers: [matches, 0, goals, assists, mvp, bestGk, 0, 0, 0],
});

describe("rankScorers", () => {
  it("lists everyone with a goal, level players sharing a place", () => {
    const table = rankScorers([
      player(1, "Δέλτας", [5, 3, 0, 0, 0]),
      player(2, "Άλφας", [5, 7, 0, 0, 0]),
      player(3, "Γάμμας", [5, 3, 2, 0, 0]),
      player(4, "Βήτας", [4, 3, 0, 0, 0]),
      player(5, "Άσφαιρος", [5, 0, 4, 0, 0]),
      player(6, "Έψιλον", [5, 1, 0, 0, 0]),
    ]);
    // Level on goals: more assists first, then fewer matches.
    expect(table.map((p) => [p.rank, p.last])).toEqual([
      [1, "Άλφας"],
      [2, "Γάμμας"],
      [2, "Βήτας"],
      [2, "Δέλτας"],
      [5, "Έψιλον"],
    ]);
  });
});

describe("tournamentLeaders", () => {
  it("gives a card to each list's leader", () => {
    const leaders = tournamentLeaders([
      player(1, "Σκόρερ", [9, 12, 2, 1, 0]),
      player(2, "Δημιουργός", [9, 3, 8, 0, 0]),
      player(3, "Πολύτιμος", [8, 4, 1, 4, 0]),
      player(4, "Τερματοφύλακας", [9, 0, 0, 1, 3]),
    ]);
    expect(leaders.map((l) => [l.player.last, l.label, l.note])).toEqual([
      ["Σκόρερ", "Πρώτος σκόρερ", "12 γκολ, 2 ασίστ, 1 MVP σε 9 αγώνες"],
      ["Δημιουργός", "Πρώτος σε ασίστ", "3 γκολ, 8 ασίστ σε 9 αγώνες"],
      ["Πολύτιμος", "Περισσότερα MVP", "4 γκολ, 1 ασίστ, 4 MVP σε 8 αγώνες"],
      ["Τερματοφύλακας", "Καλύτερος τερματοφύλακας", "1 MVP, 3 βραβεία τερματοφύλακα σε 9 αγώνες"],
    ]);
  });

  it("gives one card to a player who leads more than one list", () => {
    const leaders = tournamentLeaders([player(1, "Όλα", [1, 5, 4, 1, 0]), player(2, "Άλλος", [3, 1, 1, 0, 0])]);
    expect(leaders).toHaveLength(1);
    expect(leaders[0].label).toBe("Πρώτος σκόρερ, πρώτος σε ασίστ και περισσότερα MVP");
    expect(leaders[0].note).toBe("5 γκολ, 4 ασίστ, 1 MVP σε 1 αγώνα");
  });

  it("breaks a tie by the other number, then fewer matches, then surname", () => {
    expect(
      tournamentLeaders([player(1, "Άλφας", [8, 5, 1, 0, 0]), player(2, "Βήτας", [8, 5, 3, 0, 0])])[0].player.last,
    ).toBe("Βήτας");
    expect(
      tournamentLeaders([player(1, "Άλφας", [9, 5, 0, 0, 0]), player(2, "Γάμμας", [6, 5, 0, 0, 0])])[0].player.last,
    ).toBe("Γάμμας");
    expect(
      tournamentLeaders([player(1, "Γάμμας", [8, 5, 0, 0, 0]), player(2, "Βήτας", [8, 5, 0, 0, 0])])[0].player.last,
    ).toBe("Βήτας");
  });

  it("gives nothing when nobody has a number to lead with", () => {
    expect(tournamentLeaders([player(1, "Άσφαιρος", [4, 0, 0, 0, 0])])).toEqual([]);
  });
});
