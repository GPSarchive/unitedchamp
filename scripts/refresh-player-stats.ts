/**
 * refresh-player-stats.ts
 *
 * Runs the REAL refreshAllPlayerStats() from src/app/lib/refreshPlayerStats.ts
 * against the database in .env.local — the same code the
 * /dashboard/refresh-stats button executes. Non-destructive: upserts
 * recomputed rows, then deletes only rows with no remaining source stats.
 *
 * Usage:  npx tsx scripts/refresh-player-stats.ts
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

  // dynamic import so the env vars above are set before supabaseAdmin is created
  const { refreshAllPlayerStats } = await import("../src/app/lib/refreshPlayerStats");

  console.log("Rebuilding player_career_stats + player_tournament_stats…");
  const result = await refreshAllPlayerStats();
  console.log(
    `Done. career rows upserted: ${result.careerRows}, tournament rows upserted: ${result.tournamentRows},\n` +
      `stale career rows deleted: ${result.staleCareerRowsDeleted}, stale tournament rows deleted: ${result.staleTournamentRowsDeleted},\n` +
      `match_player_stats rows processed: ${result.mpsRowsProcessed}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
