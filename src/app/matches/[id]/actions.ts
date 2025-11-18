// src/app/matches/[id]/actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
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

  /** Stats row - ✅ UPDATED: now includes own_goals */
  type Row = {
    match_id: number;
    team_id: number;
    player_id: number;
    goals: number;
    assists: number;
    own_goals: number; // ✅ ADDED
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

  // ✅ UPDATED: regex now captures own_goals too
  const statsRe =
    /^players\[(\d+)\]\[(\d+)\]\[(team_id|player_id|goals|assists|own_goals|yellow_cards|red_cards|blue_cards|position|is_captain|gk|_delete)\]$/;

  // participants[...] regex (participation) – attendance only
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
            own_goals: 0, // ✅ ADDED
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

  // Awards (1 per match) – radios (will be set via RPC)
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
  // Guard stats by participation (NO awards applied here - will use RPC)
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

      // ✅ CRITICAL: Awards are NOT set here - they will be set atomically via RPC
      // Always set to false during upsert to avoid constraint violations
      clean.mvp = false;
      clean.best_goalkeeper = false;

      statUpserts.push(clean as Row);
    }
  }

  // Delete removed player stats
  if (statDeletes.length) {
    const { error } = await supabase
      .from('match_player_stats')
      .delete()
      .eq('match_id', match_id)
      .in('player_id', statDeletes);
    if (error) throw error;
  }

  // Upsert all stats (without awards)
  if (statUpserts.length) {
    const { error } = await supabase
      .from('match_player_stats')
      .upsert(statUpserts, { onConflict: 'match_id,player_id' });
    if (error) throw error;
  }

  // ✅ ATOMIC AWARD UPDATE via Database Function
  // This is 100% safe - clears all awards first, then sets new ones in a single transaction
  const { error: rpcError } = await supabase.rpc('update_match_awards', {
    p_match_id: match_id,
    p_mvp_player_id: mvpPlayerId || null,
    p_best_gk_player_id: bestGkPlayerId || null
  });

  if (rpcError) {
    console.error('Error updating match awards:', rpcError);
    throw rpcError;
  }

  // --- Auto-finalize from the just-saved stats ---
  const { data: mt, error: mErr } = await supabase
    .from('matches')
    .select('team_a_id, team_b_id')
    .eq('id', match_id)
    .single();
  if (mErr || !mt) throw new Error('Match not found');

  // ✅ UPDATED: recompute from DB including own_goals
  const { data: agg, error: aggErr } = await supabase
    .from('match_player_stats')
    .select('team_id, goals, own_goals') // ✅ ADDED own_goals
    .eq('match_id', match_id);
  if (aggErr) throw aggErr;

  // ✅ UPDATED: Calculate scores with own goals logic
  // Team A score = (goals by Team A) + (own goals by Team B)
  // Team B score = (goals by Team B) + (own goals by Team A)
  const teamAId = Number(mt.team_a_id);
  const teamBId = Number(mt.team_b_id);

  let aGoals = 0;
  let bGoals = 0;

  for (const r of agg ?? []) {
    const tid = Number(r.team_id);
    const g = Number(r.goals) || 0;
    const og = Number(r.own_goals) || 0;

    if (tid === teamAId) {
      aGoals += g;   // Team A's own goals count for Team A
      bGoals += og;  // Team A's own goals count for Team B
    } else if (tid === teamBId) {
      bGoals += g;   // Team B's own goals count for Team B
      aGoals += og;  // Team B's own goals count for Team A
    }
  }

  const isTie = aGoals === bGoals;
  const winner_team_id = isTie
    ? null
    : (aGoals > bGoals ? teamAId : teamBId);

  // Check if this is a KO match - ties are not allowed in knockout matches
  const { data: matchData, error: matchErr } = await supabase
    .from('matches')
    .select('is_ko')
    .eq('id', match_id)
    .single();

  if (matchErr) throw matchErr;

  if (matchData?.is_ko && isTie) {
    throw new Error('Knockout matches cannot end in a tie. A winner must be determined.');
  }

  // Save scores and mark as finished (ties are still finished matches for non-KO)
  const { error: upErr } = await supabase
    .from('matches')
    .update({
      team_a_score: aGoals,
      team_b_score: bGoals,
      winner_team_id,
      status: 'finished',
    })
    .eq('id', match_id);
  if (upErr) throw upErr;

  // Always run progression (handles KO and non-KO stages appropriately)
  // For non-KO rounds (groups/league), ties need progression to update standings
  // For KO rounds, progression logic internally handles ties (no winner to propagate)
  progressAfterMatch(match_id).catch(console.error);

  // Refresh page and show success flag
  revalidatePath(`/matches/${match_id}`);
  redirect(`/matches/${match_id}?saved=1`);
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

/** ✅ UPDATED: Compute goals with own goals logic */
async function computeGoalsByTeam(
  supabase: Awaited<ReturnType<typeof createSupabaseRouteClient>>,
  matchId: number,
  teamAId: number,
  teamBId: number
): Promise<{ aGoals: number; bGoals: number }> {
  // ✅ UPDATED: select own_goals too
  const { data, error } = await supabase
    .from('match_player_stats')
    .select('team_id, goals, own_goals')
    .eq('match_id', matchId);

  if (error) throw error;

  let aGoals = 0;
  let bGoals = 0;

  // ✅ UPDATED: Apply own goals logic
  for (const row of data ?? []) {
    const tid = Number(row.team_id);
    const g = Number(row.goals) || 0;
    const og = Number(row.own_goals) || 0;

    if (tid === teamAId) {
      aGoals += g;   // Team A's goals
      bGoals += og;  // Team A's own goals count for Team B
    } else if (tid === teamBId) {
      bGoals += g;   // Team B's goals
      aGoals += og;  // Team B's own goals count for Team A
    }
  }

  return { aGoals, bGoals };
}

/** -------------------------------
 *  Action: Recalc scores from stats (optional)
 *  ------------------------------- */
export async function recalcScoresFromStatsAction(formData: FormData) {
  const supabase = await assertAdmin();

  const matchId = Number(formData.get('match_id'));
  if (!Number.isFinite(matchId)) throw new Error('Bad match id');

  const { teamA, teamB } = await fetchMatchTeams(supabase, matchId);
  const { aGoals, bGoals } = await computeGoalsByTeam(supabase, matchId, teamA, teamB);

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
  const { aGoals, bGoals } = await computeGoalsByTeam(supabase, matchId, teamA, teamB);

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

/** --------------------------------
 *  NEW: update match video URL (CRUD)
 *  -------------------------------- */
export async function updateMatchVideoAction(formData: FormData) {
  const supabase = await assertAdmin();

  const matchId = Number(formData.get('match_id'));
  if (!Number.isFinite(matchId)) throw new Error('Bad match id');

  const raw = (formData.get('video_url') as string | null) ?? null;
  const value = raw && raw.trim().length ? raw.trim() : null; // empty => NULL (delete)

  const { error } = await supabase
    .from('matches')
    .update({ video_url: value })
    .eq('id', matchId);

  if (error) throw error;

  revalidatePath(`/matches/${matchId}`);
}
