// src/app/matches/[id]/actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import {
  revalidateMatchSurfaces,
  revalidateTournamentSurfaces,
  revalidatePlayerStatSurfaces,
} from '@/app/lib/revalidatePublicPages';
import { createSupabaseRouteClient } from '@/app/lib/supabase/supabaseServer';
import { canEditContent } from '@/app/lib/supabase/apiAuth';
import { progressAfterMatch } from '@/app/dashboard/tournaments/TournamentCURD/progression';
import {
  syncPlayerStatisticsForPlayers,
  refreshCareerStatsForPlayers,
  refreshTournamentStatsForPlayers,
} from '@/app/lib/refreshPlayerStats';
import { decideTwoLeggedTie, decideSingleLegKO } from '@/app/dashboard/tournaments/TournamentCURD/util/functions/twoLeggedTie';

/** =========================
 *  Content-editor guard (server-side)
 *  Admins and editors may both edit matches.
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
  if (!canEditContent(user)) {
    throw new Error('Forbidden');
  }
  return supabase; // cookie-bound client; RLS applies
}

/** -------------------------------
 *  Knockout score/winner resolution (single-leg + two-legged aware)
 *
 *  Computes the team scores from player stats upstream; this helper decides the
 *  winner and whether finishing is allowed, honouring two-legged ties:
 *   - Leg 1: any result allowed, no winner (the tie is decided after leg 2).
 *   - Leg 2 decider: winner from LEG WINS (then penalties). Pens are passed in
 *     and are required when leg wins are level (1–1 or both legs drawn).
 *   - Single-leg KO: winner from the score, or from the penalty shootout when
 *     the score is level (form pens, falling back to the stored row's pens).
 *  Returns the patch to apply to the match row (scores + winner) or throws.
 *  ------------------------------- */
async function resolveKoFinishPatch(
  supabase: Awaited<ReturnType<typeof createSupabaseRouteClient>>,
  opts: {
    matchId: number;
    teamAId: number;
    teamBId: number;
    aGoals: number;
    bGoals: number;
    penA: number | null;
    penB: number | null;
  }
): Promise<{ team_a_score: number; team_b_score: number; winner_team_id: number | null; penalty_a: number | null; penalty_b: number | null }> {
  const { matchId, teamAId, teamBId, aGoals, bGoals, penA, penB } = opts;

  const { data: m, error } = await supabase
    .from('matches')
    .select('is_ko, leg, tie_leg1_match_id, penalty_a, penalty_b')
    .eq('id', matchId)
    .single();
  if (error) throw error;

  const leg = (m?.leg ?? null) as number | null;
  const tieLeg1Id = (m?.tie_leg1_match_id ?? null) as number | null;
  const isKo = !!m?.is_ko;
  const isTie = aGoals === bGoals;

  // The stats form only submits pens when the penalty panel is rendered; fall
  // back to the pens already stored on the row so a plain stat re-save on a
  // pens-decided match keeps the shootout instead of erroring or wiping it.
  const effPenA = penA ?? ((m?.penalty_a ?? null) as number | null);
  const effPenB = penB ?? ((m?.penalty_b ?? null) as number | null);

  // Leg 1 of a two-legged tie: store scores, no winner, never reject a level leg.
  if (leg === 1) {
    return { team_a_score: aGoals, team_b_score: bGoals, winner_team_id: null, penalty_a: null, penalty_b: null };
  }

  // Leg 2 decider: winner from aggregate (then penalties).
  if (leg === 2 && tieLeg1Id != null) {
    const { data: leg1 } = await supabase
      .from('matches')
      .select('team_a_id, team_b_id, team_a_score, team_b_score, status')
      .eq('id', tieLeg1Id)
      .maybeSingle();

    if (!leg1 || leg1.team_a_score == null || leg1.team_b_score == null) {
      throw new Error('Finish leg 1 before finishing leg 2 of this tie.');
    }

    const res = decideTwoLeggedTie(
      { team_a_id: teamAId, team_b_id: teamBId, team_a_score: aGoals, team_b_score: bGoals, penalty_a: effPenA, penalty_b: effPenB },
      leg1 as any
    );
    if (res.kind === 'undecided') {
      throw new Error('Leg wins are level (1–1) — enter the penalty shootout result (and it cannot be level).');
    }
    if (res.kind !== 'decided') {
      throw new Error('Could not resolve the two-legged tie.');
    }
    // Persist pens only when they were the decider (leg wins level). When a team
    // advanced on leg wins, clear any stray penalty input.
    const decidedByPens = res.via === 'penalties';
    return {
      team_a_score: aGoals,
      team_b_score: bGoals,
      winner_team_id: res.winnerTeamId,
      penalty_a: decidedByPens ? effPenA : null,
      penalty_b: decidedByPens ? effPenB : null,
    };
  }

  // Single-leg KO (or leg-2 whose leg 1 was deleted): winner from the score,
  // or from the shootout when the score is level. Shared resolver — a drawn
  // single-leg KO with pens entered (4–4, pens 5–4) is a legal state and must
  // survive re-saves without wiping the stored shootout.
  if (isKo) {
    const res = decideSingleLegKO({
      team_a_id: teamAId,
      team_b_id: teamBId,
      team_a_score: aGoals,
      team_b_score: bGoals,
      penalty_a: effPenA,
      penalty_b: effPenB,
    });
    if (res.kind !== 'decided') {
      throw new Error(
        res.reason === 'level-pens'
          ? 'Penalty shootout cannot end level — enter a winner on penalties.'
          : 'Knockout matches cannot end in a tie — enter the penalty shootout result.'
      );
    }
    const decidedByPens = res.via === 'penalties';
    return {
      team_a_score: aGoals,
      team_b_score: bGoals,
      winner_team_id: res.winnerTeamId,
      penalty_a: decidedByPens ? effPenA : null,
      penalty_b: decidedByPens ? effPenB : null,
    };
  }
  return {
    team_a_score: aGoals,
    team_b_score: bGoals,
    winner_team_id: isTie ? null : aGoals > bGoals ? teamAId : teamBId,
    penalty_a: null,
    penalty_b: null,
  };
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

  /** Stats row - ✅ UPDATED: now includes own_goals and player_number */
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
    player_number?: number | null;
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

  // ✅ UPDATED: regex now captures own_goals and player_number too
  const statsRe =
    /^players\[(\d+)\]\[(\d+)\]\[(team_id|player_id|goals|assists|own_goals|yellow_cards|red_cards|blue_cards|position|is_captain|gk|player_number|_delete)\]$/;

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
            player_number: null,
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
        } else if (field === 'player_number') {
          const trimmed = (val ?? '').trim();
          const n = Number(trimmed);
          (row as any).player_number = trimmed && Number.isFinite(n) ? n : null;
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

  // ✅ VALIDATION: Check if any player is marked as played for both teams
  const playerTeamCount = new Map<number, number[]>();
  for (const p of toUpsertParticipants) {
    if (!playerTeamCount.has(p.player_id)) {
      playerTeamCount.set(p.player_id, []);
    }
    playerTeamCount.get(p.player_id)!.push(p.team_id);
  }

  const duplicatePlayers: Array<{playerId: number, teams: number[]}> = [];
  for (const [playerId, teams] of playerTeamCount.entries()) {
    if (teams.length > 1) {
      duplicatePlayers.push({ playerId, teams });
    }
  }

  if (duplicatePlayers.length > 0) {
    const errors = duplicatePlayers.map(({ playerId, teams }) =>
      `Player ID ${playerId} is marked as played for multiple teams (${teams.join(', ')})`
    ).join('; ');
    throw new Error(`Validation error: A player cannot participate for both teams in the same match. ${errors}`);
  }

  // -----------------------
  // Guard against silent stat loss (must run BEFORE any DB write)
  // -----------------------
  // A row carries real data if any tracked stat is non-zero or any descriptive
  // field is set. Empty rows (all zeros, no position/number/role) are safe to
  // drop silently — that's the normal "remove player" path.
  const hasMeaningfulStats = (r: Row): boolean =>
    (Number(r.goals) || 0) > 0 ||
    (Number(r.assists) || 0) > 0 ||
    (Number(r.own_goals) || 0) > 0 ||
    (Number(r.yellow_cards) || 0) > 0 ||
    (Number(r.red_cards) || 0) > 0 ||
    (Number(r.blue_cards) || 0) > 0 ||
    !!r.is_captain ||
    !!r.gk ||
    (r.position != null && String(r.position).trim() !== '') ||
    (r.player_number != null);

  // A player with stats entered but NOT marked "played" (and not explicitly
  // cleared) would otherwise be routed to delete and lost, while the action
  // still reports success. Reject up front — before participation or stats are
  // written — so the admin either ticks Συμμετοχή or clears the stats
  // deliberately, and we never leave a half-saved match.
  const participatedKeysForGuard = new Set<string>(
    toUpsertParticipants.map((r) => `${r.team_id}:${r.player_id}`)
  );
  const orphanedStats = [...statsRows.values()].filter(
    (r) =>
      !(r as any)._delete &&
      !participatedKeysForGuard.has(`${r.team_id}:${r.player_id}`) &&
      hasMeaningfulStats(r)
  );
  if (orphanedStats.length > 0) {
    const who = orphanedStats
      .map((r) => `player ${r.player_id} (team ${r.team_id})`)
      .join(', ');
    throw new Error(
      `Δεν αποθηκεύτηκαν στατιστικά: οι παρακάτω παίκτες έχουν στατιστικά αλλά ` +
        `δεν έχουν επισημανθεί ως «Συμμετοχή». Ενεργοποίησε τη Συμμετοχή τους ή ` +
        `μηδένισε τα στατιστικά και αποθήκευσε ξανά. (${who})`
    );
  }

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
  // Route stats by participation (NO awards applied here - will use RPC)
  // -----------------------
  // Tracks (team_id, player_id) pairs (computed above as participatedKeysForGuard)
  // so a player on Team B isn't saved when they only played for Team A. Rows that
  // aren't participants here are all-empty (meaningful-stat orphans were already
  // rejected up front), so routing them to delete is a safe clear.
  const statUpserts: Row[] = [];
  const statDeletes: number[] = [];

  for (const r of statsRows.values()) {
    const markedDelete = (r as any)._delete;
    const participantKey = `${r.team_id}:${r.player_id}`;
    const isParticipant = participatedKeysForGuard.has(participantKey);

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

  // ✅ ADDITIONAL VALIDATION: Check for duplicate player_ids in stats before upsert
  // This catches cases where form data has stats for same player on both teams
  if (statUpserts.length) {
    const playerIdCount = new Map<number, number>();
    for (const stat of statUpserts) {
      const count = playerIdCount.get(stat.player_id) || 0;
      playerIdCount.set(stat.player_id, count + 1);
    }
    const duplicateStats = Array.from(playerIdCount.entries())
      .filter(([_, count]) => count > 1)
      .map(([playerId, _]) => playerId);

    if (duplicateStats.length > 0) {
      throw new Error(
        `Database constraint error: Player(s) ${duplicateStats.join(', ')} have stats for both teams. ` +
        `This should have been caught earlier. Please ensure each player is only marked as played for ONE team.`
      );
    }

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

  // --- Sync player_statistics from match_player_stats for affected players ---
  // Uses the shared paginated helper: the previous inline read was silently
  // truncated at ~1000 rows by PostgREST, undercounting long careers.
  const affectedPlayerIds = Array.from(
    new Set([
      ...statUpserts.map((r) => r.player_id),
      ...statDeletes,
    ])
  );

  if (affectedPlayerIds.length > 0) {
    try {
      await syncPlayerStatisticsForPlayers(affectedPlayerIds);
    } catch (err) {
      console.error('Error syncing player_statistics:', err);
    }
  }

  // --- Auto-finalize from the just-saved stats ---
  const { data: mt, error: mErr } = await supabase
    .from('matches')
    .select('team_a_id, team_b_id, tournament_id')
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

  // Penalty shootout result (two-legged decider, or a level single-leg KO).
  const penAraw = formData.get('penalty_a');
  const penBraw = formData.get('penalty_b');
  const penA = penAraw == null || penAraw === '' ? null : Number(penAraw);
  const penB = penBraw == null || penBraw === '' ? null : Number(penBraw);

  // Resolve scores + winner with two-legged awareness (handles leg 1 / leg 2 / single-leg).
  const patch = await resolveKoFinishPatch(supabase, {
    matchId: match_id,
    teamAId,
    teamBId,
    aGoals,
    bGoals,
    penA: penA != null && Number.isFinite(penA) ? penA : null,
    penB: penB != null && Number.isFinite(penB) ? penB : null,
  });

  // Save scores and mark as finished (ties are still finished matches for non-KO)
  const { error: upErr } = await supabase
    .from('matches')
    .update({ ...patch, status: 'finished' })
    .eq('id', match_id);
  if (upErr) throw upErr;

  // Always run progression (handles KO and non-KO stages appropriately)
  // For non-KO rounds (groups/league), ties need progression to update standings
  // For KO rounds, progression logic internally handles ties (no winner to propagate)
  //
  // Scheduled via after(): the previous fire-and-forget promise was killed when
  // the redirect ended the request, so the player-stats cache refresh inside
  // progressAfterMatch often never ran. after() keeps the redirect fast while
  // guaranteeing the work completes once the response is sent.
  const removedPlayerIds = [...new Set(statDeletes)];
  const tournamentId = mt.tournament_id ? Number(mt.tournament_id) : null;
  after(async () => {
    try {
      await progressAfterMatch(match_id);
    } catch (err) {
      console.error('[saveAllStats] progressAfterMatch error:', err);
    }
    // progressAfterMatch only refreshes players still present in the match;
    // players whose stats were removed need an explicit cache refresh too.
    if (removedPlayerIds.length > 0) {
      try {
        await refreshCareerStatsForPlayers(removedPlayerIds);
        if (tournamentId) {
          await refreshTournamentStatsForPlayers(removedPlayerIds, tournamentId);
        }
      } catch (err) {
        console.error('[saveAllStats] removed-player cache refresh error:', err);
      }
    }
    // Standings/stat caches were written above (post-response), so the ISR
    // snapshots regenerated by the synchronous call below may predate them —
    // invalidate the tournament/leaderboard surfaces once more.
    try {
      if (tournamentId) revalidateTournamentSurfaces(tournamentId);
      revalidatePlayerStatSurfaces();
    } catch (err) {
      console.error('[saveAllStats] post-progression revalidate error:', err);
    }
  });

  // Refresh every public page showing this match, then show success flag
  revalidateMatchSurfaces({
    id: match_id,
    tournament_id: tournamentId,
    team_a_id: teamAId,
    team_b_id: teamBId,
  });
  redirect(`/matches/${match_id}?saved=1`);
}

/** --------------------------------
 *  NEW: update match video URL (CRUD)
 *  -------------------------------- */
export async function updateMatchVideoAction(formData: FormData) {
  const supabase = await assertAdmin();

  const matchId = Number(formData.get('match_id'));
  if (!Number.isFinite(matchId)) throw new Error('Bad match id');

  const raw = (formData.get('video_url') as string | null) ?? null;
  const trimmed = raw?.trim() || null;

  // Validate: must be a YouTube URL or a bare 11-char video ID, or null to clear
  let value: string | null = null;
  if (trimmed) {
    const isYouTubeId = /^[a-zA-Z0-9_-]{11}$/.test(trimmed);
    let isYouTubeUrl = false;
    try {
      const url = new URL(trimmed);
      isYouTubeUrl = /^(www\.)?(youtube\.com|youtu\.be)$/.test(url.hostname);
    } catch {}
    if (!isYouTubeId && !isYouTubeUrl) {
      throw new Error('Invalid video URL: must be a YouTube URL or video ID');
    }
    value = trimmed;
  }

  const { error } = await supabase
    .from('matches')
    .update({ video_url: value })
    .eq('id', matchId);

  if (error) throw error;

  revalidatePath(`/matches/${matchId}`);
  // Home "Highlights" and /api/matches/videos render video_url too.
  revalidatePath('/');
}
