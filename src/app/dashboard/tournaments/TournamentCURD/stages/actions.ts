'use server';

import { createSupabaseRouteClient } from '@/app/lib/supabase/supabaseServer';
import { recomputeStandingsNow } from '../progression';

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
  return { supabase, user };
}

type PointAdjustmentInput = {
  stageId: number;
  groupId: number | null;
  teamId: number;
  pointsAdjustment: number; // Positive to add, negative to deduct
  reason: string;
};

/**
 * Apply a point adjustment (deduction or addition) to a team in a specific stage.
 * This creates an audit trail in disciplinary_actions and updates stage_standings.
 */
export async function applyPointAdjustmentAction(input: PointAdjustmentInput) {
  try {
    const { supabase, user } = await assertAdmin();
    const { stageId, groupId, teamId, pointsAdjustment, reason } = input;

    if (!stageId || !teamId) {
      return { success: false, error: 'Stage ID and Team ID are required' };
    }

    if (pointsAdjustment === 0) {
      return { success: false, error: 'Point adjustment cannot be zero' };
    }

    if (!reason || reason.trim().length === 0) {
      return { success: false, error: 'Reason is required for point adjustments' };
    }

    // 1. Get tournament_id for audit trail
    const { data: stage, error: stageError } = await supabase
      .from('tournament_stages')
      .select('tournament_id')
      .eq('id', stageId)
      .single();

    if (stageError || !stage) {
      return { success: false, error: 'Stage not found' };
    }

    // 2. Get current standings for this team
    const { data: currentStanding, error: standingError } = await supabase
      .from('stage_standings')
      .select('*')
      .eq('stage_id', stageId)
      .eq('team_id', teamId)
      .eq('group_id', groupId ?? 0)
      .single();

    if (standingError || !currentStanding) {
      return { success: false, error: 'Team not found in stage standings' };
    }

    // 3. Calculate new points
    const currentPoints = currentStanding.points || 0;
    const newPoints = Math.max(0, currentPoints + pointsAdjustment); // Don't allow negative points

    // 4. Update stage_standings
    const { error: updateError } = await supabase
      .from('stage_standings')
      .update({ points: newPoints })
      .eq('stage_id', stageId)
      .eq('team_id', teamId)
      .eq('group_id', groupId ?? 0);

    if (updateError) {
      console.error('Failed to update standings:', updateError);
      return { success: false, error: 'Failed to update standings' };
    }

    // 5. Create audit trail in disciplinary_actions
    const { error: auditError } = await supabase
      .from('disciplinary_actions')
      .insert({
        tournament_id: stage.tournament_id,
        stage_id: stageId,
        team_id: teamId,
        group_id: groupId,
        points_adjustment: pointsAdjustment,
        reason: reason.trim(),
        applied_by: user.id,
        applied_at: new Date().toISOString(),
      });

    if (auditError) {
      console.error('Failed to create audit trail:', auditError);
      // Don't fail the operation if audit trail fails, but log it
    }

    // 6. Recalculate rankings for the stage
    try {
      await recomputeStandingsNow(stageId);
    } catch (err) {
      console.error('Failed to recalculate standings:', err);
      // Don't fail the entire operation if standings recalc fails
    }

    return {
      success: true,
      previousPoints: currentPoints,
      newPoints,
      adjustment: pointsAdjustment
    };

  } catch (error) {
    console.error('applyPointAdjustmentAction error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get disciplinary action history for a team in a tournament
 */
export async function getDisciplinaryHistoryAction(teamId: number, tournamentId: number) {
  try {
    const { supabase } = await assertAdmin();

    const { data, error } = await supabase
      .from('disciplinary_actions')
      .select(`
        *,
        tournament_stages!inner(name),
        tournament_teams!inner(
          team:teams(name, logo)
        )
      `)
      .eq('team_id', teamId)
      .eq('tournament_id', tournamentId)
      .order('applied_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch disciplinary history:', error);
      return { success: false, error: 'Failed to fetch history' };
    }

    return { success: true, data };

  } catch (error) {
    console.error('getDisciplinaryHistoryAction error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
