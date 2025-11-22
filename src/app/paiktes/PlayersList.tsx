// src/app/paiktes/PlayersList.tsx (OPTIMIZED - Mobile-friendly layout)
"use client";

import { useRef, useMemo, memo, useCallback } from "react";
import { PlayerImage } from "@/app/lib/OptimizedImage";
import type { PlayerLite } from "./types";

type PlayerRow = PlayerLite & { tournament_goals?: number };

type Props = {
  players: PlayerRow[];
  activeId: number | null;
  onPlayerSelect: (id: number) => void;
  onPlayerHover?: (id: number) => void;
  showTournamentGoals?: boolean;
  isAlphaSort?: boolean;
  isTournamentScoped?: boolean;
};

// ✅ Mobile-optimized grid - all columns visible with horizontal scroll on mobile
const GRID_TEMPLATE =
  "grid grid-cols-[60px_minmax(140px,1fr)_60px_60px_60px_60px_60px_60px] sm:grid-cols-[70px_1fr_70px_70px_70px_70px_70px_70px] md:grid-cols-[90px_1fr_90px_90px_90px_90px_90px_90px]";
const GRID_GAPS = "gap-1.5 sm:gap-2 md:gap-4";

const COLUMN_HEADERS = [
  { key: "photo", label: "Φωτό", fullLabel: "Φωτογραφία", align: "text-left" },
  { key: "player", label: "Παίκτης", fullLabel: "Παίκτης / Ομάδα", align: "text-left" },
  { key: "matches", label: "Αγ.", fullLabel: "Αγώνες", align: "text-center" },
  { key: "wins", label: "Ν.", fullLabel: "Νίκες", align: "text-center" },
  { key: "goals", label: "Γκολ", fullLabel: "Γκολ", align: "text-center" },
  { key: "assists", label: "Ασ.", fullLabel: "Ασίστ", align: "text-center" },
  { key: "mvp", label: "MVP", fullLabel: "Βραβεία MVP", align: "text-center" },
  { key: "best_gk", label: "GK", fullLabel: "Καλύτερος GK", align: "text-center" },
];

// ✅ Helper function to compute display photo (moved outside component)
function getDisplayPhoto(player: PlayerRow): string {
  if (player.photo && player.photo !== "/player-placeholder.jpg") {
    return player.photo;
  }
  // Fallback to first team logo
  return player.team?.logo || player.teams?.[0]?.logo || player.photo;
}

// ✅ Memoized individual player row component
const PlayerRowItem = memo(function PlayerRowItem({
  player,
  isActive,
  showLetter,
  letter,
  showTournamentGoals,
  isTournamentScoped,
  onPlayerSelect,
  onPlayerHover,
}: {
  player: PlayerRow;
  isActive: boolean;
  showLetter: boolean;
  letter: string;
  showTournamentGoals: boolean;
  isTournamentScoped: boolean;
  onPlayerSelect: (id: number) => void;
  onPlayerHover?: (id: number) => void;
}) {
  const displayPhoto = useMemo(() => getDisplayPhoto(player), [player]);

  const handleClick = useCallback(() => {
    onPlayerSelect(player.id);
  }, [onPlayerSelect, player.id]);

  const handleMouseEnter = useCallback(() => {
    onPlayerHover?.(player.id);
  }, [onPlayerHover, player.id]);

  return (
    <div>
      {/* Alphabetical Divider */}
      {showLetter && (
        <div className="bg-zinc-900 border-y border-white/10 px-2 sm:px-3 md:px-6 py-1.5 sm:py-2 md:py-3 text-[10px] sm:text-xs md:text-sm font-bold text-white/70 tracking-widest min-w-[640px]">
          {letter}
        </div>
      )}

      {/* Player Row */}
      <div
        data-pid={player.id}
        onMouseEnter={handleMouseEnter}
        onClick={handleClick}
        className={`
          ${GRID_TEMPLATE} ${GRID_GAPS}
          px-2 sm:px-3 md:px-6 py-2 sm:py-3 md:py-4
          border-b border-white/5
          cursor-pointer
          transition-all duration-200
          hover:bg-white/5
          active:bg-white/10
          ${isActive ? "bg-cyan-500/10 border-l-2 md:border-l-4 border-l-cyan-400" : ""}
        `}
        role="button"
        aria-pressed={isActive}
      >
        {/* Photo */}
        <div className="flex items-center">
          <div className="relative w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 overflow-hidden rounded-md md:rounded-lg bg-white/5 border border-white/10">
            <PlayerImage
              src={displayPhoto}
              alt={`${player.first_name} ${player.last_name}`}
              width={56}
              height={56}
              className="w-full h-full object-cover"
              animate={false}
            />
          </div>
        </div>

        {/* Player Info */}
        <div className="flex flex-col justify-center min-w-0">
          <div className="text-white font-semibold text-xs sm:text-sm md:text-base truncate">
            {player.first_name} {player.last_name}
          </div>
          <div className="text-white/50 text-[10px] sm:text-xs md:text-sm mt-0.5 flex items-center gap-1 md:gap-2">
            <span className="truncate">{player.team?.name || "—"}</span>
            {player.position && (
              <>
                <span className="text-white/30 hidden sm:inline">•</span>
                <span className="hidden sm:inline">{player.position}</span>
              </>
            )}
          </div>
        </div>

        {/* Stats - Tournament-aware */}
        {/* Matches */}
        <div className="flex items-center justify-center">
          <span className="text-white font-mono text-[10px] sm:text-xs md:text-base">
            {isTournamentScoped && player.tournament_matches !== undefined
              ? player.tournament_matches
              : player.matches}
          </span>
        </div>

        {/* Wins */}
        <div className="flex items-center justify-center">
          <span className="text-white font-mono text-[10px] sm:text-xs md:text-base">
            {isTournamentScoped && player.tournament_wins !== undefined
              ? player.tournament_wins
              : player.wins}
          </span>
        </div>

        {/* Goals */}
        <div className="flex items-center justify-center">
          <span className="text-white font-mono text-[10px] sm:text-sm md:text-base font-semibold">
            {isTournamentScoped && player.tournament_goals !== undefined
              ? player.tournament_goals
              : player.goals}
          </span>
        </div>

        {/* Assists */}
        <div className="flex items-center justify-center">
          <span className="text-white font-mono text-[10px] sm:text-xs md:text-base">
            {isTournamentScoped && player.tournament_assists !== undefined
              ? player.tournament_assists
              : player.assists}
          </span>
        </div>

        {/* MVP */}
        <div className="flex items-center justify-center">
          <span className="text-white font-mono text-[10px] sm:text-sm md:text-base">
            {isTournamentScoped && player.tournament_mvp !== undefined
              ? player.tournament_mvp
              : player.mvp}
          </span>
        </div>

        {/* Best GK */}
        <div className="flex items-center justify-center">
          <span className="text-white font-mono text-[10px] sm:text-xs md:text-base">
            {isTournamentScoped && player.tournament_best_gk !== undefined
              ? player.tournament_best_gk
              : player.best_gk}
          </span>
        </div>
      </div>
    </div>
  );
});

function PlayersListComponent({
  players,
  activeId,
  onPlayerSelect,
  onPlayerHover,
  showTournamentGoals = false,
  isAlphaSort = false,
  isTournamentScoped = false,
}: Props) {
  const itemRefs = useRef<Record<number, HTMLDivElement | null>>({});

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        {players.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-white/40 text-sm">
            Δεν βρέθηκαν παίκτες
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            {/* Header */}
            <div className="sticky top-0 z-20 bg-zinc-950 border-b border-white/10 shadow-lg min-w-[640px]">
              <div
                className={`${GRID_TEMPLATE} ${GRID_GAPS} px-2 sm:px-3 md:px-6 py-2 sm:py-2.5 md:py-3 text-[9px] sm:text-[10px] md:text-xs font-semibold uppercase tracking-wider text-white/60`}
              >
                {COLUMN_HEADERS.map((col) => (
                  <div
                    key={col.key}
                    className={col.align}
                  >
                    <span className="hidden sm:inline">{col.fullLabel}</span>
                    <span className="sm:hidden">{col.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Player rows */}
            <div className="min-w-[640px]">
              {players.map((player, idx) => {
                const prev = players[idx - 1];
                const letter = (player.last_name || player.first_name || "?")
                  .charAt(0)
                  .toUpperCase();
                const prevLetter = (prev?.last_name || prev?.first_name || "")
                  .charAt(0)
                  .toUpperCase();
                const showLetter = isAlphaSort && (!prev || prevLetter !== letter);
                const isActive = activeId === player.id;

                return (
                  <PlayerRowItem
                    key={player.id}
                    player={player}
                    isActive={isActive}
                    showLetter={showLetter}
                    letter={letter}
                    showTournamentGoals={showTournamentGoals}
                    isTournamentScoped={isTournamentScoped}
                    onPlayerSelect={onPlayerSelect}
                    onPlayerHover={onPlayerHover}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ✅ Export memoized component
const PlayersList = memo(PlayersListComponent);
export default PlayersList;