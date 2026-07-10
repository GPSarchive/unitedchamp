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
const careerMatches = new Map(), tourneyMatches = new Map();

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
  }
}
for (const [pid, s] of career) s.total_matches = careerMatches.get(pid)?.size ?? 0;
for (const [key, s] of tourney) s.matches = tourneyMatches.get(key)?.size ?? 0;

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

console.log('\n──────────────────────────────────────────────');
if (d1 + d2 + d3 === 0) {
  console.log('✓ No drift: every aggregate matches a fresh recompute from match_player_stats.');
} else {
  console.log(`✗ Drift confirmed in ${[d1 && 'player_statistics', d2 && 'player_career_stats', d3 && 'player_tournament_stats'].filter(Boolean).join(', ')}.`);
  console.log('  This proves saves wrote match stats without the aggregates following.');
  console.log('  Recovery: /dashboard/refresh-stats (or scripts/refresh-player-stats.ts)');
  console.log('  rebuilds the two cache tables; /dashboard/fix-stats re-syncs the legacy');
  console.log('  player_statistics totals. Both paginate.');
}
