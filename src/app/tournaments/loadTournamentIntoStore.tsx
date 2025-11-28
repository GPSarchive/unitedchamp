// app/tournaments/loadTournamentIntoStore.ts
import type { Team, Player, Tournament, Stage, Standing, DraftMatch, Awards } from './useTournamentData'; // Adjust path as needed

// Define types for Supabase query results
type MatchPlayerStat = {
  player_id: number;
  team_id: number;
  match_id: number;
  goals: number;
  assists: number;
  yellow_cards: number;
  red_cards: number;
  blue_cards: number;
  mvp: boolean;
  best_goalkeeper: boolean;
  is_captain: boolean;
};

type AggPlayerStat = {
  player_id: number;
  team_id: number;
  goals: number;
  assists: number;
  yellow_cards: number;
  red_cards: number;
  blue_cards: number;
  mvp: number;
  best_goalkeeper: number;
  matches: number;
  is_captain: boolean;
};

type PlayerDetail = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  photo: string | null;
  position: string | null;
};

type TournamentTeamData = {
  team: {
    id: number;
    name: string;
    logo: string;
    season_score: any; // Adjust type if season_score has a specific structure
  };
  stage_id: number | null;
  group_id: number | null;
  seed: number | null;
};

type Group = {
  id: number;
  stage_id: number;
  name: string;
  ordering: number;
};

type MatchParticipant = {
  player_id: number;
  team_id: number;
  match_id: number;
  played: boolean;
};

export const loadTournamentIntoStore = async (
  tournamentId: number,
  supabaseInstance: import('@supabase/supabase-js').SupabaseClient
): Promise<{
  tournament: Tournament;
  teams: Team[];
  players: Player[];
  matches: DraftMatch[];
  stages: Stage[];
  standings: Standing[];
  awards: Awards | null;
  groups: Group[]; // Added for completeness, even if not in store yet
}> => {
  console.log(`[loadTournamentIntoStore] Fetching data for tournamentId: ${tournamentId}`);

  // Fetch tournament
  const { data: tournamentData, error: tournamentError } = await supabaseInstance
    .from('tournaments')
    .select('*')
    .eq('id', tournamentId)
    .single();
  console.log(`[loadTournamentIntoStore] Tournament fetch result:`, { data: tournamentData, error: tournamentError });

  if (tournamentError || !tournamentData) {
    console.error(`[loadTournamentIntoStore] Failed to fetch tournament: ${tournamentError?.message || 'No data'}`);
    throw new Error(`Failed to fetch tournament: ${tournamentError?.message || 'No data'}`);
  }
  const tournament: Tournament = {
    id: tournamentData.id,
    name: tournamentData.name,
    slug: tournamentData.slug,
    format: tournamentData.format,
    season: tournamentData.season,
    logo: tournamentData.logo,
    status: tournamentData.status,
    winner_team_id: tournamentData.winner_team_id,
    matches_count: '',
    teams_count: ''
  };

  // Fetch stages
  const { data: stagesData, error: stagesError } = await supabaseInstance
    .from('tournament_stages')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('ordering');
  console.log(`[loadTournamentIntoStore] Stages fetch result:`, { data: stagesData, error: stagesError });

  if (stagesError) {
    console.error(`[loadTournamentIntoStore] Failed to fetch stages: ${stagesError.message}`);
    throw new Error(`Failed to fetch stages: ${stagesError.message}`);
  }
  const stages: Stage[] = stagesData || [];

  // Fetch groups (added for completeness, as they tie into stages, standings, and matches)
  const stageIds = stages.map((s: Stage) => s.id);
  const { data: groupsData, error: groupsError } = await supabaseInstance
    .from('tournament_groups')
    .select('*')
    .in('stage_id', stageIds)
    .order('ordering');
  console.log(`[loadTournamentIntoStore] Groups fetch result:`, { data: groupsData, error: groupsError });

  if (groupsError) {
    console.error(`[loadTournamentIntoStore] Failed to fetch groups: ${groupsError.message}`);
    throw new Error(`Failed to fetch groups: ${groupsError.message}`);
  }
  const groups: Group[] = groupsData || [];

  // Fetch matches
  const { data: matchesData, error: matchesError } = await supabaseInstance
    .from('matches')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('match_date');
  console.log(`[loadTournamentIntoStore] Matches fetch result:`, { data: matchesData, error: matchesError });

  if (matchesError) {
    console.error(`[loadTournamentIntoStore] Failed to fetch matches: ${matchesError.message}`);
    throw new Error(`Failed to fetch matches: ${matchesError.message}`);
  }
  const matches: DraftMatch[] = (matchesData || []).map((match: any) => ({
    db_id: match.id,
    stageIdx: stages.findIndex(s => s.id === match.stage_id),
    groupIdx: match.group_id ?? null,
    bracket_pos: match.bracket_pos ?? null,
    matchday: match.matchday ?? null,
    match_date: match.match_date ? new Date(match.match_date).toISOString() : null,
    team_a_id: match.team_a_id ?? null,
    team_b_id: match.team_b_id ?? null,
    round: match.round ?? null,
    status: match.status ?? null,
    team_a_score: match.team_a_score ?? null,
    team_b_score: match.team_b_score ?? null,
    winner_team_id: match.winner_team_id ?? null,
    home_source_match_idx: match.home_source_match_id ?? null, // Note: This is match_id, not idx; adjust if needed for client logic
    away_source_match_idx: match.away_source_match_id ?? null,
    home_source_outcome: match.home_source_outcome ?? null,
    away_source_outcome: match.away_source_outcome ?? null,
    home_source_round: match.home_source_round ?? null,
    home_source_bracket_pos: match.home_source_bracket_pos ?? null,
    away_source_round: match.away_source_round ?? null,
    away_source_bracket_pos: match.away_source_bracket_pos ?? null,
  }));

  // Fetch standings
  const { data: standingsData, error: standingsError } = await supabaseInstance
  .from("stage_standings")
  .select("stage_id,group_id,team_id,played,won,drawn,lost,gf,ga,gd,points,rank")
  .in("stage_id", stageIds.length ? stageIds : [-1])
  .order("stage_id", { ascending: true })
  .order("group_id", { ascending: true, nullsFirst: true })
  .order("rank", { ascending: true, nullsFirst: true });
  console.log(`[loadTournamentIntoStore] Standings fetch result:`, { data: standingsData, error: standingsError });

  if (standingsError) {
    console.error(`[loadTournamentIntoStore] Failed to fetch standings: ${standingsError.message}`);
    throw new Error(`Failed to fetch standings: ${standingsError.message}`);
  }
  const standings: Standing[] = standingsData || [];

  // Fetch teams
  const { data: tournamentTeamsData, error: teamsError } = await supabaseInstance
    .from('tournament_teams')
    .select('*, team:teams(id, name, logo, season_score), stage_id, group_id, seed')
    .eq('tournament_id', tournamentId);
  console.log(`[loadTournamentIntoStore] Teams fetch result:`, { data: tournamentTeamsData, error: teamsError });

  if (teamsError) {
    console.error(`[loadTournamentIntoStore] Failed to fetch teams: ${teamsError.message}`);
    throw new Error(`Failed to fetch teams: ${teamsError.message}`);
  }

  const teamIds = tournamentTeamsData?.map((tt: TournamentTeamData) => tt.team.id) || [];

  // Fetch match IDs for tournament-specific filtering
  const matchIds = matches.map((m: DraftMatch) => m.db_id).filter((id): id is number => id !== null && id !== undefined);

  console.log(`[loadTournamentIntoStore] Query params:`, {
    tournamentId,
    matchIds: matchIds,
    matchIdsLength: matchIds.length,
    teamIds: teamIds,
    teamIdsLength: teamIds.length,
  });

  // Fetch raw match player stats DIRECTLY (primary source of truth)
  const { data: rawStats, error: statsError } = await supabaseInstance
    .from('match_player_stats')
    .select(`
      player_id,
      team_id,
      match_id,
      goals,
      assists,
      yellow_cards,
      red_cards,
      blue_cards,
      mvp,
      best_goalkeeper,
      is_captain
    `)
    .in('match_id', matchIds)
    .in('team_id', teamIds) as { data: MatchPlayerStat[] | null; error: any };

  console.log(`[loadTournamentIntoStore] Raw player stats fetch result:`, {
    data: rawStats,
    error: statsError,
    statsCount: rawStats?.length || 0,
  });

  if (statsError) {
    console.error(`[loadTournamentIntoStore] Failed to fetch raw player stats: ${statsError.message}`);
    throw new Error(`Failed to fetch raw player stats: ${statsError.message}`);
  }

  // Fetch participants for match count (optional - will work even if empty)
  const { data: participantsData, error: participantsError } = await supabaseInstance
    .from('match_participants')
    .select('player_id, team_id, match_id, played')
    .in('match_id', matchIds)
    .in('team_id', teamIds)
    .eq('played', true);

  console.log(`[loadTournamentIntoStore] Participants fetch result:`, {
    participantsCount: participantsData?.length || 0,
    error: participantsError,
  });

  // Build participant map for accurate match counts
  const participantMap = new Map<string, Set<number>>();
  for (const p of (participantsData as MatchParticipant[] || [])) {
    const key = `${p.player_id}-${p.team_id}`;
    if (!participantMap.has(key)) {
      participantMap.set(key, new Set<number>());
    }
    participantMap.get(key)!.add(p.match_id);
  }

  // Aggregate player stats from match_player_stats
  const aggStatsMap = new Map<string, AggPlayerStat>();
  for (const stat of rawStats || []) {
    const key = `${stat.player_id}-${stat.team_id}`;
    const existing = aggStatsMap.get(key) || {
      player_id: stat.player_id,
      team_id: stat.team_id,
      goals: 0,
      assists: 0,
      yellow_cards: 0,
      red_cards: 0,
      blue_cards: 0,
      mvp: 0,
      best_goalkeeper: 0,
      matches: 0,
      is_captain: false,
    };

    aggStatsMap.set(key, {
      ...existing,
      goals: existing.goals + (stat.goals || 0),
      assists: existing.assists + (stat.assists || 0),
      yellow_cards: existing.yellow_cards + (stat.yellow_cards || 0),
      red_cards: existing.red_cards + (stat.red_cards || 0),
      blue_cards: existing.blue_cards + (stat.blue_cards || 0),
      mvp: existing.mvp + (stat.mvp ? 1 : 0),
      best_goalkeeper: existing.best_goalkeeper + (stat.best_goalkeeper ? 1 : 0),
      is_captain: existing.is_captain || stat.is_captain,
    });
  }

  // Update match counts from participants (if available)
  for (const [key, matchSet] of participantMap.entries()) {
    const stat = aggStatsMap.get(key);
    if (stat) {
      stat.matches = matchSet.size;
    }
  }

  // If no participant data, estimate matches from stats records
  for (const [key, stat] of aggStatsMap.entries()) {
    if (stat.matches === 0) {
      // Count unique match_ids for this player from rawStats
      const playerMatches = new Set(
        (rawStats || [])
          .filter(s => `${s.player_id}-${s.team_id}` === key)
          .map(s => s.match_id)
      );
      stat.matches = playerMatches.size;
    }
  }

  const aggStats: AggPlayerStat[] = Array.from(aggStatsMap.values());

  console.log(`[loadTournamentIntoStore] Aggregated stats:`, {
    aggStatsCount: aggStats.length,
    sampleStats: aggStats.slice(0, 3),
  });

  // Extract unique player IDs from aggregated stats
  const playerIds = [...new Set(aggStats.map(s => s.player_id))];

  console.log(`[loadTournamentIntoStore] Player IDs to fetch:`, {
    playerIdsCount: playerIds.length,
    playerIds: playerIds,
  });

  // Fetch player details with fallback
  let playersDetails: PlayerDetail[] | null = null;
  let detailsError: any = null;
  try {
    const { data, error } = await supabaseInstance
      .from('player') // Fixed: schema uses 'player', not 'players'
      .select('id, first_name, last_name, photo, position')
      .in('id', playerIds);
    playersDetails = data;
    detailsError = error;
    console.log(`[loadTournamentIntoStore] Player details fetch result:`, {
      data: playersDetails,
      error: detailsError,
      detailsCount: playersDetails?.length || 0,
    });
  } catch (e) {
    console.error(`[loadTournamentIntoStore] Exception while fetching player details: ${e}`);
    detailsError = e;
  }

  if (detailsError) {
    console.error(`[loadTournamentIntoStore] Failed to fetch player details: ${detailsError.message}`);
    // Instead of throwing, proceed with default player details
    console.warn(`[loadTournamentIntoStore] Using default player details for playerIds: ${playerIds.join(', ')}`);
  }

  // Create a map for quick lookup of player details, with fallback for missing data
  const playersMap = new Map<number, PlayerDetail>(
    (playersDetails ?? []).map((p: PlayerDetail) => [p.id, p]) ||
      playerIds.map((id) => [
        id,
        {
          id,
          first_name: null,
          last_name: null,
          photo: null,
          position: null,
        },
      ])
  );

  // Build players array
  const players: Player[] = aggStats.map((stat: AggPlayerStat) => {
    const detail = playersMap.get(stat.player_id) ?? {
      id: stat.player_id,
      first_name: null,
      last_name: null,
      photo: null,
      position: null,
    };
    return {
      id: stat.player_id,
      name: `${detail.first_name || 'Unknown'} ${detail.last_name || 'Player'}`.trim(),
      position: detail.position ?? null,
      goals: stat.goals || 0,
      assists: stat.assists || 0,
      yellowCards: stat.yellow_cards || 0,
      redCards: stat.red_cards || 0,
      blueCards: stat.blue_cards || 0,
      mvp: stat.mvp || 0,
      bestGoalkeeper: stat.best_goalkeeper || 0,
      matchesPlayed: stat.matches || 0,
      teamId: stat.team_id,
      photo: detail.photo || '/player-placeholder.jpg',
      isCaptain: stat.is_captain || false,
    };
  });

  console.log(`[loadTournamentIntoStore] Built players array:`, {
    playersCount: players.length,
    samplePlayers: players.slice(0, 3),
    allPlayers: players,
  });

  // Build teams
  const teams: Team[] = [];
  for (const tt of (tournamentTeamsData || []) as TournamentTeamData[]) {
    const teamStandings = standings.filter((s: Standing) => s.team_id === tt.team.id);
    const aggregatedStandings = teamStandings.reduce(
      (
        acc: {
          matchesPlayed: number;
          wins: number;
          draws: number;
          losses: number;
          goalsFor: number;
          goalsAgainst: number;
          goalDifference: number;
          points: number;
        },
        s: Standing
      ) => ({
        matchesPlayed: acc.matchesPlayed + s.played,
        wins: acc.wins + s.won,
        draws: acc.draws + s.drawn,
        losses: acc.losses + s.lost,
        goalsFor: acc.goalsFor + s.gf,
        goalsAgainst: acc.goalsAgainst + s.ga,
        goalDifference: acc.goalDifference + s.gd,
        points: acc.points + s.points,
      }),
      { matchesPlayed: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 }
    );

    // Filter aggregated stats for this team
    const teamAggStats = aggStats.filter((s: AggPlayerStat) => s.team_id === tt.team.id);

    // Compute team cards (sum cards across players)
    const yellowCards = teamAggStats.reduce((sum: number, s: AggPlayerStat) => sum + (s.yellow_cards || 0), 0);
    const redCards = teamAggStats.reduce((sum: number, s: AggPlayerStat) => sum + (s.red_cards || 0), 0);
    const blueCards = teamAggStats.reduce((sum: number, s: AggPlayerStat) => sum + (s.blue_cards || 0), 0);

    // Compute top scorer for the team
    let topScorer = null;
    if (teamAggStats.length > 0) {
      const topStat = teamAggStats.reduce(
        (max: AggPlayerStat, curr: AggPlayerStat) => (curr.goals > max.goals ? curr : max),
        { goals: -1 } as AggPlayerStat
      );
      if (topStat.goals >= 0) {
        const detail = playersMap.get(topStat.player_id);
        topScorer = {
          id: topStat.player_id,
          name: `${detail?.first_name || 'Unknown'} ${detail?.last_name || 'Player'}`.trim(),
          goals: topStat.goals || 0,
        };
      }
    }

    teams.push({
      id: tt.team.id,
      name: tt.team.name,
      logo: tt.team.logo,
      ...aggregatedStandings,
      topScorer,
      stageStandings: teamStandings.map((s: Standing) => ({ stageId: s.stage_id, rank: s.rank, points: s.points })),
      yellowCards,
      redCards,
      blueCards,
    });
  }

  // Fetch awards
  const { data: awardsData, error: awardsError } = await supabaseInstance
    .from('tournament_awards')
    .select('*')
    .eq('tournament_id', tournamentId)
    .single();
  console.log(`[loadTournamentIntoStore] Awards fetch result:`, { data: awardsData, error: awardsError });

  if (awardsError && awardsError.code !== 'PGRST116') {
    console.error(`[loadTournamentIntoStore] Failed to fetch awards: ${awardsError.message}`);
    throw new Error(`Failed to fetch awards: ${awardsError.message}`);
  }
  const awards: Awards | null = awardsData || null;

  console.log(`[loadTournamentIntoStore] Successfully loaded data for tournamentId: ${tournamentId}`);
  return { tournament, teams, players, matches, stages, standings, awards, groups };
};