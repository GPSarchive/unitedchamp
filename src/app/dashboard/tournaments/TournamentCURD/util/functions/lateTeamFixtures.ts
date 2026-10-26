/**
 * Fixtures for a team that joins a league/group after its schedule exists.
 *
 * Only the late team's matches are created — every existing row stays as it
 * is. Each late team meets each opponent `repeats` times (pairs that already
 * exist count toward that), and every fixture lands on an EXISTING matchday:
 *  - Odd-sized group before the join: one team rests on each matchday, so the
 *    late team plays the resting team — the schedule fills with no clashes.
 *  - Even-sized group (or irregular schedules): no free slot exists, so the
 *    fixture goes where the fewest of the two teams' games already are; those
 *    come back flagged `shared` (a team plays twice that matchday) and the
 *    admin sets the real dates.
 * With repeats > 1 the n-th meeting prefers the n-th block of matchdays, so
 * return fixtures stay in the second half like the circle-method schedule.
 */

type RowLike = {
  matchday?: number | null;
  team_a_id?: number | null;
  team_b_id?: number | null;
};

export type LateFixture = {
  matchday: number;
  team_a_id: number;
  team_b_id: number;
  /** The late team this fixture was created for. */
  newTeamId: number;
  opponentId: number;
  /** One of the two teams already plays on this matchday. */
  shared: boolean;
};

const pairKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

/** Meetings per pair in an existing schedule (1 = single, 2 = double round). 0 if no complete pair. */
export function inferRepeats(rows: RowLike[]): number {
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (r.team_a_id == null || r.team_b_id == null) continue;
    const k = pairKey(r.team_a_id, r.team_b_id);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return counts.size ? Math.max(...counts.values()) : 0;
}

export function planLateTeamFixtures(opts: {
  /** Existing rows of this group (or of the league stage). */
  rows: RowLike[];
  /** Teams to create fixtures for, processed in order. */
  newTeamIds: number[];
  /** Everyone who should meet the late teams, late teams included. */
  teamIds: number[];
  repeats: number;
}): LateFixture[] {
  const repeats = Math.max(1, Math.floor(opts.repeats || 1));
  const teamIds = Array.from(new Set(opts.teamIds));

  // Working state: existing rows plus fixtures planned so far, so a second
  // late team sees the first one's games (and their mutual pair).
  const work: Array<{ matchday: number | null; a: number; b: number }> = [];
  for (const r of opts.rows) {
    if (r.team_a_id == null || r.team_b_id == null) continue;
    work.push({ matchday: r.matchday ?? null, a: r.team_a_id, b: r.team_b_id });
  }

  let matchdays = Array.from(
    new Set(
      opts.rows
        .map((r) => r.matchday)
        .filter((md): md is number => typeof md === "number" && md > 0)
    )
  ).sort((a, b) => a - b);
  if (matchdays.length === 0) {
    // No schedule yet: one matchday per meeting of a full cycle.
    const n = Math.max(1, (teamIds.length - 1) * repeats);
    matchdays = Array.from({ length: n }, (_, i) => i + 1);
  }
  const blockSize = Math.ceil(matchdays.length / repeats);
  const blockOf = (mdIndex: number) => Math.floor(mdIndex / blockSize) + 1;

  const gamesOn = (team: number, md: number) =>
    work.reduce((n, w) => n + (w.matchday === md && (w.a === team || w.b === team) ? 1 : 0), 0);

  const out: LateFixture[] = [];

  for (const t of opts.newTeamIds) {
    const opponents = teamIds.filter((id) => id !== t);

    // Rep-major order: every first meeting, then every second, …
    for (let rep = 1; rep <= repeats; rep++) {
      opponents.forEach((opp, oppIdx) => {
        const meetings = work.filter(
          (w) => (w.a === t && w.b === opp) || (w.a === opp && w.b === t)
        );
        if (meetings.length >= rep) return;

        let best = matchdays[0];
        let bestCost = Infinity;
        matchdays.forEach((md, i) => {
          const clash = gamesOn(t, md) + gamesOn(opp, md);
          const cost = clash + (blockOf(i) === rep ? 0 : 100);
          if (cost < bestCost) {
            bestCost = cost;
            best = md;
          }
        });

        // Balance home/away per pair; the first meeting alternates by opponent.
        const tHome = meetings.filter((w) => w.a === t).length;
        const tAway = meetings.length - tHome;
        const home = tHome === tAway ? oppIdx % 2 === 0 : tHome < tAway;

        const fixture: LateFixture = {
          matchday: best,
          team_a_id: home ? t : opp,
          team_b_id: home ? opp : t,
          newTeamId: t,
          opponentId: opp,
          shared: gamesOn(t, best) + gamesOn(opp, best) > 0,
        };
        out.push(fixture);
        work.push({ matchday: best, a: fixture.team_a_id, b: fixture.team_b_id });
      });
    }
  }

  return out;
}
