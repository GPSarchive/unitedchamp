// Regression tests for the uid-based match identity model.
//
// The scenario driving all of this: two TBD skeleton fixtures (null teams) on
// the same matchday share a matchSig. While overlays/dirty-tracking were keyed
// by sig, the two rows collapsed to one identity — hydration lost a db_id,
// deleting one removed both from the UI, and save reconcile could hand both
// rows the same db_id. Identity is now a client uid assigned at the store
// boundary; matchSig remains only a fingerprint for matching DB rows that
// don't know the uid.

import { describe, it, expect, vi, afterEach } from "vitest";
import type { DraftMatch } from "../../TournamentWizard";
import {
  useTournamentStore,
  matchSig,
  type FullTournamentSnapshot,
} from "../tournamentStore";

const TOURNAMENT_ID = 1;
const GROUPS_STAGE = 10;
const KO_STAGE = 20;
const GROUP_A = 100;

/** Snapshot with the collision-prone shapes: 2 TBD skeletons on one matchday,
 *  a normal teamed fixture, a persisted two-legged KO tie, and a single-leg KO row. */
function makeSnapshot(overrides?: Partial<FullTournamentSnapshot>): FullTournamentSnapshot {
  return {
    tournament: { id: TOURNAMENT_ID, name: "T", slug: "t", format: "mixed" },
    stages: [
      { id: GROUPS_STAGE, tournament_id: TOURNAMENT_ID, name: "Groups", kind: "groups", ordering: 0 },
      { id: KO_STAGE, tournament_id: TOURNAMENT_ID, name: "KO", kind: "knockout", ordering: 1 },
    ],
    groups: [{ id: GROUP_A, stage_id: GROUPS_STAGE, name: "A", ordering: 0 }],
    teams: [
      { id: 1, name: "One" },
      { id: 2, name: "Two" },
      { id: 3, name: "Three" },
      { id: 4, name: "Four" },
    ],
    tournamentTeams: [],
    matches: [
      // two identical TBD skeletons — same stage/group/matchday, null teams
      { id: 901, stage_id: GROUPS_STAGE, group_id: GROUP_A, matchday: 1, team_a_id: null, team_b_id: null, status: "scheduled", updated_at: "u901" },
      { id: 902, stage_id: GROUPS_STAGE, group_id: GROUP_A, matchday: 1, team_a_id: null, team_b_id: null, status: "scheduled", updated_at: "u902" },
      // a normal teamed fixture
      { id: 903, stage_id: GROUPS_STAGE, group_id: GROUP_A, matchday: 2, team_a_id: 1, team_b_id: 2, status: "finished", team_a_score: 2, team_b_score: 1, winner_team_id: 1 },
      // persisted two-legged KO tie at (r1, p1)
      { id: 910, stage_id: KO_STAGE, round: 1, bracket_pos: 1, leg: 1, team_a_id: 1, team_b_id: 2, status: "scheduled" },
      { id: 911, stage_id: KO_STAGE, round: 1, bracket_pos: 1, leg: 2, team_a_id: 2, team_b_id: 1, status: "scheduled", tie_leg1_match_id: 910 },
      // single-leg KO row at (r1, p2)
      { id: 920, stage_id: KO_STAGE, round: 1, bracket_pos: 2, leg: null, team_a_id: 3, team_b_id: 4, status: "scheduled" },
    ],
    ...overrides,
  };
}

const state = () => useTournamentStore.getState();
const skeletons = () =>
  state().draftMatches.filter((m) => m.stageIdx === 0 && m.matchday === 1);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("hydration — identity of identical skeleton fixtures", () => {
  it("gives each row a distinct uid and its own overlay entry (no sig collapse)", () => {
    state().hydrateFromSnapshot(makeSnapshot());

    const rows = skeletons();
    expect(rows).toHaveLength(2);

    // sigs collide (that's inherent to TBD fixtures) — uids must not
    expect(matchSig(rows[0] as DraftMatch)).toBe(matchSig(rows[1] as DraftMatch));
    expect(rows[0].uid).toBeTruthy();
    expect(rows[1].uid).toBeTruthy();
    expect(rows[0].uid).not.toBe(rows[1].uid);

    // both DB identities survive hydration (sig-keyed overlays kept only one)
    const overlay = state().dbOverlayByUid;
    const dbIds = rows.map((r) => overlay[r.uid!]?.db_id).sort();
    expect(dbIds).toEqual([901, 902]);
    expect(overlay[rows[0].uid!]?.updated_at).not.toBe(overlay[rows[1].uid!]?.updated_at);
  });
});

describe("removeMatch — the deferred bug", () => {
  it("removes exactly the targeted skeleton and queues exactly its db_id", () => {
    state().hydrateFromSnapshot(makeSnapshot());
    const [first, second] = skeletons();
    const firstDbId = state().dbOverlayByUid[first.uid!]!.db_id!;

    state().removeMatch(first);

    const left = skeletons();
    expect(left).toHaveLength(1); // sig-keyed removal deleted BOTH
    expect(left[0].uid).toBe(second.uid);
    expect([...state().dirty.deletedMatchIds]).toEqual([firstDbId]);
    expect(state().dbOverlayByUid[first.uid!]).toBeUndefined();
    expect(state().dbOverlayByUid[second.uid!]?.db_id).toBe(firstDbId === 901 ? 902 : 901);
  });
});

describe("updateMatches / ensureUids boundary", () => {
  it("assigns uids to new rows and re-mints spread-duplicated uids", () => {
    state().hydrateFromSnapshot(makeSnapshot());
    const before = state().draftMatches.filter((m) => m.stageIdx === 0);

    state().updateMatches(0, (rows) => [
      ...rows,
      // brand-new row without uid
      { stageIdx: 0, groupIdx: 0, matchday: 3, team_a_id: 3, team_b_id: 4, is_ko: false } as DraftMatch,
      // spread copy of an existing row → duplicated uid must be re-minted
      { ...rows[0], matchday: 4 },
    ]);

    const after = state().draftMatches.filter((m) => m.stageIdx === 0);
    expect(after).toHaveLength(before.length + 2);
    const uids = after.map((m) => m.uid);
    expect(uids.every(Boolean)).toBe(true);
    expect(new Set(uids).size).toBe(uids.length); // all unique
    // every touched row is dirty by uid
    for (const m of after) expect(state().dirty.matches.has(m.uid!)).toBe(true);
  });
});

describe("setKOLegCount — identity survives leg changes", () => {
  const koRows = (pos: number) =>
    state().draftMatches.filter(
      (m) => m.stageIdx === 1 && m.round === 1 && m.bracket_pos === pos
    );

  it("1 → 2: promoted leg-1 keeps uid/db linkage; new leg 2 gets a fresh uid", () => {
    state().hydrateFromSnapshot(makeSnapshot());
    const single = koRows(2)[0];
    expect(state().dbOverlayByUid[single.uid!]?.db_id).toBe(920);

    state().setKOLegCount(1, { round: 1, bracket_pos: 2 }, 2);

    const rows = koRows(2);
    expect(rows).toHaveLength(2);
    const leg1 = rows.find((m) => m.leg === 1)!;
    const leg2 = rows.find((m) => m.leg === 2)!;
    // no sig-migration dance: the uid (and thus the overlay entry) is unchanged
    expect(leg1.uid).toBe(single.uid);
    expect(state().dbOverlayByUid[leg1.uid!]?.db_id).toBe(920);
    expect(leg2.uid).toBeTruthy();
    expect(leg2.uid).not.toBe(leg1.uid);
    expect(leg2.db_id ?? null).toBeNull();
    // orientation swapped
    expect(leg2.team_a_id).toBe(single.team_b_id);
    expect(leg2.team_b_id).toBe(single.team_a_id);
  });

  it("2 → 1: deletes the persisted leg-2, keeps leg-1 identity", () => {
    state().hydrateFromSnapshot(makeSnapshot());
    const leg1Before = koRows(1).find((m) => m.leg === 1)!;

    state().setKOLegCount(1, { round: 1, bracket_pos: 1 }, 1);

    const rows = koRows(1);
    expect(rows).toHaveLength(1);
    expect(rows[0].uid).toBe(leg1Before.uid);
    expect(rows[0].leg ?? null).toBeNull();
    expect(state().dbOverlayByUid[rows[0].uid!]?.db_id).toBe(910);
    expect([...state().dirty.deletedMatchIds]).toContain(911);
  });
});

describe("saveAll reconcile — sig-colliding creates get distinct db_ids", () => {
  it("assigns server rows one-to-one and keys overlays by uid", async () => {
    state().hydrateFromSnapshot(makeSnapshot({ matches: [] }));

    // two brand-new TBD skeletons on the same matchday (no db ids)
    state().updateMatches(0, () => [
      { stageIdx: 0, groupIdx: 0, matchday: 1, team_a_id: null, team_b_id: null, is_ko: false } as DraftMatch,
      { stageIdx: 0, groupIdx: 0, matchday: 1, team_a_id: null, team_b_id: null, is_ko: false } as DraftMatch,
    ]);

    const serverMatches = [
      { id: 2001, stage_id: GROUPS_STAGE, group_id: GROUP_A, matchday: 1, team_a_id: null, team_b_id: null, status: "scheduled", updated_at: "s1" },
      { id: 2002, stage_id: GROUPS_STAGE, group_id: GROUP_A, matchday: 1, team_a_id: null, team_b_id: null, status: "scheduled", updated_at: "s2" },
    ];
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, matches: serverMatches }),
      text: async () => "",
    }));
    vi.stubGlobal("fetch", fetchMock);

    await state().saveAll();

    // only phase 4 had dirty state → exactly one POST
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse((fetchMock.mock.calls[0] as any)[1].body);
    expect(body.matches.upsert).toHaveLength(2);

    const rows = skeletons();
    expect(rows).toHaveLength(2);
    const ids = rows.map((r) => r.db_id).sort();
    expect(ids).toEqual([2001, 2002]); // NOT the same id twice

    const overlay = state().dbOverlayByUid;
    expect(overlay[rows[0].uid!]?.db_id).not.toBe(overlay[rows[1].uid!]?.db_id);
    expect(state().dirty.matches.size).toBe(0);
  });
});
