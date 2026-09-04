/**
 * refresh-player-stats.ts
 *
 * Runs the REAL refreshAllPlayerStats() from src/app/lib/refreshPlayerStats.ts
 * (per-tournament + active-season rows; the career table is retired)
 * against the database in .env.local — the same code the
 * /dashboard/refresh-stats button executes. Non-destructive: upserts
 * recomputed rows, then deletes only rows with no remaining source stats.
 *
 * Usage:  npx tsx scripts/refresh-player-stats.ts
 *         npx tsx scripts/refresh-player-stats.ts --season=2025-2026
 *   With --season=<label> ONLY player_season_stats for that season is rebuilt
 *   (refreshAllSeasonStats). This is the Phase 1 backfill and the "re-snapshot"
 *   of an archived season. Without it the full rebuild runs (career +
 *   tournament + active season).
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 * Verify afterwards with: node scripts/audit-player-stats-drift.mjs (read-only)
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

async function main() {
  // The lib imports "server-only", which Next aliases at build time but is not
  // an installed package here — provide a no-op stub so tsx can resolve it.
  const stubDir = "node_modules/server-only";
  if (!fs.existsSync(stubDir)) {
    fs.mkdirSync(stubDir, { recursive: true });
    fs.writeFileSync(
      `${stubDir}/package.json`,
      JSON.stringify({ name: "server-only", version: "0.0.0-local-stub", main: "index.js" }),
    );
    fs.writeFileSync(`${stubDir}/index.js`, "// no-op stub for tsx scripts\n");
  }

  const seasonArg = process.argv.find((a) => a.startsWith("--season="));
  const seasonLabel = seasonArg ? seasonArg.slice("--season=".length).trim() : null;
  if (seasonArg && !seasonLabel) throw new Error("--season= needs a label, e.g. --season=2025-2026");

  // dynamic imports so the env vars above are set before supabaseAdmin is created
  if (seasonLabel) {
    const { refreshAllSeasonStats } = await import("../src/app/lib/refreshSeasonStats");
    console.log(`Rebuilding player_season_stats for season ${seasonLabel}…`);
    const r = await refreshAllSeasonStats(seasonLabel);
    console.log(
      `Done. season ${r.seasonLabel}: matches ${r.matches}, match_player_stats rows processed: ${r.mpsRowsProcessed},\n` +
        `season rows upserted: ${r.seasonRows}, stale season rows deleted: ${r.staleSeasonRowsDeleted}`,
    );
    return;
  }

  const { refreshAllPlayerStats } = await import("../src/app/lib/refreshPlayerStats");

  console.log("Rebuilding player_tournament_stats + active-season player_season_stats…");
  const result = await refreshAllPlayerStats();
  console.log(
    `Done. tournament rows upserted: ${result.tournamentRows}, stale tournament rows deleted: ${result.staleTournamentRowsDeleted},\n` +
      `season ${result.seasonLabel ?? "(none active)"}: rows upserted ${result.seasonRows}, stale deleted ${result.staleSeasonRowsDeleted},\n` +
      `match_player_stats rows processed: ${result.mpsRowsProcessed}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
