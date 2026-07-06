/**
 * Fix tournament 35 (ULTRACHAMP ARENA 2026) — Group 2 (Όμιλος 2 / group_id 34)
 * orphaned matches.
 *
 * Fault: 6 finished matches (matchdays 16–17) were saved with group_id = NULL
 * instead of 34. The standings recompute buckets by (group_id ?? 0), so those
 * matches landed in a phantom "bucket 0" table and never counted toward Group 2.
 *
 * Fix (mirrors recomputeStandingsIfNeeded in progression.ts):
 *  A. Set group_id = 34 on the 6 orphaned matches.
 *  B. Recompute stage_standings for stage 63 (3-1-0 + disciplinary), delete +
 *     reinsert per group. The phantom group_id=0 rows are NOT re-inserted.
 *
 * Usage:
 *   node scripts/fix-t35-g34-orphans.mjs           # DRY RUN (default) — no writes
 *   node scripts/fix-t35-g34-orphans.mjs --apply   # actually writes
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

const TID = 35, STAGE = 63, G34 = 34;
const GROUPS = { 33: 'Όμιλος 1', 34: 'Όμιλος 2', 0: '(orphan bucket 0)' };
const ORPHAN_IDS = [2493, 2494, 2495, 2496, 2497, 2498];

// 2493 (PALOMAS vs KENNEDY) is a legitimate SECOND fixture of a pair that already
// played on md16 in group 34 (match 2491). The unique constraint
// unique_league_match_idx forbids the same (group, matchday, pair) twice, so this
// extra match is moved to its own free matchday. Both results count. All other
// orphans keep their matchday. team_id -> new matchday overrides:
const MATCHDAY_OVERRIDE = { 2493: 18 };

const banner = s => console.log('\n' + '─'.repeat(70) + '\n' + s + '\n' + '─'.repeat(70));
const { data: teams } = await sb.from('teams').select('id,name');
const tn = id => (teams.find(t => t.id === id)?.name ?? `#${id}`);

console.log(APPLY ? '*** APPLY MODE — WRITING TO DB ***' : '*** DRY RUN — no writes ***');

// ---------------------------------------------------------------------------
// STEP A: retarget the orphaned matches to group 34
// ---------------------------------------------------------------------------
banner('STEP A — set group_id = 34 on the 6 orphaned matches');
const { data: orphans } = await sb.from('matches')
  .select('id, group_id, team_a_id, team_b_id, team_a_score, team_b_score, status, matchday')
  .in('id', ORPHAN_IDS);

// Safety: verify each is what we expect (finished, currently NULL group, both teams in group 34)
const { data: g34tt } = await sb.from('tournament_teams')
  .select('team_id').eq('tournament_id', TID).eq('stage_id', STAGE).eq('group_id', G34);
const g34set = new Set((g34tt || []).map(r => r.team_id));

let safe = true;
for (const m of (orphans || [])) {
  const bothInG34 = g34set.has(m.team_a_id) && g34set.has(m.team_b_id);
  const problems = [];
  if (m.group_id !== null) problems.push(`group_id already ${m.group_id} (expected NULL)`);
  if (m.status !== 'finished') problems.push(`status ${m.status} (expected finished)`);
  if (!bothInG34) problems.push('one/both teams NOT registered in group 34');
  if (problems.length) safe = false;
  const newMd = MATCHDAY_OVERRIDE[m.id];
  const mdNote = newMd != null ? ` md${m.matchday}->${newMd} (extra fixture, own matchday)` : ` md${m.matchday}`;
  console.log(`  match ${m.id}${mdNote} ${tn(m.team_a_id)} ${m.team_a_score}-${m.team_b_score} ${tn(m.team_b_id)}` +
    `  group ${m.group_id} -> ${G34}${problems.length ? '   ⚠ ' + problems.join('; ') : '  ✓'}`);
}
if ((orphans || []).length !== ORPHAN_IDS.length) {
  safe = false;
  console.log(`  ⚠ expected ${ORPHAN_IDS.length} matches, found ${(orphans || []).length}`);
}
if (!safe) {
  console.log('\n⚠ Safety checks failed — aborting (no writes). Investigate before applying.');
  process.exit(1);
}

if (APPLY) {
  // Rows with a matchday override get an individual update (group_id + matchday);
  // the rest get a single bulk group_id update. Doing overrides first avoids the
  // md16 pair collision with the pre-existing match 2491.
  const overrideIds = ORPHAN_IDS.filter(id => MATCHDAY_OVERRIDE[id] != null);
  const plainIds = ORPHAN_IDS.filter(id => MATCHDAY_OVERRIDE[id] == null);
  for (const id of overrideIds) {
    const { error } = await sb.from('matches')
      .update({ group_id: G34, matchday: MATCHDAY_OVERRIDE[id] }).eq('id', id);
    if (error) throw error;
    console.log(`  ✓ match ${id} -> group ${G34}, matchday ${MATCHDAY_OVERRIDE[id]}`);
  }
  if (plainIds.length) {
    const { error } = await sb.from('matches').update({ group_id: G34 }).in('id', plainIds);
    if (error) throw error;
    console.log(`  ✓ updated ${plainIds.length} matches -> group_id ${G34}`);
  }
}

// ---------------------------------------------------------------------------
// STEP B: recompute standings for stage 63 (mirror recomputeStandingsIfNeeded)
// ---------------------------------------------------------------------------
banner('STEP B — recompute stage_standings for stage 63 (3-1-0 + disciplinary)');

// Read participants (registered teams per group)
const { data: parts } = await sb.from('tournament_teams')
  .select('team_id, group_id').eq('tournament_id', TID).eq('stage_id', STAGE);
const teamsByGroup = new Map();
(parts || []).forEach(p => {
  if (p.group_id == null) return;
  const l = teamsByGroup.get(p.group_id) ?? [];
  if (!l.includes(p.team_id)) l.push(p.team_id);
  teamsByGroup.set(p.group_id, l);
});

// Read all finished matches, applying step A in-memory (so dry-run reflects end state)
let { data: allMatches } = await sb.from('matches')
  .select('id, group_id, team_a_id, team_b_id, team_a_score, team_b_score, status')
  .eq('tournament_id', TID).eq('stage_id', STAGE);
allMatches = (allMatches || []).map(m =>
  ORPHAN_IDS.includes(m.id) ? { ...m, group_id: G34 } : m);
const finished = allMatches.filter(m => m.status === 'finished');

// Bucket by group_id ?? 0 (matches progression.ts)
const buckets = new Map();
for (const m of finished) {
  const gid = m.group_id ?? 0;
  if (!buckets.has(gid)) buckets.set(gid, []);
  buckets.get(gid).push(m);
}
const bucketKeys = new Set([...teamsByGroup.keys(), ...buckets.keys()]);

// Disciplinary actions
const { data: disc } = await sb.from('disciplinary_actions')
  .select('team_id, group_id, points_adjustment').eq('stage_id', STAGE);
const discByGroupTeam = new Map();
(disc || []).forEach(d => {
  const g = d.group_id ?? 0;
  const k = `${g}:${d.team_id}`;
  discByGroupTeam.set(k, (discByGroupTeam.get(k) || 0) + d.points_adjustment);
});

const computeGroup = (gid) => {
  const stats = new Map();
  const seed = t => { if (!stats.has(t)) stats.set(t, { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0 }); };
  (teamsByGroup.get(gid) ?? []).forEach(seed);
  const bump = (t, d) => { seed(t); const s = stats.get(t); for (const k in d) s[k] += d[k]; };
  for (const m of (buckets.get(gid) ?? [])) {
    const A = m.team_a_id, B = m.team_b_id; if (!A || !B) continue;
    const as = m.team_a_score ?? 0, bs = m.team_b_score ?? 0;
    bump(A, { played: 1, gf: as, ga: bs }); bump(B, { played: 1, gf: bs, ga: as });
    if (as > bs) { bump(A, { won: 1, points: 3 }); bump(B, { lost: 1 }); }
    else if (bs > as) { bump(B, { won: 1, points: 3 }); bump(A, { lost: 1 }); }
    else { bump(A, { drawn: 1, points: 1 }); bump(B, { drawn: 1, points: 1 }); }
  }
  for (const [t, s] of stats) {
    const adj = discByGroupTeam.get(`${gid}:${t}`);
    if (adj) s.points = Math.max(0, s.points + adj);
  }
  return [...stats.entries()]
    .map(([team_id, s]) => ({ team_id, gd: s.gf - s.ga, ...s }))
    .sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.team_id - b.team_id)
    .map((r, i) => ({ ...r, rank: i + 1 }));
};

// Current cache for before/after diff
const { data: cache } = await sb.from('stage_standings').select('*').eq('stage_id', STAGE);
const cacheByKey = new Map(); (cache || []).forEach(r => cacheByKey.set(`${r.group_id}:${r.team_id}`, r));

const computed = [...bucketKeys].sort((a, b) => a - b).map(gid => ({ gid, ranked: computeGroup(gid) }));

for (const { gid, ranked } of computed) {
  const willWrite = gid !== 0;
  console.log(`\nGroup ${gid} — ${GROUPS[gid] || '?'}${willWrite ? '' : '   (NOT re-inserted — phantom bucket removed)'}`);
  console.log('  rk team                       P  W  D  L  GF GA  GD Pts   (was)');
  for (const r of ranked) {
    const c = cacheByKey.get(`${gid}:${r.team_id}`);
    const wasPts = c ? String(c.points) : '—';
    const changed = !c || c.points !== r.points || c.played !== r.played;
    console.log(`  ${String(r.rank).padStart(2)} ${tn(r.team_id).padEnd(24)} ${r.played} ${r.won} ${r.drawn} ${r.lost} ${String(r.gf).padStart(3)}${String(r.ga).padStart(4)} ${String(r.gd).padStart(3)} ${String(r.points).padStart(3)}${changed ? `   (${wasPts})  <=` : ''}`);
  }
}

if (APPLY) {
  banner('STEP B (apply) — writing standings');
  // Wipe ALL standings for the stage (incl. phantom group 0), then reinsert real groups.
  const { error: delErr } = await sb.from('stage_standings').delete().eq('stage_id', STAGE);
  if (delErr) throw delErr;
  for (const { gid, ranked } of computed) {
    if (gid === 0) { console.log('  skipping phantom bucket group_id=0 (not re-inserted)'); continue; }
    if (!ranked.length) continue;
    const { error } = await sb.from('stage_standings').insert(
      ranked.map(r => ({
        stage_id: STAGE, group_id: gid, team_id: r.team_id,
        played: r.played, won: r.won, drawn: r.drawn, lost: r.lost,
        gf: r.gf, ga: r.ga, gd: r.gd, points: r.points, rank: r.rank,
      })));
    if (error) throw error;
    console.log(`  wrote ${ranked.length} rows for group ${gid} (${GROUPS[gid]})`);
  }
  console.log('\n✓ DONE. Matches re-grouped, standings rewritten, phantom bucket removed.');
} else {
  banner('DRY RUN COMPLETE — re-run with --apply to write');
}
