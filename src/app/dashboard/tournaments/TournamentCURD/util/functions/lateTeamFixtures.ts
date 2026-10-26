/**
 * Fixtures for a team that joins a league/group after its schedule exists.
 *
 * Only the late team's matches are created — every existing row stays as it
 * is. Each late team meets each opponent `repeats` times (pairs that already
 * exist count toward that). Placement:
 *  - A fixture may use an EXISTING matchday only if neither team plays on it
 *    and the matchday hasn't been played yet (no finished match). In an
 *    odd-sized group that is the resting team's slot.
 *  - Everything else goes on NEW matchdays appended after the last one, never
 *    with a team playing twice on the same matchday (owner's rule, 2026-10-26:
 *    no extra games squeezed into existing matchdays).
 * With repeats > 1 the n-th meeting prefers the n-th block of existing
 * matchdays, and later meetings are appended after earlier ones.
 */

type RowLike = {
  matchday?: number | null;
  team_a_id?: number | null;
  team_b_id?: number | null;
  status?: string | null;
};

export type LateFixture = {
  matchday: number;
  team_a_id: number;
  team_b_id: number;
  /** The late team this fixture was created for. */
  newTeamId: number;
  opponentId: number;
  /** Placed on a new matchday after the existing schedule. */
  appended: boolean;
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

  const existing = Array.from(
    new Set(
      opts.rows
        .map((r) => r.matchday)
        .filter((md): md is number => typeof md === "number" && md > 0)
    )
  ).sort((a, b) => a - b);
  const played = new Set(
    opts.rows.filter((r) => r.status === "finished").map((r) => r.matchday)
  );
  const open = existing.filter((md) => !played.has(md));
  const lastExisting = existing.length ? existing[existing.length - 1] : 0;
  const appended: number[] = [];

  const blockSize = Math.max(1, Math.ceil(existing.length / repeats));
  const blockOf = (md: number) => Math.floor(existing.indexOf(md) / blockSize) + 1;
  const busy = (team: number, md: number) =>
    work.some((w) => w.matchday === md && (w.a === team || w.b === team));

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

        const free = (md: number) => !busy(t, md) && !busy(opp, md);
        const slot =
          open.find((md) => free(md) && blockOf(md) === rep) ?? open.find(free);
        let md = slot;
        if (md == null) {
          // Later meetings go after the earlier ones on appended matchdays.
          const after = Math.max(
            0,
            ...meetings.map((w) => w.matchday ?? 0).filter((x) => x > lastExisting)
          );
          md = appended.find((x) => x > after && free(x));
          if (md == null) {
            md = lastExisting + appended.length + 1;
            appended.push(md);
          }
        }

        // Balance home/away per pair; the first meeting alternates by opponent.
        const tHome = meetings.filter((w) => w.a === t).length;
        const tAway = meetings.length - tHome;
        const home = tHome === tAway ? oppIdx % 2 === 0 : tHome < tAway;

        const fixture: LateFixture = {
          matchday: md,
          team_a_id: home ? t : opp,
          team_b_id: home ? opp : t,
          newTeamId: t,
          opponentId: opp,
          appended: md > lastExisting,
        };
        out.push(fixture);
        work.push({ matchday: md, a: fixture.team_a_id, b: fixture.team_b_id });
      });
    }
  }

  return out;
}
