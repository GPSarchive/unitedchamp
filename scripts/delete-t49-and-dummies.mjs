import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n')
    .map(l => l.trim()).filter(l => l && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const TID = 49;
const DUMMY_TEAMS = [86, 87, 88, 89, 135, 136, 137, 138];

async function del(label, q) {
  const { data, error } = await q.select('*');
  if (error) throw new Error(`${label}: ${error.message}`);
  console.log(`  deleted ${label}: ${data?.length ?? 0}`);
}

// --- Gather the dummy player ids first ---
const { data: pt, error: ptErr } = await sb.from('player_teams').select('player_id').in('team_id', DUMMY_TEAMS);
if (ptErr) throw ptErr;
const playerIds = [...new Set((pt || []).map(r => r.player_id))];
console.log(`Dummy players found: ${playerIds.length}`);

// --- Tournament 49 match ids ---
const { data: m49 } = await sb.from('matches').select('id').eq('tournament_id', TID);
const matchIds = (m49 || []).map(r => r.id);
console.log(`Tournament 49 matches: ${matchIds.length}`);

const NONE = [-1];
const pIds = playerIds.length ? playerIds : NONE;
const mIds = matchIds.length ? matchIds : NONE;

console.log('\n[1] Match-level stat/participant rows (t49 matches + dummy players)');
await del('match_player_stats (t49 matches)', sb.from('match_player_stats').delete().in('match_id', mIds));
await del('match_player_stats (dummy players)', sb.from('match_player_stats').delete().in('player_id', pIds));
await del('match_participants (t49 matches)', sb.from('match_participants').delete().in('match_id', mIds));
await del('match_participants (dummy players)', sb.from('match_participants').delete().in('player_id', pIds));

console.log('\n[2] Player stat rows (dummy players)');
await del('player_career_stats', sb.from('player_career_stats').delete().in('player_id', pIds));
await del('player_tournament_stats', sb.from('player_tournament_stats').delete().in('player_id', pIds));
await del('player_statistics', sb.from('player_statistics').delete().in('player_id', pIds));

console.log('\n[3] player_teams + player (dummy)');
await del('player_teams (dummy teams)', sb.from('player_teams').delete().in('team_id', DUMMY_TEAMS));
await del('player_teams (dummy players)', sb.from('player_teams').delete().in('player_id', pIds));
await del('player (dummy)', sb.from('player').delete().in('id', pIds));

console.log('\n[4] Tournament 49 (matches -> teams -> stages -> tournament)');
await del('matches', sb.from('matches').delete().eq('tournament_id', TID));
await del('tournament_teams', sb.from('tournament_teams').delete().eq('tournament_id', TID));
await del('tournament_stages', sb.from('tournament_stages').delete().eq('tournament_id', TID));
await del('tournaments', sb.from('tournaments').delete().eq('id', TID));

console.log('\n[5] Dummy teams');
await del('teams (dummy ids)', sb.from('teams').delete().in('id', DUMMY_TEAMS));

console.log('\n=== VERIFY ===');
const chk = async (label, q) => { const { data } = await q; console.log(`  ${label}: ${data?.length ?? 0} remaining`); };
await chk('tournament 49', sb.from('tournaments').select('id').eq('id', TID));
await chk('t49 stages', sb.from('tournament_stages').select('id').eq('tournament_id', TID));
await chk('t49 matches', sb.from('matches').select('id').eq('tournament_id', TID));
await chk('t49 tournament_teams', sb.from('tournament_teams').select('id').eq('tournament_id', TID));
await chk('dummy teams', sb.from('teams').select('id').in('id', DUMMY_TEAMS));
await chk('dummy players (ZZZ)', sb.from('player').select('id').ilike('first_name', 'zzz%'));
await chk('dummy player_teams', sb.from('player_teams').select('id').in('team_id', DUMMY_TEAMS));
console.log('\nDONE.');
