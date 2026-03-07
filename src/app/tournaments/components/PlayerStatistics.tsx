"use client";

import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, ChevronUp, ChevronDown } from "lucide-react";
import { FaFutbol, FaHandsHelping, FaExclamationTriangle, FaTimesCircle } from "react-icons/fa";
import { MdSportsSoccer } from "react-icons/md";
import type { Player, Team } from "../useTournamentData";
import { resolvePlayerPhotoUrl } from "@/app/lib/player-images";

type PlayerStatisticsProps = {
  players: Player[];
  teams: Team[];
};

type PlayerWithTeam = Player & {
  teamName: string;
  teamLogo: string;
};

const PLAYERS_PER_PAGE = 10;

type SortKey = "goals" | "assists" | "mvp" | "yellowCards" | "redCards" | "matchesPlayed";
type SortDirection = "asc" | "desc";

const PlayerStatistics: React.FC<PlayerStatisticsProps> = ({ players, teams }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("goals");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const teamMap = useMemo(
    () => new Map(teams.map((team) => [team.id, team])),
    [teams]
  );

  const playersWithTeam = useMemo((): PlayerWithTeam[] => {
    return players
      .map((player) => {
        const team = teamMap.get(player.teamId);
        return {
          ...player,
          teamName: team?.name || "Unknown Team",
          teamLogo: team?.logo || "/team-placeholder.png",
        };
      })
      .sort((a, b) => {
        const aValue = a[sortKey];
        const bValue = b[sortKey];
        if (sortDirection === "desc") {
          if (bValue !== aValue) return bValue - aValue;
          if (sortKey !== "goals") return b.goals - a.goals;
          return b.assists - a.assists;
        } else {
          if (aValue !== bValue) return aValue - bValue;
          if (sortKey !== "goals") return b.goals - a.goals;
          return b.assists - a.assists;
        }
      });
  }, [players, teamMap, sortKey, sortDirection]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === "desc" ? "asc" : "desc");
    } else {
      setSortKey(key);
      setSortDirection("desc");
    }
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(playersWithTeam.length / PLAYERS_PER_PAGE);
  const startIndex = (currentPage - 1) * PLAYERS_PER_PAGE;
  const endIndex = startIndex + PLAYERS_PER_PAGE;
  const currentPlayers = playersWithTeam.slice(startIndex, endIndex);

  React.useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  if (!players || players.length === 0) {
    return (
      <div className="space-y-5">
        <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
          Στατιστικά Παικτών
        </h2>
        <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.01] p-16 text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-white/[0.04] flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <p className="text-base font-medium text-white/40 mb-1">
            Δεν υπάρχουν στατιστικά παικτών
          </p>
          <p className="text-sm text-white/25">
            Τα στατιστικά των παικτών θα εμφανιστούν εδώ όταν υπάρχουν δεδομένα.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
          Στατιστικά Παικτών
        </h2>
        <span className="text-sm text-white/30 font-medium">
          {playersWithTeam.length} {playersWithTeam.length === 1 ? "παίκτης" : "παίκτες"}
        </span>
      </div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="rounded-2xl border border-white/[0.06] overflow-hidden bg-white/[0.02] backdrop-blur-xl"
      >
        <div className="overflow-x-auto">
          {/* Table Header */}
          <div className="border-b border-white/[0.04] bg-white/[0.02]">
            <div className="grid grid-cols-[48px_1fr_80px_64px_64px_64px_64px_64px_64px] gap-3 px-5 py-3 text-[10px] font-semibold text-white/35 uppercase tracking-wider min-w-[820px]">
              <div className="text-center">#</div>
              <div>Παίκτης</div>
              <div className="text-center">Ομάδα</div>

              <SortButton
                icon={<FaFutbol className="w-2.5 h-2.5 text-emerald-400/70" />}
                label="Γκολ"
                sortKey="goals"
                currentKey={sortKey}
                currentDir={sortDirection}
                onClick={handleSort}
              />
              <SortButton
                icon={<FaHandsHelping className="w-2.5 h-2.5 text-blue-400/70" />}
                label="Ασίστ"
                sortKey="assists"
                currentKey={sortKey}
                currentDir={sortDirection}
                onClick={handleSort}
              />
              <SortButton
                icon={<Trophy className="w-2.5 h-2.5 text-yellow-400/70" />}
                label="MVP"
                sortKey="mvp"
                currentKey={sortKey}
                currentDir={sortDirection}
                onClick={handleSort}
              />
              <SortButton
                icon={<FaExclamationTriangle className="w-2.5 h-2.5 text-yellow-500/70" />}
                label="ΚΚ"
                sortKey="yellowCards"
                currentKey={sortKey}
                currentDir={sortDirection}
                onClick={handleSort}
                title="Κίτρινες Κάρτες"
              />
              <SortButton
                icon={<FaTimesCircle className="w-2.5 h-2.5 text-red-500/70" />}
                label="ΚΚ"
                sortKey="redCards"
                currentKey={sortKey}
                currentDir={sortDirection}
                onClick={handleSort}
                title="Κόκκινες Κάρτες"
              />
              <SortButton
                icon={<MdSportsSoccer className="w-2.5 h-2.5 text-white/40" />}
                label="ΑΓ"
                sortKey="matchesPlayed"
                currentKey={sortKey}
                currentDir={sortDirection}
                onClick={handleSort}
                title="Αγώνες"
              />
            </div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-white/[0.03]">
            <AnimatePresence mode="wait">
              {currentPlayers.map((player, index) => {
                const globalIndex = startIndex + index;
                return (
                  <motion.div
                    key={`${player.id}-${player.teamId}-${currentPage}`}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 12 }}
                    transition={{ duration: 0.25, delay: index * 0.02 }}
                    className="grid grid-cols-[48px_1fr_80px_64px_64px_64px_64px_64px_64px] gap-3 px-5 py-3.5 hover:bg-white/[0.03] transition-colors duration-150 group min-w-[820px]"
                  >
                    {/* Rank */}
                    <div className="flex items-center justify-center">
                      <span
                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                          globalIndex === 0
                            ? "bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 text-yellow-400 ring-1 ring-yellow-500/20"
                            : globalIndex === 1
                            ? "bg-gradient-to-br from-zinc-400/15 to-zinc-500/5 text-zinc-300 ring-1 ring-zinc-400/15"
                            : globalIndex === 2
                            ? "bg-gradient-to-br from-orange-500/15 to-orange-600/5 text-orange-400 ring-1 ring-orange-500/15"
                            : "bg-white/[0.03] text-white/30"
                        }`}
                      >
                        {globalIndex + 1}
                      </span>
                    </div>

                    {/* Player Info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex-shrink-0 w-10 h-10 rounded-xl overflow-hidden bg-zinc-900 ring-1 ring-white/[0.06] transition-all duration-200 group-hover:ring-emerald-500/20">
                        <img
                          src={resolvePlayerPhotoUrl(player.photo)}
                          alt={player.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = "/player-placeholder.jpg";
                          }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-white/90 truncate transition-colors duration-200 group-hover:text-emerald-400">
                          {player.name}
                        </div>
                        {player.position && (
                          <div className="text-[10px] text-white/30 truncate uppercase tracking-wide">
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
                          className="w-8 h-8 object-contain transition-transform duration-200 group-hover/team:scale-110"
                          onError={(e) => {
                            e.currentTarget.src = "/team-placeholder.png";
                          }}
                        />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-zinc-900 border border-white/10 text-white text-[10px] rounded-lg opacity-0 group-hover/team:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                          {player.teamName}
                        </div>
                      </div>
                    </div>

                    {/* Stats */}
                    <StatCell value={player.goals} highlight={player.goals > 0} color="text-emerald-400" />
                    <StatCell value={player.assists} highlight={player.assists > 0} color="text-blue-400" />
                    <StatCell value={player.mvp} highlight={player.mvp > 0} color="text-yellow-400" />
                    <StatCell value={player.yellowCards} highlight={player.yellowCards > 0} color="text-yellow-500" />
                    <StatCell value={player.redCards} highlight={player.redCards > 0} color="text-red-500" />
                    <StatCell value={player.matchesPlayed} highlight={false} color="text-white/50" alwaysShow />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="border-t border-white/[0.04] bg-white/[0.02] px-5 py-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/30">
                {startIndex + 1}–{Math.min(endIndex, playersWithTeam.length)} από{" "}
                {playersWithTeam.length}
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    currentPage === 1
                      ? "bg-white/[0.02] text-white/15 cursor-not-allowed"
                      : "bg-white/[0.04] text-white/60 hover:bg-emerald-500/10 hover:text-emerald-400"
                  }`}
                >
                  ← Προηγ.
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
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
                        <span key={page} className="px-1.5 text-white/20 text-xs">
                          ···
                        </span>
                      );
                    }

                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                          page === currentPage
                            ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30"
                            : "bg-white/[0.03] text-white/40 hover:bg-white/[0.06] hover:text-white/60"
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    currentPage === totalPages
                      ? "bg-white/[0.02] text-white/15 cursor-not-allowed"
                      : "bg-white/[0.04] text-white/60 hover:bg-emerald-500/10 hover:text-emerald-400"
                  }`}
                >
                  Επόμ. →
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

/* ─── Sort Button ─── */
function SortButton({
  icon,
  label,
  sortKey,
  currentKey,
  currentDir,
  onClick,
  title,
}: {
  icon: React.ReactNode;
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  currentDir: SortDirection;
  onClick: (key: SortKey) => void;
  title?: string;
}) {
  const isActive = currentKey === sortKey;
  return (
    <button
      onClick={() => onClick(sortKey)}
      className={`flex items-center justify-center gap-0.5 transition-colors ${
        isActive ? "text-emerald-400" : "hover:text-white/60"
      }`}
      title={title || label}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
      {isActive &&
        (currentDir === "desc" ? (
          <ChevronDown className="w-2.5 h-2.5" />
        ) : (
          <ChevronUp className="w-2.5 h-2.5" />
        ))}
    </button>
  );
}

/* ─── Stat Cell ─── */
function StatCell({
  value,
  highlight,
  color,
  alwaysShow,
}: {
  value: number;
  highlight: boolean;
  color: string;
  alwaysShow?: boolean;
}) {
  return (
    <div className="flex items-center justify-center">
      <span
        className={`text-sm font-bold tabular-nums ${
          highlight || alwaysShow ? color : "text-white/15"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export { PlayerStatistics };
