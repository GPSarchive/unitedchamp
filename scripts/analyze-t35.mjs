import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n')
    .map(l => l.trim()).filter(l => l && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const TID = 35, STAGE = 63;
const GROUPS = { 33: 'Όμιλος 1', 34: 'Όμιλος 2' };

const { data: teams } = await sb.from('teams').select('id,name');
const tn = id => (teams.find(t => t.id === id)?.name ?? `#${id}`);

const { data: tt } = await sb.from('tournament_teams').select('team_id, group_id').eq('tournament_id', TID).eq('stage_id', STAGE);
const memberOfGroup = new Map(); // team_id -> group_id
(tt || []).forEach(r => memberOfGroup.set(r.team_id, r.group_id));

const { data: matches } = await sb.from('matches')
  .select('id, group_id, team_a_id, team_b_id, status')
  .eq('tournament_id', TID).eq('stage_id', STAGE);

// For every team that appears in any match, figure out which group(s) its opponents/matches sit in
const teamMatchGroups = new Map(); // team_id -> {groupId -> count}
const add = (t, g) => {
  if (!teamMatchGroups.has(t)) teamMatchGroups.set(t, new Map());
  const m = teamMatchGroups.get(t);
  m.set(g, (m.get(g) || 0) + 1);
};
for (const m of matches) {
  add(m.team_a_id, m.group_id);
  add(m.team_b_id, m.group_id);
}

console.log('\n=== Per-team: registered group vs. groups their matches sit in ===');
const allTeamsInPlay = [...teamMatchGroups.keys()].sort((a, b) => a - b);
for (const t of allTeamsInPlay) {
  const reg = memberOfGroup.has(t) ? `group_id=${memberOfGroup.get(t)} (${GROUPS[memberOfGroup.get(t)] || '?'})` : '*** NOT REGISTERED in stage ***';
  const mg = [...teamMatchGroups.get(t).entries()].map(([g, c]) => `${g === null ? 'NULL' : g}:${c}`).join(', ');
  console.log(`${tn(t).padEnd(26)} registered=${reg.padEnd(40)} matchGroups={${mg}}`);
}

console.log('\n=== Matches with group_id = NULL (orphans) ===');
for (const m of matches.filter(m => m.group_id === null)) {
  console.log(`match ${m.id} [${m.status}] ${tn(m.team_a_id)} vs ${tn(m.team_b_id)}`);
}

console.log('\n=== Recompute simulation: which buckets would standings be written to ===');
// participants by group (only registered)
const partByGroup = new Map();
(tt || []).forEach(r => {
  if (r.group_id == null) return;
  if (!partByGroup.has(r.group_id)) partByGroup.set(r.group_id, new Set());
  partByGroup.get(r.group_id).add(r.team_id);
});
const finished = matches.filter(m => m.status === 'finished');
const matchBuckets = new Set(finished.map(m => m.group_id ?? 0));
const bucketKeys = new Set([...partByGroup.keys(), ...matchBuckets]);
console.log('bucket keys (group_id) that get standings rows:', [...bucketKeys]);
console.log(' -> bucket 0 is the league/orphan table from NULL-group matches');
