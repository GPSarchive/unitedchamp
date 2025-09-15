'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseRouteClient } from '@/app/lib/supabaseServer';

/** =========================
 *  Admin guard (server-side)
 *  ========================= */
async function assertAdmin() {
  const supabase = await createSupabaseRouteClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error('Unauthorized');
  }
  const roles = Array.isArray(user.app_metadata?.roles)
    ? (user.app_metadata!.roles as string[])
    : [];
  if (!roles.includes('admin')) {
    throw new Error('Forbidden');
  }
  return supabase; // cookie-bound client; RLS applies
}

/** -------------------------------
 *  Existing: Save per-player stats
 *  ------------------------------- */
export async function saveAllStatsAction(formData: FormData) {
  const supabase = await assertAdmin();

  const match_id = Number(formData.get('match_id'));
  if (!Number.isFinite(match_id)) throw new Error('Bad match id');

  type Row = {
    match_id: number;
    team_id: number;
    player_id: number;
    goals: number;
    assists: number;
    yellow_cards: number;
    red_cards: number;
    blue_cards: number;
    mvp: boolean;
    best_goalkeeper: boolean;
    _delete?: boolean;
  };

  const rows = new Map<string, Row>();
  const entryRe =
    /^players\[(\d+)\]\[(\d+)\]\[(team_id|player_id|goals|assists|yellow_cards|red_cards|blue_cards|_delete)\]$/;

  for (const [k, v] of formData.entries()) {
    const m = entryRe.exec(k);
    if (!m) continue;
    const teamId = Number(m[1]);
    const playerId = Number(m[2]);
    const field = m[3] as keyof Row;
    const key = `${teamId}:${playerId}`;

    if (!rows.has(key)) {
      rows.set(key, {
        match_id,
        team_id: teamId,
        player_id: playerId,
        goals: 0,
        assists: 0,
        yellow_cards: 0,
        red_cards: 0,
        blue_cards: 0,
        mvp: false,
        best_goalkeeper: false,
      });
    }
    const row = rows.get(key)!;
    const val = typeof v === 'string' ? v : (v as File).name;

    if (field === '_delete') {
      row._delete = val === 'true' || val === 'on' || val === '1';
    } else if (field === 'team_id' || field === 'player_id') {
      // already captured by key
    } else {
      const n = Number(val);
      (row as any)[field] = Number.isFinite(n) ? Math.max(0, n) : 0;
    }
  }

  // MVP / Best GK are chosen via single-select radio; set the boolean on the chosen row
  const mvpPlayerId = Number(formData.get('mvp_player_id') ?? 0) || 0;
  const bestGkPlayerId = Number(formData.get('best_gk_player_id') ?? 0) || 0;

  const ensureRow = (playerId: number) => {
    if (!playerId) return;
    const key = [...rows.keys()].find((k) => k.endsWith(`:${playerId}`));
    if (!key) return;
    return rows.get(key)!;
  };

  const mvpRow = ensureRow(mvpPlayerId);
  if (mvpRow) mvpRow.mvp = true;

  const gkRow = ensureRow(bestGkPlayerId);
  if (gkRow) gkRow.best_goalkeeper = true;

  const toDelete: number[] = [];
  const toUpsert: Row[] = [];
  for (const r of rows.values()) {
    if (r._delete) toDelete.push(r.player_id);
    else toUpsert.push(r);
  }

  if (toDelete.length) {
    const { error } = await supabase
      .from('match_player_stats')
      .delete()
      .eq('match_id', match_id)
      .in('player_id', toDelete);
    if (error) throw error;
  }

  if (toUpsert.length) {
    const { error } = await supabase
      .from('match_player_stats')
      .upsert(toUpsert, { onConflict: 'match_id,player_id' });
    if (error) throw error;
  }

  revalidatePath(`/matches/${match_id}`);
}

/** -------------------------------
 *  Helpers for result actions
 *  ------------------------------- */
async function fetchMatchTeams(
  supabase: Awaited<ReturnType<typeof createSupabaseRouteClient>>,
  matchId: number
) {
  const { data, error } = await supabase
    .from('matches')
    .select('id, team_a_id, team_b_id')
    .eq('id', matchId)
    .single();
  if (error || !data) throw new Error('Match not found');
  return { teamA: Number(data.team_a_id), teamB: Number(data.team_b_id) };
}

async function computeGoalsByTeam(
  supabase: Awaited<ReturnType<typeof createSupabaseRouteClient>>,
  matchId: number
): Promise<Map<number, number>> {
  const { data, error } = await supabase
    .from('match_player_stats')
    .select('team_id, goals')
    .eq('match_id', matchId);

  if (error) throw error;

  const sum = new Map<number, number>();
  for (const row of data ?? []) {
    const tid = Number(row.team_id);
    const g = Number(row.goals) || 0;
    sum.set(tid, (sum.get(tid) ?? 0) + g);
  }
  return sum;
}

/** -------------------------------
 *  Action: Recalc scores from stats
 *  ------------------------------- */
export async function recalcScoresFromStatsAction(formData: FormData) {
  const supabase = await assertAdmin();

  const matchId = Number(formData.get('match_id'));
  if (!Number.isFinite(matchId)) throw new Error('Bad match id');

  const { teamA, teamB } = await fetchMatchTeams(supabase, matchId);
  const totals = await computeGoalsByTeam(supabase, matchId);
  const aGoals = totals.get(teamA) ?? 0;
  const bGoals = totals.get(teamB) ?? 0;

  const { error } = await supabase
    .from('matches')
    .update({
      team_a_score: aGoals,
      team_b_score: bGoals,
      // status/winner unchanged here
    })
    .eq('id', matchId);

  if (error) throw error;
  revalidatePath(`/matches/${matchId}`);
}

/** -------------------------------------------
 *  Action: Finalize match (compute + set winner)
 *  ------------------------------------------- */
export async function finalizeFromStatsAction(formData: FormData) {
  const supabase = await assertAdmin();

  const matchId = Number(formData.get('match_id'));
  if (!Number.isFinite(matchId)) throw new Error('Bad match id');

  const { teamA, teamB } = await fetchMatchTeams(supabase, matchId);
  const totals = await computeGoalsByTeam(supabase, matchId);
  const aGoals = totals.get(teamA) ?? 0;
  const bGoals = totals.get(teamB) ?? 0;

  if (aGoals === bGoals) {
    throw new Error('Cannot finalize: scores are equal. Resolve tie before finishing.');
  }

  const winner_team_id = aGoals > bGoals ? teamA : teamB;

  const { error } = await supabase
    .from('matches')
    .update({
      team_a_score: aGoals,
      team_b_score: bGoals,
      winner_team_id,
      status: 'finished',
    })
    .eq('id', matchId);

  if (error) throw error;

  // If you trigger tournament progression, do it here (still via cookie client if it writes rows).
  // await progressAfterMatch(matchId).catch(console.error);

  revalidatePath(`/matches/${matchId}`);
}

/** --------------------------------
 *  Action: Mark back to 'scheduled'
 *  -------------------------------- */
export async function markScheduledAction(formData: FormData) {
  const supabase = await assertAdmin();

  const matchId = Number(formData.get('match_id'));
  if (!Number.isFinite(matchId)) throw new Error('Bad match id');

  const { error } = await supabase
    .from('matches')
    .update({
      status: 'scheduled',
      winner_team_id: null,
      // If you prefer clearing the score, uncomment:
      // team_a_score: 0,
      // team_b_score: 0,
    })
    .eq('id', matchId);

  if (error) throw error;
  revalidatePath(`/matches/${matchId}`);
}
