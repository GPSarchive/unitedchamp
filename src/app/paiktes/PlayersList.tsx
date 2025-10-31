// src/app/paiktes/PlayersList.tsx
"use client";

import { useRef } from "react";
import SignedImg from "./SignedImg";
import styles from "./PlayersClient.module.css";
import type { PlayerLite } from "./types"; // ← use shared type

type PlayerRow = PlayerLite & { tournament_goals?: number };

type Props = {
  players: PlayerRow[];               // ← was Player[]
  activeId: number | null;
  onPlayerSelect: (id: number) => void;
  onPlayerHover?: (id: number) => void;
  showTournamentGoals?: boolean;
  isAlphaSort?: boolean;
};

export default function PlayersList({
  players,
  activeId,
  onPlayerSelect,
  onPlayerHover,
  showTournamentGoals = false,
  isAlphaSort = false,
}: Props) {
  const itemRefs = useRef<Record<number, HTMLDivElement | null>>({});
  return (
    <div className="flex flex-col h-full ">
      {/* List Header - Column Labels */}
    

      {/* Scrollable List */}
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
                <div key={player.id}>
                  {/* Alphabetical Divider */}
                  {showLetter && (
                    <div className=" top-[57px] z-[9] bg-zinc-900 border-y border-white/10 px-6 py-3 text-sm font-bold text-white/70 tracking-widest">
                      {letter}
                    </div>
                  )}

                  {/* Player Row */}
                  <div
                    ref={(el) => {
                      itemRefs.current[player.id] = el;
                    }}
                    data-pid={player.id}
                    onMouseEnter={() => onPlayerHover?.(player.id)}
                    onClick={() => onPlayerSelect(player.id)}
                    className={`
                      grid grid-cols-[80px_1fr_80px_80px_80px_80px_80px_80px] gap-4 
                      px-6 py-4 
                      border-b border-white/5 
                      cursor-pointer 
                      transition-all duration-200
                      hover:bg-white/5
                      hover:shadow-cyan-500/30 hover:scale-[1.01]  // ← Added nice glow and scale effect on hover
                      ${isActive ? "bg-cyan-500/10 border-l-4 border-l-cyan-400" : ""}
                    `}
                    role="button"
                    aria-pressed={isActive}
                  >
                    {/* Photo */}
                    <div className="flex items-center">
                      <div className="relative w-14 h-14 overflow-hidden rounded-lg bg-white/5 border border-white/10">
                        <SignedImg
                          src={player.photo}
                          alt={`${player.first_name} ${player.last_name}`}
                          className={`${styles.avatarImg} object-cover`}
                        />
                      </div>
                    </div>

                    {/* Player Info */}
                    <div className="flex flex-col justify-center min-w-0">
                      <div className="text-white font-semibold text-lg md:text-base truncate">  
                        {player.first_name} {player.last_name}
                      </div>
                      <div className="text-white/50 text-base md:text-sm mt-0.5 flex items-center gap-2">  
                        <span>{player.team?.name || "—"}</span>
                        {player.position && (
                          <>
                            <span className="text-white/30">•</span>
                            <span>{player.position}</span>
                          </>
                        )}
                        {player.height_cm && (
                          <>
                            <span className="text-white/30">•</span>
                            <span>{player.height_cm}cm</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Stats - Centered */}
                    <div className="flex items-center justify-center">
                      <span className="text-white font-mono text-lg md:text-base"> 
                        {player.matches}
                      </span>
                    </div>

                    <div className="flex items-center justify-center">
                      <span className="text-white font-mono text-lg md:text-base"> 
                        {player.wins}
                      </span>
                    </div>

                    <div className="flex items-center justify-center">
                      <span className="text-white font-mono text-lg md:text-base">  
                        {showTournamentGoals && player.tournament_goals !== undefined
                          ? player.tournament_goals
                          : player.goals}
                      </span>
                    </div>

                    <div className="flex items-center justify-center">
                      <span className="text-white font-mono text-lg md:text-base">  
                        {player.assists}
                      </span>
                    </div>

                    <div className="flex items-center justify-center">
                      <span className="text-white font-mono text-lg md:text-base">  
                        {player.mvp}
                      </span>
                    </div>

                    <div className="flex items-center justify-center">
                      <span className="text-white font-mono text-lg md:text-base"> 
                        {player.best_gk}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}