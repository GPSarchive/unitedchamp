import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// load .env.local
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n')
    .map(l => l.trim()).filter(l => l && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const TID = 35;
const p = (label, x) => { console.log('\n=== ' + label + ' ==='); console.dir(x, { depth: null }); };

const { data: tour, error: tourErr } = await sb.from('tournaments').select('*').eq('id', TID).maybeSingle();
p('tournament', tour);
if (tourErr) p('tournament ERROR', tourErr);

// Also try by slug, and list a few tournaments to confirm connectivity
const { data: bySlug } = await sb.from('tournaments').select('id,name,slug').eq('slug', String(TID)).maybeSingle();
p('tournament by slug=35', bySlug);
const { data: someTours, error: listErr } = await sb.from('tournaments').select('id,name,slug').order('id', { ascending: false }).limit(10);
p('recent tournaments', someTours);
if (listErr) p('list ERROR', listErr);

const { data: stages } = await sb.from('tournament_stages').select('*').eq('tournament_id', TID).order('ordering');
p('stages', stages);
const stageIds = (stages || []).map(s => s.id);

const { data: groups } = await sb.from('tournament_groups').select('*').in('stage_id', stageIds).order('ordering');
p('groups', groups);

const { data: tt } = await sb.from('tournament_teams')
  .select('id, team_id, stage_id, group_id, seed, team:teams(name)')
  .eq('tournament_id', TID).order('stage_id').order('group_id');
p('tournament_teams (participation)', tt);

const { data: matches } = await sb.from('matches')
  .select('id, stage_id, group_id, team_a_id, team_b_id, team_a_score, team_b_score, status, matchday')
  .eq('tournament_id', TID).order('stage_id').order('group_id').order('match_date');
p('matches', matches);

const { data: standings } = await sb.from('stage_standings')
  .select('*').in('stage_id', stageIds).order('stage_id').order('group_id').order('rank');
p('stage_standings (cache)', standings);

const teamIds = [...new Set((tt || []).map(r => r.team_id))];
const { data: teams } = await sb.from('teams').select('id,name').in('id', teamIds);
p('teams', teams);
