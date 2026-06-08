/**
 * Fix tournament 35 (ULTRACHAMP ARENA 2026) group membership + standings.
 *
 * Two faults found:
 *  1. BALLISTAS FC(116), PINK PANTHERS(100), ΟΠΕΚΕΠΕ(114) were added after creation
 *     but never registered into stage 63 (tournament_teams.stage_id/group_id are NULL).
 *  2. BALLISTAS FC's 5 matches have group_id=NULL instead of 33 (Όμιλος 1),
 *     producing a phantom orphan standings table (group_id=0).
 *
 * Fix:
 *  A. Register the 3 teams into tournament_teams with the correct stage/group.
 *  B. Set group_id=33 on BALLISTAS's 5 stage-63 matches.
 *  C. Recompute stage_standings (mirrors recomputeStandingsIfNeeded in progression.ts).
 *  D. Delete the now-orphan group_id=0 standings rows for this stage.
 *
 * Usage:
 *   node scripts/fix-t35.mjs            # DRY RUN (default) — writes nothing
 *   node scripts/fix-t35.mjs --apply    # actually writes
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const APPLY = process.argv.includes('--apply');
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n')
    .map(l => l.trim()).filter(l => l && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const TID = 35, STAGE = 63;
const G1 = 33, G2 = 34;
const GROUP_NAME = { [G1]: 'Όμιλος 1', [G2]: 'Όμιλος 2', 0: '(orphan / league bucket)' };

// Teams to register: team_id -> target group_id
const REGISTER = [
  { team_id: 116, group_id: G1, name: 'BALLISTAS FC' },
  { team_id: 100, group_id: G2, name: 'PINK PANTHERS' },
  { team_id: 114, group_id: G2, name: 'ΟΠΕΚΕΠΕ' },
];

const banner = s => console.log('\n' + '─'.repeat(70) + '\n' + s + '\n' + '─'.repeat(70));

const { data: teams } = await sb.from('teams').select('id,name');
const tn = id => (teams.find(t => t.id === id)?.name ?? `#${id}`);

console.log(APPLY ? '*** APPLY MODE — WRITING TO DB ***' : '*** DRY RUN — no writes ***');

// ---------------------------------------------------------------------------
// STEP A: register missing tournament_teams rows
// ---------------------------------------------------------------------------
banner('STEP A — register teams into tournament_teams (stage 63)');
const { data: existing } = await sb.from('tournament_teams')
  .select('id, team_id, stage_id, group_id').eq('tournament_id', TID);

for (const r of REGISTER) {
  const stageRow = (existing || []).find(e => e.team_id === r.team_id && e.stage_id === STAGE);
  const nullRow = (existing || []).find(e => e.team_id === r.team_id && e.stage_id === null);
  if (stageRow) {
    if (stageRow.group_id === r.group_id) {
      console.log(`SKIP  ${r.name}: already in stage ${STAGE} group ${r.group_id}`);
    } else {
      console.log(`UPDATE ${r.name}: tt#${stageRow.id} group_id ${stageRow.group_id} -> ${r.group_id}`);
      if (APPLY) {
        const { error } = await sb.from('tournament_teams').update({ group_id: r.group_id }).eq('id', stageRow.id);
        if (error) throw error;
      }
    }
  } else if (nullRow) {
    // Promote the dangling stage_id=null row into the stage/group (keeps id stable)
    console.log(`UPDATE ${r.name}: tt#${nullRow.id} (stage_id null) -> stage ${STAGE}, group ${r.group_id}`);
    if (APPLY) {
      const { error } = await sb.from('tournament_teams')
        .update({ stage_id: STAGE, group_id: r.group_id }).eq('id', nullRow.id);
      if (error) throw error;
    }
  } else {
    console.log(`INSERT ${r.name}: new tournament_teams row -> stage ${STAGE}, group ${r.group_id}`);
    if (APPLY) {
      const { error } = await sb.from('tournament_teams')
        .insert({ tournament_id: TID, team_id: r.team_id, stage_id: STAGE, group_id: r.group_id, seed: null });
      if (error) throw error;
    }
  }
}

// ---------------------------------------------------------------------------
// STEP B: fix BALLISTAS matches group_id NULL -> 33
// ---------------------------------------------------------------------------
banner('STEP B — set group_id=33 on BALLISTAS (116) stage-63 matches that are NULL');
const { data: ballistasMatches } = await sb.from('matches')
  .select('id, group_id, team_a_id, team_b_id, status')
  .eq('tournament_id', TID).eq('stage_id', STAGE)
  .or('team_a_id.eq.116,team_b_id.eq.116');

const toFix = (ballistasMatches || []).filter(m => m.group_id !== G1);
for (const m of (ballistasMatches || [])) {
  const willFix = m.group_id !== G1;
  console.log(`${willFix ? 'FIX  ' : 'OK   '} match ${m.id} [${m.status}] ${tn(m.team_a_id)} vs ${tn(m.team_b_id)}  group_id ${m.group_id} ${willFix ? '-> ' + G1 : ''}`);
}
if (APPLY && toFix.length) {
  const { error } = await sb.from('matches').update({ group_id: G1 }).in('id', toFix.map(m => m.id));
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// STEP C: simulate / recompute standings (mirror of recomputeStandingsIfNeeded)
// ---------------------------------------------------------------------------
banner('STEP C — recompute standings (3-1-0) for stage 63');

// Re-read matches & participants reflecting steps A/B (in dry-run, apply the
// changes in-memory so the simulation reflects the intended end-state).
let { data: allMatches } = await sb.from('matches')
  .select('id, group_id, team_a_id, team_b_id, team_a_score, team_b_score, status')
  .eq('tournament_id', TID).eq('stage_id', STAGE);
allMatches = (allMatches || []).map(m =>
  (m.team_a_id === 116 || m.team_b_id === 116) ? { ...m, group_id: G1 } : m);

let { data: parts } = await sb.from('tournament_teams')
  .select('team_id, group_id, stage_id').eq('tournament_id', TID).eq('stage_id', STAGE);
parts = (parts || []).map(p => ({ ...p }));
if (!APPLY) {
  // reflect step A in-memory for the sim
  for (const r of REGISTER) {
    const hit = parts.find(p => p.team_id === r.team_id);
    if (hit) hit.group_id = r.group_id;
    else parts.push({ team_id: r.team_id, group_id: r.group_id, stage_id: STAGE });
  }
}

const teamsByGroup = new Map();
parts.forEach(p => {
  if (p.group_id == null) return;
  const list = teamsByGroup.get(p.group_id) ?? [];
  if (!list.includes(p.team_id)) list.push(p.team_id);
  teamsByGroup.set(p.group_id, list);
});

const finished = allMatches.filter(m => m.status === 'finished');
const buckets = new Map();
for (const m of finished) {
  const gid = m.group_id ?? 0;
  if (!buckets.has(gid)) buckets.set(gid, []);
  buckets.get(gid).push(m);
}
const bucketKeys = new Set([...teamsByGroup.keys(), ...buckets.keys()]);

const computedRows = [];
for (const gid of bucketKeys) {
  const list = buckets.get(gid) ?? [];
  const initial = teamsByGroup.get(gid) ?? [];
  const stats = new Map();
  const seed = t => { if (!stats.has(t)) stats.set(t, { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0 }); };
  initial.forEach(seed);
  const bump = (t, d) => { seed(t); const s = stats.get(t); for (const k in d) s[k] += d[k]; };
  for (const m of list) {
    const A = m.team_a_id, B = m.team_b_id; if (!A || !B) continue;
    const as = m.team_a_score ?? 0, bs = m.team_b_score ?? 0;
    bump(A, { played: 1, gf: as, ga: bs }); bump(B, { played: 1, gf: bs, ga: as });
    if (as > bs) { bump(A, { won: 1, points: 3 }); bump(B, { lost: 1 }); }
    else if (bs > as) { bump(B, { won: 1, points: 3 }); bump(A, { lost: 1 }); }
    else { bump(A, { drawn: 1, points: 1 }); bump(B, { drawn: 1, points: 1 }); }
  }
  const ranked = [...stats.entries()]
    .map(([team_id, s]) => ({ team_id, gd: s.gf - s.ga, ...s }))
    .sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.team_id - b.team_id)
    .map((r, i) => ({ ...r, rank: i + 1 }));
  computedRows.push({ gid, ranked });
}

for (const { gid, ranked } of computedRows.sort((a, b) => a.gid - b.gid)) {
  console.log(`\nGroup ${gid} — ${GROUP_NAME[gid] || '?'}  (${ranked.length} teams)`);
  console.log('  rank  team                        P  W  D  L   GF GA  GD  Pts');
  for (const r of ranked) {
    console.log(`  ${String(r.rank).padStart(2)}    ${tn(r.team_id).padEnd(26)} ${r.played}  ${r.won}  ${r.drawn}  ${r.lost}   ${String(r.gf).padStart(2)} ${String(r.ga).padStart(2)} ${String(r.gd).padStart(3)}  ${String(r.points).padStart(3)}`);
  }
}

// ---------------------------------------------------------------------------
// STEP D: write standings (apply only). Mirrors progression: delete+insert per group.
// ---------------------------------------------------------------------------
if (APPLY) {
  banner('STEP D — writing standings to DB');
  // Wipe ALL standings for this stage (incl. the orphan group_id=0), then reinsert.
  const { error: delErr } = await sb.from('stage_standings').delete().eq('stage_id', STAGE);
  if (delErr) throw delErr;
  for (const { gid, ranked } of computedRows) {
    if (gid === 0) { console.log('  skipping orphan bucket group_id=0 (not re-inserted)'); continue; }
    if (!ranked.length) continue;
    const { error } = await sb.from('stage_standings').insert(
      ranked.map(r => ({
        stage_id: STAGE, group_id: gid, team_id: r.team_id,
        played: r.played, won: r.won, drawn: r.drawn, lost: r.lost,
        gf: r.gf, ga: r.ga, gd: r.gd, points: r.points, rank: r.rank,
      })));
    if (error) throw error;
    console.log(`  wrote ${ranked.length} rows for group ${gid}`);
  }
  console.log('\nDONE. Standings rewritten; orphan group_id=0 rows removed.');
} else {
  banner('DRY RUN COMPLETE');
  console.log('Note: the orphan group_id=0 standings rows (currently showing the top');
  console.log('mini-table) are NOT in the simulation above and will be deleted on --apply.');
  console.log('\nRe-run with --apply to write these changes.');
}
