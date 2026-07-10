/**
 * audit-read-surfaces.mjs  (Session 7 — read-only)
 *
 * Quantifies what the public read surfaces actually pull from Supabase:
 *  - table row counts for every table the public pages touch
 *  - per-query row counts + JSON payload bytes for the tournament loader
 *    (loadTournamentIntoStore) against the biggest real tournament
 *  - matches-explorer style query sizes
 *
 * Usage: node scripts/audit-read-surfaces.mjs
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 * Makes zero writes.
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split("\n")
    .map(l => l.trim()).filter(l => l && !l.startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, "")]; }),
);

const supa = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const bytes = (o) => Buffer.byteLength(JSON.stringify(o ?? null), "utf8");
const kb = (n) => (n / 1024).toFixed(1) + " KB";

async function count(table, build = q => q) {
  const { count: c, error } = await build(supa.from(table).select("*", { count: "exact", head: true }));
  return error ? `ERR ${error.message}` : c;
}

async function main() {
  console.log("=== Table row counts (public-read tables) ===");
  const tables = ["tournaments", "tournament_stages", "tournament_groups", "tournament_teams",
    "matches", "stage_standings", "match_player_stats", "match_participants", "player",
    "teams", "tournament_awards", "player_statistics", "player_career_stats", "player_tournament_stats"];
  for (const t of tables) console.log(`${t}: ${await count(t)}`);

  // biggest tournament by matches
  const { data: allMatches } = await supa.from("matches").select("tournament_id");
  const byT = new Map();
  for (const m of allMatches) byT.set(m.tournament_id, (byT.get(m.tournament_id) ?? 0) + 1);
  const ranked = [...byT.entries()].sort((a, b) => b[1] - a[1]);
  console.log("\n=== Matches per tournament (top 5) ===");
  for (const [tid, n] of ranked.slice(0, 5)) console.log(`tournament ${tid}: ${n} matches`);

  const tid = ranked[0][0];
  console.log(`\n=== Tournament loader simulation (tournament ${tid}) — mirrors loadTournamentIntoStore ===`);
  let total = 0;
  const step = async (label, q) => {
    const { data, error } = await q;
    if (error) { console.log(`${label}: ERR ${error.message}`); return []; }
    const b = bytes(data);
    total += b;
    console.log(`${label}: ${Array.isArray(data) ? data.length : 1} rows, ${kb(b)}`);
    return data ?? [];
  };

  const t = await step("tournaments select(*)", supa.from("tournaments").select("*").eq("id", tid).single());
  const stages = await step("tournament_stages select(*)", supa.from("tournament_stages").select("*").eq("tournament_id", tid).order("ordering"));
  const stageIds = stages.map(s => s.id);
  await step("tournament_groups select(*)", supa.from("tournament_groups").select("*").in("stage_id", stageIds));
  const matches = await step("matches select(*)", supa.from("matches").select("*").eq("tournament_id", tid).order("match_date"));
  await step("stage_standings (13 cols)", supa.from("stage_standings").select("stage_id,group_id,team_id,played,won,drawn,lost,gf,ga,gd,points,rank").in("stage_id", stageIds));
  const tt = await step("tournament_teams (*+teams join)", supa.from("tournament_teams").select("*, team:teams(id, name, logo, colour, season_score), stage_id, group_id, seed").eq("tournament_id", tid));
  const matchIds = matches.map(m => m.id);
  const teamIds = [...new Set(tt.map(x => x.team?.id).filter(Boolean))];
  const stats = await step("match_player_stats (12 cols)", supa.from("match_player_stats").select("player_id,team_id,match_id,goals,assists,yellow_cards,red_cards,blue_cards,mvp,best_goalkeeper,is_captain").in("match_id", matchIds).in("team_id", teamIds));
  await step("match_participants (4 cols)", supa.from("match_participants").select("player_id,team_id,match_id,played").in("match_id", matchIds).in("team_id", teamIds).eq("played", true));
  const playerIds = [...new Set(stats.map(s => s.player_id))];
  await step("player details (6 cols)", supa.from("player").select("id, first_name, last_name, photo, position, deleted_at").in("id", playerIds));
  await step("tournament_awards select(*)", supa.from("tournament_awards").select("*").eq("tournament_id", tid).single());
  console.log(`TOTAL loader payload: ${kb(total)}  (${teamIds.length} teams, ${matches.length} matches, ${playerIds.length} players)`);

  // width check: matches select(*) vs the ~25 fields the loader maps
  if (matches[0]) {
    const cols = Object.keys(matches[0]);
    console.log(`\nmatches table width: ${cols.length} columns -> ${cols.join(", ")}`);
  }
  if (t) console.log(`tournaments width: ${Object.keys(t).length} cols; teams-join row sample keys: ${tt[0] ? Object.keys(tt[0]).join(",") : "-"}`);

  console.log("\n=== Matches explorer style (all matches, wide join) ===");
  const { data: expl } = await supa.from("matches")
    .select("*, team_a:teams!matches_team_a_id_fkey(id,name,logo), team_b:teams!matches_team_b_id_fkey(id,name,logo), tournament:tournaments(id,name,slug,logo)")
    .order("match_date", { ascending: false });
  console.log(`all matches wide join: ${expl?.length ?? 0} rows, ${kb(bytes(expl))}`);
  const { data: expl50 } = await supa.from("matches")
    .select("*, team_a:teams!matches_team_a_id_fkey(id,name,logo), team_b:teams!matches_team_b_id_fkey(id,name,logo), tournament:tournaments(id,name,slug,logo)")
    .order("match_date", { ascending: false }).limit(50);
  console.log(`first 50 wide join: ${kb(bytes(expl50))}`);

  console.log("\n=== OMADA team-page style (match_player_stats for one team) ===");
  const bigTeam = teamIds[0];
  const { data: teamStats } = await supa.from("match_player_stats").select("*").eq("team_id", bigTeam);
  console.log(`team ${bigTeam}: match_player_stats select(*): ${teamStats?.length ?? 0} rows, ${kb(bytes(teamStats))}`);
}

main().catch(e => { console.error(e); process.exit(1); });
