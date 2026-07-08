import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n')
    .map(l => l.trim()).filter(l => l && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const TID = 49;

const { data: tournament } = await sb.from('tournaments').select('*').eq('id', TID).maybeSingle();
console.log('TOURNAMENT:', JSON.stringify(tournament));

const { data: stages } = await sb.from('tournament_stages').select('*').eq('tournament_id', TID);
console.log('STAGES:', (stages || []).map(s => ({ id: s.id, name: s.name, kind: s.kind })));

const { data: matches } = await sb.from('matches').select('id').eq('tournament_id', TID);
console.log('MATCHES count:', (matches || []).length);

const { data: tt } = await sb.from('tournament_teams').select('id, team_id, stage_id, group_id').eq('tournament_id', TID);
console.log('TOURNAMENT_TEAMS count:', (tt || []).length, 'team_ids:', [...new Set((tt||[]).map(r=>r.team_id))]);

// dummy teams / players
const { data: dteams } = await sb.from('teams').select('id, name').ilike('name', 'zzz%');
console.log('\nZZZ TEAMS:', dteams_fmt(dteams));
function dteams_fmt(a){return (a||[]).map(t=>`#${t.id} ${t.name}`);}

const { data: dplayers } = await sb.from('players').select('id, name, team_id').ilike('name', 'zzz%');
console.log('ZZZ PLAYERS:', (dplayers||[]).map(p=>`#${p.id} ${p.name} (team ${p.team_id})`));
