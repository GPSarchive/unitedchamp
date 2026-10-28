import { describe, it, expect } from "vitest";
import {
  describeMatchdayIssue,
  findMatchdayIssues,
  type IntegrityRow,
} from "../matchdayIntegrity";

const row = (
  uid: string,
  matchday: number | null,
  a: number | null,
  b: number | null,
  groupIdx: number | null = null
): IntegrityRow => ({ uid, matchday, team_a_id: a, team_b_id: b, groupIdx });

describe("findMatchdayIssues", () => {
  it("accepts uneven matchdays, gaps and empty rows", () => {
    const rows = [
      row("a", 1, 1, 2),
      row("b", 1, 3, 4),
      row("c", 3, 1, 3), // matchday 2 skipped, a single match here
      row("d", 3, null, null), // two empty slots on one matchday
      row("e", 3, null, null),
      row("f", 7, 2, null), // half-filled
    ];
    expect(findMatchdayIssues(rows, { repeats: 1 })).toEqual([]);
  });

  it("flags the same pair twice on one matchday as an error, either way round", () => {
    const issues = findMatchdayIssues([row("a", 2, 1, 2), row("b", 2, 2, 1)], { repeats: 2 });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      kind: "duplicate_pair",
      severity: "error",
      matchday: 2,
      count: 2,
      uids: ["a", "b"],
    });
  });

  it("flags two opponent-less rows of one team on a matchday (the DB keys them alike)", () => {
    const issues = findMatchdayIssues([row("a", 4, 5, null), row("b", 4, null, 5)], { repeats: 1 });
    expect(issues.map((i) => i.kind)).toEqual(["duplicate_pair"]);
  });

  it("warns when a team plays two different opponents on one matchday", () => {
    const issues = findMatchdayIssues([row("a", 1, 1, 2), row("b", 1, 1, 3)], { repeats: 1 });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      kind: "double_booking",
      severity: "warning",
      teamId: 1,
      count: 2,
      uids: ["a", "b"],
    });
  });

  it("flags a team set on both sides of a match", () => {
    expect(findMatchdayIssues([row("a", 1, 7, 7)], { repeats: 1 })).toEqual([
      { kind: "self_match", severity: "error", groupIdx: null, matchday: 1, teamId: 7, uids: ["a"] },
    ]);
  });

  it("warns when a pair meets more often than the stage's repeats, across matchdays", () => {
    const rows = [row("a", 1, 1, 2), row("b", 5, 2, 1), row("c", 9, 1, 2)];
    expect(findMatchdayIssues(rows, { repeats: 3 })).toEqual([]);
    const issues = findMatchdayIssues(rows, { repeats: 2 });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      kind: "pair_overflow",
      teamA: 1,
      teamB: 2,
      count: 3,
      max: 2,
      uids: ["a", "b", "c"],
    });
  });

  it("keeps groups apart", () => {
    expect(findMatchdayIssues([row("a", 1, 1, 2, 0), row("b", 1, 1, 2, 1)], { repeats: 1 })).toEqual(
      []
    );
  });

  it("ignores knockout rows", () => {
    const rows: IntegrityRow[] = [
      { uid: "a", round: 1, bracket_pos: 1, team_a_id: 1, team_b_id: 2, matchday: null },
      { uid: "b", round: 1, bracket_pos: 2, team_a_id: 1, team_b_id: 2, matchday: null },
    ];
    expect(findMatchdayIssues(rows, { repeats: 1 })).toEqual([]);
  });

  it("lists errors first, then warnings by matchday, stage-wide ones last", () => {
    const rows = [row("a", 1, 1, 2), row("b", 1, 1, 3), row("c", 6, 4, 5), row("d", 6, 5, 4)];
    expect(findMatchdayIssues(rows, { repeats: 1 }).map((i) => i.kind)).toEqual([
      "duplicate_pair",
      "double_booking",
      "pair_overflow",
    ]);
  });
});

describe("describeMatchdayIssue", () => {
  const ctx = {
    teamName: (id: number | null) => (id == null ? "—" : `T${id}`),
    groupName: (g: number | null) => (g == null ? null : `Όμιλος ${g + 1}`),
  };

  it("names the team, the matchday and the group", () => {
    const [issue] = findMatchdayIssues([row("a", 3, 1, 2, 1), row("b", 3, 1, 4, 1)], { repeats: 1 });
    expect(describeMatchdayIssue(issue, ctx)).toBe("Η ομάδα «T1» παίζει 2 φορές στην Αγ. 3 (Όμιλος 2).");
  });

  it("says the save will be rejected for a duplicate pair", () => {
    const [issue] = findMatchdayIssues([row("a", 2, 1, 2), row("b", 2, 2, 1)], { repeats: 1 });
    expect(describeMatchdayIssue(issue, ctx)).toBe(
      "Το ζευγάρι «T1» – «T2» υπάρχει 2 φορές στην Αγ. 2· η αποθήκευση θα απορριφθεί, γιατί κάθε ζευγάρι παίζει μία φορά ανά αγωνιστική."
    );
  });

  it("states the configured meetings for a pair overflow", () => {
    const [issue] = findMatchdayIssues([row("a", 1, 1, 2), row("b", 4, 1, 2)], { repeats: 1 });
    expect(describeMatchdayIssue(issue, ctx)).toBe(
      "Το ζευγάρι «T1» – «T2» συναντιέται 2 φορές· η ρύθμιση του σταδίου είναι 1 αγώνας ανά αντίπαλο."
    );
  });
});
