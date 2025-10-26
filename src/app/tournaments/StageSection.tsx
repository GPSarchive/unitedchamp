  // app/components/StageSection.tsx

  "use client";

  import React from "react";
  import { useTournamentData } from "@/app/tournaments/useTournamentData";
  import MatchList from "./MatchList";
  import TeamCard from "./TeamCard";
  import PlayerStats from "./PlayerStats";

  const StageSection: React.FC<{ stageId: number }> = ({ stageId }) => {
    const { stages, teams, players, matches, standings } = useTournamentData();

    const stage = stages?.find((s) => s.id === stageId);

    if (!stage) {
      return <div>Stage not found</div>;
    }

    const stageTeams = teams?.filter((team) =>
      team.stageStandings?.some((standing) => standing.stageId === stageId)
    );

    // Filter players for the stage (players who participated in matches of this stage)
    const stageMatches = matches?.filter((match) => match.stageIdx === stageId);
       const stagePlayerIds = new Set(
      stageMatches?.flatMap((match) =>
        // Assuming match_participants or similar links players to matches
        players?.filter((player) => player.teamId === match.team_a_id || player.teamId === match.team_b_id)
          .map((player) => player.id)
      ) || []
    );
    const stagePlayers = players?.filter((player) => stagePlayerIds.has(player.id)) || [];

    return (
      <section className="bg-black text-white py-8 px-6 rounded-lg shadow-lg space-y-6">
        <h2 className="text-3xl font-semibold text-center">{stage.name}</h2>
        <p className="text-center text-xl">Type: {stage.kind}</p>

        {/* Teams */}
        <div className="team-section space-y-4">
          <h3 className="text-xl font-semibold text-center">Teams</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
            {stageTeams?.map((team) => (
              <TeamCard key={team.id} team={team} stageId={stageId} />
            ))}
          </div>
        </div>

        {/* Standings (only for league/group stages) */}
        {stage.kind !== "knockout" && (
          <div className="standings-section space-y-4">
            <h3 className="text-xl font-semibold text-center">Standings</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {standings
                ?.filter((standing) => standing.stage_id === stageId)
                .sort((a, b) => (b.rank || 0) - (a.rank || 0)) // Sort by rank
                .map((standing) => {
                  const team = teams?.find((t) => t.id === standing.team_id);
                  return (
                    <div
                      key={standing.team_id}
                      className="p-4 bg-gray-800 rounded-lg shadow-md hover:bg-orange-600 transition-all duration-300"
                    >
                      <p className="font-bold">{team?.name || `Team ${standing.team_id}`}</p>
                      <p>Rank: {standing.rank || 'N/A'}</p>
                      <p>Points: {standing.points}</p>
                      <p>Played: {standing.played}</p>
                      <p>Wins: {standing.won}</p>
                      <p>Draws: {standing.drawn}</p>
                      <p>Losses: {standing.lost}</p>
                      <p>Goals For: {standing.gf}</p>
                      <p>Goals Against: {standing.ga}</p>
                      <p>Goal Difference: {standing.gd}</p>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Matches */}
        <MatchList stageId={stageId} />

        {/* Player and Team Stats for the Stage */}
        <div className="player-team-stats-section grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="player-stats-section">
            <h3 className="text-xl font-semibold text-center">Player Stats</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {stagePlayers.length > 0 ? (
                stagePlayers.map((player) => (
                  <PlayerStats key={player.id} player={player} />
                ))
              ) : (
                <p>No players found for this stage</p>
              )}
            </div>
          </div>
          <div className="team-stats-section">
            <h3 className="text-xl font-semibold text-center">Team Stats</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {stageTeams?.map((team) => (
                <TeamCard key={team.id} team={team} stageId={stageId} />
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  };

  export default StageSection;