import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n')
    .map(l => l.trim()).filter(l => l && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const DUMMY_TEAMS = [86, 87, 88, 89, 135, 136, 137, 138];

async function show(label, q) {
  const { data, error } = await q;
  if (error) { console.log(label, 'ERROR:', error.message); return null; }
  console.log(label, '->', JSON.stringify(data));
  return data;
}

// player_teams rows for dummy teams
const pt = await show('player_teams (dummy teams)', sb.from('player_teams').select('id, player_id, team_id').in('team_id', DUMMY_TEAMS));
const playerIds = [...new Set((pt || []).map(r => r.player_id))];

// the players themselves
await show('player rows', sb.from('player').select('id, first_name, last_name, deleted_at').in('id', playerIds.length ? playerIds : [-1]));

// zzz-named players (try first_name / last_name)
await show('player by first_name zzz', sb.from('player').select('id, first_name, last_name').ilike('first_name', 'zzz%'));
await show('player by last_name zzz', sb.from('player').select('id, first_name, last_name').ilike('last_name', 'zzz%'));

// dependent stats for these players
await show('player_statistics', sb.from('player_statistics').select('id, player_id').in('player_id', playerIds.length ? playerIds : [-1]));
await show('player_career_stats', sb.from('player_career_stats').select('player_id').in('player_id', playerIds.length ? playerIds : [-1]));
await show('player_tournament_stats', sb.from('player_tournament_stats').select('player_id').in('player_id', playerIds.length ? playerIds : [-1]));
await show('match_player_stats', sb.from('match_player_stats').select('id, player_id').in('player_id', playerIds.length ? playerIds : [-1]));

// match-level dependents for t49 matches
const { data: m49 } = await sb.from('matches').select('id').eq('tournament_id', 49);
const mids = (m49 || []).map(r => r.id);
console.log('t49 match ids:', mids);
await show('match_player_stats for t49 matches', sb.from('match_player_stats').select('id').in('match_id', mids.length ? mids : [-1]));
