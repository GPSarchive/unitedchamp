import type { Team, Player, Tournament, Stage, Standing, Match, Awards } from './useTournamentData';

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

export const loadTournamentIntoStore = async (
  tournamentId: number,
  supabaseInstance: import('@supabase/supabase-js').SupabaseClient
): Promise<{
  tournament: Tournament;
  teams: Team[];
  players: Player[];
  matches: Match[];
  stages: Stage[];
  standings: Standing[];
  awards: Awards | null;
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
  const tournament: Tournament = tournamentData;

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

  // Fetch matches
  const { data: matchesData, error: matchesError } = await supabaseInstance
    .from('matches')
    .select('*')
    .eq('tournament_id', tournamentId);
  console.log(`[loadTournamentIntoStore] Matches fetch result:`, { data: matchesData, error: matchesError });

  if (matchesError) {
    console.error(`[loadTournamentIntoStore] Failed to fetch matches: ${matchesError.message}`);
    throw new Error(`Failed to fetch matches: ${matchesError.message}`);
  }
  const matches: Match[] = matchesData?.map((match: any) => ({
    ...match,
    match_date: match.match_date ? new Date(match.match_date).toISOString() : '',
  })) || [];

  // Fetch standings
  const stageIds = stages.map((s: Stage) => s.id);
  const { data: standingsData, error: standingsError } = await supabaseInstance
    .from('stage_standings')
    .select('*')
    .in('stage_id', stageIds);
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
  const matchIds = matches.map((m: Match) => m.id);

  // Fetch raw match player stats (tournament-specific)
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
  console.log(`[loadTournamentIntoStore] Raw player stats fetch result:`, { data: rawStats, error: statsError });

  if (statsError) {
    console.error(`[loadTournamentIntoStore] Failed to fetch raw player stats: ${statsError.message}`);
    throw new Error(`Failed to fetch raw player stats: ${statsError.message}`);
  }

  // Aggregate player stats in JavaScript
  const aggStatsMap = new Map<string, AggPlayerStat & { matchIds: Set<number> }>();
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
      matchIds: new Set<number>(),
    };

    existing.matchIds.add(stat.match_id);

    aggStatsMap.set(key, {
      ...existing,
      goals: existing.goals + (stat.goals || 0),
      assists: existing.assists + (stat.assists || 0),
      yellow_cards: existing.yellow_cards + (stat.yellow_cards || 0),
      red_cards: existing.red_cards + (stat.red_cards || 0),
      blue_cards: existing.blue_cards + (stat.blue_cards || 0),
      mvp: existing.mvp + (stat.mvp ? 1 : 0),
      best_goalkeeper: existing.best_goalkeeper + (stat.best_goalkeeper ? 1 : 0),
      matches: existing.matchIds.size,
      is_captain: existing.is_captain || stat.is_captain,
    });
  }
  const aggStats: AggPlayerStat[] = Array.from(aggStatsMap.values()).map(({ matchIds, ...stat }) => stat);

  // Get unique player IDs from aggregates
  const playerIds = [...new Set(aggStats.map((s: AggPlayerStat) => s.player_id))];

  // Fetch player details with fallback
  let playersDetails: PlayerDetail[] | null = null;
  let detailsError: any = null;
  try {
    const { data, error } = await supabaseInstance
      .from('players')
      .select('id, first_name, last_name, photo, position')
      .in('id', playerIds);
    playersDetails = data;
    detailsError = error;
    console.log(`[loadTournamentIntoStore] Player details fetch result:`, { data: playersDetails, error: detailsError });
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
    playersDetails?.map((p: PlayerDetail) => [p.id, p]) ||
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
    const detail = playersMap.get(stat.player_id);
    return {
      id: stat.player_id,
      name: `${detail?.first_name || 'Unknown'} ${detail?.last_name || 'Player'}`.trim(),
      position: detail?.position ?? null,
      goals: stat.goals || 0,
      assists: stat.assists || 0,
      yellowCards: stat.yellow_cards || 0,
      redCards: stat.red_cards || 0,
      blueCards: stat.blue_cards || 0,
      mvp: stat.mvp || 0,
      bestGoalkeeper: stat.best_goalkeeper || 0,
      matchesPlayed: stat.matches || 0,
      teamId: stat.team_id,
      photo: detail?.photo || '/player-placeholder.jpg',
      isCaptain: stat.is_captain || false,
    };
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
  return { tournament, teams, players, matches, stages, standings, awards };
};