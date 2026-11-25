// src/app/lib/awardForfeitWin.ts
// The 3-0 forfeit award, shared by the dashboard's match panel (admin-only
// action) and the match page (admins + editors). Callers check the role and
// pass their cookie-bound client; RLS (matches_update_editor) applies to the
// match update, progression runs with the service key.
//
// Plain module on purpose — no "use server": every export of a "use server"
// file becomes a public endpoint, and this one has no role check of its own.
import type { createSupabaseRouteClient } from '@/app/lib/supabase/supabaseServer';
import { progressAfterMatch } from '@/app/dashboard/tournaments/TournamentCURD/progression';
import { revalidateMatchSurfaces } from '@/app/lib/revalidatePublicPages';
import { refreshActiveSeasonStandings } from '@/app/lib/refreshStandings';

type Supa = Awaited<ReturnType<typeof createSupabaseRouteClient>>;

export type AwardForfeitResult =
  | { success: true; team_a_score: number; team_b_score: number }
  | { success: false; error: string };

/**
 * Award a 3-0 forfeit win to a team (for matches that weren't played).
 * Sets the match as finished with 3-0 score and triggers progression.
 */
export async function awardForfeitWin(
  supabase: Supa,
  matchId: number,
  winningTeam: 'A' | 'B',
  source: string
): Promise<AwardForfeitResult> {
  // 1. Get match info
  const { data: match, error: matchErr } = await supabase
    .from('matches')
    .select('id, team_a_id, team_b_id, status, tournament_id')
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
      penalty_a: null,
      penalty_b: null,
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

  // 5. Public pages must show the forfeit result immediately.
  await refreshActiveSeasonStandings(source);
  revalidateMatchSurfaces({
    id: matchId,
    tournament_id: match.tournament_id ?? null,
    team_a_id: match.team_a_id ?? null,
    team_b_id: match.team_b_id ?? null,
  });

  return { success: true, team_a_score, team_b_score };
}
