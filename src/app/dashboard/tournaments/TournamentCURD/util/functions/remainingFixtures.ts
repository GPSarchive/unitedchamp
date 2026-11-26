/**
 * «Νέα κλήρωση υπολοίπων»: rebuild what is left of a league/group schedule
 * without touching anything already played (owner ask, 2026-11-26 — a
 * tournament got messed up mid-season and Regenerate refuses once matches
 * are finished).
 *
 *  1. Finished matches never change.
 *  2. Owed pairings = what the round-robin algorithm would create (every pair
 *     of `teamIds`, `repeats` times) minus the finished meetings.
 *  3. Unfinished rows whose pairing is still owed are KEPT (same row, same
 *     teams); the rest — hand-made extras, pairings repeated more often than
 *     the format allows, teams no longer in the stage, empty rows — are removed.
 *     Owed pairings with no row at all are created.
 *  4. Kept + created matches are shuffled onto matchdays from the first one
 *     that still had an unfinished match. No team plays twice on a matchday
 *     (finished matches there count), and as few matchdays as possible are used.
 *  5. Dates stay with the matchday: a matchday's unfinished rows' dates are its
 *     time slots, handed to whatever lands there; extra matches get no date.
 *
 * Deterministic for a given `seed`; another seed gives another shuffle.
 */

export type RemainingRow = {
  matchday?: number | null;
  team_a_id?: number | null;
  team_b_id?: number | null;
  status?: string | null;
  match_date?: string | null;
  db_id?: number | null;
};

export type RemainingPlacement = {
  matchday: number;
  match_date: string | null;
  team_a_id: number;
  team_b_id: number;
};

export type RemainingPlan = {
  /** Kept unfinished rows (index into `rows`) and where they go. */
  moves: (RemainingPlacement & { rowIndex: number })[];
  /** Unfinished rows (indexes into `rows`) whose pairing the schedule doesn't owe. */
  removed: number[];
  /** Owed pairings that had no row. */
  created: RemainingPlacement[];
  finishedCount: number;
  /** Matchdays the remaining schedule spans (inclusive); null when nothing is left. */
  firstMatchday: number | null;
  lastMatchday: number | null;
};

const pairKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(list: T[], rnd: () => number): T[] {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const isFinished = (r: RemainingRow) => r.status === "finished";

type Item = { id: number; a: number; b: number };

/**
 * Largest set of items with no team twice, among teams not in `busy`. Prefers
 * covering teams with the most matches left (keeps the tail short). Budgeted
 * backtracking; `items` order (already shuffled) breaks ties.
 */
function bestMatching(items: Item[], busy: Set<number>, left: Map<number, number>): Item[] {
  const usable = items.filter((it) => !busy.has(it.a) && !busy.has(it.b));
  const byTeam = new Map<number, Item[]>();
  for (const it of usable) {
    (byTeam.get(it.a) ?? byTeam.set(it.a, []).get(it.a)!).push(it);
    (byTeam.get(it.b) ?? byTeam.set(it.b, []).get(it.b)!).push(it);
  }
  const teams = [...byTeam.keys()];
  const score = (set: Item[]) =>
    set.length * 10000 + set.reduce((s, it) => s + (left.get(it.a) ?? 0) + (left.get(it.b) ?? 0), 0);

  let best: Item[] = [];
  let bestScore = -1;
  let budget = 4000;
  const used = new Set<number>();
  const chosen: Item[] = [];

  const go = (from: number) => {
    if (--budget < 0) return;
    // Upper bound: every remaining free team paired.
    let free = 0;
    for (let i = from; i < teams.length; i++) if (!used.has(teams[i])) free++;
    if ((chosen.length + Math.floor(free / 2)) * 10000 + 9999 <= bestScore) return;
    let i = from;
    while (i < teams.length && used.has(teams[i])) i++;
    if (i >= teams.length) {
      const s = score(chosen);
      if (s > bestScore) {
        bestScore = s;
        best = chosen.slice();
      }
      return;
    }
    const t = teams[i];
    used.add(t);
    for (const it of byTeam.get(t)!) {
      const o = it.a === t ? it.b : it.a;
      if (used.has(o)) continue;
      used.add(o);
      chosen.push(it);
      go(i + 1);
      chosen.pop();
      used.delete(o);
    }
    // t rests this matchday.
    go(i + 1);
    used.delete(t);
  };
  go(0);
  return best;
}

export function planRemainingFixtures(opts: {
  /** Rows of ONE group (or of the league stage). */
  rows: RemainingRow[];
  /** Teams the schedule is between (archived/withdrawn teams left out). */
  teamIds: number[];
  /** Meetings per pair (1 single, 2 double round, …). */
  repeats: number;
  seed?: number;
  attempts?: number;
}): RemainingPlan {
  const { rows } = opts;
  const teams = [...new Set(opts.teamIds)];
  const inStage = new Set(teams);
  const repeats = Math.max(1, Math.floor(opts.repeats || 1));
  const rnd = mulberry32((opts.seed ?? 1) * 7919 + 17);

  // Finished meetings and home counts per pair (home = team_a).
  const played = new Map<string, number>();
  const homes = new Map<string, Map<number, number>>();
  const addHome = (a: number, b: number) => {
    const k = pairKey(a, b);
    const m = homes.get(k) ?? homes.set(k, new Map()).get(k)!;
    m.set(a, (m.get(a) ?? 0) + 1);
  };
  let finishedCount = 0;
  for (const r of rows) {
    if (!isFinished(r)) continue;
    finishedCount++;
    if (r.team_a_id == null || r.team_b_id == null) continue;
    const k = pairKey(r.team_a_id, r.team_b_id);
    played.set(k, (played.get(k) ?? 0) + 1);
    addHome(r.team_a_id, r.team_b_id);
  }

  const owed = new Map<string, number>();
  for (let i = 0; i < teams.length; i++)
    for (let j = i + 1; j < teams.length; j++) {
      const k = pairKey(teams[i], teams[j]);
      owed.set(k, Math.max(0, repeats - (played.get(k) ?? 0)));
    }

  // Keep owed unfinished rows: saved rows first, then by matchday.
  const unfinished = rows
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => !isFinished(r))
    .sort(
      (x, y) =>
        Number(x.r.db_id == null) - Number(y.r.db_id == null) ||
        (x.r.matchday ?? Infinity) - (y.r.matchday ?? Infinity) ||
        x.i - y.i
    );
  const kept: { rowIndex: number; a: number; b: number }[] = [];
  const removed: number[] = [];
  for (const { r, i } of unfinished) {
    const a = r.team_a_id,
      b = r.team_b_id;
    const k = a != null && b != null && a !== b ? pairKey(a, b) : null;
    if (k && inStage.has(a!) && inStage.has(b!) && (owed.get(k) ?? 0) > 0) {
      owed.set(k, owed.get(k)! - 1);
      kept.push({ rowIndex: i, a: a!, b: b! });
      addHome(a!, b!);
    } else removed.push(i);
  }
  removed.sort((x, y) => x - y);

  // Missing pairings, home side balanced against earlier meetings.
  const toCreate: { a: number; b: number }[] = [];
  for (const [k, n] of owed) {
    const [x, y] = k.split("-").map(Number);
    for (let c = 0; c < n; c++) {
      const h = homes.get(k);
      const hx = h?.get(x) ?? 0,
        hy = h?.get(y) ?? 0;
      const [a, b] = hx <= hy ? [x, y] : [y, x];
      toCreate.push({ a, b });
      addHome(a, b);
    }
  }

  const items: Item[] = [
    ...kept.map((k, id) => ({ id, a: k.a, b: k.b })),
    ...toCreate.map((c, j) => ({ id: kept.length + j, a: c.a, b: c.b })),
  ];

  const unfinishedMds = unfinished.map(({ r }) => r.matchday).filter((m): m is number => m != null);
  const allMds = rows.map((r) => r.matchday).filter((m): m is number => m != null);
  const start = unfinishedMds.length
    ? Math.min(...unfinishedMds)
    : (allMds.length ? Math.max(...allMds) : 0) + 1;

  if (!items.length)
    return { moves: [], removed, created: [], finishedCount, firstMatchday: null, lastMatchday: null };

  // Teams already busy (finished match) on a matchday from `start` on.
  const busyOn = new Map<number, Set<number>>();
  for (const r of rows) {
    if (!isFinished(r) || r.matchday == null || r.matchday < start) continue;
    const s = busyOn.get(r.matchday) ?? busyOn.set(r.matchday, new Set()).get(r.matchday)!;
    if (r.team_a_id != null) s.add(r.team_a_id);
    if (r.team_b_id != null) s.add(r.team_b_id);
  }
  // Time slots: dates of the matchday's unfinished rows (removed ones included).
  const slots = new Map<number, string[]>();
  for (const { r } of unfinished) {
    if (r.matchday == null || !r.match_date) continue;
    (slots.get(r.matchday) ?? slots.set(r.matchday, []).get(r.matchday)!).push(r.match_date);
  }
  for (const s of slots.values()) s.sort();

  // Lower bound on the last matchday, to stop searching early.
  const leftOf = new Map<number, number>();
  for (const it of items) {
    leftOf.set(it.a, (leftOf.get(it.a) ?? 0) + 1);
    leftOf.set(it.b, (leftOf.get(it.b) ?? 0) + 1);
  }
  let bound = start;
  for (const [t, n] of leftOf) {
    let md = start - 1,
      got = 0;
    while (got < n) {
      md++;
      if (!busyOn.get(md)?.has(t)) got++;
    }
    bound = Math.max(bound, md);
  }

  const attempts = opts.attempts ?? 40;
  let best: Map<number, number> | null = null;
  let bestLast = Infinity;
  for (let a = 0; a < attempts && bestLast > bound; a++) {
    let pool = shuffled(items, rnd);
    const left = new Map(leftOf);
    const at = new Map<number, number>();
    let md = start;
    while (pool.length) {
      const pick = bestMatching(pool, busyOn.get(md) ?? new Set(), left);
      const ids = new Set(pick.map((p) => p.id));
      for (const p of pick) {
        at.set(p.id, md);
        left.set(p.a, left.get(p.a)! - 1);
        left.set(p.b, left.get(p.b)! - 1);
      }
      pool = pool.filter((p) => !ids.has(p.id));
      md++;
    }
    const last = md - 1;
    if (last < bestLast) {
      bestLast = last;
      best = at;
    }
  }

  // Hand each matchday's slots to its matches in random order.
  const byMd = new Map<number, Item[]>();
  for (const it of items) {
    const md = best!.get(it.id)!;
    (byMd.get(md) ?? byMd.set(md, []).get(md)!).push(it);
  }
  const dateOf = new Map<number, string | null>();
  for (const [md, list] of byMd) {
    const s = slots.get(md) ?? [];
    shuffled(list, rnd).forEach((it, i) => dateOf.set(it.id, s[i] ?? null));
  }

  const place = (it: Item): RemainingPlacement => ({
    matchday: best!.get(it.id)!,
    match_date: dateOf.get(it.id) ?? null,
    team_a_id: it.a,
    team_b_id: it.b,
  });
  return {
    moves: kept.map((k, id) => ({ rowIndex: k.rowIndex, ...place(items[id]) })),
    removed,
    created: toCreate.map((_, j) => place(items[kept.length + j])),
    finishedCount,
    firstMatchday: Math.min(...best!.values()),
    lastMatchday: bestLast,
  };
}
