// What the team page shows, as plain data — and the rules that decide it: how
// a finished match reads from the team's side, how its matches split into
// fixtures and results, each player's numbers with the team, who gets the big
// card. Pure, so it can be tested without a database.
//
// The match rules (sideResult, the schedule split, the labels, the goalkeeper
// rule, the table window) are the ones of the player area — src/app/lib/profile
// on branch feat/player-profile-area — so a team's results read the same on
// its public page and in its players' own area. When that branch lands, import
// them from there and delete the copies here.
import {
  decideSingleLegKO,
  decideTwoLeggedTie,
  type TieLegLite,
} from "@/app/dashboard/tournaments/TournamentCURD/util/functions/twoLeggedTie";
import { toNaiveIso } from "@/app/lib/datetime";
import type { MatchPlayer, MatchTeam } from "../../matches-v3/[id]/model";
import type { StatTuple } from "../../paiktes-v2/model";

export type TeamRef = MatchTeam;

// ───────────────────────────────────────────────────────────────────────
// A finished match from one team's side
// ───────────────────────────────────────────────────────────────────────

export type Outcome = "W" | "D" | "L";

export const OUTCOME_LETTER: Record<Outcome, string> = { W: "Ν", D: "Ι", L: "Η" };
export const OUTCOME_WORD: Record<Outcome, string> = { W: "Νίκη", D: "Ισοπαλία", L: "Ήττα" };

export type MatchLike = {
  id: number;
  team_a_id: number | null;
  team_b_id: number | null;
  team_a_score: number | null;
  team_b_score: number | null;
  status: string | null;
  leg?: number | null;
  tie_leg1_match_id?: number | null;
  penalty_a?: number | null;
  penalty_b?: number | null;
};

export type TieContext = {
  leg: 1 | 2;
  /** First-leg score from this team's side (leg 2 only, when it was played). */
  firstLeg: { own: number; opp: number } | null;
  verdict: "advanced" | "eliminated" | "pending";
  via: "wins" | "penalties" | null;
};

export type SideResult = {
  own: number;
  opp: number;
  /** This match from the team's side. A level single-leg knockout takes the shootout winner. */
  outcome: Outcome;
  /** The shootout, when one decided this match or tie. */
  pens: { own: number; opp: number } | null;
  tie: TieContext | null;
};

const asLeg = (m: MatchLike): TieLegLite => ({
  team_a_id: m.team_a_id,
  team_b_id: m.team_b_id,
  team_a_score: m.team_a_score,
  team_b_score: m.team_b_score,
  penalty_a: m.penalty_a ?? null,
  penalty_b: m.penalty_b ?? null,
  status: m.status === "finished" ? "finished" : "scheduled",
});

function sidePens(m: MatchLike, isA: boolean): { own: number; opp: number } | null {
  if (m.penalty_a == null || m.penalty_b == null) return null;
  return isA ? { own: m.penalty_a, opp: m.penalty_b } : { own: m.penalty_b, opp: m.penalty_a };
}

/**
 * `ko` = the match is a knockout match (a draw is not a final answer).
 * `leg1` = the first-leg row when `m` is a leg-2 decider.
 * Returns null unless the match is finished and `teamId` played in it.
 *
 * Winners of knockout matches come from the shared helpers every writer uses
 * (decideSingleLegKO / decideTwoLeggedTie), never re-derived here.
 */
export function sideResult(
  m: MatchLike,
  teamId: number,
  ko: boolean,
  leg1?: MatchLike | null,
): SideResult | null {
  if (m.status !== "finished") return null;
  const isA = m.team_a_id === teamId;
  if (!isA && m.team_b_id !== teamId) return null;
  const own = Number((isA ? m.team_a_score : m.team_b_score) ?? 0);
  const opp = Number((isA ? m.team_b_score : m.team_a_score) ?? 0);
  const byScore: Outcome = own > opp ? "W" : own < opp ? "L" : "D";

  if (m.leg === 1) {
    return { own, opp, outcome: byScore, pens: null, tie: { leg: 1, firstLeg: null, verdict: "pending", via: null } };
  }

  if (m.leg === 2 && leg1) {
    const res = decideTwoLeggedTie(asLeg(m), asLeg(leg1));
    const firstIsA = leg1.team_a_id === teamId;
    const firstLeg =
      leg1.status === "finished"
        ? {
            own: Number((firstIsA ? leg1.team_a_score : leg1.team_b_score) ?? 0),
            opp: Number((firstIsA ? leg1.team_b_score : leg1.team_a_score) ?? 0),
          }
        : null;
    if (res.kind === "decided") {
      return {
        own,
        opp,
        outcome: byScore,
        pens: res.via === "penalties" ? sidePens(m, isA) : null,
        tie: {
          leg: 2,
          firstLeg,
          verdict: res.winnerTeamId === teamId ? "advanced" : "eliminated",
          via: res.via,
        },
      };
    }
    if (res.kind !== "single") {
      return { own, opp, outcome: byScore, pens: null, tie: { leg: 2, firstLeg, verdict: "pending", via: null } };
    }
  }

  if (ko) {
    const res = decideSingleLegKO(asLeg(m));
    if (res.kind === "decided" && res.via === "penalties") {
      return { own, opp, outcome: res.winnerTeamId === teamId ? "W" : "L", pens: sidePens(m, isA), tie: null };
    }
  }
  return { own, opp, outcome: byScore, pens: null, tie: null };
}

// ───────────────────────────────────────────────────────────────────────
// The team's matches
// ───────────────────────────────────────────────────────────────────────

export type MatchStatus = "scheduled" | "postponed" | "finished";

/** One match seen from the team. */
export type TeamMatch = {
  id: number;
  opponent: TeamRef | null;
  /** Raw match_date: literal kick-off wall-clock. Format with lib/datetime.ts. */
  date: string | null;
  status: MatchStatus;
  competition: { id: number; name: string } | null;
  stageName: string | null;
  groupName: string | null;
  matchday: number | null;
  leg: number | null;
  /** Knockout match: a draw is not a final answer. */
  ko: boolean;
  /** Present once the match is finished. */
  result: SideResult | null;
};

export type Schedule = {
  /** First scheduled match whose kick-off is still ahead. */
  next: TeamMatch | null;
  /** Scheduled, dated, kick-off still ahead; soonest first. */
  upcoming: TeamMatch[];
  /** Kick-off has passed but the result is not in yet. */
  awaiting: TeamMatch[];
  postponed: TeamMatch[];
  /** Scheduled without a date yet. */
  undated: TeamMatch[];
  /** Finished, newest first. */
  results: TeamMatch[];
  /** Outcomes of the last five finished matches, oldest first. */
  form: Outcome[];
};

const kickoff = (m: TeamMatch) => (m.date ? toNaiveIso(m.date) : null);

/**
 * Split the team's matches into the lists the page shows. `nowIso` is the
 * current Athens wall-clock as a zone-less ISO string (lib/datetime
 * nowWallClockIso) — the same shape as a match date, so "has it kicked off?"
 * is a plain comparison of digits.
 */
export function splitSchedule(matches: TeamMatch[], nowIso: string): Schedule {
  const byDate = (missing: string) => (a: TeamMatch, b: TeamMatch) =>
    (kickoff(a) ?? missing).localeCompare(kickoff(b) ?? missing) || a.id - b.id;

  // Not played yet: a match without a date goes last.
  const pending = [...matches].sort(byDate("9999"));
  const scheduled = pending.filter((m) => m.status === "scheduled");
  const ahead = (m: TeamMatch) => {
    const k = kickoff(m);
    return k !== null && nowIso < k;
  };
  const upcoming = scheduled.filter(ahead);

  // Played: a result without a date is the oldest, never "the latest result".
  const finished = matches.filter((m) => m.status === "finished" && m.result).sort(byDate("0000"));

  // No date to go by: the order they are meant to be played in.
  const byMatchday = (a: TeamMatch, b: TeamMatch) =>
    (a.matchday ?? 9999) - (b.matchday ?? 9999) || a.id - b.id;

  return {
    next: upcoming[0] ?? null,
    upcoming,
    awaiting: scheduled.filter((m) => m.date != null && !ahead(m)),
    postponed: pending.filter((m) => m.status === "postponed").sort(byMatchday),
    undated: scheduled.filter((m) => m.date == null).sort(byMatchday),
    results: [...finished].reverse(),
    form: finished.slice(-5).map((m) => m.result!.outcome),
  };
}

export type SeasonRecord = {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
};

/** The team's season in six numbers. A knockout match decided on penalties counts as won or lost. */
export function seasonRecord(results: TeamMatch[]): SeasonRecord {
  const record: SeasonRecord = { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0 };
  for (const { result } of results) {
    if (!result) continue;
    record.played += 1;
    if (result.outcome === "W") record.won += 1;
    else if (result.outcome === "D") record.drawn += 1;
    else record.lost += 1;
    record.goalsFor += result.own;
    record.goalsAgainst += result.opp;
  }
  return record;
}

/** «ULTRA LEAGUE, 5η αγωνιστική» / «Κύπελλο, Ημιτελικά, Ρεβάνς» */
export function competitionLabel(m: TeamMatch): string {
  const parts: string[] = [];
  if (m.competition?.name) parts.push(m.competition.name);
  if (m.ko) {
    if (m.stageName) parts.push(m.stageName);
    if (m.leg === 1) parts.push("1ος αγώνας");
    if (m.leg === 2) parts.push("Ρεβάνς");
  } else if (m.matchday) {
    parts.push(`${m.matchday}η αγωνιστική`);
  }
  if (m.groupName) parts.push(m.groupName);
  return parts.join(", ");
}

/** What the bare score does not say: a shootout, or where a two-legged tie stands. */
export function resultNote(r: SideResult): string | null {
  const pens = r.pens ? ` στα πέναλτι ${r.pens.own}–${r.pens.opp}` : "";
  if (r.tie?.leg === 1) return "1ος αγώνας, ακολουθεί η ρεβάνς";
  if (r.tie?.leg === 2) {
    const first = r.tie.firstLeg ? `1ος αγώνας ${r.tie.firstLeg.own}–${r.tie.firstLeg.opp}` : null;
    const verdict =
      r.tie.verdict === "advanced"
        ? `Πρόκριση${pens}`
        : r.tie.verdict === "eliminated"
          ? `Αποκλεισμός${pens}`
          : "Η πρόκριση εκκρεμεί";
    return [first, verdict].filter(Boolean).join(", ");
  }
  if (r.pens) return r.outcome === "W" ? `Νίκη${pens}` : `Ήττα${pens}`;
  return null;
}

// ───────────────────────────────────────────────────────────────────────
// The players' numbers with this team
// ───────────────────────────────────────────────────────────────────────

/** One player's line on one match sheet. */
export type StatRow = {
  matchId: number;
  playerId: number;
  goals: number;
  assists: number;
  yellow: number;
  red: number;
  blue: number;
  mvp: boolean;
  bestGk: boolean;
  /** He was in goal. */
  gk: boolean;
};

export type PlayerTotals = {
  /** Matches with a match-sheet line (an appearance). */
  apps: number;
  wins: number;
  goals: number;
  assists: number;
  mvp: number;
  bestGk: number;
  /** Appearances in goal. */
  gkApps: number;
  yellow: number;
  red: number;
  blue: number;
};

/**
 * One total per player from the team's match sheets. `outcomes` holds the
 * team's finished matches; a line of any other match is ignored, and so is a
 * second line of the same player in the same match.
 */
export function playerTotals(
  outcomes: ReadonlyMap<number, Outcome>,
  rows: readonly StatRow[],
): Map<number, PlayerTotals> {
  const out = new Map<number, PlayerTotals>();
  const seen = new Set<string>();
  for (const r of rows) {
    const outcome = outcomes.get(r.matchId);
    if (!outcome) continue;
    const key = `${r.matchId}:${r.playerId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const t =
      out.get(r.playerId) ??
      ({ apps: 0, wins: 0, goals: 0, assists: 0, mvp: 0, bestGk: 0, gkApps: 0, yellow: 0, red: 0, blue: 0 } as PlayerTotals);
    t.apps += 1;
    if (outcome === "W") t.wins += 1;
    t.goals += r.goals;
    t.assists += r.assists;
    t.mvp += r.mvp ? 1 : 0;
    t.bestGk += r.bestGk ? 1 : 0;
    t.gkApps += r.gk ? 1 : 0;
    t.yellow += r.yellow;
    t.red += r.red;
    t.blue += r.blue;
    out.set(r.playerId, t);
  }
  return out;
}

/** The totals in the order the player cards print them. */
export const totalsTuple = (t: PlayerTotals): StatTuple => [
  t.apps,
  t.wins,
  t.goals,
  t.assists,
  t.mvp,
  t.bestGk,
  t.yellow,
  t.red,
  t.blue,
];

/**
 * player.position is free text and almost always empty, so a goalkeeper is
 * told by the match sheets: in goal for at least half of his matches, and at
 * least twice.
 */
export const isKeeper = (t: Pick<PlayerTotals, "apps" | "gkApps"> | null | undefined): boolean =>
  !!t && t.gkApps >= 2 && t.gkApps * 2 >= t.apps;

// Positions in a StatTuple.
const MATCHES = 0;
const GOALS = 2;

export type SquadPlayer = MatchPlayer & {
  /** Played for the team this season but is no longer in its squad. */
  left: boolean;
  keeper: boolean;
  /** His numbers WITH THIS TEAM this season; null = no match sheet yet. */
  numbers: StatTuple | null;
};

const surname = (p: { first: string; last: string }) => p.last || p.first;

const byName = (a: SquadPlayer, b: SquadPlayer) =>
  surname(a).localeCompare(surname(b), "el") || a.first.localeCompare(b.first, "el") || a.id - b.id;

/** Squad order: the regulars first (most matches, then most goals), the rest by surname. */
export function orderSquad(players: SquadPlayer[]): SquadPlayer[] {
  const at = (p: SquadPlayer, i: number) => p.numbers?.[i] ?? -1;
  return [...players].sort(
    (a, b) => at(b, MATCHES) - at(a, MATCHES) || at(b, GOALS) - at(a, GOALS) || byName(a, b),
  );
}

// ───────────────────────────────────────────────────────────────────────
// League / group tables
// ───────────────────────────────────────────────────────────────────────

export type StandingLine = {
  teamId: number;
  name: string;
  logo: string | null;
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

export type GroupTable = {
  stageId: number;
  stageName: string;
  groupName: string | null;
  competition: { id: number; name: string } | null;
  rows: StandingLine[];
  /** Index of this team in rows. */
  ownIndex: number;
};

/**
 * The rows around `ownIndex`: `radius` places either side. Near the top or the
 * bottom the window slides, so it still shows 2×radius+1 rows when the table
 * is long enough.
 */
export function tableWindow<T>(rows: readonly T[], ownIndex: number, radius = 2): T[] {
  if (rows.length === 0 || ownIndex < 0 || ownIndex >= rows.length) return [];
  const size = Math.min(rows.length, radius * 2 + 1);
  const start = Math.max(0, Math.min(ownIndex - radius, rows.length - size));
  return rows.slice(start, start + size);
}

// ───────────────────────────────────────────────────────────────────────
// The page
// ───────────────────────────────────────────────────────────────────────

export type TeamView = {
  team: {
    id: number;
    name: string;
    logo: string | null;
    /** As stored; the page lifts it until it reads (accent.ts). */
    colour: string | null;
    /** Registry number, when the team has one. */
    am: string | null;
  };
  /** The season this team row belongs to. Teams are one row per season. */
  season: { label: string; display: string; archived: boolean } | null;
  /** Position in the Γενική Κατάταξη of its season. */
  general: { rank: number; points: number } | null;
  schedule: Schedule;
  record: SeasonRecord;
  /** Real instant of the next kick-off, for the countdown. */
  kickoffMs: number | null;
  /** Every meeting with the next opponent, all seasons. */
  headToHead: { won: number; drawn: number; lost: number } | null;
  /** League and group tables the team is in, its main competition first. */
  tables: GroupTable[];
  squad: SquadPlayer[];
  /** Played for the team this season and left it since. */
  departed: SquadPlayer[];
  /** The season's tournaments the team entered, newest first; `won` = it took the title. */
  tournaments: { id: number; name: string; status: string | null; won: boolean }[];
};
