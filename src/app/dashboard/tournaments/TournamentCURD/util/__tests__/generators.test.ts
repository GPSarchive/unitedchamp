import { describe, it, expect } from "vitest";
import { generateDraftMatches } from "../Generators";
import type { NewTournamentPayload } from "@/app/lib/types";
import type { DraftMatch, TeamDraft } from "../../TournamentWizard";

const teams = (n: number, groupOf?: (i: number) => number): TeamDraft[] =>
  Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    ...(groupOf ? { groupsByStage: { 0: groupOf(i) } } : {}),
  }));

const payload = (stage: Record<string, unknown>): NewTournamentPayload =>
  ({
    tournament: { name: "T" },
    stages: [{ name: "Stage 1", ordering: 1, config: { shuffle: false }, ...stage }],
  }) as unknown as NewTournamentPayload;

const pair = (m: DraftMatch) =>
  [m.team_a_id, m.team_b_id].sort((a, b) => (a ?? 0) - (b ?? 0)).join("-");

/** Order-insensitive fingerprint: which pairs meet on which matchday. */
const schedule = (ms: DraftMatch[]) =>
  ms
    .map((m) => `G${m.groupIdx ?? -1}|MD${m.matchday}|${pair(m)}`)
    .sort()
    .join(",");

describe("generateDraftMatches — shuffle", () => {
  const league = payload({ kind: "league" });
  const t14 = teams(14);

  it("is deterministic without shuffle (same schedule on every call)", () => {
    const a = generateDraftMatches({ payload: league, teams: t14 });
    const b = generateDraftMatches({ payload: league, teams: t14 });
    expect(schedule(a)).toBe(schedule(b));
  });

  it("forceShuffle gives different schedules across calls, even with shuffle off", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 6; i++) {
      seen.add(schedule(generateDraftMatches({ payload: league, teams: t14, forceShuffle: true })));
    }
    // 14 teams → an astronomically large number of orderings; 6 identical draws
    // would mean the flag is ignored.
    expect(seen.size).toBeGreaterThan(1);
  });

  it("a shuffled league is still a full single round-robin", () => {
    const out = generateDraftMatches({ payload: league, teams: t14, forceShuffle: true });
    expect(out).toHaveLength((14 * 13) / 2);
    expect(new Set(out.map(pair)).size).toBe((14 * 13) / 2);
    // 13 matchdays, every team exactly once per matchday
    const byMd = new Map<number, number[]>();
    for (const m of out) {
      const ids = byMd.get(m.matchday!) ?? [];
      ids.push(m.team_a_id!, m.team_b_id!);
      byMd.set(m.matchday!, ids);
    }
    expect(byMd.size).toBe(13);
    for (const ids of byMd.values()) expect(new Set(ids).size).toBe(14);
  });

  it("forceShuffle keeps teams inside their assigned group", () => {
    const groups = payload({ kind: "groups", groups: [{ name: "A" }, { name: "B" }] });
    const t8 = teams(8, (i) => (i < 4 ? 0 : 1));
    const out = generateDraftMatches({ payload: groups, teams: t8, forceShuffle: true });
    expect(out).toHaveLength(12);
    for (const m of out) {
      const inA = (id: number) => id <= 4;
      expect(inA(m.team_a_id!)).toBe(m.groupIdx === 0);
      expect(inA(m.team_b_id!)).toBe(m.groupIdx === 0);
    }
  });
});
