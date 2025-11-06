// app/dashboard/tournaments/TournamentCURD/submit/actions/updateMatchAction.ts
"use server";

import { createSupabaseRouteClient } from "@/app/lib/supabase/supabaseServer";
import { progressAfterMatch } from "@/app/dashboard/tournaments/TournamentCURD/progression";

export interface MatchUpdatePayload {
  matchId: number;
  status?: "scheduled" | "finished";
  team_a_score?: number | null;
  team_b_score?: number | null;
  winner_team_id?: number | null;
  field?: string | null;
  team_a_id?: number | null;
  team_b_id?: number | null;
  match_date?: string | null;
}

/**
 * Server action to update match from InlineMatchPlanner
 * Handles validation, updates the database, and triggers progression if needed
 */
export async function updateMatchFromPlanner(payload: MatchUpdatePayload) {
  try {
    const supabase = await createSupabaseRouteClient();
    
    // Check auth & admin role
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return { success: false, error: "Unauthorized" };
    }
    
    const roles = Array.isArray(user.app_metadata?.roles) 
      ? user.app_metadata.roles 
      : [];
    if (!roles.includes("admin")) {
      return { success: false, error: "Forbidden: Admin role required" };
    }

    const { matchId, ...updateData } = payload;

    // Load current match data
    const { data: currentMatch, error: fetchErr } = await supabase
      .from("matches")
      .select("*, tournament_stages!matches_stage_id_fkey(kind)")
      .eq("id", matchId)
      .single();

    if (fetchErr || !currentMatch) {
      return { success: false, error: "Match not found" };
    }

    const stageKind = currentMatch.tournament_stages?.kind;
    const wasFinished = currentMatch.status === "finished";
    const willBeFinished = updateData.status === "finished";

    // Validate finished state requirements
    if (willBeFinished && !wasFinished) {
      // Check required fields for finishing
      const teamA = updateData.team_a_id ?? currentMatch.team_a_id;
      const teamB = updateData.team_b_id ?? currentMatch.team_b_id;
      const scoreA = updateData.team_a_score ?? currentMatch.team_a_score;
      const scoreB = updateData.team_b_score ?? currentMatch.team_b_score;
      
      if (!teamA || !teamB) {
        return { success: false, error: "Both teams must be set to finish a match" };
      }
      
      if (scoreA == null || scoreB == null) {
        return { success: false, error: "Scores are required when finishing a match" };
      }

      // Handle winner logic based on stage kind
      if (stageKind === "knockout") {
        if (scoreA === scoreB) {
          return { success: false, error: "Knockout matches cannot end in a draw" };
        }
        // Auto-set winner if not provided
        if (!updateData.winner_team_id) {
          updateData.winner_team_id = scoreA > scoreB ? teamA : teamB;
        }
      } else {
        // Groups/league: allow draws
        if (scoreA === scoreB) {
          updateData.winner_team_id = null; // Draw
        } else if (!updateData.winner_team_id) {
          updateData.winner_team_id = scoreA > scoreB ? teamA : teamB;
        }
      }
    }

    // Prevent reverting finished to scheduled
    if (wasFinished && updateData.status === "scheduled") {
      return { success: false, error: "Cannot revert a finished match to scheduled" };
    }

    // Clear scores/winner when scheduling
    if (updateData.status === "scheduled") {
      updateData.team_a_score = null;
      updateData.team_b_score = null;
      updateData.winner_team_id = null;
    }

    // Update the match
    const { error: updateErr } = await supabase
      .from("matches")
      .update(updateData)
      .eq("id", matchId);

    if (updateErr) {
      console.error("Match update error:", updateErr);
      return { success: false, error: updateErr.message };
    }

    // Trigger progression if match was just finished
    if (willBeFinished && !wasFinished) {
      try {
        await progressAfterMatch(matchId);
      } catch (progErr) {
        // Log but don't fail the update
        console.error("Progression failed for match", matchId, progErr);
      }
    }

    return { success: true };
  } catch (error: any) {
    console.error("updateMatchFromPlanner error:", error);
    return { success: false, error: error.message || "Server error" };
  }
}

/**
 * Batch update multiple matches (optional utility)
 */
export async function batchUpdateMatches(updates: MatchUpdatePayload[]) {
  const results = await Promise.all(
    updates.map(update => updateMatchFromPlanner(update))
  );
  
  const succeeded = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success);
  
  return {
    success: failed.length === 0,
    succeeded,
    failed: failed.length,
    errors: failed.map((r, i) => ({ 
      matchId: updates[i].matchId, 
      error: r.error 
    }))
  };
}