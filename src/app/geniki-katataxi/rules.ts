// app/geniki-katataxi/rules.ts
// The points system of the Γενική Κατάταξη — constants and types only, safe to
// import from both server (points engine) and client (log/admin UI) code.

export const POINTS = {
  participation: 50,
  qualification: 50,
  tournamentWinner: 500,
  runnerUp: 200,
  international: 1000,
  internationalParticipation: 300,
  withdrawal: -100,
  abandonment: -30,
  win: 15,
  draw: 5,
  loss: -10,
} as const;

export const NO_SEASON_LABEL = "Χωρίς σεζόν";

/** Every rule an admin can grant manually, with its default points (null = free amount). */
export const ADJUSTMENT_PRESETS = {
  international: { label: "Διεθνής διάκριση", points: POINTS.international },
  international_participation: { label: "Διεθνής συμμετοχή", points: POINTS.internationalParticipation },
  withdrawal: { label: "Αποχώρηση από τουρνουά", points: POINTS.withdrawal },
  abandonment: { label: "Διακοπή αγώνα (υπαίτιος)", points: POINTS.abandonment },
  participation: { label: "Συμμετοχή σε τουρνουά", points: POINTS.participation },
  qualification: { label: "Πρόκριση σε επόμενη φάση", points: POINTS.qualification },
  tournament_winner: { label: "Νικητής τουρνουά", points: POINTS.tournamentWinner },
  runner_up: { label: "Διεκδικητής (φιναλίστ)", points: POINTS.runnerUp },
  win: { label: "Νίκη", points: POINTS.win },
  draw: { label: "Ισοπαλία", points: POINTS.draw },
  loss: { label: "Ήττα", points: POINTS.loss },
  other: { label: "Άλλο", points: null },
} as const;

export type AdjustmentKind = keyof typeof ADJUSTMENT_PRESETS;

export const ADJUSTMENT_KINDS = Object.keys(ADJUSTMENT_PRESETS) as AdjustmentKind[];

/** One row of the public "why does this team have points" log (aggregated per tournament). */
export type EventKind =
  | "participation"
  | "qualification"
  | "title"
  | "runner_up"
  | "win"
  | "draw"
  | "loss"
  | "adjustment";

/** One match behind a W/D/L award — for the expandable per-match breakdown. */
export interface MatchDetail {
  /** ISO date (match_date) or null when the match has no date. */
  date: string | null;
  /** Opponent team id, or null if unknown. */
  opponentId: number | null;
  /** This team's goals in the match, when scored. */
  goalsFor: number | null;
  /** Opponent's goals in the match, when scored. */
  goalsAgainst: number | null;
}

export interface PointsEvent {
  season: string;
  teamId: number;
  kind: EventKind;
  /** Set when kind === "adjustment": which manual rule was granted. */
  adjustmentKind?: AdjustmentKind;
  /** How many times the rule fired (e.g. 6 wins). */
  count: number;
  /** Total points from this row (count × rule value, or the manual amount). */
  points: number;
  /** Context: tournament name, or the admin's reason text. */
  label: string;
  /**
   * Representative date for the award (ISO). For W/D/L it's the earliest of the
   * underlying matches; for title/runner-up the final's date; for participation/
   * qualification the tournament's start date when known. May be null.
   */
  date?: string | null;
  /** Per-match breakdown for W/D/L events (the expandable sub-rows). */
  matches?: MatchDetail[];
  /** Source tournament id for automatic events (undefined for manual adjustments). */
  tournamentId?: number;
  /**
   * Stable identifier of an automatic event, for the admin cancel/override flow.
   * Set on automatic events only; manual adjustment rows carry `adjustmentId` instead.
   */
  sourceKey?: string;
  /** DB row id when kind === "adjustment" (a real season_team_adjustments row). */
  adjustmentId?: number;
  /**
   * For automatic events: the id of the counter-adjustment row that cancels this
   * event, if one exists. When set, the event's points are neutralised.
   */
  cancelledBy?: number;
  /**
   * For adjustment events: the sourceKey this row cancels, if it is a counter-
   * adjustment created by the admin "cancel" action (rather than a plain grant).
   */
  cancelsSourceKey?: string;
}

/**
 * Deterministic key for an automatic points event: (season, team, rule, tournament).
 * Recomputing the standings must reproduce the exact same key so the admin panel
 * can tell whether an event has already been cancelled by a counter-adjustment.
 */
export function automaticSourceKey(
  season: string,
  teamId: number,
  kind: EventKind,
  tournamentId: number
): string {
  return `${season}|${teamId}|${kind}|${tournamentId}`;
}

/** Marker embedded in a counter-adjustment's reason so we can pair it to its source event. */
export const CANCEL_TAG_PREFIX = "[gk-cancel:";

export function makeCancelTag(sourceKey: string): string {
  return `${CANCEL_TAG_PREFIX}${sourceKey}]`;
}

/** Extracts the cancelled sourceKey from an adjustment reason, or null if it isn't a cancel. */
export function parseCancelTag(reason: string | null): string | null {
  if (!reason) return null;
  const start = reason.indexOf(CANCEL_TAG_PREFIX);
  if (start < 0) return null;
  const end = reason.indexOf("]", start);
  if (end < 0) return null;
  return reason.slice(start + CANCEL_TAG_PREFIX.length, end);
}
