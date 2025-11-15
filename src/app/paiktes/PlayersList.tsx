// src/app/paiktes/PlayersList.tsx (OPTIMIZED - React.memo + fixed useMemo)
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
};

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
  onPlayerSelect,
  onPlayerHover,
}: {
  player: PlayerRow;
  isActive: boolean;
  showLetter: boolean;
  letter: string;
  showTournamentGoals: boolean;
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
        <div className="sticky top-0 z-[9] bg-zinc-900 border-y border-white/10 px-3 md:px-6 py-2 md:py-3 text-xs md:text-sm font-bold text-white/70 tracking-widest">
          {letter}
        </div>
      )}

      {/* Player Row */}
      <div
        data-pid={player.id}
        onMouseEnter={handleMouseEnter}
        onClick={handleClick}
        className={`
          grid grid-cols-[60px_1fr_60px_60px_60px_60px_60px_60px] md:grid-cols-[80px_1fr_80px_80px_80px_80px_80px_80px] gap-2 md:gap-4
          px-3 md:px-6 py-3 md:py-4
          border-b border-white/5
          cursor-pointer
          transition-all duration-200
          hover:bg-white/5
          hover:shadow-cyan-500/30 hover:scale-[1.01]
          ${isActive ? "bg-cyan-500/10 border-l-2 md:border-l-4 border-l-cyan-400" : ""}
        `}
        role="button"
        aria-pressed={isActive}
      >
        {/* Photo */}
        <div className="flex items-center">
          <div className="relative w-12 h-12 md:w-14 md:h-14 overflow-hidden rounded-lg bg-white/5 border border-white/10">
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
          <div className="text-white font-semibold text-sm md:text-base truncate">
            {player.first_name} {player.last_name}
          </div>
          <div className="text-white/50 text-xs md:text-sm mt-0.5 flex items-center gap-1 md:gap-2">
            <span className="truncate">{player.team?.name || "—"}</span>
            {player.position && (
              <>
                <span className="text-white/30 hidden sm:inline">•</span>
                <span className="hidden sm:inline">{player.position}</span>
              </>
            )}
            {player.height_cm && (
              <>
                <span className="text-white/30 hidden sm:inline">•</span>
                <span className="hidden sm:inline">{player.height_cm}cm</span>
              </>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-center">
          <span className="text-white font-mono text-xs md:text-base">
            {player.matches}
          </span>
        </div>

        <div className="flex items-center justify-center">
          <span className="text-white font-mono text-xs md:text-base">
            {player.wins}
          </span>
        </div>

        <div className="flex items-center justify-center">
          <span className="text-white font-mono text-xs md:text-base">
            {showTournamentGoals && player.tournament_goals !== undefined
              ? player.tournament_goals
              : player.goals}
          </span>
        </div>

        <div className="flex items-center justify-center">
          <span className="text-white font-mono text-xs md:text-base">
            {player.assists}
          </span>
        </div>

        <div className="flex items-center justify-center">
          <span className="text-white font-mono text-xs md:text-base">
            {player.mvp}
          </span>
        </div>

        <div className="flex items-center justify-center">
          <span className="text-white font-mono text-xs md:text-base">
            {player.best_gk}
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
}: Props) {
  const itemRefs = useRef<Record<number, HTMLDivElement | null>>({});
  
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        {players.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-white/40">
            Δεν βρέθηκαν παίκτες
          </div>
        ) : (
          <div>
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
                  onPlayerSelect={onPlayerSelect}
                  onPlayerHover={onPlayerHover}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ✅ Export memoized component
const PlayersList = memo(PlayersListComponent);
export default PlayersList;