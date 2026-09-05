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

// ─── Close-season preflight ─────────────────────────────────────────────────

export type UnfinishedMatchRow = {
  status: string | null;
  match_date: string | null;
};

/**
 * Splits a season's matches into the two preflight buckets of the close
 * (dashboard/seasons/actions.ts). `todayIso` is a calendar date "YYYY-MM-DD"
 * in the league's own time zone; match dates are literal wall-clock strings,
 * so only the date part is compared and no zone conversion happens.
 *
 * - `past`   → status is not 'finished' AND the match has a date before today.
 *              Almost always a result nobody entered: the close BLOCKS on it,
 *              because after the flip the archive's numbers change only by a
 *              manual re-snapshot and the recap is computed once.
 * - `future` → status is not 'finished' AND the date is today, later, or
 *              missing. Legitimately unplayed: the close only WARNS.
 * Finished matches appear in neither bucket.
 */
export function unfinishedMatchBuckets<T extends UnfinishedMatchRow>(
  matches: T[],
  todayIso: string,
): { past: T[]; future: T[] } {
  const past: T[] = [];
  const future: T[] = [];
  for (const m of matches) {
    if (m.status === "finished") continue;
    const day = m.match_date ? m.match_date.slice(0, 10) : null;
    if (day && day < todayIso) past.push(m);
    else future.push(m);
  }
  return { past, future };
}

/**
 * A tournament counts as "open" for the close warning unless its status is
 * completed or archived. Status is informational only: the points engine and
 * the stats pipeline never read it, so an open tournament changes no number.
 */
export function isOpenTournamentStatus(status: string | null | undefined): boolean {
  return status !== "completed" && status !== "archived";
}

/** Calendar date "YYYY-MM-DD" for `now` in the given IANA zone. */
export function calendarDateIn(timeZone: string, now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
