"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import type { Player, Team } from "../useTournamentData";

type PlayerStatisticsProps = {
  players: Player[];
  teams: Team[];
};

type PlayerWithTeam = Player & {
  teamName: string;
  teamLogo: string;
};

const StatCard: React.FC<{
  title: string;
  icon: string;
  players: PlayerWithTeam[];
  statKey: keyof Pick<Player, "goals" | "assists" | "mvp" | "yellowCards" | "redCards" | "matchesPlayed">;
  statLabel: string;
}> = ({ title, icon, players, statKey, statLabel }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl border border-white/10 bg-zinc-950/60 hover:bg-zinc-950/80 shadow-lg hover:shadow-xl transition-all overflow-hidden"
    >
      {/* Card Header */}
      <div className="px-6 py-4 border-b border-white/10 bg-gradient-to-r from-black via-zinc-950 to-black">
        <div className="flex items-center gap-3">
          <div className="text-2xl">{icon}</div>
          <h3 className="text-xl font-bold text-white">{title}</h3>
        </div>
      </div>

      {/* Card Content */}
      <div className="p-6">
        {players.length === 0 ? (
          <div className="text-center py-8 text-white/50">
            Δεν υπάρχουν δεδομένα
          </div>
        ) : (
          <div className="space-y-3">
            {players.map((player, index) => (
              <div
                key={`${player.id}-${player.teamId}`}
                className="flex items-center gap-4 p-3 rounded-xl bg-black/40 hover:bg-black/60 transition-colors"
              >
                {/* Rank */}
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white font-bold text-sm">
                  {index + 1}
                </div>

                {/* Player Photo */}
                <div className="flex-shrink-0 w-12 h-12 rounded-full overflow-hidden bg-zinc-800 border-2 border-white/10">
                  <img
                    src={player.photo}
                    alt={player.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = "/player-placeholder.jpg";
                    }}
                  />
                </div>

                {/* Player Info */}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white truncate">
                    {player.name}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-white/70">
                    <img
                      src={player.teamLogo}
                      alt={player.teamName}
                      className="w-4 h-4 object-contain"
                      onError={(e) => {
                        e.currentTarget.src = "/team-placeholder.png";
                      }}
                    />
                    <span className="truncate">{player.teamName}</span>
                  </div>
                </div>

                {/* Stat Value */}
                <div className="flex-shrink-0 text-right">
                  <div className="text-2xl font-bold text-emerald-400">
                    {player[statKey]}
                  </div>
                  <div className="text-xs text-white/70">{statLabel}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export const PlayerStatistics: React.FC<PlayerStatisticsProps> = ({
  players,
  teams,
}) => {
  // Create a map for quick team lookup
  const teamMap = useMemo(() => {
    return new Map(teams.map((team) => [team.id, team]));
  }, [teams]);

  // Enrich players with team info
  const playersWithTeam = useMemo((): PlayerWithTeam[] => {
    return players.map((player) => {
      const team = teamMap.get(player.teamId);
      return {
        ...player,
        teamName: team?.name || "Unknown Team",
        teamLogo: team?.logo || "/team-placeholder.png",
      };
    });
  }, [players, teamMap]);

  // Top Scorers (Goals)
  const topScorers = useMemo(() => {
    return [...playersWithTeam]
      .filter((p) => p.goals > 0)
      .sort((a, b) => b.goals - a.goals)
      .slice(0, 10);
  }, [playersWithTeam]);

  // Assists Leaders
  const assistLeaders = useMemo(() => {
    return [...playersWithTeam]
      .filter((p) => p.assists > 0)
      .sort((a, b) => b.assists - a.assists)
      .slice(0, 10);
  }, [playersWithTeam]);

  // MVPs
  const mvpLeaders = useMemo(() => {
    return [...playersWithTeam]
      .filter((p) => p.mvp > 0)
      .sort((a, b) => b.mvp - a.mvp)
      .slice(0, 10);
  }, [playersWithTeam]);

  // Yellow Cards
  const yellowCardLeaders = useMemo(() => {
    return [...playersWithTeam]
      .filter((p) => p.yellowCards > 0)
      .sort((a, b) => b.yellowCards - a.yellowCards)
      .slice(0, 10);
  }, [playersWithTeam]);

  // Red Cards
  const redCardLeaders = useMemo(() => {
    return [...playersWithTeam]
      .filter((p) => p.redCards > 0)
      .sort((a, b) => b.redCards - a.redCards)
      .slice(0, 10);
  }, [playersWithTeam]);

  // Match Participation
  const matchParticipation = useMemo(() => {
    return [...playersWithTeam]
      .filter((p) => p.matchesPlayed > 0)
      .sort((a, b) => b.matchesPlayed - a.matchesPlayed)
      .slice(0, 10);
  }, [playersWithTeam]);

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">
          Στατιστικά Παικτών
        </h2>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Κορυφαίοι Σκόρερ"
          icon="⚽"
          players={topScorers}
          statKey="goals"
          statLabel="γκολ"
        />

        <StatCard
          title="Ασίστ"
          icon="🎯"
          players={assistLeaders}
          statKey="assists"
          statLabel="ασίστ"
        />

        <StatCard
          title="MVPs"
          icon="⭐"
          players={mvpLeaders}
          statKey="mvp"
          statLabel="MVP"
        />

        <StatCard
          title="Κίτρινες Κάρτες"
          icon="🟨"
          players={yellowCardLeaders}
          statKey="yellowCards"
          statLabel="κίτρινες"
        />

        <StatCard
          title="Κόκκινες Κάρτες"
          icon="🟥"
          players={redCardLeaders}
          statKey="redCards"
          statLabel="κόκκινες"
        />

        <StatCard
          title="Συμμετοχές"
          icon="📊"
          players={matchParticipation}
          statKey="matchesPlayed"
          statLabel="αγώνες"
        />
      </div>
    </div>
  );
};
