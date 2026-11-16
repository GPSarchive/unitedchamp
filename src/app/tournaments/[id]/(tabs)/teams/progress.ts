// A team's course through one tournament, worked out from the tournament's
// own matches and tables: its results in order, its points match by match,
// where it stands. Pure functions, no fetching.
//
// The same measures as the player area's home page (branch
// feat/player-profile-area: «Η σεζόν», «Πορεία βαθμών», «Τελευταίο
// αποτέλεσμα», «Βαθμολογία»), there for a player's team over the season, here
// for every team of the tournament.
import {
  matchWinner,
  type StageTables,
  type TMatch,
  type TStage,
  type TTeam,
  type Table,
  type TableRow,
} from "@/app/preview/tournaments-v3/[id]/model";

export type Outcome = "W" | "D" | "L";

export type TeamResult = {
  match: TMatch;
  opponent: TTeam | null;
  /** The team's own goals, then the opponent's. */
  own: number;
  opp: number;
  outcome: Outcome;
  /** A shootout, the team's own count first. */
  pens: { own: number; opp: number } | null;
};

/**
 * The team's finished matches, earliest first (a match with no date stored
 * goes after the dated ones, in the order it was entered). The outcome is the
 * match's own: a level knockout match settled on penalties is a win or a loss.
 */
export function teamResults(matches: TMatch[], teamId: number): TeamResult[] {
  return matches
    .filter((m) => m.status === "finished" && m.score !== null && (m.a?.id === teamId || m.b?.id === teamId))
    .sort(
      (x, y) => (x.date && y.date ? x.date.localeCompare(y.date) : x.date ? -1 : y.date ? 1 : 0) || x.id - y.id,
    )
    .map((match): TeamResult => {
      const isA = match.a?.id === teamId;
      const score = match.score!;
      const winner = matchWinner(match);
      return {
        match,
        opponent: isA ? match.b : match.a,
        own: isA ? score.a : score.b,
        opp: isA ? score.b : score.a,
        outcome: winner === null ? "D" : (winner === "a") === isA ? "W" : "L",
        pens: match.pens ? { own: isA ? match.pens.a : match.pens.b, opp: isA ? match.pens.b : match.pens.a } : null,
      };
    });
}

/** Wins, draws, losses. */
export function record(results: TeamResult[]): { won: number; drawn: number; lost: number } {
  const count = (o: Outcome) => results.filter((r) => r.outcome === o).length;
  return { won: count("W"), drawn: count("D"), lost: count("L") };
}

/** The latest table the team is in: its stage, the table, the team's row and its place among the rows. `stages` in competition order. */
export function standingIn(
  stages: StageTables[],
  teamId: number,
): { stage: TStage; table: Table; row: TableRow; index: number } | null {
  for (const { stage, tables } of [...stages].reverse()) {
    for (const table of tables) {
      const index = table.rows.findIndex((r) => r.team.id === teamId);
      if (index !== -1) return { stage, table, row: table.rows[index], index };
    }
  }
  return null;
}

/**
 * Points after each match of a table stage, in playing order: 3 for a win, 1
 * for a draw. Knockout matches earn no points and are left out.
 */
export function pointsRun(results: TeamResult[], stageId: number): number[] {
  let total = 0;
  return results
    .filter((r) => !r.match.ko && r.match.stageId === stageId)
    .map((r) => (total += r.outcome === "W" ? 3 : r.outcome === "D" ? 1 : 0));
}

/** `size` rows of the table around the team (fewer when the table is shorter), the team as near the middle as the ends allow. */
export function tableWindow(table: Table, index: number, size = 5): Table {
  const start = Math.max(0, Math.min(index - Math.floor(size / 2), table.rows.length - size));
  return { ...table, rows: table.rows.slice(start, start + size) };
}
