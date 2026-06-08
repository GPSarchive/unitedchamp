// One-off verification for the /paiktes stat-filter hardening.
// Confirms: (1) table sizes vs the 10k ceiling, (2) the new SQL career-stat
// filter (.gte) returns exactly the same player set as filtering the full
// career table in JS — the count==filtered invariant the plan requires.
//
// Run: node --env-file=.env.local scripts/verify-paiktes-stat-filter.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing Supabase env vars");
  process.exit(1);
}
const db = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ok = (b) => (b ? "PASS" : "FAIL");
let allPass = true;
const check = (label, pass, extra = "") => {
  if (!pass) allPass = false;
  console.log(`[${ok(pass)}] ${label}${extra ? "  " + extra : ""}`);
};

// ── table sizes (how close are we to the 10k ceiling?) ──────────────
async function count(table, mods = (q) => q) {
  const { count, error } = await mods(
    db.from(table).select("*", { count: "exact", head: true }),
  );
  if (error) throw new Error(`${table}: ${error.message}`);
  return count ?? 0;
}

const players = await count("player", (q) => q.is("deleted_at", null));
const careerRows = await count("player_career_stats");
const tourneyRows = await count("player_tournament_stats");
console.log(
  `\nrow counts → player(live)=${players}  player_career_stats=${careerRows}  player_tournament_stats=${tourneyRows}`,
);
check("player count well under 10k ceiling", players < 9000, `(${players})`);
check("career stats under 10k ceiling", careerRows < 9000, `(${careerRows})`);

// ── SQL .gte filter == JS filter over full career table ─────────────
// Pull the whole career table once (small), filter in JS, compare to the
// SQL .gte path used by page.tsx for the non-scoped case.
const { data: allCareer, error: cErr } = await db
  .from("player_career_stats")
  .select("player_id, total_goals, total_matches, total_assists")
  .limit(10000);
if (cErr) throw new Error(cErr.message);

async function sqlIds(column, n) {
  const { data, error } = await db
    .from("player_career_stats")
    .select("player_id")
    .gte(column, n)
    .limit(10000);
  if (error) throw new Error(error.message);
  return new Set(data.map((r) => r.player_id));
}

function jsIds(column, n) {
  return new Set(
    allCareer.filter((r) => (r[column] ?? 0) >= n).map((r) => r.player_id),
  );
}

const eqSet = (a, b) =>
  a.size === b.size && [...a].every((x) => b.has(x));

for (const [column, thresholds] of [
  ["total_goals", [0, 1, 5, 10, 20]],
  ["total_matches", [0, 1, 5, 10]],
  ["total_assists", [0, 1, 3, 5]],
]) {
  for (const n of thresholds) {
    const s = await sqlIds(column, n);
    const j = jsIds(column, n);
    check(
      `SQL .gte == JS filter  ${column} >= ${n}`,
      eqSet(s, j),
      `sql=${s.size} js=${j.size}`,
    );
  }
}

console.log(`\n${allPass ? "ALL CHECKS PASSED" : "SOME CHECKS FAILED"}\n`);
process.exit(allPass ? 0 : 1);
