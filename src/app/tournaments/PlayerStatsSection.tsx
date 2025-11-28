"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import type { Player, Team } from "./useTournamentData";
import { useTournamentData } from "./useTournamentData";

type StatCategory = "goals" | "assists" | "cards" | "awards";

const PlayerStatsSection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<StatCategory>("goals");
  const { players, teams } = useTournamentData();

  if (!players || players.length === 0) {
    return null;
  }

  // Get team name for a player
  const getTeamName = (teamId: number): string => {
    return teams?.find((t) => t.id === teamId)?.name || "Unknown Team";
  };

  // Get team logo for a player
  const getTeamLogo = (teamId: number): string | null => {
    return teams?.find((t) => t.id === teamId)?.logo || null;
  };

  // Sort players by goals
  const topScorers = [...players]
    .sort((a, b) => b.goals - a.goals)
    .filter((p) => p.goals > 0)
    .slice(0, 10);

  // Sort players by assists
  const topAssisters = [...players]
    .sort((a, b) => b.assists - a.assists)
    .filter((p) => p.assists > 0)
    .slice(0, 10);

  // Sort players by cards (yellow + red)
  const mostCarded = [...players]
    .sort((a, b) => {
      const totalA = a.yellowCards + a.redCards * 2; // Red cards weigh more
      const totalB = b.yellowCards + b.redCards * 2;
      return totalB - totalA;
    })
    .filter((p) => p.yellowCards > 0 || p.redCards > 0)
    .slice(0, 10);

  // Awards (MVP and Best Goalkeeper)
  const mvpPlayers = [...players]
    .sort((a, b) => b.mvp - a.mvp)
    .filter((p) => p.mvp > 0)
    .slice(0, 10);

  const bestGoalkeepers = [...players]
    .sort((a, b) => b.bestGoalkeeper - a.bestGoalkeeper)
    .filter((p) => p.bestGoalkeeper > 0)
    .slice(0, 10);

  const tabs = [
    { id: "goals" as StatCategory, label: "Σκόρερ", icon: "⚽" },
    { id: "assists" as StatCategory, label: "Ασίστ", icon: "🎯" },
    { id: "cards" as StatCategory, label: "Κάρτες", icon: "🟨" },
    { id: "awards" as StatCategory, label: "Βραβεία", icon: "🏆" },
  ];

  const renderPlayerRow = (
    player: Player,
    rank: number,
    statValue: number,
    statLabel: string
  ) => (
    <motion.div
      key={player.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.05 }}
      className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-slate-50 to-transparent dark:from-slate-800/30 dark:to-transparent hover:from-slate-100 dark:hover:from-slate-800/50 transition-all group"
    >
      {/* Rank */}
      <div className="flex-shrink-0 w-8 text-center">
        <span
          className={`text-lg font-bold ${
            rank === 0
              ? "text-yellow-500"
              : rank === 1
              ? "text-slate-400"
              : rank === 2
              ? "text-orange-600"
              : "text-slate-500 dark:text-slate-400"
          }`}
        >
          {rank + 1}
        </span>
      </div>

      {/* Player Photo */}
      <div className="flex-shrink-0">
        <img
          src={player.photo || "/player-placeholder.jpg"}
          alt={player.name}
          className="w-12 h-12 rounded-full object-cover border-2 border-slate-200 dark:border-slate-700"
        />
      </div>

      {/* Player Info */}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
          {player.name}
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          {getTeamLogo(player.teamId) && (
            <img
              src={getTeamLogo(player.teamId)!}
              alt=""
              className="w-4 h-4 object-contain"
            />
          )}
          <span className="truncate">{getTeamName(player.teamId)}</span>
          {player.position && (
            <>
              <span>•</span>
              <span>{player.position}</span>
            </>
          )}
        </div>
      </div>

      {/* Stat Value */}
      <div className="flex-shrink-0 text-right">
        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
          {statValue}
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          {statLabel}
        </div>
      </div>
    </motion.div>
  );

  const renderCardsRow = (player: Player, rank: number) => (
    <motion.div
      key={player.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.05 }}
      className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-slate-50 to-transparent dark:from-slate-800/30 dark:to-transparent hover:from-slate-100 dark:hover:from-slate-800/50 transition-all group"
    >
      {/* Rank */}
      <div className="flex-shrink-0 w-8 text-center">
        <span className="text-lg font-bold text-slate-500 dark:text-slate-400">
          {rank + 1}
        </span>
      </div>

      {/* Player Photo */}
      <div className="flex-shrink-0">
        <img
          src={player.photo || "/player-placeholder.jpg"}
          alt={player.name}
          className="w-12 h-12 rounded-full object-cover border-2 border-slate-200 dark:border-slate-700"
        />
      </div>

      {/* Player Info */}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
          {player.name}
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          {getTeamLogo(player.teamId) && (
            <img
              src={getTeamLogo(player.teamId)!}
              alt=""
              className="w-4 h-4 object-contain"
            />
          )}
          <span className="truncate">{getTeamName(player.teamId)}</span>
        </div>
      </div>

      {/* Cards */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {player.yellowCards > 0 && (
          <div className="flex items-center gap-1">
            <div className="w-4 h-5 bg-yellow-400 rounded-sm"></div>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {player.yellowCards}
            </span>
          </div>
        )}
        {player.redCards > 0 && (
          <div className="flex items-center gap-1">
            <div className="w-4 h-5 bg-red-500 rounded-sm"></div>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {player.redCards}
            </span>
          </div>
        )}
        {player.blueCards > 0 && (
          <div className="flex items-center gap-1">
            <div className="w-4 h-5 bg-blue-500 rounded-sm"></div>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {player.blueCards}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Στατιστικά Παικτών
        </h2>
        <span className="text-sm text-slate-600 dark:text-slate-400">
          {players.length} παίκτες
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl shadow-lg overflow-hidden"
      >
        <div className="p-6 space-y-3">
          {activeTab === "goals" && (
            <>
              {topScorers.length > 0 ? (
                topScorers.map((player, index) =>
                  renderPlayerRow(player, index, player.goals, "γκολ")
                )
              ) : (
                <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                  Δεν υπάρχουν στατιστικά γκολ ακόμα
                </div>
              )}
            </>
          )}

          {activeTab === "assists" && (
            <>
              {topAssisters.length > 0 ? (
                topAssisters.map((player, index) =>
                  renderPlayerRow(player, index, player.assists, "ασίστ")
                )
              ) : (
                <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                  Δεν υπάρχουν στατιστικά ασίστ ακόμα
                </div>
              )}
            </>
          )}

          {activeTab === "cards" && (
            <>
              {mostCarded.length > 0 ? (
                mostCarded.map((player, index) => renderCardsRow(player, index))
              ) : (
                <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                  Δεν υπάρχουν κάρτες ακόμα
                </div>
              )}
            </>
          )}

          {activeTab === "awards" && (
            <div className="space-y-6">
              {/* MVP Section */}
              {mvpPlayers.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                    <span>🏆</span>
                    <span>MVP Αγώνων</span>
                  </h3>
                  <div className="space-y-3">
                    {mvpPlayers.map((player, index) =>
                      renderPlayerRow(
                        player,
                        index,
                        player.mvp,
                        player.mvp === 1 ? "φορά" : "φορές"
                      )
                    )}
                  </div>
                </div>
              )}

              {/* Best Goalkeeper Section */}
              {bestGoalkeepers.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                    <span>🧤</span>
                    <span>Καλύτερος Τερματοφύλακας</span>
                  </h3>
                  <div className="space-y-3">
                    {bestGoalkeepers.map((player, index) =>
                      renderPlayerRow(
                        player,
                        index,
                        player.bestGoalkeeper,
                        player.bestGoalkeeper === 1 ? "φορά" : "φορές"
                      )
                    )}
                  </div>
                </div>
              )}

              {mvpPlayers.length === 0 && bestGoalkeepers.length === 0 && (
                <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                  Δεν υπάρχουν βραβεία ακόμα
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default PlayerStatsSection;
