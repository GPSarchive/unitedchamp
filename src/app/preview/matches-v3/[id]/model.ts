// What the match page shows, as plain data — and the few rules that decide it
// (who is listed as a scorer, the order of the match sheet, which players get
// the big card). Pure, so it can be tested without a database.
import type { StatTuple } from "../../paiktes-v2/model";

export type MatchTeam = { id: number; name: string; logo: string | null };

export type MatchPlayer = {
  id: number;
  first: string;
  last: string;
  photo: string | null;
  /** Archived player: still shown on old matches, marked «πρώην». */
  former: boolean;
  /** The player's profile, when there is one to open. */
  href: string | null;
};

/** One player's numbers in this match. */
export type StatLine = {
  goals: number;
  assists: number;
  ownGoals: number;
  yellow: number;
  red: number;
  blue: number;
  mvp: boolean;
  bestGk: boolean;
  captain: boolean;
  gk: boolean;
  number: number | null;
};

export type SheetRow = { player: MatchPlayer; line: StatLine | null };

/** A name under a team's score. */
export type ScorerLine = { player: MatchPlayer; count: number };

/** A player shown with the big card. */
export type Star = {
  player: MatchPlayer;
  team: MatchTeam;
  /** Why this player: «MVP αγώνα», «Πρώτος σκόρερ»… */
  label: string;
  /** One line under the card: this match's numbers, or the season's. */
  note: string | null;
  /** Season numbers printed on the card; null = no appearances. */
  season: StatTuple | null;
};

export type TeamSide = {
  team: MatchTeam;
  scorers: ScorerLine[];
  /** After the match: who played, with their numbers. */
  sheet: SheetRow[];
  /** Before the match: the squad. */
  roster: MatchPlayer[];
};

export type Pair = { a: number; b: number };

export type MatchView = {
  id: number;
  /** Which version of the page is shown. */
  phase: "before" | "after";
  status: string;
  date: string | null;
  referee: string | null;
  tournament: { id: number; name: string; logo: string | null } | null;
  score: Pair | null;
  /** Two-legged tie: both legs added up. */
  aggregate: Pair | null;
  penalties: Pair | null;
  a: TeamSide;
  b: TeamSide;
  stars: Star[];
  videoId: string | null;
};

export const playerName = (p: { first: string; last: string }) =>
  `${p.first} ${p.last}`.trim() || "Άγνωστος";

/** The name set in large letters: the surname, or whatever there is. */
export const mainName = (p: { first: string; last: string }) => p.last || p.first || "—";

/** The small line above it — only when there are two names to split. */
export const smallName = (p: { first: string; last: string }) => (p.first && p.last ? p.first : "");

const byName = (a: MatchPlayer, b: MatchPlayer) =>
  mainName(a).localeCompare(mainName(b), "el") || a.first.localeCompare(b.first, "el") || a.id - b.id;

/** Squad order: by surname. */
export function orderRoster(players: MatchPlayer[]): MatchPlayer[] {
  return [...players].sort(byName);
}

/**
 * Match sheet order: the players who decided the match first (goals, then
 * assists, then the two awards), everyone else by surname.
 */
export function orderSheet(rows: SheetRow[]): SheetRow[] {
  const weight = (l: StatLine | null) =>
    l ? l.goals * 1000 + l.assists * 100 + (l.mvp ? 10 : 0) + (l.bestGk ? 5 : 0) : 0;
  return [...rows].sort((x, y) => weight(y.line) - weight(x.line) || byName(x.player, y.player));
}

/**
 * The names under a team's score: only the players who scored for it, most
 * goals first. Own goals stay out of this list — they show on the match sheet.
 */
export function scorerLines(own: SheetRow[]): ScorerLine[] {
  return own
    .filter((r) => (r.line?.goals ?? 0) > 0)
    .map((r) => ({ player: r.player, count: r.line!.goals }))
    .sort((x, y) => y.count - x.count || byName(x.player, y.player));
}

/** «2 γκολ · 1 ασίστ» — what the player did in this match; null if neither. */
export function matchNote(line: StatLine | null): string | null {
  if (!line) return null;
  const parts: string[] = [];
  if (line.goals > 0) parts.push(`${line.goals} γκολ`);
  if (line.assists > 0) parts.push(`${line.assists} ασίστ`);
  return parts.length ? parts.join(" · ") : null;
}

/** «12 γκολ σε 9 αγώνες τη σεζόν». */
export function seasonNote(season: StatTuple): string {
  const [matches, , goals] = season;
  return `${goals} γκολ σε ${matches} ${matches === 1 ? "αγώνα" : "αγώνες"} τη σεζόν`;
}

/**
 * After the match the big cards go to the MVP and the best goalkeeper. One
 * player holding both gets a single card naming both.
 */
export function awardStars(
  sides: { team: MatchTeam; sheet: SheetRow[] }[],
  seasonOf: (playerId: number) => StatTuple | null,
): Star[] {
  const stars: Star[] = [];
  for (const { team, sheet } of sides) {
    for (const { player, line } of sheet) {
      if (!line || (!line.mvp && !line.bestGk)) continue;
      stars.push({
        player,
        team,
        label:
          line.mvp && line.bestGk
            ? "MVP & καλύτερος τερματοφύλακας"
            : line.mvp
              ? "MVP αγώνα"
              : "Καλύτερος τερματοφύλακας",
        note: matchNote(line),
        season: seasonOf(player.id),
      });
    }
  }
  // MVP first, whichever team they play for.
  return stars.sort((x, y) => Number(y.label.startsWith("MVP")) - Number(x.label.startsWith("MVP")));
}

/**
 * Before the match the big card goes to each squad's leading scorer of the
 * season. Nobody is picked for a squad that has not scored yet.
 */
export function topScorer(
  roster: MatchPlayer[],
  seasonOf: (playerId: number) => StatTuple | null,
): { player: MatchPlayer; season: StatTuple } | null {
  let best: { player: MatchPlayer; season: StatTuple } | null = null;
  for (const player of roster) {
    if (player.former) continue;
    const season = seasonOf(player.id);
    if (!season || season[2] <= 0) continue;
    if (!best) {
      best = { player, season };
      continue;
    }
    // More goals, then more assists, then fewer matches to get there.
    const diff = season[2] - best.season[2] || season[3] - best.season[3] || best.season[0] - season[0];
    if (diff > 0 || (diff === 0 && byName(player, best.player) < 0)) best = { player, season };
  }
  return best;
}

/** Which team won the match itself (not the tie): by score, then by penalties. */
export function winnerSide(score: Pair | null, penalties: Pair | null): "a" | "b" | null {
  if (!score) return null;
  if (score.a !== score.b) return score.a > score.b ? "a" : "b";
  if (penalties && penalties.a !== penalties.b) return penalties.a > penalties.b ? "a" : "b";
  return null;
}
