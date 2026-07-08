import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n')
    .map(l => l.trim()).filter(l => l && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const DUMMY_TEAMS = [86, 87, 88, 89, 135, 136, 137, 138];

// Players belonging to dummy teams (any naming)
const { data: players } = await sb.from('players').select('id, name, team_id').in('team_id', DUMMY_TEAMS);
console.log('PLAYERS on dummy teams:', (players || []).map(p => `#${p.id} ${p.name} (team ${p.team_id})`));

// Which tournaments reference each dummy team via tournament_teams
const { data: tt } = await sb.from('tournament_teams').select('tournament_id, team_id').in('team_id', DUMMY_TEAMS);
const byTeam = {};
(tt || []).forEach(r => { (byTeam[r.team_id] ??= new Set()).add(r.tournament_id); });
console.log('\ntournament_teams refs:');
for (const t of DUMMY_TEAMS) console.log(`  team ${t}: tournaments [${[...(byTeam[t]||[])].join(', ')}]`);

// Which matches reference each dummy team (across all tournaments)
const { data: ma } = await sb.from('matches').select('id, tournament_id, team_a_id, team_b_id').or(DUMMY_TEAMS.map(t=>`team_a_id.eq.${t},team_b_id.eq.${t}`).join(','));
const matchByTeam = {};
(ma || []).forEach(m => {
  [m.team_a_id, m.team_b_id].forEach(t => { if (DUMMY_TEAMS.includes(t)) (matchByTeam[t] ??= new Set()).add(m.tournament_id); });
});
console.log('\nmatch refs (tournament ids):');
for (const t of DUMMY_TEAMS) console.log(`  team ${t}: tournaments [${[...(matchByTeam[t]||[])].join(', ')}]`);

// Other tournaments that look like dummies (referencing teams 86-89)
const otherTids = new Set();
(tt||[]).forEach(r => otherTids.add(r.tournament_id));
(ma||[]).forEach(m => otherTids.add(m.tournament_id));
console.log('\nAll tournament ids touching dummy teams:', [...otherTids]);
const { data: touched } = await sb.from('tournaments').select('id, name, is_dummy, status').in('id', [...otherTids]);
console.log('Those tournaments:', (touched||[]).map(t=>`#${t.id} "${t.name}" dummy=${t.is_dummy} status=${t.status}`));
