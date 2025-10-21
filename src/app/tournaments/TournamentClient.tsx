// app/tournaments/[tournamentId]/TournamentClient.tsx
"use client";

import { useEffect, useState } from "react";
import { useTournamentData } from "@/app/tournaments/useTournamentData";
import TournamentHeader from "@/app/tournaments/TournamentHeader";
import StageSection from "@/app/tournaments/StageSection";
import type { Tournament, Team, Player, Match, Stage, Standing, Awards } from "@/app/tournaments/useTournamentData";

type InitialData = {
  tournament: Tournament;
  teams: Team[];
  players: Player[];
  matches: Match[];
  stages: Stage[];
  standings: Standing[];
  awards: Awards | null;
};

const TournamentClient = ({ initialData }: { initialData: InitialData }) => {
  const {
    setTournamentData,
    setTeams,
    setPlayers,
    setMatches,
    setStages,
    setStandings,
    setAwards,
    tournament,
    teams,
    stages,
    matches,
    awards,
  } = useTournamentData();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setTournamentData(initialData.tournament);
    setTeams(initialData.teams);
    setPlayers(initialData.players);
    setMatches(initialData.matches);
    setStages(initialData.stages);
    setStandings(initialData.standings);
    
    setLoading(false);
  }, [initialData, setTournamentData, setTeams, setPlayers, setMatches, setStages, setStandings, setAwards]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!tournament) {
    return <div>No data available</div>;
  }

  return (
    <div className="tournament-page">
      <TournamentHeader
        tournamentName={tournament.name}
        season={tournament.season || "N/A"}
        numTeams={teams?.length || 0}
        numStages={stages?.length || 0}
        numMatches={matches?.length || 0}
        logoUrl={tournament.logo || "/default-logo.png"}
      />
      {awards && (
        <section className="awards-section">
          <h2 className="text-xl font-bold text-center">Awards</h2>
          <p>
            Top Scorer: Player {awards.top_scorer_id} ({awards.top_scorer_goals} goals)
          </p>
          <p>MVP: Player {awards.mvp_player_id}</p>
          <p>Best GK: Player {awards.best_gk_player_id}</p>
        </section>
      )}
      <section className="stages-section">
        <h2 className="text-xl font-bold text-center">Stages</h2>
        {stages?.map((stage) => (
          <StageSection key={stage.id} stageId={stage.id} />
        ))}
      </section>
    </div>
  );
};

export default TournamentClient;