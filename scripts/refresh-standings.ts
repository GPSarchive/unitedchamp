/**
 * refresh-standings.ts
 *
 * Rebuilds public.season_team_standings for ONE season by running the real
 * refreshSeasonStandings() from src/app/lib/refreshStandings.ts against the
 * database in .env.local — the same code every points-affecting mutation
 * runs for the active season. This is the Phase 2 backfill and the
 * "re-snapshot" of an archived season. Non-destructive: upserts recomputed
 * rows, then deletes only rows whose team no longer appears in the compute.
 *
 * Usage:  npx tsx scripts/refresh-standings.ts --season=2025-2026
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 * Verify afterwards with: npx tsx scripts/audit-season-standings.ts (read-only)
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

async function main() {
  const seasonArg = process.argv.find((a) => a.startsWith("--season="));
  const seasonLabel = seasonArg ? seasonArg.slice("--season=".length).trim() : "";
  if (!seasonLabel) throw new Error("Usage: npx tsx scripts/refresh-standings.ts --season=2025-2026");

  ensureServerOnlyStub();
  const { refreshSeasonStandings } = await import("../src/app/lib/refreshStandings");

  console.log(`Rebuilding season_team_standings for season ${seasonLabel}…`);
  const r = await refreshSeasonStandings(seasonLabel);
  console.log(
    `Done. season ${r.seasonLabel}: rows upserted ${r.rows}, stale rows deleted ${r.staleRowsDeleted}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
