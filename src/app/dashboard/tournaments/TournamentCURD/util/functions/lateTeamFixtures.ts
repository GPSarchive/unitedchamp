/**
 * Fixtures for a team that joins a league/group after its schedule exists.
 *
 * Each late team meets each opponent `repeats` times (pairs that already exist
 * count toward that). Nothing is ever deleted, and no team plays twice on the
 * same matchday. Placement, in order (owner's rules, 2026-10-26):
 *  1. Free slot: an unplayed matchday (no finished match) where neither team
 *     plays — in an odd-sized group, the resting team's slot. A meeting of two
 *     late teams prefers a matchday that can't take swaps (one with dates).
 *  2. Swap-in: on an unplayed matchday with no dates, an existing match moves
 *     to the end and its two teams play the late team(s) instead, so the round
 *     stays full. Only scheduled, undated matches that are the last meeting of
 *     their pair are moved.
 *  3. Everything left — late fixtures and the moved matches — goes on as few
 *     new matchdays after the last one as possible.
 * The plan with the fewest new matchdays wins (then the fewest moved matches);
 * extra attempts use a seeded shuffle, so the result is deterministic.
 */

type RowLike = {
  matchday?: number | null;
  team_a_id?: number | null;
  team_b_id?: number | null;
  status?: string | null;
  match_date?: string | null;
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

/** An existing match the plan moves to a new matchday at the end. */
export type MovedMatch = { rowIndex: number; from: number; to: number };

export type LatePlan = {
  fixtures: LateFixture[];
  moves: MovedMatch[];
  /** New matchdays created after the last existing one (ascending). */
  newMatchdays: number[];
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

/** Small seeded PRNG so extra attempts are reproducible. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Need = { t: number; opp: number; rep: number; home: number; away: number; mutual: boolean };

export function planLateTeamFixtures(opts: {
  /** Existing rows of this group (or of the league stage). */
  rows: RowLike[];
  /** Teams to create fixtures for. */
  newTeamIds: number[];
  /** Everyone who should meet the late teams, late teams included. */
  teamIds: number[];
  repeats: number;
  /** Seeded attempts after the first, deterministic one. */
  attempts?: number;
}): LatePlan {
  const repeats = Math.max(1, Math.floor(opts.repeats || 1));
  const late = Array.from(new Set(opts.newTeamIds));
  const lateSet = new Set(late);
  const teamIds = Array.from(new Set(opts.teamIds));
  const rows = opts.rows;

  const existing = Array.from(
    new Set(rows.map((r) => r.matchday).filter((md): md is number => typeof md === "number" && md > 0))
  ).sort((a, b) => a - b);
  const lastExisting = existing.length ? existing[existing.length - 1] : 0;
  const played = new Set(rows.filter((r) => r.status === "finished").map((r) => r.matchday));
  const dated = new Set(rows.filter((r) => r.match_date).map((r) => r.matchday));
  const open = existing.filter((md) => !played.has(md));
  const swappable = new Set(open.filter((md) => !dated.has(md)));
  const blockSize = Math.max(1, Math.ceil(existing.length / repeats));
  const blockOf = (md: number) => Math.floor(existing.indexOf(md) / blockSize) + 1;

  // ---- what has to be created --------------------------------------------
  const complete = rows
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.team_a_id != null && r.team_b_id != null);
  const needs: Need[] = [];
  const planned = new Map<string, { count: number; tHome: Map<number, number> }>();
  late.forEach((t, li) => {
    // A meeting of two late teams belongs to the earlier one.
    const opponents = teamIds.filter((id) => id !== t && !(lateSet.has(id) && late.indexOf(id) < li));
    for (let rep = 1; rep <= repeats; rep++) {
      opponents.forEach((opp, oppIdx) => {
        const k = pairKey(t, opp);
        const meetings = complete.filter(
          ({ r }) => pairKey(r.team_a_id!, r.team_b_id!) === k
        );
        const p = planned.get(k) ?? { count: 0, tHome: new Map() };
        if (meetings.length + p.count >= rep) return;
        const tHome = meetings.filter(({ r }) => r.team_a_id === t).length + (p.tHome.get(t) ?? 0);
        const tAway = meetings.length + p.count - tHome;
        const home = tHome === tAway ? oppIdx % 2 === 0 : tHome < tAway;
        p.count += 1;
        if (home) p.tHome.set(t, (p.tHome.get(t) ?? 0) + 1);
        planned.set(k, p);
        needs.push({
          t, opp, rep,
          home: home ? t : opp,
          away: home ? opp : t,
          mutual: lateSet.has(opp),
        });
      });
    }
  });

  // Existing matches that may be moved: unplayed, undated, no late team, on a
  // swappable matchday, and the last meeting of their pair (so a moved first
  // leg never lands after its return leg).
  const lastMeetingMd = new Map<string, number>();
  for (const { r } of complete) {
    const k = pairKey(r.team_a_id!, r.team_b_id!);
    lastMeetingMd.set(k, Math.max(lastMeetingMd.get(k) ?? 0, r.matchday ?? 0));
  }
  const movable = complete.filter(
    ({ r }) =>
      r.matchday != null &&
      swappable.has(r.matchday) &&
      (r.status == null || r.status === "scheduled") &&
      !r.match_date &&
      !lateSet.has(r.team_a_id!) &&
      !lateSet.has(r.team_b_id!) &&
      lastMeetingMd.get(pairKey(r.team_a_id!, r.team_b_id!)) === r.matchday
  );

  /** `skip`: chance of leaving a swappable matchday alone — swapping into
   *  every one isn't always best (it can scatter the moved matches badly). */
  function attempt(rand: (() => number) | null, skip = 0): LatePlan {
    const shuffle = <T,>(a: T[]) => {
      if (!rand) return a;
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };

    // Who plays on which matchday (existing rows, then everything placed).
    const busy = new Map<number, Set<number>>();
    const occupy = (md: number, a: number, b: number) => {
      const s = busy.get(md) ?? new Set<number>();
      s.add(a);
      s.add(b);
      busy.set(md, s);
    };
    for (const { r } of complete) if (r.matchday != null) occupy(r.matchday, r.team_a_id!, r.team_b_id!);
    const free = (team: number, md: number) => !busy.get(md)?.has(team);

    const placedAt = new Map<Need, number>();
    let pending = needs.slice();
    const place = (n: Need, md: number) => {
      placedAt.set(n, md);
      occupy(md, n.t, n.opp);
      pending = pending.filter((x) => x !== n);
    };
    const byBlock = (rep: number, mds: number[]) =>
      [...mds.filter((md) => blockOf(md) === rep), ...mds.filter((md) => blockOf(md) !== rep)];

    // 1. free slots — opponents first, then late-vs-late meetings
    for (const n of [...needs.filter((x) => !x.mutual), ...needs.filter((x) => x.mutual)]) {
      const order = n.mutual
        ? [...open.filter((md) => !swappable.has(md)), ...open.filter((md) => swappable.has(md))]
        : open;
      const md = byBlock(n.rep, order).find((d) => free(n.t, d) && free(n.opp, d));
      if (md != null) place(n, md);
    }

    // 2. swap-in on unplayed, undated matchdays
    const moved = new Map<number, number>(); // row index → (temporary) 0
    const movedPairs: Array<{ rowIndex: number; a: number; b: number; from: number }> = [];
    for (const md of shuffle(open.filter((d) => swappable.has(d)))) {
      if (rand && rand() < skip) continue;
      for (;;) {
        const lateFree = late.filter((t) => free(t, md));
        if (!lateFree.length) break;
        const needFor = (t: number, opp: number) =>
          pending
            .filter((n) => n.t === t && n.opp === opp)
            .sort((a, b) => (a.rep === blockOf(md) ? -1 : 0) - (b.rep === blockOf(md) ? -1 : 0) || a.rep - b.rep)[0];
        let best: { score: number; m: (typeof movable)[number]; picks: Need[] } | null = null;
        for (const m of shuffle(movable.filter((x) => x.r.matchday === md && !moved.has(x.i)))) {
          const x = m.r.team_a_id!;
          const y = m.r.team_b_id!;
          for (const [p, q] of [[x, y], [y, x]]) {
            for (const t1 of lateFree) {
              const n1 = needFor(t1, p);
              const t2 = lateFree.find((t) => t !== t1 && needFor(t, q));
              const n2 = t2 != null ? needFor(t2, q) : undefined;
              const picks = [n1, n2].filter((n): n is Need => !!n);
              const score =
                picks.length * 10 + picks.filter((n) => n.rep === blockOf(md)).length;
              if (picks.length && (!best || score > best.score)) best = { score, m, picks };
            }
          }
        }
        if (!best) break;
        const { m, picks } = best;
        moved.set(m.i, 0);
        movedPairs.push({ rowIndex: m.i, a: m.r.team_a_id!, b: m.r.team_b_id!, from: md });
        busy.get(md)!.delete(m.r.team_a_id!);
        busy.get(md)!.delete(m.r.team_b_id!);
        for (const n of picks) place(n, md);
      }
    }

    // 3. pack what's left onto as few new matchdays as possible
    type Item = { a: number; b: number; need?: Need; move?: (typeof movedPairs)[number] };
    const items: Item[] = [
      ...pending.map((n) => ({ a: n.t, b: n.opp, need: n })),
      ...movedPairs.map((mv) => ({ a: mv.a, b: mv.b, move: mv })),
    ];
    const assign = packMatchdays(items, lastExisting);
    const fixtures: LateFixture[] = [];
    for (const n of needs) {
      const md = placedAt.get(n) ?? assign.get(items.find((it) => it.need === n)!)!;
      fixtures.push({ matchday: md, team_a_id: n.home, team_b_id: n.away, newTeamId: n.t, opponentId: n.opp, appended: md > lastExisting });
    }
    const moves = items
      .filter((it) => it.move)
      .map((it) => ({ rowIndex: it.move!.rowIndex, from: it.move!.from, to: assign.get(it)! }));

    // Several meetings of one pair: keep home/away alternating in time.
    const byPair = new Map<string, LateFixture[]>();
    for (const f of fixtures) {
      const k = pairKey(f.team_a_id, f.team_b_id);
      byPair.set(k, [...(byPair.get(k) ?? []), f]);
    }
    for (const list of byPair.values()) {
      if (list.length < 2) continue;
      const orient = list.map((f) => [f.team_a_id, f.team_b_id]);
      list.sort((a, b) => a.matchday - b.matchday);
      list.forEach((f, i) => ([f.team_a_id, f.team_b_id] = orient[i]));
    }

    const newMatchdays = Array.from(
      new Set([...fixtures.filter((f) => f.appended).map((f) => f.matchday), ...moves.map((m) => m.to)])
    ).sort((a, b) => a - b);
    return { fixtures, moves, newMatchdays };
  }

  let best = attempt(null);
  const attempts = opts.attempts ?? 60;
  for (let k = 1; k <= attempts && (best.newMatchdays.length > 0 || best.moves.length > 0); k++) {
    // Alternate full swapping with runs that leave some matchdays alone.
    const next = attempt(mulberry32(k), k % 2 === 0 ? 0 : 0.3);
    if (
      next.newMatchdays.length < best.newMatchdays.length ||
      (next.newMatchdays.length === best.newMatchdays.length && next.moves.length < best.moves.length)
    )
      best = next;
  }
  return best;
}

/**
 * Put each match on a matchday after `after` so nobody plays twice on one,
 * using as few matchdays as possible and spreading them evenly. Exact search
 * with a node budget; first-fit if the budget runs out.
 */
function packMatchdays<T extends { a: number; b: number }>(items: T[], after: number): Map<T, number> {
  const out = new Map<T, number>();
  if (!items.length) return out;
  const load = new Map<number, number>();
  for (const it of items) for (const t of [it.a, it.b]) load.set(t, (load.get(t) ?? 0) + 1);
  const order = items
    .slice()
    .sort((x, y) => load.get(y.a)! + load.get(y.b)! - (load.get(x.a)! + load.get(x.b)!));
  const lowerBound = Math.max(...load.values());

  for (let k = lowerBound; k <= items.length; k++) {
    const days: Array<Set<number>> = Array.from({ length: k }, () => new Set());
    const count = new Array(k).fill(0);
    const slot = new Map<T, number>();
    let budget = 20000;
    const solve = (i: number): boolean => {
      if (i === order.length) return true;
      if (--budget < 0) return false;
      const it = order[i];
      const tries = days.map((_, d) => d).sort((p, q) => count[p] - count[q] || p - q);
      for (const d of tries) {
        if (days[d].has(it.a) || days[d].has(it.b)) continue;
        days[d].add(it.a);
        days[d].add(it.b);
        count[d]++;
        slot.set(it, d);
        if (solve(i + 1)) return true;
        days[d].delete(it.a);
        days[d].delete(it.b);
        count[d]--;
      }
      return false;
    };
    if (solve(0)) {
      for (const [it, d] of slot) out.set(it, after + d + 1);
      return out;
    }
    if (budget < 0) break;
  }

  // First-fit fallback (very large inputs only).
  const days: Array<Set<number>> = [];
  for (const it of order) {
    let d = days.findIndex((s) => !s.has(it.a) && !s.has(it.b));
    if (d < 0) {
      days.push(new Set());
      d = days.length - 1;
    }
    days[d].add(it.a);
    days[d].add(it.b);
    out.set(it, after + d + 1);
  }
  return out;
}
