import { describe, it, expect } from "vitest";
import { genRoundRobin } from "../roundRobin";
import { planRemainingFixtures, type RemainingPlan, type RemainingRow } from "../remainingFixtures";

const pairKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

const schedule = (teamIds: number[], repeats: number): RemainingRow[] =>
  genRoundRobin({ stageIdx: 0, groupIdx: 0, teamIds, repeats }).map((m, i) => ({
    matchday: m.matchday,
    team_a_id: m.team_a_id,
    team_b_id: m.team_b_id,
    status: "scheduled",
    match_date: null,
    db_id: 1000 + i,
  }));

const finishThrough = (rows: RemainingRow[], md: number) =>
  rows.map((r) => ((r.matchday ?? 0) <= md ? { ...r, status: "finished" } : r));

/** The stage after applying the plan. */
function apply(rows: RemainingRow[], plan: RemainingPlan): RemainingRow[] {
  const removed = new Set(plan.removed);
  const moved = new Map(plan.moves.map((m) => [m.rowIndex, m]));
  return [
    ...rows.flatMap((r, i) => {
      if (removed.has(i)) return [];
      const m = moved.get(i);
      return [m ? { ...r, matchday: m.matchday, match_date: m.match_date } : r];
    }),
    ...plan.created.map((c) => ({ ...c, status: "scheduled" })),
  ];
}

function expectValid(rows: RemainingRow[], teams: number[], repeats: number) {
  const seen = new Set<string>();
  for (const r of rows)
    for (const t of [r.team_a_id, r.team_b_id]) {
      const k = `${r.matchday}|${t}`;
      expect(seen.has(k), `team ${t} twice on matchday ${r.matchday}`).toBe(false);
      seen.add(k);
    }
  const count = new Map<string, number>();
  for (const r of rows) {
    const k = pairKey(r.team_a_id!, r.team_b_id!);
    count.set(k, (count.get(k) ?? 0) + 1);
  }
  for (let i = 0; i < teams.length; i++)
    for (let j = i + 1; j < teams.length; j++)
      expect(count.get(pairKey(teams[i], teams[j])), `pair ${teams[i]}-${teams[j]}`).toBe(repeats);
  expect(count.size).toBe((teams.length * (teams.length - 1)) / 2);
}

describe("planRemainingFixtures", () => {
  const teams = [1, 2, 3, 4, 5, 6];

  it("finished matches never move; the rest is a valid schedule using the same matchday count", () => {
    const rows = finishThrough(schedule(teams, 1), 2);
    const plan = planRemainingFixtures({ rows, teamIds: teams, repeats: 1, seed: 3 });
    expect(plan.removed).toEqual([]);
    expect(plan.created).toEqual([]);
    expect(plan.finishedCount).toBe(6);
    expect(plan.moves.every((m) => m.matchday >= 3)).toBe(true);
    expect(plan.firstMatchday).toBe(3);
    expect(plan.lastMatchday).toBe(5);
    const after = apply(rows, plan);
    after.forEach((r, i) => {
      if (rows[i].status === "finished") expect(r).toEqual(rows[i]);
    });
    expectValid(after, teams, 1);
  });

  it("different seeds shuffle differently", () => {
    const rows = finishThrough(schedule([1, 2, 3, 4, 5, 6, 7, 8], 1), 1);
    const sig = (seed: number) =>
      planRemainingFixtures({ rows, teamIds: [1, 2, 3, 4, 5, 6, 7, 8], repeats: 1, seed })
        .moves.map((m) => `${m.rowIndex}@${m.matchday}`)
        .join(",");
    const all = new Set([1, 2, 3, 4, 5, 6].map(sig));
    expect(all.size).toBeGreaterThan(1);
  });

  it("wipes hand-made extras and duplicates, recreates a deleted pairing", () => {
    const base = finishThrough(schedule(teams, 1), 1);
    const dropped = base.findIndex((r) => r.matchday === 4);
    const droppedPair = pairKey(base[dropped].team_a_id!, base[dropped].team_b_id!);
    const rows: RemainingRow[] = [
      ...base.filter((_, i) => i !== dropped),
      // duplicate of an owed pairing, hand-made (no db_id) â†’ wiped
      { ...base.find((r) => r.matchday === 3)!, matchday: 6, db_id: null },
      // rematch of a finished pairing â†’ wiped
      { ...base.find((r) => r.matchday === 1)!, status: "scheduled", matchday: 7, db_id: 5 },
      // empty and foreign-team rows â†’ wiped
      { matchday: 7, team_a_id: null, team_b_id: null, status: "scheduled" },
      { matchday: 7, team_a_id: 1, team_b_id: 99, status: "scheduled" },
    ];
    const plan = planRemainingFixtures({ rows, teamIds: teams, repeats: 1, seed: 1 });
    expect(plan.removed).toEqual([rows.length - 4, rows.length - 3, rows.length - 2, rows.length - 1]);
    expect(plan.created.map((c) => pairKey(c.team_a_id, c.team_b_id))).toEqual([droppedPair]);
    expectValid(apply(rows, plan), teams, 1);
  });

  it("partly played matchday: postponed match can stay, its teams keep the slot rules", () => {
    const rows = finishThrough(schedule(teams, 1), 3);
    const postponed = rows.findIndex((r) => r.matchday === 2);
    rows[postponed] = { ...rows[postponed], status: "postponed" };
    const plan = planRemainingFixtures({ rows, teamIds: teams, repeats: 1, seed: 2 });
    expect(plan.firstMatchday).toBe(2);
    const after = apply(rows, plan);
    expectValid(after, teams, 1);
    // nothing else fits matchday 2: only the postponed pair can go there
    expect(after.filter((r) => r.matchday === 2 && r.status !== "finished").length).toBeLessThanOrEqual(1);
  });

  it("dates stay with the matchday's slots", () => {
    const rows = finishThrough(schedule(teams, 1), 1).map((r) =>
      r.matchday === 2 ? { ...r, match_date: `2026-12-0${(r.team_a_id ?? 0) % 3 + 1}T20:00:00` } : r
    );
    const slots2 = rows.filter((r) => r.matchday === 2).map((r) => r.match_date).sort();
    const plan = planRemainingFixtures({ rows, teamIds: teams, repeats: 1, seed: 9 });
    const landed = [...plan.moves, ...plan.created].filter((p) => p.matchday === 2);
    expect(landed.map((p) => p.match_date).sort()).toEqual(slots2);
    expect([...plan.moves, ...plan.created].filter((p) => p.matchday !== 2).every((p) => p.match_date === null)).toBe(true);
  });

  it("odd team count and double round", () => {
    const odd = [1, 2, 3, 4, 5];
    const rows = finishThrough(schedule(odd, 2), 4);
    const plan = planRemainingFixtures({ rows, teamIds: odd, repeats: 2, seed: 5 });
    expectValid(apply(rows, plan), odd, 2);
    expect(plan.lastMatchday).toBe(10);
  });

  it("withdrawn team: its unplayed matches go, everyone else is complete", () => {
    const rows = finishThrough(schedule(teams, 1), 2);
    const plan = planRemainingFixtures({ rows, teamIds: [1, 2, 3, 4, 5], repeats: 1, seed: 4 });
    const after = apply(rows, plan).filter((r) => r.status !== "finished");
    expect(after.some((r) => r.team_a_id === 6 || r.team_b_id === 6)).toBe(false);
    const seen = new Set<string>();
    for (const r of after)
      for (const t of [r.team_a_id, r.team_b_id]) {
        expect(seen.has(`${r.matchday}|${t}`)).toBe(false);
        seen.add(`${r.matchday}|${t}`);
      }
  });

  it("12 teams, double round, scrambled mid-season: valid, compact, fast", () => {
    const big = Array.from({ length: 12 }, (_, i) => i + 1);
    let rows = finishThrough(schedule(big, 2), 7);
    // scramble: move unplayed matches around, delete some, add hand-made junk
    rows = rows
      .filter((r, i) => r.status === "finished" || i % 9 !== 0)
      .map((r, i) => (r.status === "finished" ? r : { ...r, matchday: 8 + (i % 20) }));
    rows.push({ matchday: 9, team_a_id: 1, team_b_id: 2, status: "scheduled" });
    rows.push({ matchday: 30, team_a_id: 3, team_b_id: 3, status: "scheduled" });
    const t0 = Date.now();
    const plan = planRemainingFixtures({ rows, teamIds: big, repeats: 2, seed: 11 });
    expect(Date.now() - t0).toBeLessThan(1500);
    expectValid(apply(rows, plan), big, 2);
    // a 12-team double round needs 22 matchdays; the search reaches that
    expect(plan.lastMatchday!).toBeLessThanOrEqual(22);
  });

  it("nothing left to play", () => {
    const rows = finishThrough(schedule(teams, 1), 99);
    const plan = planRemainingFixtures({ rows, teamIds: teams, repeats: 1 });
    expect(plan).toMatchObject({ moves: [], removed: [], created: [], firstMatchday: null });
  });
});
