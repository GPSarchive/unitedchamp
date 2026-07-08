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
}
