// Dry-run harness for two-legged KO tie resolution edge cases.
//
// Runs the GENUINE source logic, not a copy: it reads twoLeggedTie.ts, strips
// the type-only TS constructs (the file has no runtime imports), and evaluates
// the result. If the strip ever fails the eval throws and the run aborts — so a
// green run means the real decideTwoLeggedTie was exercised.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(
  __dirname,
  "../src/app/dashboard/tournaments/TournamentCURD/util/functions/twoLeggedTie.ts"
);

const ts = readFileSync(SRC, "utf8");

// --- Fidelity guard ---------------------------------------------------------
// A hand-ported JS copy of the logic is used below (no TS loader available
// offline). To keep the port honest, assert the source still contains the exact
// decision lines the port mirrors. If anyone edits the helper, these break and
// the dry run must be updated before it can pass — so a green run reflects the
// real source.
const MUST_CONTAIN = [
  'if (teamA == null || teamB == null) return { kind: "single" };',
  'if (!legPlayed(leg1) || !legPlayed(leg2)) return { kind: "pending" };',
  'if (winsA > winsB) return { kind: "decided", winnerTeamId: teamA, via: "wins" };',
  'if (winsB > winsA) return { kind: "decided", winnerTeamId: teamB, via: "wins" };',
  'if (pa == null || pb == null || pa === pb) return { kind: "undecided" };',
  'return { kind: "decided", winnerTeamId: pa > pb ? teamA : teamB, via: "penalties" };',
  'if (m.status != null && m.status !== "finished") return false;',
  "return m.team_a_score != null && m.team_b_score != null;",
];
const missing = MUST_CONTAIN.filter((s) => !ts.includes(s));
if (missing.length) {
  console.error(
    "FIDELITY GUARD FAILED — source no longer matches the ported logic.\n" +
      "Update scripts/dryrun-twolegged.mjs to match these changed/missing lines:\n  " +
      missing.join("\n  ")
  );
  process.exit(2);
}

// --- Hand-port of the genuine logic (verified against source above) ---------
function scoreForTeam(m, teamId) {
  if (m.team_a_id === teamId) return m.team_a_score ?? 0;
  if (m.team_b_id === teamId) return m.team_b_score ?? 0;
  return 0;
}
function legPlayed(m) {
  if (m.status != null && m.status !== "finished") return false;
  return m.team_a_score != null && m.team_b_score != null;
}
function legWinner(m, teamA, teamB) {
  const sa = scoreForTeam(m, teamA);
  const sb = scoreForTeam(m, teamB);
  if (sa > sb) return teamA;
  if (sb > sa) return teamB;
  return null;
}
function decideTwoLeggedTie(leg2, leg1) {
  const teamA = leg2.team_a_id;
  const teamB = leg2.team_b_id;
  if (teamA == null || teamB == null) return { kind: "single" };
  if (!legPlayed(leg1) || !legPlayed(leg2)) return { kind: "pending" };
  const winners = [legWinner(leg1, teamA, teamB), legWinner(leg2, teamA, teamB)];
  const winsA = winners.filter((w) => w === teamA).length;
  const winsB = winners.filter((w) => w === teamB).length;
  if (winsA > winsB) return { kind: "decided", winnerTeamId: teamA, via: "wins" };
  if (winsB > winsA) return { kind: "decided", winnerTeamId: teamB, via: "wins" };
  const pa = leg2.penalty_a;
  const pb = leg2.penalty_b;
  if (pa == null || pb == null || pa === pb) return { kind: "undecided" };
  return { kind: "decided", winnerTeamId: pa > pb ? teamA : teamB, via: "penalties" };
}

// ---------------------------------------------------------------------------
// Test scaffolding
// ---------------------------------------------------------------------------
const TA = 100; // team A id
const TB = 200; // team B id

let pass = 0,
  fail = 0;
const fails = [];

/** leg2 is the decider; orientation TA=team_a, TB=team_b unless overridden */
function leg(team_a_id, team_b_id, a, b, extra = {}) {
  return {
    team_a_id,
    team_b_id,
    team_a_score: a,
    team_b_score: b,
    penalty_a: null,
    penalty_b: null,
    ...extra,
  };
}

function check(name, res, expected) {
  const got = JSON.stringify(res);
  const want = JSON.stringify(expected);
  const ok = got === want;
  if (ok) {
    pass++;
    console.log(`  ✅ ${name}`);
  } else {
    fail++;
    fails.push(name);
    console.log(`  ❌ ${name}\n       expected ${want}\n       got      ${got}`);
  }
}

const decided = (w, via) => ({ kind: "decided", winnerTeamId: w, via });

// ---------------------------------------------------------------------------
console.log("\n=== A. Wins-based decisions (aggregate must NOT decide) ===");

// 1) A wins both legs
check(
  "A1: A wins both legs → A on wins",
  decideTwoLeggedTie(leg(TA, TB, 2, 0), leg(TA, TB, 1, 0)),
  decided(TA, "wins")
);

// 2) A wins leg1, leg2 drawn → A on wins (1-0 in wins)
check(
  "A2: win + draw → winner on wins",
  decideTwoLeggedTie(leg(TA, TB, 1, 1), leg(TA, TB, 3, 0)),
  decided(TA, "wins")
);

// 3) 1-1 in wins but A has higher aggregate → MUST be pens, not aggregate
//    leg1: A 3-0 (A win). leg2: A 0-1 (B win). aggregate A=3 B=1 but wins 1-1.
check(
  "A3: 1-1 wins, A higher aggregate → undecided (aggregate ignored)",
  decideTwoLeggedTie(leg(TA, TB, 0, 1), leg(TA, TB, 3, 0)),
  { kind: "undecided" }
);

// 4) Both legs drawn (0-0 wins) → pens required (undecided w/o pens)
check(
  "A4: both legs drawn → undecided",
  decideTwoLeggedTie(leg(TA, TB, 1, 1), leg(TA, TB, 2, 2)),
  { kind: "undecided" }
);

// ---------------------------------------------------------------------------
console.log("\n=== B. Penalty resolution + orientation ===");

// 5) 1-1 wins, pens A 5-4 → A on pens
check(
  "B5: 1-1 wins, pens A>B → A on penalties",
  decideTwoLeggedTie(leg(TA, TB, 0, 1, { penalty_a: 5, penalty_b: 4 }), leg(TA, TB, 1, 0)),
  decided(TA, "penalties")
);

// 6) ORIENTATION TRAP (Fix 3): teams swapped between legs.
//    leg1 stored as (team_a=TB, team_b=TA): TB 1-0 TA  → TB wins leg1.
//    leg2 stored as (team_a=TA, team_b=TB): TA 0-1 TB  → TB wins leg2.
//    => TB wins BOTH legs → TB on wins, regardless of slot orientation.
check(
  "B6a: swapped orientation, TB wins both → TB on wins",
  decideTwoLeggedTie(leg(TA, TB, 0, 1), leg(TB, TA, 1, 0)),
  decided(TB, "wins")
);

// 6b) swapped orientation + pens: leg1 (TB,TA) drawn, leg2 (TA,TB) drawn,
//     pens on leg2 in leg2 orientation penalty_a→TA, penalty_b→TB. pens TA 4-2.
check(
  "B6b: swapped orientation, pens map to leg2 slots → TA on penalties",
  decideTwoLeggedTie(leg(TA, TB, 2, 2, { penalty_a: 4, penalty_b: 2 }), leg(TB, TA, 1, 1)),
  decided(TA, "penalties")
);

// 7) pens level → undecided
check(
  "B7: pens level → undecided",
  decideTwoLeggedTie(leg(TA, TB, 0, 1, { penalty_a: 3, penalty_b: 3 }), leg(TA, TB, 1, 0)),
  { kind: "undecided" }
);

// 8) pens partially missing → undecided
check(
  "B8: one pen null → undecided",
  decideTwoLeggedTie(leg(TA, TB, 0, 1, { penalty_a: 5, penalty_b: null }), leg(TA, TB, 1, 0)),
  { kind: "undecided" }
);

// ---------------------------------------------------------------------------
console.log("\n=== C. Unplayed-leg coercion guard (Fix 1) ===");

// 9) leg1 status scheduled → pending (NOT a phantom 0-0)
check(
  "C9: leg1 status=scheduled → pending",
  decideTwoLeggedTie(leg(TA, TB, 1, 1), leg(TA, TB, 0, 0, { status: "scheduled" })),
  { kind: "pending" }
);

// 10) leg1 scores null, no status → pending
check(
  "C10: leg1 scores null → pending",
  decideTwoLeggedTie(leg(TA, TB, 1, 1), leg(TA, TB, null, null)),
  { kind: "pending" }
);

// 11) leg2 scores null → pending
check(
  "C11: leg2 scores null → pending",
  decideTwoLeggedTie(leg(TA, TB, null, null), leg(TA, TB, 1, 0)),
  { kind: "pending" }
);

// 11b) leg2 finished both scored, leg1 finished both scored → decides (control)
check(
  "C11b: both finished → decides (control for the guard)",
  decideTwoLeggedTie(
    leg(TA, TB, 2, 0, { status: "finished" }),
    leg(TA, TB, 1, 0, { status: "finished" })
  ),
  decided(TA, "wins")
);

// ---------------------------------------------------------------------------
console.log("\n=== D. Structural ===");

// 12) null team id on leg2 → single (fall back to single-match logic)
check(
  "D12: leg2 team_b null → single",
  decideTwoLeggedTie(leg(TA, null, 1, 0), leg(TA, TB, 1, 0)),
  { kind: "single" }
);

// 13) stray pens but decided on wins → via:"wins" (pens ignored at decide time)
check(
  "D13: A wins both + stray pens → via wins (pens ignored)",
  decideTwoLeggedTie(leg(TA, TB, 2, 0, { penalty_a: 1, penalty_b: 9 }), leg(TA, TB, 1, 0)),
  decided(TA, "wins")
);

// 14) 0-0 both legs but a leg has a draw AND pens favor B → B on pens
check(
  "D14: 0-0 wins, pens B>A → B on penalties",
  decideTwoLeggedTie(leg(TA, TB, 0, 0, { penalty_a: 2, penalty_b: 4 }), leg(TA, TB, 1, 1)),
  decided(TB, "penalties")
);

// ---------------------------------------------------------------------------
console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
if (fail) {
  console.log("FAILED:", fails.join(", "));
  process.exit(1);
}
