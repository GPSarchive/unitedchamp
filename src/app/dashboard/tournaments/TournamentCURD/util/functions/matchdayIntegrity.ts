/**
 * Schedule checks for league / group fixtures edited by hand.
 *
 * Matchdays are free labels: any number of matches per matchday, gaps and
 * empty rows are all allowed (standings read finished matches only, and the
 * database's one rule is a single meeting per pair per matchday). So nothing
 * here blocks an edit — the planner lists the issues and marks the rows, and
 * the admin decides.
 *
 * Severity:
 *  - "error": the save will be rejected (`duplicate_pair` hits
 *    unique_league_match_idx) or the row is meaningless (`self_match`).
 *  - "warning": legal but usually a slip — a team twice on one matchday, or a
 *    pair meeting more often than the stage's rounds-per-opponent setting.
 */

export type IntegrityRow = {
  uid?: string | null;
  groupIdx?: number | null;
  matchday?: number | null;
  round?: number | null;
  bracket_pos?: number | null;
  team_a_id?: number | null;
  team_b_id?: number | null;
};

type Base = { groupIdx: number | null; uids: string[] };

export type MatchdayIssue =
  | (Base & {
      kind: "duplicate_pair";
      severity: "error";
      matchday: number;
      /** Either side may be null: two opponent-less rows of one team collide too. */
      teamA: number | null;
      teamB: number | null;
      count: number;
    })
  | (Base & { kind: "self_match"; severity: "error"; matchday: number; teamId: number })
  | (Base & {
      kind: "double_booking";
      severity: "warning";
      matchday: number;
      teamId: number;
      count: number;
    })
  | (Base & {
      kind: "pair_overflow";
      severity: "warning";
      teamA: number;
      teamB: number;
      count: number;
      max: number;
    });

/** Same shape as the DB key: LEAST/GREATEST of the pair, a missing side as 0. */
const pairKey = (a: number, b: number) => (a <= b ? `${a}-${b}` : `${b}-${a}`);
const uidsOf = (rows: IntegrityRow[]) =>
  rows.map((r) => r.uid).filter((u): u is string => !!u);

function push<K>(map: Map<K, IntegrityRow[]>, key: K, row: IntegrityRow) {
  const list = map.get(key);
  if (list) list.push(row);
  else map.set(key, [row]);
}

export function findMatchdayIssues(
  rows: IntegrityRow[],
  { repeats }: { repeats: number }
): MatchdayIssue[] {
  const issues: MatchdayIssue[] = [];
  const max = Math.max(1, Math.floor(repeats) || 1);

  // Knockout rows live in a bracket, not on matchdays.
  const byGroup = new Map<number | null, IntegrityRow[]>();
  for (const r of rows) {
    if (r.round != null || r.bracket_pos != null) continue;
    push(byGroup, r.groupIdx ?? null, r);
  }

  const groups = [...byGroup].sort((x, y) => (x[0] ?? -1) - (y[0] ?? -1));
  for (const [groupIdx, groupRows] of groups) {
    const byMd = new Map<number, IntegrityRow[]>();
    for (const r of groupRows) push(byMd, r.matchday ?? 0, r);

    for (const [matchday, mdRows] of [...byMd].sort((x, y) => x[0] - y[0])) {
      const pairs = new Map<string, IntegrityRow[]>();
      const perTeam = new Map<number, IntegrityRow[]>();
      for (const r of mdRows) {
        const a = r.team_a_id ?? null;
        const b = r.team_b_id ?? null;
        if (a != null && a === b) {
          issues.push({
            kind: "self_match",
            severity: "error",
            groupIdx,
            matchday,
            teamId: a,
            uids: uidsOf([r]),
          });
          continue;
        }
        if (a == null && b == null) continue; // empty slot: no identity yet
        push(pairs, pairKey(a ?? 0, b ?? 0), r);
        for (const t of [a, b]) if (t != null) push(perTeam, t, r);
      }

      for (const dup of pairs.values()) {
        if (dup.length < 2) continue;
        issues.push({
          kind: "duplicate_pair",
          severity: "error",
          groupIdx,
          matchday,
          teamA: dup[0].team_a_id ?? null,
          teamB: dup[0].team_b_id ?? null,
          count: dup.length,
          uids: uidsOf(dup),
        });
      }

      for (const [teamId, teamRows] of perTeam) {
        if (teamRows.length < 2) continue;
        // Already reported as duplicate_pair when every appearance is the same pairing.
        const distinct = new Set(
          teamRows.map((r) => pairKey(r.team_a_id ?? 0, r.team_b_id ?? 0))
        );
        if (distinct.size < 2) continue;
        issues.push({
          kind: "double_booking",
          severity: "warning",
          groupIdx,
          matchday,
          teamId,
          count: teamRows.length,
          uids: uidsOf(teamRows),
        });
      }
    }

    // Meetings per pair across all matchdays of the group / league.
    const meetings = new Map<string, IntegrityRow[]>();
    for (const r of groupRows) {
      const a = r.team_a_id ?? null;
      const b = r.team_b_id ?? null;
      if (a == null || b == null || a === b) continue;
      push(meetings, pairKey(a, b), r);
    }
    for (const met of meetings.values()) {
      if (met.length <= max) continue;
      const a = met[0].team_a_id as number;
      const b = met[0].team_b_id as number;
      issues.push({
        kind: "pair_overflow",
        severity: "warning",
        groupIdx,
        teamA: Math.min(a, b),
        teamB: Math.max(a, b),
        count: met.length,
        max,
        uids: uidsOf(met),
      });
    }
  }

  // Errors first, then by matchday (stage-wide issues last).
  const mdOf = (i: MatchdayIssue) => ("matchday" in i ? i.matchday : Number.MAX_SAFE_INTEGER);
  return issues.sort(
    (x, y) =>
      (x.severity === y.severity ? 0 : x.severity === "error" ? -1 : 1) || mdOf(x) - mdOf(y)
  );
}

/** One Greek sentence per issue, for the planner's banner. */
export function describeMatchdayIssue(
  issue: MatchdayIssue,
  ctx: {
    teamName: (id: number | null) => string;
    groupName: (groupIdx: number | null) => string | null;
  }
): string {
  const grp = ctx.groupName(issue.groupIdx);
  const inGroup = grp ? ` (${grp})` : "";
  const where = (md: number) => `στην Αγ. ${md}${inGroup}`;
  const q = (id: number | null) => `«${ctx.teamName(id)}»`;
  const times = (n: number) => (n === 1 ? "1 φορά" : `${n} φορές`);
  const rejected =
    "η αποθήκευση θα απορριφθεί, γιατί κάθε ζευγάρι παίζει μία φορά ανά αγωνιστική.";

  switch (issue.kind) {
    case "duplicate_pair": {
      if (issue.teamA == null || issue.teamB == null) {
        const t = issue.teamA ?? issue.teamB;
        return `Η ομάδα ${q(t)} έχει ${issue.count} αγώνες χωρίς αντίπαλο ${where(issue.matchday)}· ${rejected}`;
      }
      return `Το ζευγάρι ${q(issue.teamA)} – ${q(issue.teamB)} υπάρχει ${times(issue.count)} ${where(issue.matchday)}· ${rejected}`;
    }
    case "self_match":
      return `Η ομάδα ${q(issue.teamId)} έχει οριστεί και στις δύο θέσεις ενός αγώνα ${where(issue.matchday)}.`;
    case "double_booking":
      return `Η ομάδα ${q(issue.teamId)} παίζει ${times(issue.count)} ${where(issue.matchday)}.`;
    case "pair_overflow":
      return `Το ζευγάρι ${q(issue.teamA)} – ${q(issue.teamB)} συναντιέται ${times(issue.count)}${inGroup}· η ρύθμιση του σταδίου είναι ${
        issue.max === 1 ? "1 αγώνας" : `${issue.max} αγώνες`
      } ανά αντίπαλο.`;
  }
}
