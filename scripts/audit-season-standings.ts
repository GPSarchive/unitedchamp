/**
 * audit-season-standings.ts
 *
 * Recomputes the Γενική Κατάταξη for every season in public.seasons (or the
 * one given with --season=) with the real points engine, and diffs the result
 * against what is STORED in public.season_team_standings — rank, points,
 * every counter, the owner-required extras, and the number of log events.
 * Any difference is drift: a points-affecting mutation ran without
 * refreshActiveSeasonStandings() following, or an archived season needs a
 * re-snapshot. Recovery: npx tsx scripts/refresh-standings.ts --season=<label>.
 *
 * READ-ONLY: this script never writes anything.
 *
 * Usage:  npx tsx scripts/audit-season-standings.ts [--season=2025-2026]
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 */
import fs from "node:fs";

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, "")];
    }),
);
process.env.NEXT_PUBLIC_SUPABASE_URL ??= env.NEXT_PUBLIC_SUPABASE_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY ??= env.SUPABASE_SERVICE_ROLE_KEY;

function ensureServerOnlyStub() {
  const stubDir = "node_modules/server-only";
  if (fs.existsSync(stubDir)) return;
  fs.mkdirSync(stubDir, { recursive: true });
  fs.writeFileSync(
    `${stubDir}/package.json`,
    JSON.stringify({ name: "server-only", version: "0.0.0-local-stub", main: "index.js" }),
  );
  fs.writeFileSync(`${stubDir}/index.js`, "// no-op stub for tsx scripts\n");
}

const FIELDS = [
  "rank",
  "points",
  "participations",
  "qualifications",
  "titles",
  "runner_ups",
  "wins",
  "draws",
  "losses",
  "adjustment_points",
  "adjustment_count",
  "matches_played",
  "goals_for",
  "goals_against",
  "clean_sheets",
  "longest_win_streak",
] as const;

async function main() {
  ensureServerOnlyStub();
  const { computeSeasonStandingRows, getSeasonStandings } = await import(
    "../src/app/lib/refreshStandings"
  );
  const { listSeasons } = await import("../src/app/lib/seasons");
  const { supabaseAdmin } = await import("../src/app/lib/supabase/supabaseAdmin");

  const seasonArg = process.argv.find((a) => a.startsWith("--season="));
  const only = seasonArg ? seasonArg.slice("--season=".length).trim() : null;
  const seasons = (await listSeasons()).filter((s) => !only || s.label === only);
  if (seasons.length === 0) throw new Error(`No seasons found${only ? ` for ${only}` : ""}.`);

  const { data: teamRows } = await supabaseAdmin.from("teams").select("id, name, deleted_at");
  const teamName = new Map(
    (teamRows ?? []).map((t) => [t.id as number, `${t.name}${t.deleted_at ? " (deleted)" : ""}`]),
  );

  let totalDrift = 0;
  for (const season of seasons) {
    const [computed, stored] = await Promise.all([
      computeSeasonStandingRows(season.label),
      getSeasonStandings(season.label),
    ]);
    const exp = new Map(computed.map((r) => [r.team_id, r]));
    const cur = new Map(stored.map((r) => [r.team_id, r]));
    const keys = new Set([...exp.keys(), ...cur.keys()]);

    const lines: string[] = [];
    for (const teamId of keys) {
      const e = exp.get(teamId);
      const c = cur.get(teamId);
      const diffs: string[] = [];
      if (!e) diffs.push("STALE ROW — team no longer in the compute");
      else if (!c) diffs.push("MISSING ROW — never written");
      else {
        for (const f of FIELDS) {
          if (Number(c[f]) !== Number(e[f])) diffs.push(`${f}: stored=${c[f]} recomputed=${e[f]}`);
        }
        if ((c.events?.length ?? 0) !== e.events.length)
          diffs.push(`events: stored=${c.events?.length ?? 0} recomputed=${e.events.length}`);
      }
      if (diffs.length) lines.push(`  ${teamName.get(teamId) ?? teamId} (team ${teamId})\n    ${diffs.join("\n    ")}`);
    }

    // Season-level sanity: every match has two sides, so GF must equal GA.
    const gf = computed.reduce((s, r) => s + r.goals_for, 0);
    const ga = computed.reduce((s, r) => s + r.goals_against, 0);
    const mp = computed.reduce((s, r) => s + r.matches_played, 0);
    const wdl = computed.reduce((s, r) => s + r.wins + r.draws + r.losses, 0);

    console.log(
      `\n═══ ${season.label} (${season.status}): ${lines.length} of ${keys.size} rows drifted ═══`,
    );
    console.log(`  recomputed: ${computed.length} teams · GF ${gf} / GA ${ga} · matches_played Σ ${mp} = W+D+L Σ ${wdl}`);
    if (gf !== ga) console.log("  ⚠ GF ≠ GA — a match involves a team outside this season's rows");
    if (mp !== wdl) console.log("  ⚠ matches_played ≠ W+D+L");
    for (const l of lines.slice(0, 50)) console.log(l);
    if (lines.length > 50) console.log(`  … and ${lines.length - 50} more`);
    totalDrift += lines.length + (gf !== ga ? 1 : 0) + (mp !== wdl ? 1 : 0);
  }

  console.log("\n──────────────────────────────────────────────");
  if (totalDrift === 0) console.log("✓ No drift: stored season_team_standings match a fresh recompute.");
  else {
    console.log(`✗ Drift found (${totalDrift}). Recovery: npx tsx scripts/refresh-standings.ts --season=<label>`);
    process.exit(2);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
