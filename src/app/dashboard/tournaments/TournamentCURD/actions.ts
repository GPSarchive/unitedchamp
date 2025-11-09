//app/dashboard/tournaments/TournamentCURD/actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import type { NewTournamentPayload } from '@/app/lib/types';
import { createSupabaseRouteClient } from '@/app/lib/supabase/supabaseServer'; // auth check (roles)
import { supabaseAdmin } from '@/app/lib/supabase/supabaseAdmin'; // service role for writes (bypass RLS)

/* =========================================================
   Local server-only types (avoid importing from Client code)
   ========================================================= */
type TeamDraftServer = {
  id: number;
  seed?: number | null;
  // stage index (as string) -> group index
  groupsByStage?: Record<string, number | undefined>;
};

type DraftMatchServer = {
  stageIdx: number;
  groupIdx?: number | null;
  round?: number | null;
  bracket_pos?: number | null;
  matchday?: number | null;
  team_a_id?: number | null;
  team_b_id?: number | null;
  is_ko?: boolean | null;
  // DB identity if it already exists (filled in GET for edit)
  db_id?: number | null;

  // Live fields
  status?: 'scheduled' | 'finished' | null;
  team_a_score?: number | null;
  team_b_score?: number | null;
  winner_team_id?: number | null;

  // Transient links (by draft index)
  home_source_match_idx?: number | null;
  away_source_match_idx?: number | null;

  // Outcomes for the links (default W)
  home_source_outcome?: 'W' | 'L' | null;
  away_source_outcome?: 'W' | 'L' | null;

  // Stable pointers the generator normalizes to
  home_source_round?: number | null;
  home_source_bracket_pos?: number | null;
  away_source_round?: number | null;
  away_source_bracket_pos?: number | null;

  match_date?: string | null;
};

export type TournamentEditorData = {
  payload: NewTournamentPayload;
  teams: TeamDraftServer[];
  draftMatches: DraftMatchServer[];
  meta: { id: number; slug: string | null; updated_at: string; created_at: string };
};

/* =========================
   Validation Schemas
   ========================= */

// Accept absolute URL OR a leading-slash relative path
const LogoSchema = z
  .string()
  .trim()
  .refine((v) => v === '' || /^https?:\/\//i.test(v) || v.startsWith('/'), {
    message: 'Logo must be absolute URL or start with "/"',
  });

const PayloadSchema = z.object({
  tournament: z.object({
    name: z.string().min(2),
    slug: z.string().min(1).nullable().optional(),
    logo: LogoSchema.nullable().optional(),
    season: z.string().nullable().optional(),
    status: z.enum(['scheduled','running','completed','archived']).optional(),
    format: z.enum(['league','groups','knockout','mixed']).optional(),
    start_date: z.string().nullable().optional(),
    end_date: z.string().nullable().optional(),
    winner_team_id: z.number().int().nullable().optional(),
  }),
  stages: z.array(z.object({
    name: z.string().min(1),
    kind: z.enum(['league','groups','knockout']),
    ordering: z.number().int().optional(),
    config: z.any().optional(),
    groups: z.array(z.object({ name: z.string().min(1) })).optional(),
  })).min(1),
  tournament_team_ids: z.array(z.number().int()).optional(),
});

const TeamDraftSchema = z.object({
  id: z.number().int(),
  seed: z.number().int().nullable().optional(),
  // stageIdx (as string) -> groupIdx
  groupsByStage: z.record(z.string(), z.number().int().optional()).optional(),
});

const DraftMatchSchema = z.object({
  stageIdx: z.number().int(),
  groupIdx: z.number().int().nullable().optional(),
  round: z.number().int().nullable().optional(),
  bracket_pos: z.number().int().nullable().optional(),
  matchday: z.number().int().nullable().optional(),
  team_a_id: z.number().int().nullable().optional(),
  team_b_id: z.number().int().nullable().optional(),

  // db identity
  db_id: z.number().int().nullable().optional(),

  // live fields
  status: z.enum(['scheduled','finished']).nullable().optional(),
  team_a_score: z.number().int().nullable().optional(),
  team_b_score: z.number().int().nullable().optional(),
  winner_team_id: z.number().int().nullable().optional(),

  // transient & stable KO
  home_source_match_idx: z.number().int().nullable().optional(),
  away_source_match_idx: z.number().int().nullable().optional(),
  home_source_outcome: z.enum(['W','L']).nullable().optional(),
  away_source_outcome: z.enum(['W','L']).nullable().optional(),
  home_source_round: z.number().int().nullable().optional(),
  home_source_bracket_pos: z.number().int().nullable().optional(),
  away_source_round: z.number().int().nullable().optional(),
  away_source_bracket_pos: z.number().int().nullable().optional(),

  match_date: z.string().nullable().optional(),
});

/* =========================
   Helpers
   ========================= */

async function requireAdmin() {
  const routeClient = await createSupabaseRouteClient();
  const { data: { user } } = await routeClient.auth.getUser();
  const roles = (user?.app_metadata as any)?.roles ?? [];
  if (!roles.includes('admin')) throw new Error('Forbidden');
  return user;
}

/* ---------------------------------------------------------
   NEW helpers: persist Groups intake_mappings for a stage
   --------------------------------------------------------- */
async function upsertIntakeMappingsForGroupsStage(params: {
  payload: NewTournamentPayload;
  stageIdx: number;                       // groups stage index (in payload)
  stageIdByIndex: number[];               // map stageIdx -> DB id
}) {
  const { payload, stageIdx, stageIdByIndex } = params;
  const stage = payload.stages[stageIdx];
  if (!stage || stage.kind !== 'groups') return;

  const cfg: any = stage.config ?? {};
  const fromIdxRaw = cfg.from_knockout_stage_idx;
  const hasFrom = Number.isFinite(fromIdxRaw);

  // Nothing to persist if no source or no mapping rows
  if (!hasFrom || !Array.isArray(cfg.groups_intake) || cfg.groups_intake.length === 0) return;

  const target_stage_id = stageIdByIndex[stageIdx];
  const from_stage_idx = Number(fromIdxRaw);
  const from_stage_id = stageIdByIndex[from_stage_idx];

  if (!Number.isFinite(target_stage_id) || !Number.isFinite(from_stage_id)) return;

  // Normalize rows and build payload (slot_idx is 0-based by UI/design)
  type IntakeRow = {
    group_idx: number;
    slot_idx: number; // 0-based
    round: number;
    bracket_pos: number;
    outcome: 'W' | 'L';
  };

  const rows: IntakeRow[] = (cfg.groups_intake as any[]).map((r) => ({
    group_idx: Math.max(0, Number(r.group_idx) || 0),
    slot_idx: Math.max(0, Number(r.slot_idx) || 0),
    round: Math.max(1, Number(r.round) || 1),
    bracket_pos: Math.max(1, Number(r.bracket_pos) || 1),
    outcome: (r.outcome === 'L' ? 'L' : 'W') as 'W' | 'L',
  }));

  // Clear existing for this target stage, then insert fresh
  await supabaseAdmin.from('intake_mappings').delete().eq('target_stage_id', target_stage_id);

  if (rows.length) {
    await supabaseAdmin
      .from('intake_mappings')
      .insert(
        rows.map((r) => ({
          target_stage_id,
          group_idx: r.group_idx,
          slot_idx: r.slot_idx,      // kept 0-based consistently with UI
          from_stage_id,
          round: r.round,
          bracket_pos: r.bracket_pos,
          outcome: r.outcome,
        }))
      )
      .throwOnError();
  }
}

/* =========================
   CREATE
   ========================= */

export async function createTournamentAction(formData: FormData) {
  const payloadStr = String(formData.get('payload') ?? '');
  const teamsStr = String(formData.get('teams') ?? '[]');
  const draftMatchesStr = String(formData.get('draftMatches') ?? '[]');

  let payload: NewTournamentPayload;
  let teams: TeamDraftServer[];
  let draftMatches: DraftMatchServer[];

  try {
    payload = PayloadSchema.parse(JSON.parse(payloadStr));
    teams = z.array(TeamDraftSchema).parse(JSON.parse(teamsStr));
    draftMatches = z.array(DraftMatchSchema).parse(JSON.parse(draftMatchesStr));
  } catch (e: any) {
    return { ok: false, error: 'Invalid data: ' + e.message };
  }

  try {
    await requireAdmin();
  } catch (e: any) {
    return { ok: false, error: e.message || 'Forbidden' };
  }

  // 1) Tournament
  const { data: tRow, error: tErr } = await supabaseAdmin
    .from('tournaments')
    .insert({
      name: payload.tournament.name,
      slug: payload.tournament.slug,
      logo: payload.tournament.logo || null,
      season: payload.tournament.season,
      status: payload.tournament.status ?? 'scheduled',
      format: payload.tournament.format ?? 'mixed',
      start_date: (payload as any).tournament?.start_date ?? null,
      end_date: (payload as any).tournament?.end_date ?? null,
      winner_team_id: (payload as any).tournament?.winner_team_id ?? null,
    })
    .select('id, slug')
    .single();

  if (tErr || !tRow) return { ok: false, error: tErr?.message || 'Failed to create tournament' };

  // 2) Stages
  const stagesInsert = payload.stages.map((s, i) => ({
    tournament_id: tRow.id,
    name: s.name,
    kind: s.kind,
    ordering: s.ordering ?? i + 1,
    config: s.config ?? null,
  }));

  const { data: stageRows, error: sErr } = await supabaseAdmin
    .from('tournament_stages')
    .insert(stagesInsert)
    .select('id, name, kind, ordering');

  if (sErr || !stageRows) return { ok: false, error: sErr?.message || 'Failed to create stages' };

  // Map stageIdx -> stage_id using ordering + name/kind
  const stageIdByIndex: number[] = [];
  payload.stages.forEach((s, i) => {
    const found = stageRows.find(r => (r.ordering ?? i + 1) === (s.ordering ?? i + 1) && r.name === s.name && r.kind === s.kind);
    stageIdByIndex[i] = found!.id;
  });

  // NEW: normalize KO configs -> persist from_stage_id AND advancers_total (for League→KO)
  for (let i = 0; i < payload.stages.length; i++) {
    const st = payload.stages[i];
    if (st.kind !== 'knockout') continue;

    const cfg = { ...(st.config ?? {}) } as any;
    const fromIdx = Number(cfg.from_stage_idx ?? cfg.fromStageIdx);
    const hasFromIdx = Number.isFinite(fromIdx);

    if (hasFromIdx) {
      const fromId = stageIdByIndex[fromIdx];
      if (fromId) {
        cfg.from_stage_id = fromId;
        cfg.from_stage_idx = fromIdx; // keep idx for client too
      }

      // If the KO sources a LEAGUE, ensure advancers_total is present.
      const srcKind = payload.stages[fromIdx]?.kind;
      if (srcKind === 'league') {
        // Migrate old UI knob if needed
        if (cfg.advancers_total == null && cfg.advancers_per_group != null) {
          cfg.advancers_total = Number(cfg.advancers_per_group);
        }
        // Safety fallback (prevents “all teams pass”)
        if (cfg.advancers_total == null) cfg.advancers_total = 4;
      }
    }

    await supabaseAdmin
      .from('tournament_stages')
      .update({ config: cfg })
      .eq('id', stageIdByIndex[i]);
  }

  // 3) Groups per groups-stage
  type GroupRecord = { id: number; stage_id: number; name: string };
  const allGroups: GroupRecord[] = [];
  for (let i = 0; i < payload.stages.length; i++) {
    const s = payload.stages[i];
    if (s.kind !== 'groups') continue;
    const stage_id = stageIdByIndex[i];
    const names = (s.groups ?? []).map(g => g.name);

    if (names.length) {
      const { data: gRows, error: gErr } = await supabaseAdmin
        .from('tournament_groups')
        .insert(names.map((name) => ({ stage_id, name })))
        .select('id, stage_id, name');

      if (gErr) return { ok: false, error: gErr.message };
      allGroups.push(...(gRows ?? []));
    }
  }

  const groupIdByStageIdxAndOrder = (stageIdx: number, groupIdx: number | null | undefined): number | null => {
    if (groupIdx == null) return null;
    const stage = payload.stages[stageIdx];
    const wantedName = stage.groups?.[groupIdx]?.name;
    if (!wantedName) return null;
    const stage_id = stageIdByIndex[stageIdx];
    const rec = allGroups.find(g => g.stage_id === stage_id && g.name === wantedName);
    return rec?.id ?? null;
  };

  // 3.1 NEW: persist intake_mappings for every groups stage that uses KO→Groups intake
  for (let i = 0; i < payload.stages.length; i++) {
    if (payload.stages[i].kind === 'groups') {
      await upsertIntakeMappingsForGroupsStage({ payload, stageIdx: i, stageIdByIndex });
    }
  }

  // 4) Participation (tournament_teams)
  type ParticipationRow = {
    tournament_id: number;
    team_id: number;
    stage_id: number | null;
    group_id: number | null;
    seed: number | null;
  };

  const participation: ParticipationRow[] = [];
  const seenTeam = new Set<string>();

  for (const t of teams) {
    const key = `${tRow.id}:${t.id}`;
    if (seenTeam.has(key)) continue;
    seenTeam.add(key);

    let inserted = false;
    for (let sIdx = 0; sIdx < payload.stages.length; sIdx++) {
      const s = payload.stages[sIdx];
      const gIdx = t.groupsByStage?.[String(sIdx)];
      if (s.kind === 'groups' && gIdx != null && gIdx >= 0) {
        participation.push({
          tournament_id: tRow.id,
          team_id: t.id,
          stage_id: stageIdByIndex[sIdx],
          group_id: groupIdByStageIdxAndOrder(sIdx, gIdx),
          seed: (t.seed ?? null) as number | null,
        });
        inserted = true;
        break; // one row per team only
      }
    }

    if (!inserted) {
      participation.push({
        tournament_id: tRow.id,
        team_id: t.id,
        stage_id: null,
        group_id: null,
        seed: (t.seed ?? null) as number | null,
      });
    }
  }

  if (participation.length) {
    const { error: pErr } = await supabaseAdmin
      .from('tournament_teams')
      .upsert(participation, { onConflict: 'tournament_id,team_id' });

    if (pErr) return { ok: false, error: pErr.message };
  }

  // 5) Matches (from draft) — insert, then link sources by id (with live fields)
  if (draftMatches.length) {
    const matchRows = draftMatches.map((m) => ({
      tournament_id: tRow.id,
      stage_id: stageIdByIndex[m.stageIdx],
      group_id: groupIdByStageIdxAndOrder(m.stageIdx, m.groupIdx ?? null),
      team_a_id: m.team_a_id ?? null,
      team_b_id: m.team_b_id ?? null,
      matchday: m.matchday ?? null,
      round: m.round ?? null,
      bracket_pos: m.bracket_pos ?? null,

      // live fields
      status: m.status ?? 'scheduled',
      team_a_score: m.team_a_score ?? null,
      team_b_score: m.team_b_score ?? null,
      winner_team_id: m.winner_team_id ?? null,

      match_date: m.match_date ? new Date(m.match_date).toISOString() : null,

      // IDs are linked in the second pass
      home_source_match_id: null,
      home_source_outcome: m.home_source_outcome ?? null,
      away_source_match_id: null,
      away_source_outcome: m.away_source_outcome ?? null,

      // stable pointers
      home_source_round: m.home_source_round ?? null,
      home_source_bracket_pos: m.home_source_bracket_pos ?? null,
      away_source_round: m.away_source_round ?? null,
      away_source_bracket_pos: m.away_source_bracket_pos ?? null,
    }));

    const { data: inserted, error: mErr } = await supabaseAdmin
      .from('matches')
      .insert(matchRows)
      .select('id');

    if (mErr) return { ok: false, error: mErr.message };

    const idByIdx = (inserted ?? []).map((r) => r.id as number); // index in draftMatches → DB id

    const linkUpdates = draftMatches
      .map((m, i) => {
        const upd: any = { id: idByIdx[i] };

        // Link by ID if we have transient indices
        if (m.home_source_match_idx != null) {
          const sid = idByIdx[m.home_source_match_idx];
          if (Number.isFinite(sid)) {
            upd.home_source_match_id = sid;
            upd.home_source_outcome = m.home_source_outcome ?? 'W';
          }
          // Also ensure stable round/pos present
          const src = draftMatches[m.home_source_match_idx];
          if (src) {
            upd.home_source_round = src.round ?? null;
            upd.home_source_bracket_pos = src.bracket_pos ?? null;
          }
        }
        if (m.away_source_match_idx != null) {
          const sid = idByIdx[m.away_source_match_idx];
          if (Number.isFinite(sid)) {
            upd.away_source_match_id = sid;
            upd.away_source_outcome = m.away_source_outcome ?? 'W';
          }
          const src = draftMatches[m.away_source_match_idx];
          if (src) {
            upd.away_source_round = src.round ?? null;
            upd.away_source_bracket_pos = src.bracket_pos ?? null;
          }
        }

        // If no transient idx, we may still have stable pointers from the generator
        upd.home_source_round ??= m.home_source_round ?? null;
        upd.home_source_bracket_pos ??= m.home_source_bracket_pos ?? null;
        upd.away_source_round ??= m.away_source_round ?? null;
        upd.away_source_bracket_pos ??= m.away_source_bracket_pos ?? null;

        const hasAny =
          upd.home_source_match_id != null ||
          upd.away_source_match_id != null ||
          upd.home_source_round != null ||
          upd.home_source_bracket_pos != null ||
          upd.away_source_round != null ||
          upd.away_source_bracket_pos != null;

        return hasAny ? upd : null;
      })
      .filter(Boolean) as Array<{
        id: number;
        home_source_match_id?: number | null;
        home_source_outcome?: 'W' | 'L' | null;
        away_source_match_id?: number | null;
        away_source_outcome?: 'W' | 'L' | 'L' | null;
        home_source_round?: number | null;
        home_source_bracket_pos?: number | null;
        away_source_round?: number | null;
        away_source_bracket_pos?: number | null;
      }>;

    for (const u of linkUpdates) {
      const { error } = await supabaseAdmin
        .from('matches')
        .update({
          home_source_match_id: u.home_source_match_id ?? null,
          home_source_outcome: u.home_source_outcome ?? null,
          away_source_match_id: u.away_source_match_id ?? null,
          away_source_outcome: u.away_source_outcome ?? null,
          home_source_round: u.home_source_round ?? null,
          home_source_bracket_pos: u.home_source_bracket_pos ?? null,
          away_source_round: u.away_source_round ?? null,
          away_source_bracket_pos: u.away_source_bracket_pos ?? null,
        })
        .eq('id', u.id);
      if (error) return { ok: false, error: error.message };
    }
  }

  revalidatePath('/tournoua');
  redirect(`/tournoua/${tRow.slug ?? payload.tournament.slug ?? ''}`);
}

/* =========================
   LIST (for "Load old tournaments")
   ========================= */

export async function listTournamentsAction(opts?: {
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  try {
    await requireAdmin();
  } catch (e: any) {
    return { ok: false, error: e.message || 'Forbidden' };
  }

  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = Math.min(50, opts?.pageSize ?? 10);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabaseAdmin
    .from('tournaments')
    .select('id,name,slug,season,status,format,start_date,end_date,updated_at,created_at', { count: 'exact' })
    .order('updated_at', { ascending: false })
    .range(from, to);

  if (opts?.search?.trim()) {
    const s = opts.search.trim();
    q = q.or(`name.ilike.%${s}%,slug.ilike.%${s}%`);
  }

  const { data, error, count } = await q;
  if (error) return { ok: false, error: error.message };

  return {
    ok: true,
    items: data ?? [],
    total: count ?? 0,
    page,
    pageSize,
  };
}

/* =========================
   GET for Edit (assemble payload back)
   ========================= */

export async function getTournamentForEditAction(tournamentId: number): Promise<
  { ok: true; data: TournamentEditorData } | { ok: false; error: string }
> {
  try {
    await requireAdmin();
  } catch (e: any) {
    return { ok: false, error: e.message || 'Forbidden' };
  }

  // Base tournament
  const { data: t, error: tErr } = await supabaseAdmin
    .from('tournaments')
    .select('*')
    .eq('id', tournamentId)
    .single();

  if (tErr || !t) return { ok: false, error: tErr?.message || 'Tournament not found' };

  // Stages
  const { data: stages, error: sErr } = await supabaseAdmin
    .from('tournament_stages')
    .select('id,name,kind,ordering,config')
    .eq('tournament_id', tournamentId)
    .order('ordering', { ascending: true });

  if (sErr) return { ok: false, error: sErr.message };

  // Groups
  const { data: groups, error: gErr } = await supabaseAdmin
    .from('tournament_groups')
    .select('id,stage_id,name')
    .in('stage_id', (stages ?? []).map(s => s.id));

  if (gErr) return { ok: false, error: gErr.message };

  // Teams (participation)
  const { data: parts, error: pErr } = await supabaseAdmin
    .from('tournament_teams')
    .select('team_id,stage_id,group_id,seed')
    .eq('tournament_id', tournamentId);

  if (pErr) return { ok: false, error: pErr.message };

  // Matches (include live fields; order stable for source indices)
  const { data: matches, error: mErr } = await supabaseAdmin
    .from('matches')
    .select(`
      id, stage_id, group_id, team_a_id, team_b_id, matchday, round, bracket_pos, match_date,
      status, team_a_score, team_b_score, winner_team_id,
      home_source_match_id, home_source_outcome, away_source_match_id, away_source_outcome,
      home_source_round, home_source_bracket_pos, away_source_round, away_source_bracket_pos
    `)
    .eq('tournament_id', tournamentId)
    .order('round', { ascending: true, nullsFirst: true })
    .order('bracket_pos', { ascending: true, nullsFirst: true })
    .order('matchday', { ascending: true, nullsFirst: true })
    .order('id', { ascending: true });

  if (mErr) return { ok: false, error: mErr.message };

  // Build indices for reconstruction
  const stageIndexById = new Map<number, number>();
  (stages ?? []).forEach((s, i) => stageIndexById.set(s.id, i));

  const groupsByStageId = new Map<number, { id: number; name: string }[]>();
  (groups ?? []).forEach(g => {
    const arr = groupsByStageId.get(g.stage_id) ?? [];
    arr.push({ id: g.id, name: g.name });
    groupsByStageId.set(g.stage_id, arr);
  });

  // Build stages payload with DB id and backfill from_stage_idx from any stored from_stage_id
  const stagesForPayload = (stages ?? []).map((s, i) => {
    const cfg = { ...(s.config ?? {}) } as any;
    if (s.kind === 'knockout') {
      const fsId = Number(cfg.from_stage_id ?? cfg.fromStageId);
      if (Number.isFinite(fsId) && cfg.from_stage_idx == null) {
        const idx = stageIndexById.get(fsId);
        if (idx != null) cfg.from_stage_idx = idx;
      }
    }
    return {
      id: s.id, // include DB id for client (Planner reseed button)
      name: s.name,
      kind: s.kind,
      ordering: s.ordering ?? i + 1,
      config: cfg,
      // NEW: include id with groups so MatchPlanner can map group_id -> index
      groups: s.kind === 'groups'
        ? (groupsByStageId.get(s.id) ?? []).map(g => ({ id: g.id, name: g.name }))
        : undefined,
    };
  });

  // Build payload
  const payload: NewTournamentPayload = {
    tournament: {
      name: t.name,
      slug: t.slug,
      logo: t.logo,
      season: t.season,
      status: t.status,
      format: t.format,
      start_date: t.start_date,
      end_date: t.end_date,
      winner_team_id: t.winner_team_id,
    },
    stages: stagesForPayload as any,
    tournament_team_ids: undefined,
  } as any;

  // Rebuild teams as TeamDraftServer[] with groupsByStage mapping
  const teams: TeamDraftServer[] = [];
  const seen = new Set<number>();
  for (const part of (parts ?? [])) {
    if (seen.has(part.team_id)) continue;
    seen.add(part.team_id);
    const td: TeamDraftServer = { id: part.team_id, seed: part.seed ?? undefined, groupsByStage: {} };
    const rowsForTeam = (parts ?? []).filter(p => p.team_id === part.team_id);
    for (const row of rowsForTeam) {
      if (row.stage_id && row.group_id) {
        const sIdx = stageIndexById.get(row.stage_id);
        if (sIdx != null) {
          const stageGroups = groupsByStageId.get(row.stage_id) ?? [];
          const gIdx = stageGroups.findIndex(g => g.id === row.group_id);
          if (gIdx >= 0) {
            (td.groupsByStage as any)[String(sIdx)] = gIdx; // string key
          }
        }
      }
    }
    teams.push(td);
  }

  // Build id -> index map in the same order as SELECT (for source idx rehydration)
  const indexById = new Map<number, number>();
  (matches ?? []).forEach((m, i) => {
    if ((m as any).id != null) indexById.set((m as any).id, i);
  });

  // Rebuild draftMatches[] from matches (including db_id, live fields, source *_idx, stable pointers)
  const draftMatches: DraftMatchServer[] = (matches ?? []).map((m: any) => {
    const sIdx = m.stage_id ? stageIndexById.get(m.stage_id) ?? 0 : 0;
    let groupIdx: number | null = null;
    if (m.group_id && m.stage_id) {
      const arr = groupsByStageId.get(m.stage_id) ?? [];
      const idx = arr.findIndex(g => g.id === m.group_id);
      groupIdx = idx >= 0 ? idx : null;
    }
    return {
      db_id: m.id,
      stageIdx: sIdx,
      groupIdx,
      round: m.round ?? null,
      bracket_pos: m.bracket_pos ?? null,
      matchday: m.matchday ?? null,
      team_a_id: m.team_a_id ?? null,
      team_b_id: m.team_b_id ?? null,

      status: m.status ?? 'scheduled',
      team_a_score: m.team_a_score ?? null,
      team_b_score: m.team_b_score ?? null,
      winner_team_id: m.winner_team_id ?? null,

      home_source_match_idx: m.home_source_match_id != null ? (indexById.get(m.home_source_match_id) ?? null) : null,
      away_source_match_idx: m.away_source_match_id != null ? (indexById.get(m.away_source_match_id) ?? null) : null,
      home_source_outcome: m.home_source_outcome ?? null,
      away_source_outcome: m.away_source_outcome ?? null,

      home_source_round: m.home_source_round ?? null,
      home_source_bracket_pos: m.home_source_bracket_pos ?? null,
      away_source_round: m.away_source_round ?? null,
      away_source_bracket_pos: m.away_source_bracket_pos ?? null,

      match_date: m.match_date ?? null,
    };
  });

  return {
    ok: true as const,
    data: {
      payload,
      teams,
      draftMatches,
      meta: {
        id: t.id,
        slug: t.slug,
        updated_at: t.updated_at,
        created_at: t.created_at,
      }
    }
  };
}

/* =========================
   UPDATE (replace children; persist live fields)
   ========================= */

export async function updateTournamentAction(formData: FormData) {
  const idStr = String(formData.get('tournament_id') ?? '');
  const tournamentId = Number(idStr);
  if (!Number.isFinite(tournamentId)) return { ok: false, error: 'Invalid tournament id' };

  const payloadStr = String(formData.get('payload') ?? '');
  const teamsStr = String(formData.get('teams') ?? '[]');
  const draftMatchesStr = String(formData.get('draftMatches') ?? '[]');

  let payload: NewTournamentPayload;
  let teams: TeamDraftServer[];
  let draftMatches: DraftMatchServer[];

  try {
    payload = PayloadSchema.parse(JSON.parse(payloadStr));
    teams = z.array(TeamDraftSchema).parse(JSON.parse(teamsStr));
    draftMatches = z.array(DraftMatchSchema).parse(JSON.parse(draftMatchesStr));
  } catch (e: any) {
    return { ok: false, error: 'Invalid data: ' + e.message };
  }

  try {
    await requireAdmin();
  } catch (e: any) {
    return { ok: false, error: e.message || 'Forbidden' };
  }

  // Ensure exists
  const { data: existing, error: exErr } = await supabaseAdmin
    .from('tournaments')
    .select('id,slug')
    .eq('id', tournamentId)
    .single();

  if (exErr || !existing) return { ok: false, error: exErr?.message || 'Tournament not found' };

  // Update base
  {
    const { error } = await supabaseAdmin
      .from('tournaments')
      .update({
        name: payload.tournament.name,
        slug: payload.tournament.slug,
        logo: payload.tournament.logo || null,
        season: payload.tournament.season,
        status: payload.tournament.status ?? 'scheduled',
        format: payload.tournament.format ?? 'mixed',
        start_date: (payload as any).tournament?.start_date ?? null,
        end_date: (payload as any).tournament?.end_date ?? null,
        winner_team_id: (payload as any).tournament?.winner_team_id ?? null,
      })
      .eq('id', tournamentId);

    if (error) return { ok: false, error: error.message };
  }

  // Delete children (FK-safe)
  await supabaseAdmin.from('matches').delete().eq('tournament_id', tournamentId).throwOnError();
  await supabaseAdmin.from('tournament_teams').delete().eq('tournament_id', tournamentId).throwOnError();

  const { data: stageIds } = await supabaseAdmin
    .from('tournament_stages')
    .select('id')
    .eq('tournament_id', tournamentId);

  if (stageIds?.length) {
    const ids = stageIds.map(s => s.id);
    await supabaseAdmin.from('tournament_groups').delete().in('stage_id', ids).throwOnError();
    // NEW: also clear intake_mappings for all previous stages of this tournament
    await supabaseAdmin.from('intake_mappings').delete().in('target_stage_id', ids as any).throwOnError();
  }

  await supabaseAdmin.from('tournament_stages').delete().eq('tournament_id', tournamentId).throwOnError();

  // Re-insert stages
  const stagesInsert = payload.stages.map((s, i) => ({
    tournament_id: tournamentId,
    name: s.name,
    kind: s.kind,
    ordering: s.ordering ?? i + 1,
    config: s.config ?? null,
  }));

  const { data: stageRows, error: sErr } = await supabaseAdmin
    .from('tournament_stages')
    .insert(stagesInsert)
    .select('id, name, kind, ordering');

  if (sErr || !stageRows) return { ok: false, error: sErr?.message || 'Failed to create stages' };

  const stageIdByIndex: number[] = [];
  payload.stages.forEach((s, i) => {
    const found = stageRows.find(r => (r.ordering ?? i + 1) === (s.ordering ?? i + 1) && r.name === s.name && r.kind === s.kind);
    stageIdByIndex[i] = found!.id;
  });

  // NEW: normalize KO configs -> persist from_stage_id AND advancers_total (for League→KO)
  for (let i = 0; i < payload.stages.length; i++) {
    const st = payload.stages[i];
    if (st.kind !== 'knockout') continue;

    const cfg = { ...(st.config ?? {}) } as any;
    const fromIdx = Number(cfg.from_stage_idx ?? cfg.fromStageIdx);
    const hasFromIdx = Number.isFinite(fromIdx);

    if (hasFromIdx) {
      const fromId = stageIdByIndex[fromIdx];
      if (fromId) {
        cfg.from_stage_id = fromId;
        cfg.from_stage_idx = fromIdx; // keep idx for client too
      }

      const srcKind = payload.stages[fromIdx]?.kind;
      if (srcKind === 'league') {
        if (cfg.advancers_total == null && cfg.advancers_per_group != null) {
          cfg.advancers_total = Number(cfg.advancers_per_group);
        }
        if (cfg.advancers_total == null) cfg.advancers_total = 4;
      }
    }

    await supabaseAdmin
      .from('tournament_stages')
      .update({ config: cfg })
      .eq('id', stageIdByIndex[i]);
  }

  type GroupRecord = { id: number; stage_id: number; name: string };
  const allGroups: GroupRecord[] = [];

  for (let i = 0; i < payload.stages.length; i++) {
    const s = payload.stages[i];
    if (s.kind !== 'groups') continue;
    const stage_id = stageIdByIndex[i];
    const names = (s.groups ?? []).map(g => g.name);

    if (names.length) {
      const { data: gRows, error: gErr } = await supabaseAdmin
        .from('tournament_groups')
        .insert(names.map((name) => ({ stage_id, name })))
        .select('id, stage_id, name');

      if (gErr) return { ok: false, error: gErr.message };
      allGroups.push(...(gRows ?? []));
    }
  }

  const groupIdByStageIdxAndOrder = (stageIdx: number, groupIdx: number | null | undefined): number | null => {
    if (groupIdx == null) return null;
    const stage = payload.stages[stageIdx];
    const wantedName = stage.groups?.[groupIdx]?.name;
    if (!wantedName) return null;
    const stage_id = stageIdByIndex[stageIdx];
    const rec = allGroups.find(g => g.stage_id === stage_id && g.name === wantedName);
    return rec?.id ?? null;
  };

  // NEW: persist intake_mappings for every groups stage that uses KO→Groups intake
  for (let i = 0; i < payload.stages.length; i++) {
    if (payload.stages[i].kind === 'groups') {
      await upsertIntakeMappingsForGroupsStage({ payload, stageIdx: i, stageIdByIndex });
    }
  }

  // Participation
  type ParticipationRow = {
    tournament_id: number;
    team_id: number;
    stage_id: number | null;
    group_id: number | null;
    seed: number | null;
  };

  const participation: ParticipationRow[] = [];
  const seenTeam = new Set<string>();

  for (const t of teams) {
    const key = `${tournamentId}:${t.id}`;
    if (seenTeam.has(key)) continue;
    seenTeam.add(key);

    let inserted = false;
    for (let sIdx = 0; sIdx < payload.stages.length; sIdx++) {
      const s = payload.stages[sIdx];
      const gIdx = t.groupsByStage?.[String(sIdx)];
      if (s.kind === 'groups' && gIdx != null && gIdx >= 0) {
        participation.push({
          tournament_id: tournamentId,
          team_id: t.id,
          stage_id: stageIdByIndex[sIdx],
          group_id: groupIdByStageIdxAndOrder(sIdx, gIdx),
          seed: (t.seed ?? null) as number | null,
        });
        inserted = true;
        break;
      }
    }

    if (!inserted) {
      participation.push({
        tournament_id: tournamentId,
        team_id: t.id,
        stage_id: null,
        group_id: null,
        seed: (t.seed ?? null) as number | null,
      });
    }
  }

  if (participation.length) {
    const { error: pErr } = await supabaseAdmin
      .from('tournament_teams')
      .upsert(participation, { onConflict: 'tournament_id,team_id' });

    if (pErr) return { ok: false, error: pErr.message };
  }

  // Matches — insert, then link sources (IDs + stable pointers) with live fields
  if (draftMatches.length) {
    const matchRows = draftMatches.map((m) => ({
      tournament_id: tournamentId,
      stage_id: stageIdByIndex[m.stageIdx],
      group_id: groupIdByStageIdxAndOrder(m.stageIdx, m.groupIdx ?? null),
      team_a_id: m.team_a_id ?? null,
      team_b_id: m.team_b_id ?? null,
      matchday: m.matchday ?? null,
      round: m.round ?? null,
      bracket_pos: m.bracket_pos ?? null,

      // live fields
      status: m.status ?? 'scheduled',
      team_a_score: m.team_a_score ?? null,
      team_b_score: m.team_b_score ?? null,
      winner_team_id: m.winner_team_id ?? null,

      match_date: m.match_date ? new Date(m.match_date).toISOString() : null,

      home_source_match_id: null,
      home_source_outcome: m.home_source_outcome ?? null,
      away_source_match_id: null,
      away_source_outcome: m.away_source_outcome ?? null,

      // stable pointers
      home_source_round: m.home_source_round ?? null,
      home_source_bracket_pos: m.home_source_bracket_pos ?? null,
      away_source_round: m.away_source_round ?? null,
      away_source_bracket_pos: m.away_source_bracket_pos ?? null,
    }));

    const { data: inserted, error: mErr } = await supabaseAdmin
      .from('matches')
      .insert(matchRows)
      .select('id');

    if (mErr) return { ok: false, error: mErr.message };
    const idByIdx = (inserted ?? []).map((r) => r.id as number);

    const linkUpdates = draftMatches
      .map((m, i) => {
        const upd: any = { id: idByIdx[i] };

        if (m.home_source_match_idx != null) {
          const sid = idByIdx[m.home_source_match_idx];
          if (Number.isFinite(sid)) {
            upd.home_source_match_id = sid;
            upd.home_source_outcome = m.home_source_outcome ?? 'W';
          }
          const src = draftMatches[m.home_source_match_idx];
          if (src) {
            upd.home_source_round = src.round ?? null;
            upd.home_source_bracket_pos = src.bracket_pos ?? null;
          }
        }
        if (m.away_source_match_idx != null) {
          const sid = idByIdx[m.away_source_match_idx];
          if (Number.isFinite(sid)) {
            upd.away_source_match_id = sid;
            upd.away_source_outcome = m.away_source_outcome ?? 'W';
          }
          const src = draftMatches[m.away_source_match_idx];
          if (src) {
            upd.away_source_round = src.round ?? null;
            upd.away_source_bracket_pos = src.bracket_pos ?? null;
          }
        }

        // keep any explicit stable pointers provided
        upd.home_source_round ??= m.home_source_round ?? null;
        upd.home_source_bracket_pos ??= m.home_source_bracket_pos ?? null;
        upd.away_source_round ??= m.away_source_round ?? null;
        upd.away_source_bracket_pos ??= m.away_source_bracket_pos ?? null;

        const hasAny =
          upd.home_source_match_id != null ||
          upd.away_source_match_id != null ||
          upd.home_source_round != null ||
          upd.home_source_bracket_pos != null ||
          upd.away_source_round != null ||
          upd.away_source_bracket_pos != null;

        return hasAny ? upd : null;
      })
      .filter(Boolean) as Array<{
        id: number;
        home_source_match_id?: number | null;
        home_source_outcome?: 'W' | 'L' | null;
        away_source_match_id?: number | null;
        away_source_outcome?: 'W' | 'L' | null,
        home_source_round?: number | null;
        home_source_bracket_pos?: number | null;
        away_source_round?: number | null;
        away_source_bracket_pos?: number | null;
      }>;

    for (const u of linkUpdates) {
      const { error } = await supabaseAdmin
        .from('matches')
        .update({
          home_source_match_id: u.home_source_match_id ?? null,
          home_source_outcome: u.home_source_outcome ?? null,
          away_source_match_id: u.away_source_match_id ?? null,
          away_source_outcome: u.away_source_outcome ?? null,
          home_source_round: u.home_source_round ?? null,
          home_source_bracket_pos: u.home_source_bracket_pos ?? null,
          away_source_round: u.away_source_round ?? null,
          away_source_bracket_pos: u.away_source_bracket_pos ?? null,
        })
        .eq('id', u.id);
      if (error) return { ok: false, error: error.message };
    }
  }

  revalidatePath('/tournaments');
  redirect(`/tournaments/${payload.tournament.slug ?? existing.slug ?? ''}`);
}

/* =========================
   DELETE (hard delete in FK order)
   ========================= */

export async function deleteTournamentAction(tournamentId: number) {
  try {
    await requireAdmin();
  } catch (e: any) {
    return { ok: false, error: e.message || 'Forbidden' };
  }

  const delMatches = await supabaseAdmin.from('matches').delete().eq('tournament_id', tournamentId);
  if (delMatches.error) return { ok: false, error: delMatches.error.message };

  const delParts = await supabaseAdmin.from('tournament_teams').delete().eq('tournament_id', tournamentId);
  if (delParts.error) return { ok: false, error: delParts.error.message };

  const { data: stageIds } = await supabaseAdmin
    .from('tournament_stages')
    .select('id')
    .eq('tournament_id', tournamentId);

  if (stageIds?.length) {
    const ids = stageIds.map(s => s.id);
    const delGroups = await supabaseAdmin.from('tournament_groups').delete().in('stage_id', ids);
    if (delGroups.error) return { ok: false, error: delGroups.error.message };
    // NEW: remove intake_mappings for these stages as well
    const delMaps = await supabaseAdmin.from('intake_mappings').delete().in('target_stage_id', ids as any);
    if (delMaps.error) return { ok: false, error: delMaps.error.message };
  }

  const delStages = await supabaseAdmin.from('tournament_stages').delete().eq('tournament_id', tournamentId);
  if (delStages.error) return { ok: false, error: delStages.error.message };

  const delTournament = await supabaseAdmin.from('tournaments').delete().eq('id', tournamentId);
  if (delTournament.error) return { ok: false, error: delTournament.error.message };

  revalidatePath('/tournaments');
  return { ok: true };
}
