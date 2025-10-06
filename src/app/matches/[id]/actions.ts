// src/app/matches/[id]/actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseRouteClient } from '@/app/lib/supabase/supabaseServer';
import { progressAfterMatch } from '@/app/dashboard/tournaments/TournamentCURD/progression';

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
 *  Save per-player stats + participation + auto-finalize + progression
 *  ------------------------------- */
export async function saveAllStatsAction(formData: FormData) {
  const supabase = await assertAdmin();

  const match_id = Number(formData.get('match_id'));
  if (!Number.isFinite(match_id)) throw new Error('Bad match id');

  /** Match-level: Διαιτητής (referee) */
  const rawRef = (formData.get('referee') as string | null) ?? null;
  const referee = rawRef ? rawRef.trim() : null;
  // Update match-level referee (nullable)
  await supabase
    .from('matches')
    .update({ referee: referee && referee.length ? referee : null })
    .eq('id', match_id);

  /** Stats row (now includes position/is_captain/gk) */
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
    position?: string | null;
    is_captain?: boolean;
    gk?: boolean;
    _delete?: boolean;
  };

  /** Participation row (slim: attendance only) */
  type ParticipantFormRow = {
    match_id: number;
    team_id: number;
    player_id: number;
    played: boolean; // Συμμετοχή
  };

  const statsRows = new Map<string, Row>();
  const partRows = new Map<string, ParticipantFormRow>();

  // players[...] regex (stats) — captures position/is_captain/gk too
  const statsRe =
    /^players\[(\d+)\]\[(\d+)\]\[(team_id|player_id|goals|assists|yellow_cards|red_cards|blue_cards|position|is_captain|gk|_delete)\]$/;

  // participants[...] regex (participation) — attendance only
  const partRe = /^participants\[(\d+)\]\[(\d+)\]\[(played)\]$/;

  // Parse entire form once
  for (const [k, v] of formData.entries()) {
    // --- stats bucket ---
    {
      const m = statsRe.exec(k);
      if (m) {
        const [_, t, p, f] = m;
        const teamId = Number(t);
        const playerId = Number(p);
        const field = f as keyof Row;
        const key = `${teamId}:${playerId}`;

        if (!statsRows.has(key)) {
          statsRows.set(key, {
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

        const row = statsRows.get(key)!;
        const val = typeof v === 'string' ? v : (v as File).name;

        if (field === '_delete') {
          (row as any)._delete = val === 'true' || val === 'on' || val === '1';
        } else if (field === 'team_id' || field === 'player_id') {
          // captured by key; ignore
        } else if (field === 'is_captain' || field === 'gk') {
          (row as any)[field] = val === 'true' || val === 'on' || val === '1';
        } else if (field === 'position') {
          const tpos = (val ?? '').trim();
          (row as any).position = tpos && tpos.toUpperCase() !== 'TBD' ? tpos : null;
        } else {
          const n = Number(val);
          (row as any)[field] = Number.isFinite(n) ? Math.max(0, n) : 0;
        }
        continue;
      }
    }

    // --- participation bucket (attendance only) ---
    {
      const m = partRe.exec(k);
      if (m) {
        const [_, t, p, f] = m;
        const teamId = Number(t);
        const playerId = Number(p);
        const field = f as keyof ParticipantFormRow;
        const key = `${teamId}:${playerId}`;

        if (!partRows.has(key)) {
          partRows.set(key, {
            match_id,
            team_id: teamId,
            player_id: playerId,
            played: false,
          });
        }

        const row = partRows.get(key)!;
        const raw = typeof v === 'string' ? v : (v as File).name;

        if (field === 'played') {
          row.played = raw === 'true' || raw === 'on' || raw === '1';
        }
        continue;
      }
    }
  }

  // Awards (1 per match) — radios (apply ONLY to participants later)
  const mvpPlayerId = Number(formData.get('mvp_player_id') ?? 0) || 0;
  const bestGkPlayerId = Number(formData.get('best_gk_player_id') ?? 0) || 0;

  // -----------------------
  // Persist participation
  // -----------------------
  const toUpsertParticipants = [...partRows.values()].filter((r) => r.played);
  const toDeleteParticipants = [...partRows.values()]
    .filter((r) => !r.played)
    .map((r) => r.player_id);

  if (toUpsertParticipants.length) {
    // Strip UI-only 'played' before upsert
    const clean = toUpsertParticipants.map(({ played, ...r }) => r);
    const { error } = await supabase
      .from('match_participants')
      .upsert(clean, { onConflict: 'match_id,player_id' });
    if (error) throw error;
  }

  if (toDeleteParticipants.length) {
    const { error } = await supabase
      .from('match_participants')
      .delete()
      .eq('match_id', match_id)
      .in('player_id', toDeleteParticipants);
    if (error) throw error;
  }

  // -----------------------
  // Guard stats by participation (+ apply awards only to participants)
  // -----------------------
  const participatedIds = new Set<number>(toUpsertParticipants.map((r) => r.player_id));
  const statUpserts: Row[] = [];
  const statDeletes: number[] = [];

  for (const r of statsRows.values()) {
    const markedDelete = (r as any)._delete;
    const isParticipant = participatedIds.has(r.player_id);

    if (markedDelete || !isParticipant) {
      statDeletes.push(r.player_id);
    } else {
      const { _delete, ...clean } = r as any;

      // Apply awards now, only if participant
      if (mvpPlayerId && clean.player_id === mvpPlayerId) {
        clean.mvp = true;
      }
      if (bestGkPlayerId && clean.player_id === bestGkPlayerId) {
        clean.best_goalkeeper = true;
      }

      statUpserts.push(clean as Row);
    }
  }

  if (statDeletes.length) {
    const { error } = await supabase
      .from('match_player_stats')
      .delete()
      .eq('match_id', match_id)
      .in('player_id', statDeletes);
    if (error) throw error;
  }

  if (statUpserts.length) {
    const { error } = await supabase
      .from('match_player_stats')
      .upsert(statUpserts, { onConflict: 'match_id,player_id' });
    if (error) throw error;
  }

  // --- Auto-finalize from the just-saved stats ---
  const { data: mt, error: mErr } = await supabase
    .from('matches')
    .select('team_a_id, team_b_id')
    .eq('id', match_id)
    .single();
  if (mErr || !mt) throw new Error('Match not found');

  // recompute from DB to reflect the upserts/deletes
  const { data: agg, error: aggErr } = await supabase
    .from('match_player_stats')
    .select('team_id, goals')
    .eq('match_id', match_id);
  if (aggErr) throw aggErr;

  const sum = new Map<number, number>();
  for (const r of agg ?? []) {
    const tid = Number(r.team_id);
    const g = Number(r.goals) || 0;
    sum.set(tid, (sum.get(tid) ?? 0) + g);
  }
  const aGoals = sum.get(Number(mt.team_a_id)) ?? 0;
  const bGoals = sum.get(Number(mt.team_b_id)) ?? 0;

  const isTie = aGoals === bGoals;
  const winner_team_id = isTie
    ? null
    : (aGoals > bGoals ? Number(mt.team_a_id) : Number(mt.team_b_id));

  // Save scores; finish only if not a tie
  const { error: upErr } = await supabase
    .from('matches')
    .update({
      team_a_score: aGoals,
      team_b_score: bGoals,
      winner_team_id,
      status: isTie ? 'scheduled' : 'finished',
    })
    .eq('id', match_id);
  if (upErr) throw upErr;

  // Run progression only when finished (non-tie)
  if (!isTie) {
    await progressAfterMatch(match_id).catch(console.error);
  }

  revalidatePath(`/matches/${match_id}`);
}

/** -------------------------------
 *  Helpers for result actions (kept for compatibility)
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
 *  Action: Recalc scores from stats (optional)
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
 *  Action: Finalize match (compute + set winner) (optional)
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

  // If you trigger tournament progression here instead of Save All:
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
