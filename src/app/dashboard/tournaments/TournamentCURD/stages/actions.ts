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
    console.log('[DEBUG] applyPointAdjustmentAction called with:', input);

    const { supabase, user } = await assertAdmin();
    console.log('[DEBUG] Admin check passed, user:', user.id);

    const { stageId, groupId, teamId, pointsAdjustment, reason } = input;

    if (!stageId || !teamId) {
      console.error('[DEBUG] Missing stageId or teamId');
      return { success: false, error: 'Stage ID and Team ID are required' };
    }

    if (pointsAdjustment === 0) {
      console.error('[DEBUG] Point adjustment is zero');
      return { success: false, error: 'Point adjustment cannot be zero' };
    }

    if (!reason || reason.trim().length === 0) {
      console.error('[DEBUG] Reason is empty');
      return { success: false, error: 'Reason is required for point adjustments' };
    }

    // 1. Get tournament_id for audit trail
    console.log('[DEBUG] Fetching stage:', stageId);
    const { data: stage, error: stageError } = await supabase
      .from('tournament_stages')
      .select('tournament_id')
      .eq('id', stageId)
      .single();

    if (stageError || !stage) {
      console.error('[DEBUG] Stage not found:', stageError);
      return { success: false, error: 'Stage not found' };
    }
    console.log('[DEBUG] Stage found, tournament_id:', stage.tournament_id);

    // 2. Get current standings for this team (for reporting)
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

    const currentPoints = currentStanding.points || 0;

    // 3. Create audit trail in disciplinary_actions (this is the source of truth)
    // Normalize group_id: league stages (groupId=0) should be stored as NULL
    const normalizedGroupId = (groupId === null || groupId === 0) ? null : groupId;

    console.log('[DEBUG] Inserting into disciplinary_actions:', {
      tournament_id: stage.tournament_id,
      stage_id: stageId,
      team_id: teamId,
      group_id: normalizedGroupId,
      points_adjustment: pointsAdjustment,
      reason: reason.trim(),
      applied_by: user.id,
    });

    const { data: insertData, error: auditError } = await supabase
      .from('disciplinary_actions')
      .insert({
        tournament_id: stage.tournament_id,
        stage_id: stageId,
        team_id: teamId,
        group_id: normalizedGroupId,
        points_adjustment: pointsAdjustment,
        reason: reason.trim(),
        applied_by: user.id,
        applied_at: new Date().toISOString(),
      })
      .select();

    if (auditError) {
      console.error('[DEBUG] Failed to create audit trail:', auditError);
      return { success: false, error: `Failed to create audit trail: ${auditError.message}` };
    }
    console.log('[DEBUG] Audit trail created successfully:', insertData);

    // 4. Recalculate standings (this will apply all disciplinary actions)
    try {
      await recomputeStandingsNow(stageId);
    } catch (err) {
      console.error('Failed to recalculate standings:', err);
      // Don't fail the entire operation if standings recalc fails
    }

    // 5. Get new points after recalculation
    const { data: updatedStanding } = await supabase
      .from('stage_standings')
      .select('points')
      .eq('stage_id', stageId)
      .eq('team_id', teamId)
      .eq('group_id', groupId ?? 0)
      .single();

    const newPoints = updatedStanding?.points || currentPoints;

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
