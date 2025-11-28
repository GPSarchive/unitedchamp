"use client";

import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Player, Team } from "../useTournamentData";

type PlayerStatisticsProps = {
  players: Player[];
  teams: Team[];
};

type PlayerWithTeam = Player & {
  teamName: string;
  teamLogo: string;
};

const PLAYERS_PER_PAGE = 10;

const PlayerStatistics: React.FC<PlayerStatisticsProps> = ({
  players,
  teams,
}) => {
  const [currentPage, setCurrentPage] = useState(1);

  console.log('[PlayerStatistics] Component rendered with:', {
    playersCount: players?.length || 0,
    teamsCount: teams?.length || 0,
    players: players,
    teams: teams,
  });

  // Create a map for quick team lookup
  const teamMap = useMemo(() => {
    const map = new Map(teams.map((team) => [team.id, team]));
    console.log('[PlayerStatistics] Team map created:', map);
    return map;
  }, [teams]);

  // Enrich players with team info and sort by goals
  const playersWithTeam = useMemo((): PlayerWithTeam[] => {
    const enriched = players
      .map((player) => {
        const team = teamMap.get(player.teamId);
        console.log('[PlayerStatistics] Mapping player:', {
          playerId: player.id,
          playerName: player.name,
          teamId: player.teamId,
          team: team,
          goals: player.goals,
          assists: player.assists,
          mvp: player.mvp,
          matchesPlayed: player.matchesPlayed,
        });
        return {
          ...player,
          teamName: team?.name || "Unknown Team",
          teamLogo: team?.logo || "/team-placeholder.png",
        };
      })
      .sort((a, b) => {
        // Sort by goals first, then assists, then mvp
        if (b.goals !== a.goals) return b.goals - a.goals;
        if (b.assists !== a.assists) return b.assists - a.assists;
        return b.mvp - a.mvp;
      });

    console.log('[PlayerStatistics] Enriched players:', enriched);
    return enriched;
  }, [players, teamMap]);

  // Pagination calculations
  const totalPages = Math.ceil(playersWithTeam.length / PLAYERS_PER_PAGE);
  const startIndex = (currentPage - 1) * PLAYERS_PER_PAGE;
  const endIndex = startIndex + PLAYERS_PER_PAGE;
  const currentPlayers = playersWithTeam.slice(startIndex, endIndex);

  // Reset to page 1 if current page is out of bounds
  React.useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  if (!players || players.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">
            Στατιστικά Παικτών
          </h2>
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-2xl border-2 border-dashed border-white/10 bg-black/40 p-12 text-center"
        >
          <div className="mx-auto w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <p className="text-lg font-medium text-white mb-2">
            Δεν υπάρχουν στατιστικά παικτών
          </p>
          <p className="text-white/70">
            Τα στατιστικά των παικτών θα εμφανιστούν εδώ όταν υπάρχουν δεδομένα.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">
          Στατιστικά Παικτών
        </h2>
        <span className="text-sm text-white/70">
          {playersWithTeam.length} {playersWithTeam.length === 1 ? 'παίκτης' : 'παίκτες'}
        </span>
      </div>

      {/* Glassmorphism Scoreboard Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-2xl border border-white/10 overflow-hidden backdrop-blur-xl bg-gradient-to-br from-black/40 via-zinc-950/60 to-black/40 shadow-2xl"
      >
        {/* Table Header */}
        <div className="border-b border-white/10 bg-gradient-to-r from-black/60 via-zinc-900/60 to-black/60 backdrop-blur-sm">
          <div className="grid grid-cols-[60px_1fr_100px_80px_80px_80px_80px_80px_80px] gap-4 px-6 py-4 text-xs font-bold text-white/80 uppercase tracking-wider">
            <div className="text-center">#</div>
            <div>Παίκτης</div>
            <div className="text-center">Ομάδα</div>
            <div className="text-center" title="Γκολ">⚽ Γκολ</div>
            <div className="text-center" title="Ασίστ">🎯 Ασίστ</div>
            <div className="text-center" title="MVP">⭐ MVP</div>
            <div className="text-center" title="Κίτρινες Κάρτες">🟨 ΚΚ</div>
            <div className="text-center" title="Κόκκινες Κάρτες">🟥 ΚΚ</div>
            <div className="text-center" title="Αγώνες">📊 ΑΓ</div>
          </div>
        </div>

        {/* Table Body */}
        <div className="divide-y divide-white/5">
          <AnimatePresence mode="wait">
            {currentPlayers.map((player, index) => {
              const globalIndex = startIndex + index;
              return (
                <motion.div
                  key={`${player.id}-${player.teamId}-${currentPage}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3, delay: index * 0.02 }}
                  className="grid grid-cols-[60px_1fr_100px_80px_80px_80px_80px_80px_80px] gap-4 px-6 py-4 hover:bg-white/5 transition-all duration-200 group"
                >
                  {/* Rank */}
                  <div className="flex items-center justify-center">
                    <div className={`
                      w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm
                      ${globalIndex === 0 ? 'bg-gradient-to-br from-yellow-500 to-yellow-600 text-white shadow-lg shadow-yellow-500/30' : ''}
                      ${globalIndex === 1 ? 'bg-gradient-to-br from-gray-400 to-gray-500 text-white shadow-lg shadow-gray-400/30' : ''}
                      ${globalIndex === 2 ? 'bg-gradient-to-br from-orange-600 to-orange-700 text-white shadow-lg shadow-orange-600/30' : ''}
                      ${globalIndex > 2 ? 'bg-white/5 text-white/70 group-hover:bg-white/10' : ''}
                    `}>
                      {globalIndex + 1}
                    </div>
                  </div>

              {/* Player Info */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex-shrink-0 w-12 h-12 rounded-full overflow-hidden bg-zinc-800 border-2 border-white/10 group-hover:border-emerald-500/30 transition-colors">
                  <img
                    src={player.photo}
                    alt={player.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = "/player-placeholder.jpg";
                    }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-white truncate group-hover:text-emerald-400 transition-colors">
                    {player.name}
                  </div>
                  {player.position && (
                    <div className="text-xs text-white/50 truncate">
                      {player.position}
                    </div>
                  )}
                </div>
              </div>

              {/* Team Logo */}
              <div className="flex items-center justify-center">
                <div className="relative group/team">
                  <img
                    src={player.teamLogo}
                    alt={player.teamName}
                    className="w-10 h-10 object-contain transition-transform group-hover/team:scale-110"
                    onError={(e) => {
                      e.currentTarget.src = "/team-placeholder.png";
                    }}
                  />
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black/90 text-white text-xs rounded opacity-0 group-hover/team:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    {player.teamName}
                  </div>
                </div>
              </div>

              {/* Goals */}
              <div className="flex items-center justify-center">
                <div className={`
                  font-bold text-lg
                  ${player.goals > 0 ? 'text-emerald-400' : 'text-white/30'}
                `}>
                  {player.goals}
                </div>
              </div>

              {/* Assists */}
              <div className="flex items-center justify-center">
                <div className={`
                  font-bold text-lg
                  ${player.assists > 0 ? 'text-blue-400' : 'text-white/30'}
                `}>
                  {player.assists}
                </div>
              </div>

              {/* MVP */}
              <div className="flex items-center justify-center">
                <div className={`
                  font-bold text-lg
                  ${player.mvp > 0 ? 'text-yellow-400' : 'text-white/30'}
                `}>
                  {player.mvp}
                </div>
              </div>

              {/* Yellow Cards */}
              <div className="flex items-center justify-center">
                <div className={`
                  font-bold text-lg
                  ${player.yellowCards > 0 ? 'text-yellow-500' : 'text-white/30'}
                `}>
                  {player.yellowCards}
                </div>
              </div>

              {/* Red Cards */}
              <div className="flex items-center justify-center">
                <div className={`
                  font-bold text-lg
                  ${player.redCards > 0 ? 'text-red-500' : 'text-white/30'}
                `}>
                  {player.redCards}
                </div>
              </div>

              {/* Matches Played */}
              <div className="flex items-center justify-center">
                <div className="font-bold text-lg text-white/70">
                  {player.matchesPlayed}
                </div>
              </div>
            </motion.div>
          );
        })}
          </AnimatePresence>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="border-t border-white/10 bg-gradient-to-r from-black/60 via-zinc-900/60 to-black/60 backdrop-blur-sm px-6 py-4">
            <div className="flex items-center justify-between">
              {/* Page Info */}
              <div className="text-sm text-white/70">
                Εμφάνιση {startIndex + 1}-{Math.min(endIndex, playersWithTeam.length)} από {playersWithTeam.length} παίκτες
              </div>

              {/* Page Controls */}
              <div className="flex items-center gap-2">
                {/* Previous Button */}
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className={`
                    px-3 py-2 rounded-lg font-medium text-sm transition-all
                    ${currentPage === 1
                      ? 'bg-white/5 text-white/30 cursor-not-allowed'
                      : 'bg-white/10 text-white hover:bg-emerald-500/20 hover:text-emerald-400'
                    }
                  `}
                >
                  ← Προηγούμενο
                </button>

                {/* Page Numbers */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                    // Show first page, last page, current page, and pages around current
                    const showPage =
                      page === 1 ||
                      page === totalPages ||
                      (page >= currentPage - 1 && page <= currentPage + 1);

                    const showEllipsis =
                      (page === 2 && currentPage > 3) ||
                      (page === totalPages - 1 && currentPage < totalPages - 2);

                    if (!showPage && !showEllipsis) return null;

                    if (showEllipsis) {
                      return (
                        <span key={page} className="px-2 text-white/50">
                          ...
                        </span>
                      );
                    }

                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`
                          w-10 h-10 rounded-lg font-bold text-sm transition-all
                          ${page === currentPage
                            ? 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-lg shadow-emerald-500/30'
                            : 'bg-white/10 text-white hover:bg-white/20'
                          }
                        `}
                      >
                        {page}
                      </button>
                    );
                  })}
                </div>

                {/* Next Button */}
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className={`
                    px-3 py-2 rounded-lg font-medium text-sm transition-all
                    ${currentPage === totalPages
                      ? 'bg-white/5 text-white/30 cursor-not-allowed'
                      : 'bg-white/10 text-white hover:bg-emerald-500/20 hover:text-emerald-400'
                    }
                  `}
                >
                  Επόμενο →
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {[
          { label: "Συνολικά Γκολ", value: playersWithTeam.reduce((sum, p) => sum + p.goals, 0), icon: "⚽", color: "emerald" },
          { label: "Συνολικά Ασίστ", value: playersWithTeam.reduce((sum, p) => sum + p.assists, 0), icon: "🎯", color: "blue" },
          { label: "Συνολικά MVP", value: playersWithTeam.reduce((sum, p) => sum + p.mvp, 0), icon: "⭐", color: "yellow" },
          { label: "Κίτρινες Κάρτες", value: playersWithTeam.reduce((sum, p) => sum + p.yellowCards, 0), icon: "🟨", color: "yellow" },
          { label: "Κόκκινες Κάρτες", value: playersWithTeam.reduce((sum, p) => sum + p.redCards, 0), icon: "🟥", color: "red" },
          { label: "Σύνολο Παικτών", value: playersWithTeam.length, icon: "👥", color: "white" },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 + index * 0.05 }}
            className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-sm p-4 hover:bg-white/5 transition-colors"
          >
            <div className="text-2xl mb-2">{stat.icon}</div>
            <div className={`text-2xl font-bold text-${stat.color}-400 mb-1`}>
              {stat.value}
            </div>
            <div className="text-xs text-white/70 uppercase tracking-wide">
              {stat.label}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export { PlayerStatistics };
