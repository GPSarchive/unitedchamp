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
  deleted_at: string | null;
};

type TournamentTeamData = {
  team: {
    id: number;
    name: string;
    logo: string;
    colour: string | null;
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

// PostgREST caps un-ranged selects at 1000 rows; per-match tables
// (match_player_stats, match_participants) exceed that on big tournaments,
// so page through explicitly or aggregates silently miss rows.
const fetchAllRows = async <T,>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>,
  pageSize = 1000
): Promise<{ data: T[]; error: any }> => {
  const all: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await buildQuery(from, from + pageSize - 1);
    if (error) return { data: all, error };
    all.push(...(data ?? []));
    if (!data || data.length < pageSize) return { data: all, error: null };
  }
};

const MATCH_COLUMNS =
  'id, stage_id, group_id, bracket_pos, matchday, match_date, team_a_id, team_b_id, round, status, ' +
  'team_a_score, team_b_score, winner_team_id, ' +
  'home_source_match_id, away_source_match_id, home_source_outcome, away_source_outcome, ' +
  'home_source_round, home_source_bracket_pos, away_source_round, away_source_bracket_pos, ' +
  'leg, tie_leg1_match_id, penalty_a, penalty_b';

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
  // Wave 1 — everything keyed by tournament id alone
  const [
    { data: tournamentData, error: tournamentError },
    { data: stagesData, error: stagesError },
    { data: matchesData, error: matchesError },
    { data: tournamentTeamsRaw, error: teamsError },
    { data: awardsData, error: awardsError },
  ] = await Promise.all([
    supabaseInstance
      .from('tournaments')
      .select('id, name, slug, format, season, logo, status, winner_team_id')
      .eq('id', tournamentId)
      .single(),
    supabaseInstance
      .from('tournament_stages')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('ordering'),
    supabaseInstance
      .from('matches')
      .select(MATCH_COLUMNS)
      .eq('tournament_id', tournamentId)
      .order('match_date'),
    supabaseInstance
      .from('tournament_teams')
      .select('stage_id, group_id, seed, team:teams(id, name, logo, colour)')
      .eq('tournament_id', tournamentId),
    supabaseInstance
      .from('tournament_awards')
      .select('*')
      .eq('tournament_id', tournamentId)
      .maybeSingle(),
  ]);

  if (tournamentError || !tournamentData) {
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

  if (stagesError) {
    throw new Error(`Failed to fetch stages: ${stagesError.message}`);
  }
  const stages: Stage[] = stagesData || [];
  const stageIds = stages.map((s: Stage) => s.id);

  if (matchesError) {
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
    // two-legged KO
    leg: match.leg ?? null,
    tie_leg1_match_id: match.tie_leg1_match_id ?? null,
    penalty_a: match.penalty_a ?? null,
    penalty_b: match.penalty_b ?? null,
  }));

  if (teamsError) {
    throw new Error(`Failed to fetch teams: ${teamsError.message}`);
  }
  // PostgREST types the FK join as an array; at runtime it's a single object
  const tournamentTeamsData = (tournamentTeamsRaw ?? []) as unknown as TournamentTeamData[];

  // Deduplicate team IDs (a team can have multiple rows across group stages)
  const teamIds = Array.from(new Set(
    tournamentTeamsData.map((tt: TournamentTeamData) => tt.team.id)
  ));

  // Fetch match IDs for tournament-specific filtering
  const matchIds = matches.map((m: DraftMatch) => m.db_id).filter((id): id is number => id !== null && id !== undefined);

  // Wave 2 — everything keyed by stage/match/team ids
  const [
    { data: groupsData, error: groupsError },
    { data: standingsData, error: standingsError },
    { data: rawStats, error: statsError },
    { data: participantsData },
  ] = await Promise.all([
    supabaseInstance
      .from('tournament_groups')
      .select('*')
      .in('stage_id', stageIds)
      .order('ordering'),
    supabaseInstance
      .from('stage_standings')
      .select('stage_id,group_id,team_id,played,won,drawn,lost,gf,ga,gd,points,rank')
      .in('stage_id', stageIds.length ? stageIds : [-1])
      .order('stage_id', { ascending: true })
      .order('group_id', { ascending: true, nullsFirst: true })
      .order('rank', { ascending: true, nullsFirst: true }),
    // Raw match player stats DIRECTLY (primary source of truth) — paged past
    // the 1000-row cap (big tournaments have 1000+ stat rows)
    fetchAllRows<MatchPlayerStat>((from, to) =>
      supabaseInstance
        .from('match_player_stats')
        .select('player_id, team_id, match_id, goals, assists, yellow_cards, red_cards, blue_cards, mvp, best_goalkeeper, is_captain')
        .in('match_id', matchIds)
        .in('team_id', teamIds)
        .order('id')
        .range(from, to)
    ),
    // Participants for match count (optional - will work even if empty)
    fetchAllRows<MatchParticipant>((from, to) =>
      supabaseInstance
        .from('match_participants')
        .select('player_id, team_id, match_id, played')
        .in('match_id', matchIds)
        .in('team_id', teamIds)
        .eq('played', true)
        .order('id')
        .range(from, to)
    ),
  ]);

  if (groupsError) {
    throw new Error(`Failed to fetch groups: ${groupsError.message}`);
  }
  const groups: Group[] = groupsData || [];

  if (standingsError) {
    throw new Error(`Failed to fetch standings: ${standingsError.message}`);
  }
  const standings: Standing[] = standingsData || [];

  if (statsError) {
    throw new Error(`Failed to fetch raw player stats: ${statsError.message}`);
  }

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
  const statMatchesByKey = new Map<string, Set<number>>();
  for (const s of rawStats || []) {
    const key = `${s.player_id}-${s.team_id}`;
    let set = statMatchesByKey.get(key);
    if (!set) statMatchesByKey.set(key, (set = new Set<number>()));
    set.add(s.match_id);
  }
  for (const [key, stat] of aggStatsMap.entries()) {
    if (stat.matches === 0) {
      stat.matches = statMatchesByKey.get(key)?.size ?? 0;
    }
  }

  const aggStats: AggPlayerStat[] = Array.from(aggStatsMap.values());

  // Extract unique player IDs from aggregated stats
  const playerIds = [...new Set(aggStats.map(s => s.player_id))];

  // Fetch player details with fallback
  let playersDetails: PlayerDetail[] | null = null;
  let detailsError: any = null;
  try {
    const { data, error } = await supabaseInstance
      .from('player') // Fixed: schema uses 'player', not 'players'
      .select('id, first_name, last_name, photo, position, deleted_at')
      .in('id', playerIds);
    playersDetails = data;
    detailsError = error;
  } catch (e) {
    detailsError = e;
  }

  // If details fetch failed, proceed with default player details

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
          deleted_at: null,
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
      deleted_at: null,
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
      photo: detail.photo || '/player-placeholder.svg',
      isCaptain: stat.is_captain || false,
      isDeleted: !!detail.deleted_at,
    };
  });

  // Build teams
  const teams: Team[] = [];
  for (const tt of tournamentTeamsData) {
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
      colour: (tt.team as any).colour ?? null,
      ...aggregatedStandings,
      topScorer,
      stageStandings: teamStandings.map((s: Standing) => ({ stageId: s.stage_id, rank: s.rank, points: s.points })),
      yellowCards,
      redCards,
      blueCards,
    });
  }

  if (awardsError && awardsError.code !== 'PGRST116') {
    throw new Error(`Failed to fetch awards: ${awardsError.message}`);
  }
  const awards: Awards | null = awardsData || null;

  return { tournament, teams, players, matches, stages, standings, awards, groups };
};