'use server';

import { createSupabaseRouteClient } from '@/app/lib/supabase/supabaseServer';
import { progressAfterMatch, recomputeStandingsNow } from '../../progression';

type PlayerStatInput = {
  player_id: number;
  team_id: number;
  played: boolean;
  position: string;
  is_captain: boolean;
  gk: boolean;
  goals: number;
  assists: number;
  own_goals: number;
  yellow_cards: number;
  red_cards: number;
  blue_cards: number;
};

type SaveMatchStatsInput = {
  matchId: number;
  teamAStats: PlayerStatInput[];
  teamBStats: PlayerStatInput[];
  mvpPlayerId: number | null;
  bestGkPlayerId: number | null;
  matchData: {
    match_date: string | null;
    field: string | null;
    venue: string | null;
  };
  manualStatus?: 'scheduled' | 'finished'; // Optional manual override
};

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
  return supabase;
}

/**
 * Revert a finished match back to scheduled status.
 * Deletes all player stats, participants, and recalculates standings.
 */
export async function revertMatchToScheduledAction(matchId: number) {
  try {
    const supabase = await assertAdmin();

    // 1. Get match info to know which stage to recalculate
    const { data: match, error: matchErr } = await supabase
      .from('matches')
      .select('id, stage_id, status')
      .eq('id', matchId)
      .single();

    if (matchErr || !match) {
      return { success: false, error: 'Match not found' };
    }

    // 2. Delete player stats
    const { error: statsErr } = await supabase
      .from('match_player_stats')
      .delete()
      .eq('match_id', matchId);

    if (statsErr) {
      console.error('Failed to delete player stats:', statsErr);
      return { success: false, error: 'Failed to delete player stats' };
    }

    // 3. Delete participants
    const { error: participantsErr } = await supabase
      .from('match_participants')
      .delete()
      .eq('match_id', matchId);

    if (participantsErr) {
      console.error('Failed to delete participants:', participantsErr);
      return { success: false, error: 'Failed to delete participants' };
    }

    // 4. Reset match to scheduled
    const { error: updateErr } = await supabase
      .from('matches')
      .update({
        team_a_score: null,
        team_b_score: null,
        winner_team_id: null,
        status: 'scheduled',
      })
      .eq('id', matchId);

    if (updateErr) {
      console.error('Failed to update match:', updateErr);
      return { success: false, error: 'Failed to update match' };
    }

    // 5. Recalculate standings for the stage (if it's a league/groups stage)
    if (match.stage_id) {
      try {
        await recomputeStandingsNow(match.stage_id);
      } catch (err) {
        console.error('Failed to recalculate standings:', err);
        // Don't fail the entire operation if standings recalc fails
      }
    }

    return { success: true };

  } catch (error) {
    console.error('revertMatchToScheduledAction error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Award a 3-0 forfeit win to a team (for matches that weren't played).
 * Sets the match as finished with 3-0 score and triggers progression.
 */
export async function awardForfeitWinAction(matchId: number, winningTeam: 'A' | 'B') {
  try {
    const supabase = await assertAdmin();

    // 1. Get match info
    const { data: match, error: matchErr } = await supabase
      .from('matches')
      .select('id, team_a_id, team_b_id, status')
      .eq('id', matchId)
      .single();

    if (matchErr || !match) {
      return { success: false, error: 'Match not found' };
    }

    if (!match.team_a_id || !match.team_b_id) {
      return { success: false, error: 'Both teams must be assigned' };
    }

    // 2. Set 3-0 scores based on winning team
    const team_a_score = winningTeam === 'A' ? 3 : 0;
    const team_b_score = winningTeam === 'B' ? 3 : 0;
    const winner_team_id = winningTeam === 'A' ? match.team_a_id : match.team_b_id;

    // 3. Update match to finished with 3-0 score
    const { error: updateErr } = await supabase
      .from('matches')
      .update({
        team_a_score,
        team_b_score,
        winner_team_id,
        status: 'finished',
      })
      .eq('id', matchId);

    if (updateErr) {
      console.error('Failed to update match:', updateErr);
      return { success: false, error: 'Failed to update match' };
    }

    // 4. Trigger progression
    try {
      await progressAfterMatch(matchId);
    } catch (progError) {
      console.error('Progression error (non-fatal):', progError);
      // Don't fail the save if progression fails
    }

    return { success: true, team_a_score, team_b_score };

  } catch (error) {
    console.error('awardForfeitWinAction error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function saveMatchStatsAction(input: SaveMatchStatsInput) {
  try {
    const supabase = await assertAdmin();
    const { matchId, teamAStats, teamBStats, mvpPlayerId, bestGkPlayerId, matchData, manualStatus } = input;

    if (!matchId || matchId <= 0) {
      return { success: false, error: 'Invalid match ID' };
    }

    // Combine all stats
    const allStats = [...teamAStats, ...teamBStats];
    const participatedPlayers = allStats.filter(s => s.played);

    // 1. Save participation (match_participants)
    const participantRows = participatedPlayers.map(s => ({
      match_id: matchId,
      team_id: s.team_id,
      player_id: s.player_id,
      played: true,
    }));

    if (participantRows.length > 0) {
      const { error: partError } = await supabase
        .from('match_participants')
        .upsert(participantRows, { onConflict: 'match_id,player_id' });

      if (partError) {
        console.error('Error saving participants:', partError);
        return { success: false, error: 'Failed to save participants' };
      }
    }

    // Delete participants who are no longer playing
    const participatedIds = participatedPlayers.map(p => p.player_id);
    if (participatedIds.length > 0) {
      const { error: delError } = await supabase
        .from('match_participants')
        .delete()
        .eq('match_id', matchId)
        .not('player_id', 'in', `(${participatedIds.join(',')})`);

      if (delError) {
        console.error('Error deleting old participants:', delError);
      }
    }

    // 2. Save player stats (match_player_stats) - WITHOUT awards (will be set atomically)
    const statRows = participatedPlayers.map(s => ({
      match_id: matchId,
      team_id: s.team_id,
      player_id: s.player_id,
      goals: s.goals,
      assists: s.assists,
      own_goals: s.own_goals,
      yellow_cards: s.yellow_cards,
      red_cards: s.red_cards,
      blue_cards: s.blue_cards,
      position: s.position || null,
      is_captain: s.is_captain,
      gk: s.gk,
      mvp: false, // Will be set atomically via RPC
      best_goalkeeper: false, // Will be set atomically via RPC
    }));

    if (statRows.length > 0) {
      const { error: statsError } = await supabase
        .from('match_player_stats')
        .upsert(statRows, { onConflict: 'match_id,player_id' });

      if (statsError) {
        console.error('Error saving stats:', statsError);
        return { success: false, error: 'Failed to save player stats' };
      }
    }

    // Delete stats for players no longer participating
    if (participatedIds.length > 0) {
      const { error: delStatsError } = await supabase
        .from('match_player_stats')
        .delete()
        .eq('match_id', matchId)
        .not('player_id', 'in', `(${participatedIds.join(',')})`);

      if (delStatsError) {
        console.error('Error deleting old stats:', delStatsError);
      }
    }

    // 3. Atomic award update via RPC
    const { error: rpcError } = await supabase.rpc('update_match_awards', {
      p_match_id: matchId,
      p_mvp_player_id: mvpPlayerId || null,
      p_best_gk_player_id: bestGkPlayerId || null,
    });

    if (rpcError) {
      console.error('Error updating awards:', rpcError);
      return { success: false, error: 'Failed to update awards' };
    }

    // 4. Calculate scores with own goals logic
    const { data: match } = await supabase
      .from('matches')
      .select('team_a_id, team_b_id')
      .eq('id', matchId)
      .single();

    if (!match) {
      return { success: false, error: 'Match not found' };
    }

    const teamAId = Number(match.team_a_id);
    const teamBId = Number(match.team_b_id);

    let aGoals = 0;
    let bGoals = 0;

    for (const stat of allStats.filter(s => s.played)) {
      if (stat.team_id === teamAId) {
        aGoals += stat.goals;
        bGoals += stat.own_goals; // Team A's own goals count for Team B
      } else if (stat.team_id === teamBId) {
        bGoals += stat.goals;
        aGoals += stat.own_goals; // Team B's own goals count for Team A
      }
    }

    // Determine status and winner
    // Use manual status if provided, otherwise auto-determine from participants
    const hasParticipants = participatedPlayers.length > 0;
    const autoStatus = hasParticipants ? 'finished' : 'scheduled';
    const status = manualStatus ?? autoStatus;
    const winner_team_id =
      aGoals > bGoals ? teamAId :
      bGoals > aGoals ? teamBId :
      null; // Draw

    // 5. Update match (scores, status, winner, metadata)
    const { error: matchError } = await supabase
      .from('matches')
      .update({
        team_a_score: aGoals,
        team_b_score: bGoals,
        winner_team_id,
        status: status as 'scheduled' | 'finished',
        match_date: matchData.match_date,
        field: matchData.field,
        // Note: 'venue' is not in the matches table based on the schema you showed
      })
      .eq('id', matchId);

    if (matchError) {
      console.error('Error updating match:', matchError);
      return { success: false, error: 'Failed to update match' };
    }

    // 6. Trigger progression if match is finished
    if (status === 'finished') {
      try {
        await progressAfterMatch(matchId);
      } catch (progError) {
        console.error('Progression error (non-fatal):', progError);
        // Don't fail the save if progression fails
      }
    }

    return { success: true };

  } catch (error) {
    console.error('saveMatchStatsAction error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
