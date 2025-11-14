import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";  // Server-side Supabase client
import TeamSidebar from "./TeamSidebar";
import PlayersGrid from "./PlayersGrid";
import TeamMatchesTimeline from "./TeamMatchesTimeline";  // Use the new client-side component
import TeamStats from "./TeamStats";
import type { StandingRow } from "./TournamentStandingsWidget";
import {
  type Team,
  type PlayerAssociation,
  type Match,
  normalizeTeamPlayers,
  type TeamPlayersRowRaw,
} from "@/app/lib/types";

// Helper function to fetch standings for a specific tournament
async function fetchTournamentStandings(tournamentId: number): Promise<StandingRow[]> {
  // First, get the latest stage for this tournament
  const { data: stages, error: stagesError } = await supabaseAdmin
    .from("stages")
    .select("id")
    .eq("tournament_id", tournamentId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (stagesError || !stages || stages.length === 0) {
    return [];
  }

  const stageId = stages[0].id;

  // Fetch standings for this stage
  const { data: standingsData, error: standingsError } = await supabaseAdmin
    .from("stage_standings")
    .select(
      "stage_id, group_id, team_id, played, won, drawn, lost, gf, ga, gd, points, rank"
    )
    .eq("stage_id", stageId)
    .order("rank", { ascending: true, nullsFirst: false })
    .order("points", { ascending: false });

  if (standingsError || !standingsData) return [];

  // Get unique team IDs
  const teamIds = [...new Set(standingsData.map((s: any) => s.team_id))];

  // Fetch team data separately
  const { data: teamsData, error: teamsError } = await supabaseAdmin
    .from("teams")
    .select("id, name, logo")
    .in("id", teamIds);

  if (teamsError || !teamsData) return [];

  // Create a map for quick team lookup
  const teamsMap = new Map(teamsData.map((t: any) => [t.id, t]));

  // Combine standings with team data
  const standings: StandingRow[] = standingsData.map((s: any) => ({
    stage_id: s.stage_id,
    group_id: s.group_id,
    team_id: s.team_id,
    played: s.played,
    won: s.won,
    drawn: s.drawn,
    lost: s.lost,
    gf: s.gf,
    ga: s.ga,
    gd: s.gd,
    points: s.points,
    rank: s.rank,
    team: teamsMap.get(s.team_id) || {
      id: s.team_id,
      name: `Team #${s.team_id}`,
      logo: null,
    },
  }));

  return standings;
}

type TeamPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TeamPage({ params }: TeamPageProps) {
  const { id } = await params;
  const teamId = Number.parseInt(id, 10);

  if (Number.isNaN(teamId)) {
    return <div className="text-red-400">Invalid team ID</div>;
  }

  // ── Team details ────────────────────────────────────────────────────────────────
  const { data: team, error: teamError } = await supabaseAdmin
    .from("teams")
    .select("*")
    .eq("id", teamId)
    .single();

  if (teamError || !team) {
    return (
      <div className="text-red-400">
        Error loading team: {teamError?.message || "Team not found"}
      </div>
    );
  }

  // ── Tournament membership (this team in tournaments) ───────────────────────────
  const { data: tournamentMembership, error: membershipErr } = await supabaseAdmin
    .from("tournament_teams")
    .select(
      `id, tournament:tournament_id (id, name, season, status, winner_team_id)`
    )
    .eq("team_id", teamId)
    .order("tournament_id", { ascending: false });

  const tournaments =
    (tournamentMembership ?? [])
      .map((r: any) => r.tournament)
      .filter(Boolean) ?? [];

  // ── Tournament wins (championships) ────────────────────────────────────────────
  const { data: winsList, error: winsErr } = await supabaseAdmin
    .from("tournaments")
    .select("id, name, season")
    .eq("winner_team_id", teamId);

  const wins = winsList ?? [];

  // ── Players: include master data + 1 latest statistics row ─────────────────────
  const { data: playerAssociationsData, error: playersError } = await supabaseAdmin
    .from("player_teams")
    .select(
      `
        id,
        player:player_id (id, first_name, last_name, photo, height_cm, position, birth_date, player_statistics (id, age, total_goals, total_assists, yellow_cards, red_cards, blue_cards, created_at, updated_at))
      `
    )
    .eq("team_id", teamId)
    .order("player_id", { ascending: true })
    .order("id", { foreignTable: "player.player_statistics", ascending: false })
    .limit(1, { foreignTable: "player.player_statistics" });

  const playerAssociations: PlayerAssociation[] =
    playersError || !playerAssociationsData
      ? []
      : normalizeTeamPlayers(playerAssociationsData as TeamPlayersRowRaw[]);

  // ── Per-player per-season stats (scoped to this team) ──────────────────────────
  const { data: seasonStats, error: pssErr } = await supabaseAdmin
    .from("player_season_stats")
    .select(
      `
        player_id,
        season,
        matches,
        goals,
        assists,
        yellow_cards,
        red_cards,
        blue_cards,
        mvp,
        best_gk,
        updated_at
      `
    )
    .eq("team_id", teamId)
    .order("season", { ascending: false });

  const seasonStatsByPlayer: Record<number, any[]> = (seasonStats ?? []).reduce(
    (acc: Record<number, any[]>, row: any) => {
      if (!acc[row.player_id]) acc[row.player_id] = [];
      acc[row.player_id].push(row);
      return acc;
    },
    {}
  );

  // ── Matches ─────────────────────────
  const { data: matchesData, error: matchesError } = await supabaseAdmin
    .from("matches")
    .select(
      `
        id,
        match_date,
        status,
        team_a_score,
        team_b_score,
        winner_team_id,
        team_a:teams!matches_team_a_id_fkey (id, name, logo),
        team_b:teams!matches_team_b_id_fkey (id, name, logo),
        tournament:tournament_id (id, name, season, slug)
      `
    )
    .or(`team_a_id.eq.${teamId},team_b_id.eq.${teamId}`)
    .order("match_date", { ascending: false });

  const matches = (matchesData as unknown as Match[] | null) ?? null;

  // ── Fetch standings for each tournament ───────────────────────────────────────
  const tournamentsWithStandings = await Promise.all(
    tournaments.map(async (tournament: any) => {
      const standings = await fetchTournamentStandings(tournament.id);
      return {
        ...tournament,
        standings,
      };
    })
  );

  // ── Calculate team stats from matches ─────────────────────────────────────────
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;

  if (matches) {
    matches.forEach((match) => {
      // Only count finished matches
      if (typeof match.team_a_score !== 'number' || typeof match.team_b_score !== 'number') {
        return;
      }

      const isTeamA = match.team_a?.id === teamId;
      const myScore = isTeamA ? match.team_a_score : match.team_b_score;
      const oppScore = isTeamA ? match.team_b_score : match.team_a_score;

      goalsFor += myScore ?? 0;
      goalsAgainst += oppScore ?? 0;

      if (match.winner_team_id === teamId) {
        wins++;
      } else if (match.winner_team_id === null) {
        draws++;
      } else {
        losses++;
      }
    });
  }

  const totalMatches = wins + draws + losses;

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-gradient-to-br from-orange-950 via-black to-zinc-950">
      {/* Dark Neon Background Gradient */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-600/20 via-black/40 to-black" />

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-8">
          {/* Left Sidebar: Logo + Basic Info */}
          <TeamSidebar
            team={team as Team}
            tournamentsWithStandings={tournamentsWithStandings}
            wins={winsList ?? []}
            errors={{ membership: membershipErr?.message, wins: winsErr?.message }}
          />

          {/* Right Content: Stats + Players + Matches */}
          <div className="space-y-8">
            <TeamStats
              wins={wins}
              draws={draws}
              losses={losses}
              goalsFor={goalsFor}
              goalsAgainst={goalsAgainst}
              totalMatches={totalMatches}
            />
            <PlayersGrid
              playerAssociations={playerAssociations}
              seasonStatsByPlayer={seasonStatsByPlayer}
              errorMessage={playersError?.message || pssErr?.message}
              teamLogo={team.logo}
            />
            <TeamMatchesTimeline
              matches={matches}
              teamId={teamId}
              errorMessage={matchesError?.message}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
