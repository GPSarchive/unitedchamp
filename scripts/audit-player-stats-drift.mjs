/**
 * audit-player-stats-drift.mjs
 *
 * Recomputes every player-stats aggregate FROM SCRATCH out of the source of
 * truth (match_player_stats) and diffs the result against what is actually
 * stored in the three aggregate tables:
 *
 *   1. player_statistics       (legacy per-player totals, synced inline on save)
 *   2. player_career_stats     (all-time cache, refreshed via progressAfterMatch)
 *   3. player_tournament_stats (per-tournament cache, same path)
 *   4. player_season_stats     (per-season cache, refreshSeasonStats.ts — active
 *                               season live, archived seasons via re-snapshot)
 *
 * When every tournament sits in ONE season (true after the 2026-09-04 merge)
 * it also checks the Phase 1 acceptance identity: player_season_stats for that
 * season must equal player_career_stats row-for-row.
 *
 * Any row where stored != recomputed is drift — i.e. a save wrote match stats
 * but the aggregate never (or only partially) followed. This is exactly the
 * "add the match stats anew and compare against the database" check.
 *
 * READ-ONLY: this script never writes anything.
 *
 * Usage:  node scripts/audit-player-stats-drift.mjs
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; }));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// PostgREST caps responses at ~1000 rows regardless of .limit(); paginate.
const PAGE = 500;
async function fetchAll(table, select, orderCol = 'id') {
  const all = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await sb.from(table).select(select)
      .order(orderCol, { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(`reading ${table}: ${error.message}`);
    if (!data?.length) break;
    all.push(...data);
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

const n = (v) => Number(v) || 0;

// ── 1. Load source of truth ─────────────────────────────────────────────────
const mps = await fetchAll('match_player_stats',
  'player_id, match_id, team_id, goals, assists, yellow_cards, red_cards, blue_cards, mvp, best_goalkeeper');
const matches = await fetchAll('matches', 'id, tournament_id, winner_team_id, status');
const players = await fetchAll('player', 'id, first_name, last_name');
const tournaments = await fetchAll('tournaments', 'id, season');
const seasonOfTournament = new Map(tournaments.map(t => [t.id, t.season]));

const matchInfo = new Map(matches.map(m => [m.id, m]));
const name = new Map(players.map(p => [p.id, `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || `#${p.id}`]));

console.log(`Loaded ${mps.length} match_player_stats rows across ${new Set(mps.map(r => r.match_id)).size} matches.`);
if (mps.length >= 1000) {
  console.log('⚠ NOTE: dataset exceeds 1000 rows — any UNPAGINATED read of match_player_stats');
  console.log('  is silently truncated by PostgREST. All app aggregate writers paginate today');
  console.log('  (refreshPlayerStats.ts, fix-stats, the inline sync); keep it that way.\n');
}

// ── 2. Recompute all three aggregates ───────────────────────────────────────
const career = new Map();   // pid -> bucket
const legacy = new Map();   // pid -> bucket (player_statistics shape)
const tourney = new Map();  // `${pid}:${tid}` -> bucket
const season = new Map();   // `${pid}:${label}` -> bucket
const careerMatches = new Map(), tourneyMatches = new Map(), seasonMatches = new Map();
const seasonTeamCounts = new Map(); // `${pid}:${label}` -> Map(team -> rows), insertion-ordered

for (const r of mps) {
  const pid = r.player_id;
  const mi = matchInfo.get(r.match_id);

  // legacy player_statistics (all rows, no match filter — mirrors app logic)
  if (!legacy.has(pid)) legacy.set(pid, { total_goals: 0, total_assists: 0, yellow_cards: 0, red_cards: 0, blue_cards: 0 });
  const L = legacy.get(pid);
  L.total_goals += n(r.goals); L.total_assists += n(r.assists);
  L.yellow_cards += n(r.yellow_cards); L.red_cards += n(r.red_cards); L.blue_cards += n(r.blue_cards);

  // career
  if (!career.has(pid)) career.set(pid, { total_matches: 0, total_goals: 0, total_assists: 0, total_yellow_cards: 0, total_red_cards: 0, total_blue_cards: 0, total_mvp: 0, total_best_gk: 0, total_wins: 0 });
  const C = career.get(pid);
  C.total_goals += n(r.goals); C.total_assists += n(r.assists);
  C.total_yellow_cards += n(r.yellow_cards); C.total_red_cards += n(r.red_cards); C.total_blue_cards += n(r.blue_cards);
  if (r.mvp) C.total_mvp++;
  if (r.best_goalkeeper) C.total_best_gk++;
  if (mi?.winner_team_id != null && mi.winner_team_id === r.team_id) C.total_wins++;
  if (!careerMatches.has(pid)) careerMatches.set(pid, new Set());
  careerMatches.get(pid).add(r.match_id);

  // tournament
  if (mi?.tournament_id) {
    const key = `${pid}:${mi.tournament_id}`;
    if (!tourney.has(key)) tourney.set(key, { matches: 0, goals: 0, assists: 0, yellow_cards: 0, red_cards: 0, blue_cards: 0, mvp_count: 0, best_gk_count: 0, wins: 0 });
    const T = tourney.get(key);
    T.goals += n(r.goals); T.assists += n(r.assists);
    T.yellow_cards += n(r.yellow_cards); T.red_cards += n(r.red_cards); T.blue_cards += n(r.blue_cards);
    if (r.mvp) T.mvp_count++;
    if (r.best_goalkeeper) T.best_gk_count++;
    if (mi.winner_team_id != null && mi.winner_team_id === r.team_id) T.wins++;
    if (!tourneyMatches.has(key)) tourneyMatches.set(key, new Set());
    tourneyMatches.get(key).add(r.match_id);

    // season (via tournaments.season; rows are in id order → first-seen tie-break matches the app)
    const label = seasonOfTournament.get(mi.tournament_id);
    if (label) {
      const sk = `${pid}:${label}`;
      if (!season.has(sk)) season.set(sk, { matches: 0, goals: 0, assists: 0, yellow_cards: 0, red_cards: 0, blue_cards: 0, mvp_count: 0, best_gk_count: 0, wins: 0, primary_team_id: null });
      const S = season.get(sk);
      S.goals += n(r.goals); S.assists += n(r.assists);
      S.yellow_cards += n(r.yellow_cards); S.red_cards += n(r.red_cards); S.blue_cards += n(r.blue_cards);
      if (r.mvp) S.mvp_count++;
      if (r.best_goalkeeper) S.best_gk_count++;
      if (mi.winner_team_id != null && mi.winner_team_id === r.team_id) S.wins++;
      if (!seasonMatches.has(sk)) seasonMatches.set(sk, new Set());
      seasonMatches.get(sk).add(r.match_id);
      if (!seasonTeamCounts.has(sk)) seasonTeamCounts.set(sk, new Map());
      const tc = seasonTeamCounts.get(sk);
      tc.set(r.team_id, (tc.get(r.team_id) ?? 0) + 1);
    }
  }
}
for (const [pid, s] of career) s.total_matches = careerMatches.get(pid)?.size ?? 0;
for (const [key, s] of tourney) s.matches = tourneyMatches.get(key)?.size ?? 0;
for (const [key, s] of season) {
  s.matches = seasonMatches.get(key)?.size ?? 0;
  let best = null, max = 0;
  for (const [teamId, count] of seasonTeamCounts.get(key) ?? []) if (count > max) { max = count; best = teamId; }
  s.primary_team_id = best;
}

// ── 3. Diff helper ──────────────────────────────────────────────────────────
function diffTable(label, storedRows, keyOf, expectedMap, fields, describeKey) {
  const stored = new Map(storedRows.map(r => [keyOf(r), r]));
  const allKeys = new Set([...stored.keys(), ...expectedMap.keys()]);
  let drifted = 0;
  const lines = [];
  for (const key of allKeys) {
    const cur = stored.get(key);
    const exp = expectedMap.get(key);
    const diffs = [];
    for (const f of fields) {
      const a = n(cur?.[f]), b = n(exp?.[f]);
      if (a !== b) diffs.push(`${f}: stored=${a} recomputed=${b}`);
    }
    if (diffs.length) {
      drifted++;
      const tag = !cur ? ' [MISSING ROW — aggregate never written]' : !exp ? ' [STALE ROW — no source stats remain]' : '';
      lines.push(`  ${describeKey(key)}${tag}\n    ${diffs.join('\n    ')}`);
    }
  }
  console.log(`\n═══ ${label}: ${drifted} of ${allKeys.size} rows drifted ═══`);
  for (const l of lines.slice(0, 50)) console.log(l);
  if (lines.length > 50) console.log(`  … and ${lines.length - 50} more`);
  return drifted;
}

// ── 4. Compare each aggregate table ─────────────────────────────────────────
const legacyRows = await fetchAll('player_statistics',
  'player_id, total_goals, total_assists, yellow_cards, red_cards, blue_cards', 'player_id');
const careerRows = await fetchAll('player_career_stats',
  'player_id, total_matches, total_goals, total_assists, total_yellow_cards, total_red_cards, total_blue_cards, total_mvp, total_best_gk, total_wins', 'player_id');
const tourneyRows = await fetchAll('player_tournament_stats',
  'player_id, tournament_id, matches, goals, assists, yellow_cards, red_cards, blue_cards, mvp_count, best_gk_count, wins', 'player_id');

const d1 = diffTable('player_statistics (legacy totals)', legacyRows,
  r => r.player_id, legacy,
  ['total_goals', 'total_assists', 'yellow_cards', 'red_cards', 'blue_cards'],
  pid => `${name.get(pid) ?? pid} (player ${pid})`);

const d2 = diffTable('player_career_stats (cache → /paiktes, home)', careerRows,
  r => r.player_id, career,
  ['total_matches', 'total_goals', 'total_assists', 'total_yellow_cards', 'total_red_cards', 'total_blue_cards', 'total_mvp', 'total_best_gk', 'total_wins'],
  pid => `${name.get(pid) ?? pid} (player ${pid})`);

const d3 = diffTable('player_tournament_stats (cache)', tourneyRows,
  r => `${r.player_id}:${r.tournament_id}`, tourney,
  ['matches', 'goals', 'assists', 'yellow_cards', 'red_cards', 'blue_cards', 'mvp_count', 'best_gk_count', 'wins'],
  key => { const [pid, tid] = key.split(':').map(Number); return `${name.get(pid) ?? pid} (player ${pid}) in tournament ${tid}`; });

const seasonRows = await fetchAll('player_season_stats',
  'player_id, season_label, matches, goals, assists, yellow_cards, red_cards, blue_cards, mvp_count, best_gk_count, wins, primary_team_id', 'player_id');

const d4 = diffTable('player_season_stats (cache → /paiktes, home, OMADA — seasonal)', seasonRows,
  r => `${r.player_id}:${r.season_label}`, season,
  ['matches', 'goals', 'assists', 'yellow_cards', 'red_cards', 'blue_cards', 'mvp_count', 'best_gk_count', 'wins', 'primary_team_id'],
  key => { const i = key.indexOf(':'); const pid = Number(key.slice(0, i)); return `${name.get(pid) ?? pid} (player ${pid}) in season ${key.slice(i + 1)}`; });

// ── 5. Phase 1 acceptance: single-season data ⇒ season table == career table ──
let d5 = 0;
const seasonLabels = [...new Set(tournaments.map(t => t.season).filter(Boolean))];
if (seasonLabels.length === 1) {
  const label = seasonLabels[0];
  const careerAsSeason = new Map(careerRows.map(r => [`${r.player_id}:${label}`, {
    matches: r.total_matches, goals: r.total_goals, assists: r.total_assists,
    yellow_cards: r.total_yellow_cards, red_cards: r.total_red_cards, blue_cards: r.total_blue_cards,
    mvp_count: r.total_mvp, best_gk_count: r.total_best_gk, wins: r.total_wins,
  }]));
  d5 = diffTable(`equivalence: player_season_stats('${label}') vs player_career_stats (must be identical)`,
    seasonRows.filter(r => r.season_label === label),
    r => `${r.player_id}:${r.season_label}`, careerAsSeason,
    ['matches', 'goals', 'assists', 'yellow_cards', 'red_cards', 'blue_cards', 'mvp_count', 'best_gk_count', 'wins'],
    key => { const pid = Number(key.split(':')[0]); return `${name.get(pid) ?? pid} (player ${pid})`; });
} else {
  console.log(`
(equivalence check skipped: ${seasonLabels.length} distinct seasons in tournaments)`);
}

console.log('\n──────────────────────────────────────────────');
if (d1 + d2 + d3 + d4 + d5 === 0) {
  console.log('✓ No drift: every aggregate matches a fresh recompute from match_player_stats.');
} else {
  console.log(`✗ Drift confirmed in ${[d1 && 'player_statistics', d2 && 'player_career_stats', d3 && 'player_tournament_stats', d4 && 'player_season_stats', d5 && 'season≠career equivalence'].filter(Boolean).join(', ')}.`);
  console.log('  This proves saves wrote match stats without the aggregates following.');
  console.log('  Recovery: /dashboard/refresh-stats (or scripts/refresh-player-stats.ts)');
  console.log('  rebuilds the cache tables (add --season=<label> for one season only);');
  console.log('  /dashboard/fix-stats re-syncs the legacy player_statistics totals. All paginate.');
}
