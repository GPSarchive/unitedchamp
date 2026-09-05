// Pure season rules shared by API routes and server actions — no I/O, no Next
// imports, unit-tested in __tests__/seasonChecks.test.ts. The I/O wrappers
// (assertTeamsInSeason, resolveSeasonLabel) live in lib/seasons.ts.

export type TeamSeasonRow = { id: number; season_label: string | null };

/**
 * Ids from `requestedIds` whose team row is missing or belongs to a season
 * other than `seasonLabel`. Teams are per-season rows (contract D1), so a
 * tournament or match may only reference rows of its own season. Non-positive
 * and duplicate ids are ignored.
 */
export function teamSeasonMismatches(
  requestedIds: Iterable<number | null | undefined>,
  rows: TeamSeasonRow[],
  seasonLabel: string,
): number[] {
  const byId = new Map(rows.map((r) => [r.id, r.season_label]));
  const seen = new Set<number>();
  const out: number[] = [];
  for (const id of requestedIds) {
    if (typeof id !== "number" || !(id > 0) || seen.has(id)) continue;
    seen.add(id);
    if (byId.get(id) !== seasonLabel) out.push(id);
  }
  return out;
}

/**
 * The season labels whose stored snapshot (player_season_stats,
 * season_team_standings, season_recaps) must be rebuilt after a tournament's
 * season changed from `previous` to `next`: both sides of a move, only the
 * new side when the tournament had no season, nothing when unchanged.
 */
export function seasonMoveLabels(
  previous: string | null | undefined,
  next: string | null | undefined,
): string[] {
  const a = (previous ?? "").trim();
  const b = (next ?? "").trim();
  if (!b || a === b) return [];
  return a ? [a, b] : [b];
}
