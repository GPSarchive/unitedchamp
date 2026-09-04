/**
 * snapshot-season.ts
 *
 * Runs the REAL snapshotSeason() from src/app/lib/seasonSnapshot.ts against the
 * database in .env.local: player_season_stats → season_team_standings →
 * season_recaps for ONE season. Same code the dashboard "Ανανέωση" /
 * "Επανασύγχρονισμός" buttons and the close-season action run.
 *
 * Usage:  npx tsx scripts/snapshot-season.ts --season=2025-2026
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 * Verify: node scripts/audit-player-stats-drift.mjs · npx tsx scripts/audit-season-standings.ts
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
process.env.NEXT_PUBLIC_APP_ORIGIN ??= env.NEXT_PUBLIC_APP_ORIGIN;

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

async function main() {
  const seasonArg = process.argv.find((a) => a.startsWith("--season="));
  const seasonLabel = seasonArg ? seasonArg.slice("--season=".length).trim() : "";
  if (!seasonLabel) throw new Error("Usage: npx tsx scripts/snapshot-season.ts --season=2025-2026");

  ensureServerOnlyStub();
  const { snapshotSeason } = await import("../src/app/lib/seasonSnapshot");

  console.log(`Snapshotting season ${seasonLabel} (stats → standings → recap)…`);
  const r = await snapshotSeason(seasonLabel);
  console.log(
    `Done. stats rows ${r.statsRows} (stale deleted ${r.staleStatsRowsDeleted}), ` +
      `standings rows ${r.standingsRows} (stale deleted ${r.staleStandingsRowsDeleted}), ` +
      `recap stored: ${r.recapStored}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
