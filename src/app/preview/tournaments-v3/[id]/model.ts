// What the tournament pages show, as plain data — and the rules that decide
// it: who won a match, what a round is called, how matches split into fixtures
// and results, how the knockout tree hangs together, who leads the scorers.
// Pure, so it can be tested without a database.
import {
  decideSingleLegKO,
  decideTwoLeggedTie,
  type TieLegLite,
} from "@/app/dashboard/tournaments/TournamentCURD/util/functions/twoLeggedTie";
import { toNaiveIso } from "@/app/lib/datetime";
import type { MatchPlayer, MatchTeam } from "@/app/matches/[id]/model";
import type { StatTuple } from "../../paiktes-v2/model";

export type TTeam = MatchTeam;
export type Pair = { a: number; b: number };

// ───────────────────────────────────────────────────────────────────────
// Stages
// ───────────────────────────────────────────────────────────────────────

export type StageKind = "league" | "groups" | "knockout";

export type TStage = {
  id: number;
  name: string;
  kind: StageKind;
  groups: { id: number; name: string }[];
  /**
   * How many teams of each table go through to the knockout stage that takes
   * its entrants from this stage; null when no later stage does.
   */
  advancers: number | null;
};

/** A tournament_stages row, as stored. */
export type RawStage = {
  id: number;
  name: string | null;
  kind: string | null;
  ordering: number | null;
  config: Record<string, unknown> | null;
};

export const stageKind = (kind: string | null): StageKind =>
  kind === "knockout" ? "knockout" : kind === "groups" ? "groups" : "league";

/**
 * The same numbers the progression engine seeds the knockout stage with
 * (dashboard/tournaments/TournamentCURD/progression.ts): from groups,
 * `advancers_per_group` each (2 if unset); from a league, `advancers_total`
 * (else the bracket size, else 8).
 */
export function advancersOf(stage: RawStage, all: RawStage[]): number | null {
  if (stageKind(stage.kind) === "knockout") return null;
  const next = all.find(
    (s) =>
      stageKind(s.kind) === "knockout" &&
      (s.ordering ?? 0) > (stage.ordering ?? 0) &&
      (s.config?.from_stage_id === stage.id || s.config?.fromStageId === stage.id),
  );
  if (!next) return null;
  const config = next.config ?? {};
  const n =
    stageKind(stage.kind) === "groups"
      ? Math.max(1, Number(config.advancers_per_group ?? 2))
      : Math.max(2, Number(config.advancers_total ?? config.standalone_bracket_size ?? 8));
  return Number.isFinite(n) ? Math.floor(n) : null;
}

// ───────────────────────────────────────────────────────────────────────
// Matches
// ───────────────────────────────────────────────────────────────────────

export type MatchStatus = "scheduled" | "postponed" | "finished";

/** Where a knockout slot's team comes from: a match of an earlier round. */
export type Source = { round: number; pos: number; loser: boolean };

export type TMatch = {
  id: number;
  stageId: number | null;
  groupId: number | null;
  matchday: number | null;
  round: number | null;
  bracketPos: number | null;
  /** Raw match_date: literal kick-off wall-clock. Format with lib/datetime.ts. */
  date: string | null;
  status: MatchStatus;
  a: TTeam | null;
  b: TTeam | null;
  /** Present once the match is finished. */
  score: Pair | null;
  pens: Pair | null;
  /** matches.winner_team_id, as the progression engine stored it. */
  winnerTeamId: number | null;
  leg: number | null;
  leg1Id: number | null;
  /** Knockout match: a draw is not a final answer. */
  ko: boolean;
  sources: { a: Source | null; b: Source | null };
};

/** Who won the match itself: by score, a level single-leg knockout by its shootout. */
export function matchWinner(m: TMatch): "a" | "b" | null {
  if (m.status !== "finished" || !m.score) return null;
  if (m.score.a !== m.score.b) return m.score.a > m.score.b ? "a" : "b";
  if (m.ko && m.leg == null && m.pens && m.pens.a !== m.pens.b) return m.pens.a > m.pens.b ? "a" : "b";
  return null;
}

/** «Τελικός», «Ημιτελικά», «Προημιτελικά», «Φάση των 16» — by how many ties the round has. */
export function roundName(ties: number): string {
  if (ties <= 1) return "Τελικός";
  if (ties === 2) return "Ημιτελικά";
  if (ties === 4) return "Προημιτελικά";
  return `Φάση των ${ties * 2}`;
}

/** Where a knockout match sits in its stage's tree (see buildBracket). */
export type KnockoutRound = {
  /** «Ημιτελικά»… Empty when the stage is a single round: nothing to tell it apart from. */
  name: string;
  /** Column of the tree, 0 = the earliest round. */
  order: number;
};

export type LabelContext = {
  stages: Map<number, TStage>;
  /** By match id. A knockout match's round is read from the tree, never from its stored round number. */
  knockout: Map<number, KnockoutRound>;
};

/** A stage's name is worth printing only when there is another stage of its kind to tell it from. */
function stagePrefix(m: TMatch, ctx: LabelContext): string | null {
  const stage = m.stageId != null ? ctx.stages.get(m.stageId) : undefined;
  if (!stage) return null;
  const knockout = stage.kind === "knockout";
  const alike = [...ctx.stages.values()].filter((s) => (s.kind === "knockout") === knockout);
  return alike.length > 1 ? stage.name : null;
}

/** The round a match belongs to: «5η αγωνιστική» / «Ημιτελικά» / «Νοκ άουτ». Empty when unknown. */
export function roundLabel(m: TMatch, ctx: LabelContext): string {
  const parts: string[] = [];
  const prefix = stagePrefix(m, ctx);
  if (prefix) parts.push(prefix);
  if (m.ko) {
    const name = ctx.knockout.get(m.id)?.name;
    if (name) parts.push(name);
    else if (parts.length === 0) parts.push("Νοκ άουτ");
  } else if (m.matchday != null) {
    parts.push(`${m.matchday}η αγωνιστική`);
  }
  return parts.join(", ");
}

/** What a match row adds to its round: the group, or which leg it is. */
export function matchNote(m: TMatch, ctx: LabelContext): string | null {
  if (m.leg === 1) return "1ος αγώνας";
  if (m.leg === 2) return "Ρεβάνς";
  const stage = m.stageId != null ? ctx.stages.get(m.stageId) : undefined;
  if (stage && m.groupId != null) return stage.groups.find((g) => g.id === m.groupId)?.name ?? null;
  return null;
}

const kickoff = (m: TMatch) => (m.date ? toNaiveIso(m.date) : null);

export type MatchLists = {
  /** Scheduled, dated, kick-off still ahead; soonest first. */
  upcoming: TMatch[];
  /** Kick-off has passed but the result is not in yet. */
  awaiting: TMatch[];
  postponed: TMatch[];
  /** Scheduled without a date yet. */
  undated: TMatch[];
  /** Finished, newest first. */
  results: TMatch[];
};

/**
 * `nowIso` is the current Athens wall-clock as a zone-less ISO string
 * (lib/datetime nowWallClockIso): the same shape as a match date, so "has it
 * kicked off?" is a plain comparison of digits.
 */
export function splitMatches(matches: TMatch[], nowIso: string): MatchLists {
  const byDate = (missing: string) => (x: TMatch, y: TMatch) =>
    (kickoff(x) ?? missing).localeCompare(kickoff(y) ?? missing) || x.id - y.id;
  const byRound = (x: TMatch, y: TMatch) =>
    (x.matchday ?? x.round ?? 9999) - (y.matchday ?? y.round ?? 9999) || x.id - y.id;
  const ahead = (m: TMatch) => {
    const k = kickoff(m);
    return k !== null && nowIso < k;
  };
  const scheduled = matches.filter((m) => m.status === "scheduled").sort(byDate("9999"));
  return {
    upcoming: scheduled.filter(ahead),
    awaiting: scheduled.filter((m) => m.date != null && !ahead(m)),
    postponed: matches.filter((m) => m.status === "postponed").sort(byRound),
    undated: scheduled.filter((m) => m.date == null).sort(byRound),
    // A result without a date is the oldest, never "the latest result".
    results: matches
      .filter((m) => m.status === "finished" && m.score)
      .sort(byDate("0000"))
      .reverse(),
  };
}

export type MatchGroup = { key: string; title: string; matches: TMatch[] };

/** Matches of one calendar day together, days in the order given. `title` is the day's first match date. */
export function groupByDay(matches: TMatch[]): MatchGroup[] {
  const groups = new Map<string, MatchGroup>();
  for (const m of matches) {
    const key = (kickoff(m) ?? "").slice(0, 10);
    const group = groups.get(key) ?? { key, title: m.date ?? "", matches: [] };
    group.matches.push(m);
    groups.set(key, group);
  }
  return [...groups.values()];
}

/**
 * Matches of one round together (a league matchday, a knockout round). With
 * `latestFirst` the groups run backwards through the competition — last stage
 * first, then the highest matchday or round — whatever day each match was
 * actually played, so a match played late stays with its matchday.
 */
export function groupByRound(
  matches: TMatch[],
  ctx: LabelContext,
  stageOrder: number[],
  latestFirst: boolean,
): MatchGroup[] {
  const groups = new Map<string, MatchGroup & { stage: number; round: number }>();
  for (const m of matches) {
    const round = (m.ko ? ctx.knockout.get(m.id)?.order : m.matchday) ?? -1;
    const key = `${m.stageId ?? 0}:${m.ko ? "r" : "d"}${round}`;
    const group = groups.get(key) ?? {
      key,
      title: roundLabel(m, ctx) || "Άλλοι αγώνες",
      matches: [],
      stage: m.stageId != null ? stageOrder.indexOf(m.stageId) : -1,
      round,
    };
    group.matches.push(m);
    groups.set(key, group);
  }
  const direction = latestFirst ? -1 : 1;
  return [...groups.values()]
    .sort((x, y) => direction * (x.stage - y.stage || x.round - y.round))
    .map(({ key, title, matches: list }) => ({ key, title, matches: list }));
}

// ───────────────────────────────────────────────────────────────────────
// Tables
// ───────────────────────────────────────────────────────────────────────

export type TableRow = {
  team: TTeam;
  rank: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
};

export type Table = { key: string; groupName: string | null; rows: TableRow[] };

export type StageTables = { stage: TStage; tables: Table[] };

/** Where a team stands in the latest stage that has a table with it. `stages` in competition order. */
export function standingOf(
  stages: StageTables[],
  teamId: number,
): { rank: number; points: number; groupName: string | null } | null {
  for (const { tables } of [...stages].reverse()) {
    for (const table of tables) {
      const row = table.rows.find((r) => r.team.id === teamId);
      if (row) return { rank: row.rank, points: row.points, groupName: table.groupName };
    }
  }
  return null;
}

// ───────────────────────────────────────────────────────────────────────
// The line under the tournament's name
// ───────────────────────────────────────────────────────────────────────

export type Headline =
  | { kind: "champion"; team: TTeam }
  /** Matches are being played. `leader` only when one table decides it. */
  | { kind: "running"; played: number; total: number; leader: { team: TTeam; points: number } | null }
  /** Nothing played yet. */
  | { kind: "upcoming"; firstDate: string | null }
  /** Everything played, no winner recorded. */
  | { kind: "over"; played: number };

export function headline(input: {
  winner: TTeam | null;
  status: string | null;
  matches: TMatch[];
  /** In competition order. */
  tables: StageTables[];
}): Headline {
  if (input.winner) return { kind: "champion", team: input.winner };
  const played = input.matches.filter((m) => m.status === "finished").length;
  const total = input.matches.length;
  if (played === 0) {
    const dates = input.matches.map(kickoff).filter((d): d is string => d !== null).sort();
    const first = dates.length ? (input.matches.find((m) => kickoff(m) === dates[0])?.date ?? null) : null;
    return { kind: "upcoming", firstDate: first };
  }
  if (played >= total || input.status === "completed" || input.status === "archived") {
    return { kind: "over", played };
  }
  // A leader is named only while a single league table is what is being played.
  const last = input.tables[input.tables.length - 1];
  const knockoutStarted = input.matches.some((m) => m.ko && m.status === "finished");
  const top = last && last.tables.length === 1 && !knockoutStarted ? last.tables[0].rows[0] : undefined;
  return {
    kind: "running",
    played,
    total,
    leader: top && top.played > 0 ? { team: top.team, points: top.points } : null,
  };
}

// ───────────────────────────────────────────────────────────────────────
// The knockout tree
// ───────────────────────────────────────────────────────────────────────

/** One meeting of a tie, its score turned to the tie's own sides. */
export type Leg = {
  id: number;
  date: string | null;
  status: MatchStatus;
  score: Pair | null;
};

/** Two teams meeting in one slot of the tree: one match, or two legs. */
export type Tie = {
  key: string;
  round: number;
  pos: number;
  a: TTeam | null;
  b: TTeam | null;
  /** In playing order. A two-legged tie is decided on leg wins, never on goals added up. */
  legs: Leg[];
  pens: Pair | null;
  winner: "a" | "b" | null;
  /** The match page to open: the decider, or the leg still to be played. */
  matchId: number;
  sources: { a: Source | null; b: Source | null };
};

export type BracketNode = {
  tie: Tie;
  /** The earlier ties its teams came through, top to bottom. */
  feeders: BracketNode[];
  /** Column of the drawing, 0 = the earliest round shown. */
  column: number;
};

export type Bracket = {
  /** How many rounds the drawing has. */
  columns: number;
  /** A name per column, earliest first. Empty when there is one round only: nothing to tell apart. */
  roundNames: string[];
  /** The ties nothing leads on from: the final (or, mid-way, the latest round) first, then the rest. */
  roots: BracketNode[];
  /** Keys of the ties that close the tree: one = the final. */
  top: string[];
};

const asLeg = (m: TMatch): TieLegLite => ({
  team_a_id: m.a?.id ?? null,
  team_b_id: m.b?.id ?? null,
  team_a_score: m.score?.a ?? null,
  team_b_score: m.score?.b ?? null,
  penalty_a: m.pens?.a ?? null,
  penalty_b: m.pens?.b ?? null,
  status: m.status === "finished" ? "finished" : "scheduled",
});

/** A match's pair of numbers turned to face the tie's sides (the teams swap between legs). */
function facing(pair: Pair | null, match: TMatch, a: TTeam | null): Pair | null {
  if (!pair) return null;
  const swapped = a != null && match.b?.id === a.id;
  return swapped ? { a: pair.b, b: pair.a } : pair;
}

function buildTie(round: number, pos: number, rows: TMatch[]): Tie {
  const legs = [...rows].sort((x, y) => (x.leg ?? 0) - (y.leg ?? 0) || x.id - y.id);
  // The decider carries the tie: the second leg when there is one.
  const decider = legs[legs.length - 1];
  const first = legs.length > 1 ? legs[0] : null;
  const a = decider.a ?? first?.b ?? null;
  const b = decider.b ?? first?.a ?? null;

  let winnerId: number | null = decider.winnerTeamId;
  if (winnerId == null && decider.status === "finished") {
    const res = first ? decideTwoLeggedTie(asLeg(decider), asLeg(first)) : decideSingleLegKO(asLeg(decider));
    if (res.kind === "decided") winnerId = res.winnerTeamId;
  }

  const open = legs.find((l) => l.status !== "finished");
  return {
    key: `${round}-${pos}`,
    round,
    pos,
    a,
    b,
    legs: legs.map((l) => ({ id: l.id, date: l.date, status: l.status, score: facing(l.score, l, a) })),
    pens: decider.status === "finished" ? facing(decider.pens, decider, a) : null,
    winner: winnerId == null ? null : a?.id === winnerId ? "a" : b?.id === winnerId ? "b" : null,
    matchId: (open ?? decider).id,
    sources: decider.sources,
  };
}

/**
 * The tree of one knockout stage.
 *
 * A tie's feeders are the earlier ties its teams came through. Where they
 * come from, in order of trust:
 *   1. what the planner stored (source round + position). A slot fed by a
 *      LOSER is not a branch — that is a third-place match;
 *   2. the teams themselves: a team's feeder is the last tie it played before
 *      this one, if it won it. This is what holds real tournaments together:
 *      many were entered by hand, with no sources and the final stored in the
 *      same round number as the semi-finals (prod tournament 35), so neither
 *      the round number nor the position can be trusted;
 *   3. position (slots 2p−1 and 2p of the round before), for a side whose
 *      team is not known yet.
 *
 * The drawing's columns follow the tree, not the stored round numbers: a tie
 * stands one column after its feeders, and the rounds are named by how many
 * ties close the tree (one = the final).
 */
export function buildBracket(matches: TMatch[]): Bracket | null {
  const slots = new Map<string, TMatch[]>();
  for (const m of matches) {
    if (m.round == null || m.bracketPos == null) continue;
    const key = `${m.round}-${m.bracketPos}`;
    slots.set(key, [...(slots.get(key) ?? []), m]);
  }
  if (slots.size === 0) return null;

  const ties = new Map<string, Tie>();
  for (const [key, rows] of slots) {
    const [round, pos] = key.split("-").map(Number);
    ties.set(key, buildTie(round, pos, rows));
  }
  const all = [...ties.values()];
  /** Playing order: by round, then by position within it. */
  const at = (t: Tie) => t.round * 100_000 + t.pos;
  const winnerId = (t: Tie) => (t.winner === "a" ? t.a?.id : t.winner === "b" ? t.b?.id : undefined) ?? null;

  /** The tie a team came through: the last one it played before `tie`, if it won it. */
  const cameThrough = (tie: Tie, teamId: number): Tie | null => {
    let last: Tie | null = null;
    for (const other of all) {
      if (at(other) >= at(tie)) continue;
      if (other.a?.id !== teamId && other.b?.id !== teamId) continue;
      if (!last || at(other) > at(last)) last = other;
    }
    return last && winnerId(last) === teamId ? last : null;
  };

  const feederKeys = (tie: Tie): string[] => {
    const stored = [tie.sources.a, tie.sources.b];
    if (stored.some((s) => s !== null)) {
      return stored.filter((s): s is Source => s !== null && !s.loser).map((s) => `${s.round}-${s.pos}`);
    }
    const keys: string[] = [];
    const byPosition = [`${tie.round - 1}-${tie.pos * 2 - 1}`, `${tie.round - 1}-${tie.pos * 2}`];
    for (const team of [tie.a, tie.b]) {
      if (team) {
        const from = cameThrough(tie, team.id);
        if (from && !keys.includes(from.key)) keys.push(from.key);
      } else {
        const free = byPosition.find((k) => ties.has(k) && !keys.includes(k));
        if (free) keys.push(free);
      }
    }
    return keys;
  };

  type Grown = { tie: Tie; feeders: Grown[]; height: number };
  const claimed = new Set<string>();
  const grow = (tie: Tie): Grown => {
    const feeders: Grown[] = [];
    for (const key of feederKeys(tie)) {
      const feeder = ties.get(key);
      if (!feeder || claimed.has(key) || at(feeder) >= at(tie)) continue;
      claimed.add(key);
      feeders.push(grow(feeder));
    }
    feeders.sort((x, y) => at(x.tie) - at(y.tie));
    return { tie, feeders, height: 1 + Math.max(0, ...feeders.map((f) => f.height)) };
  };

  // From the last tie played backwards, so every tie hangs under the one it leads to.
  const grown: Grown[] = [];
  for (const tie of [...all].sort((x, y) => at(y) - at(x))) {
    if (claimed.has(tie.key)) continue;
    claimed.add(tie.key);
    grown.push(grow(tie));
  }

  // The deepest trees close the drawing, in its last column. Anything else that
  // nothing leads on from (a third-place match, a tie not linked yet) stands in
  // the column its round has in those trees.
  const columns = Math.max(...grown.map((g) => g.height));
  const columnOfRound = new Map<number, number>();
  const place = (g: Grown, column: number): BracketNode => {
    columnOfRound.set(g.tie.round, Math.max(columnOfRound.get(g.tie.round) ?? 0, column));
    return { tie: g.tie, column, feeders: g.feeders.map((f) => place(f, column - 1)) };
  };
  const byPlay = (x: Grown, y: Grown) => at(x.tie) - at(y.tie);
  const top = grown.filter((g) => g.height === columns).sort(byPlay);
  const roots = top.map((g) => place(g, columns - 1));
  for (const g of grown.filter((x) => x.height < columns).sort(byPlay)) {
    roots.push(place(g, Math.max(g.height - 1, columnOfRound.get(g.tie.round) ?? columns - 1)));
  }

  return {
    columns,
    roundNames:
      columns > 1 ? Array.from({ length: columns }, (_, i) => roundName(top.length * 2 ** (columns - 1 - i))) : [],
    roots,
    top: top.map((g) => g.tie.key),
  };
}

/**
 * A tie standing beside the final with nothing leading into it: the match for
 * third place.
 */
export const isThirdPlace = (node: BracketNode, bracket: Bracket) =>
  bracket.top.length === 1 &&
  bracket.columns > 1 &&
  node.feeders.length === 0 &&
  node.column === bracket.columns - 1 &&
  !bracket.top.includes(node.tie.key);

/** Every match of a stage's tree with its round: its column, and the column's name. */
export function knockoutRounds(bracket: Bracket): Map<number, KnockoutRound> {
  const out = new Map<number, KnockoutRound>();
  const walk = (node: BracketNode) => {
    const name = isThirdPlace(node, bracket) ? "Μικρός τελικός" : (bracket.roundNames[node.column] ?? "");
    for (const leg of node.tie.legs) out.set(leg.id, { name, order: node.column });
    node.feeders.forEach(walk);
  };
  bracket.roots.forEach(walk);
  return out;
}

// ───────────────────────────────────────────────────────────────────────
// Players
// ───────────────────────────────────────────────────────────────────────

export type PlayerLine = MatchPlayer & {
  /** His teams in this tournament (almost always one). */
  teams: TTeam[];
  /** His numbers in this tournament. */
  numbers: StatTuple;
};

// Positions in a StatTuple.
const MATCHES = 0;
const GOALS = 2;
const ASSISTS = 3;
const MVP = 4;
const BEST_GK = 5;

const surname = (p: { first: string; last: string }) => p.last || p.first;

const byName = (a: PlayerLine, b: PlayerLine) =>
  surname(a).localeCompare(surname(b), "el") || a.first.localeCompare(b.first, "el") || a.id - b.id;

/**
 * The scorers' table: everyone with a goal, most goals first (then assists,
 * then fewer matches, then surname). Players level on goals share a place and
 * the next place skips: 1, 2, 2, 4.
 */
export function rankScorers(players: PlayerLine[]): (PlayerLine & { rank: number })[] {
  const sorted = players
    .filter((p) => p.numbers[GOALS] > 0)
    .sort(
      (a, b) =>
        b.numbers[GOALS] - a.numbers[GOALS] ||
        b.numbers[ASSISTS] - a.numbers[ASSISTS] ||
        a.numbers[MATCHES] - b.numbers[MATCHES] ||
        byName(a, b),
    );
  let rank = 0;
  let previous: number | null = null;
  return sorted.map((p, index) => {
    if (previous === null || p.numbers[GOALS] !== previous) rank = index + 1;
    previous = p.numbers[GOALS];
    return { ...p, rank };
  });
}

export type Leader = { player: PlayerLine; label: string; note: string };

const TITLES = [
  { label: "Πρώτος σκόρερ", index: GOALS, then: ASSISTS },
  { label: "Πρώτος σε ασίστ", index: ASSISTS, then: GOALS },
  { label: "Περισσότερα MVP", index: MVP, then: GOALS },
  { label: "Καλύτερος τερματοφύλακας", index: BEST_GK, then: MVP },
] as const;

const lowerFirst = (s: string) => s.charAt(0).toLocaleLowerCase("el") + s.slice(1);

function leaderNote(n: StatTuple): string {
  const parts: string[] = [];
  if (n[GOALS] > 0) parts.push(`${n[GOALS]} γκολ`);
  if (n[ASSISTS] > 0) parts.push(`${n[ASSISTS]} ασίστ`);
  if (n[MVP] > 0) parts.push(`${n[MVP]} MVP`);
  if (n[BEST_GK] > 0) parts.push(`${n[BEST_GK]} ${n[BEST_GK] === 1 ? "βραβείο" : "βραβεία"} τερματοφύλακα`);
  return `${parts.join(", ")} σε ${n[MATCHES]} ${n[MATCHES] === 1 ? "αγώνα" : "αγώνες"}`;
}

/**
 * The big cards: the leading scorer, the leading creator, the most MVP awards
 * and the most best-goalkeeper awards of the tournament. One player leading
 * more than one list gets a single card naming them all. Ties: the other
 * number, then fewer matches to get there, then surname.
 */
export function tournamentLeaders(players: PlayerLine[]): Leader[] {
  const leaders: { player: PlayerLine; labels: string[] }[] = [];
  for (const title of TITLES) {
    let best: PlayerLine | null = null;
    for (const player of players) {
      const n = player.numbers;
      if (n[title.index] <= 0) continue;
      if (!best) {
        best = player;
        continue;
      }
      const b = best.numbers;
      const diff = n[title.index] - b[title.index] || n[title.then] - b[title.then] || b[MATCHES] - n[MATCHES];
      if (diff > 0 || (diff === 0 && byName(player, best) < 0)) best = player;
    }
    if (!best) continue;
    const holder = leaders.find((l) => l.player.id === best!.id);
    if (holder) holder.labels.push(title.label);
    else leaders.push({ player: best, labels: [title.label] });
  }
  return leaders.map(({ player, labels }) => ({
    player,
    label:
      labels.length === 1
        ? labels[0]
        : `${[labels[0], ...labels.slice(1, -1).map(lowerFirst)].join(", ")} και ${lowerFirst(labels[labels.length - 1])}`,
    note: leaderNote(player.numbers),
  }));
}

// ───────────────────────────────────────────────────────────────────────
// Squads
// ───────────────────────────────────────────────────────────────────────

export type SquadMember = MatchPlayer & {
  /** His goals in this tournament. */
  goals: number;
};

export type Squad = { team: TTeam; players: SquadMember[] };

/** Squad order: by surname. */
export function orderMembers(players: SquadMember[]): SquadMember[] {
  return [...players].sort(
    (a, b) => surname(a).localeCompare(surname(b), "el") || a.first.localeCompare(b.first, "el") || a.id - b.id,
  );
}
