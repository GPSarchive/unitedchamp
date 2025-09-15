// app/components/DashboardPageComponents/TournamentCURD/actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import type { NewTournamentPayload } from '@/app/lib/types';
import { createSupabaseRouteClient } from '@/app/lib/supabaseServer'; // auth check (roles)
import { supabaseAdmin } from '@/app/lib/supabaseAdmin'; // service role for writes (bypass RLS)

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
  home_source_match_idx?: number | null;
  away_source_match_idx?: number | null;
  home_source_outcome?: 'W' | 'L' | null;
  away_source_outcome?: 'W' | 'L' | null;
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
  home_source_match_idx: z.number().int().nullable().optional(),
  away_source_match_idx: z.number().int().nullable().optional(),
  home_source_outcome: z.enum(['W','L']).nullable().optional(),
  away_source_outcome: z.enum(['W','L']).nullable().optional(),
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
      const gIdx = t.groupsByStage?.[String(sIdx)]; // 🔐 string key
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

  // 5) Matches (from draft) — insert, then link sources
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
      status: 'scheduled',
      match_date: m.match_date ? new Date(m.match_date).toISOString() : null,
      // defer sources; we fill them after we know DB ids
      home_source_match_id: null,
      home_source_outcome: null,
      away_source_match_id: null,
      away_source_outcome: null,
    }));

    // NOTE: no .throwOnError() here since we read error.message below
    const { data: inserted, error: mErr } = await supabaseAdmin
      .from('matches')
      .insert(matchRows)
      .select('id');

    if (mErr) return { ok: false, error: mErr.message };

    const idByIdx = (inserted ?? []).map((r) => r.id as number); // index in draftMatches → DB id

    const linkUpdates = draftMatches
      .map((m, i) => {
        const upd: any = { id: idByIdx[i] };
        if (m.home_source_match_idx != null) {
          const sid = idByIdx[m.home_source_match_idx];
          if (Number.isFinite(sid)) {
            upd.home_source_match_id = sid;
            upd.home_source_outcome = m.home_source_outcome ?? 'W';
          }
        }
        if (m.away_source_match_idx != null) {
          const sid = idByIdx[m.away_source_match_idx];
          if (Number.isFinite(sid)) {
            upd.away_source_match_id = sid;
            upd.away_source_outcome = m.away_source_outcome ?? 'W';
          }
        }
        const has = upd.home_source_match_id != null || upd.away_source_match_id != null;
        return has ? upd : null;
      })
      .filter(Boolean) as Array<{
        id: number;
        home_source_match_id?: number;
        home_source_outcome?: 'W' | 'L';
        away_source_match_id?: number;
        away_source_outcome?: 'W' | 'L';
      }>;

    for (const u of linkUpdates) {
      const { error } = await supabaseAdmin
        .from('matches')
        .update({
          home_source_match_id: u.home_source_match_id ?? null,
          home_source_outcome: u.home_source_outcome ?? null,
          away_source_match_id: u.away_source_match_id ?? null,
          away_source_outcome: u.away_source_outcome ?? null,
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

  // Matches (order to keep KO stable too) — include ids & source ids
  const { data: matches, error: mErr } = await supabaseAdmin
    .from('matches')
    .select('id,stage_id,group_id,team_a_id,team_b_id,matchday,round,bracket_pos,match_date,status,home_source_match_id,home_source_outcome,away_source_match_id,away_source_outcome')
    .eq('tournament_id', tournamentId)
    .order('round', { ascending: true })
    .order('bracket_pos', { ascending: true })
    .order('matchday', { ascending: true });

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
    stages: (stages ?? []).map((s, i) => ({
      name: s.name,
      kind: s.kind,
      ordering: s.ordering ?? i + 1,
      config: s.config ?? null,
      groups: s.kind === 'groups'
        ? (groupsByStageId.get(s.id) ?? []).map(g => ({ name: g.name }))
        : undefined,
    })),
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
            (td.groupsByStage as any)[String(sIdx)] = gIdx; // 🔐 string key
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

  // Rebuild draftMatches[] from matches (including source *_idx)
  const draftMatches: DraftMatchServer[] = (matches ?? []).map(m => {
    const sIdx = m.stage_id ? stageIndexById.get(m.stage_id) ?? 0 : 0;
    let groupIdx: number | null = null;
    if (m.group_id && m.stage_id) {
      const arr = groupsByStageId.get(m.stage_id) ?? [];
      const idx = arr.findIndex(g => g.id === m.group_id);
      groupIdx = idx >= 0 ? idx : null;
    }
    return {
      stageIdx: sIdx,
      groupIdx,
      round: m.round ?? null,
      bracket_pos: m.bracket_pos ?? null,
      matchday: m.matchday ?? null,
      team_a_id: m.team_a_id ?? null,
      team_b_id: m.team_b_id ?? null,
      home_source_match_idx: m.home_source_match_id != null ? (indexById.get(m.home_source_match_id) ?? null) : null,
      away_source_match_idx: m.away_source_match_id != null ? (indexById.get(m.away_source_match_id) ?? null) : null,
      home_source_outcome: (m as any).home_source_outcome ?? null,
      away_source_outcome: (m as any).away_source_outcome ?? null,
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
   UPDATE (replace children)
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
      const gIdx = t.groupsByStage?.[String(sIdx)]; // 🔐 string key
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

  // Matches — insert, then link sources
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
      status: 'scheduled',
      match_date: m.match_date ? new Date(m.match_date).toISOString() : null,
      home_source_match_id: null,
      home_source_outcome: null,
      away_source_match_id: null,
      away_source_outcome: null,
    }));

    // NOTE: no .throwOnError() here since we read error.message below
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
        }
        if (m.away_source_match_idx != null) {
          const sid = idByIdx[m.away_source_match_idx];
          if (Number.isFinite(sid)) {
            upd.away_source_match_id = sid;
            upd.away_source_outcome = m.away_source_outcome ?? 'W';
          }
        }
        return (upd.home_source_match_id || upd.away_source_match_id) ? upd : null;
      })
      .filter(Boolean) as Array<{
        id: number;
        home_source_match_id?: number;
        home_source_outcome?: 'W' | 'L';
        away_source_match_id?: number;
        away_source_outcome?: 'W' | 'L';
      }>;

    for (const u of linkUpdates) {
      const { error } = await supabaseAdmin
        .from('matches')
        .update({
          home_source_match_id: u.home_source_match_id ?? null,
          home_source_outcome: u.home_source_outcome ?? null,
          away_source_match_id: u.away_source_match_id ?? null,
          away_source_outcome: u.away_source_outcome ?? null,
        })
        .eq('id', u.id);
      if (error) return { ok: false, error: error.message };
    }
  }

  revalidatePath('/tournoua');
  redirect(`/tournoua/${payload.tournament.slug ?? existing.slug ?? ''}`);
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
  }

  const delStages = await supabaseAdmin.from('tournament_stages').delete().eq('tournament_id', tournamentId);
  if (delStages.error) return { ok: false, error: delStages.error.message };

  const delTournament = await supabaseAdmin.from('tournaments').delete().eq('id', tournamentId);
  if (delTournament.error) return { ok: false, error: delTournament.error.message };

  revalidatePath('/tournoua');
  return { ok: true };
}
