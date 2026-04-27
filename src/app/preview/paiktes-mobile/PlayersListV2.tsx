// src/app/preview/paiktes-mobile/PlayersListV2.tsx
// Fork of @/app/paiktes/PlayersList with a subtler alphabetical divider:
// no background, no lines — just a small muted letter label above its group.
"use client";

import { useRef, useMemo, memo, useCallback } from "react";
import { PlayerImage } from "@/app/lib/OptimizedImage";
import type { PlayerLite } from "@/app/paiktes/types";

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

const GRID_TEMPLATE =
  "grid grid-cols-[56px_minmax(140px,1fr)_52px_52px_52px_52px_52px_52px] sm:grid-cols-[64px_1fr_60px_60px_60px_60px_60px_60px] md:grid-cols-[80px_1fr_80px_80px_80px_80px_80px_80px]";
const GRID_GAPS = "gap-1.5 sm:gap-2 md:gap-3";

const COLUMN_HEADERS = [
  { key: "photo", label: "Φωτό", fullLabel: "Φωτό", align: "text-left" },
  {
    key: "player",
    label: "Παίκτης",
    fullLabel: "Παίκτης / Ομάδα",
    align: "text-left",
  },
  { key: "matches", label: "Αγ.", fullLabel: "Αγώνες", align: "text-center" },
  { key: "wins", label: "Ν.", fullLabel: "Νίκες", align: "text-center" },
  { key: "goals", label: "Γκ.", fullLabel: "Γκολ", align: "text-center" },
  { key: "assists", label: "Ασ.", fullLabel: "Ασίστ", align: "text-center" },
  { key: "mvp", label: "MVP", fullLabel: "MVP", align: "text-center" },
  { key: "best_gk", label: "TΦ.", fullLabel: "Τερμ.", align: "text-center" },
];

const pad2 = (n: number | string) => String(n).padStart(2, "0");

function getDisplayPhoto(player: PlayerRow): string {
  if (player.photo && player.photo !== "/player-placeholder.svg") {
    return player.photo;
  }
  return player.team?.logo || player.teams?.[0]?.logo || player.photo;
}

const PlayerRowItem = memo(function PlayerRowItem({
  player,
  index,
  isActive,
  showLetter,
  letter,
  isTournamentScoped,
  onPlayerSelect,
  onPlayerHover,
}: {
  player: PlayerRow;
  index: number;
  isActive: boolean;
  showLetter: boolean;
  letter: string;
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

  const goals = isTournamentScoped && player.tournament_goals !== undefined
    ? player.tournament_goals
    : player.goals;

  const matches = isTournamentScoped && player.tournament_matches !== undefined
    ? player.tournament_matches
    : player.matches;

  const wins = isTournamentScoped && player.tournament_wins !== undefined
    ? player.tournament_wins
    : player.wins;

  const assists = isTournamentScoped && player.tournament_assists !== undefined
    ? player.tournament_assists
    : player.assists;

  const mvp = isTournamentScoped && player.tournament_mvp !== undefined
    ? player.tournament_mvp
    : player.mvp;

  const bestGk = isTournamentScoped && player.tournament_best_gk !== undefined
    ? player.tournament_best_gk
    : player.best_gk;

  return (
    <div>
      {/* Subtle letter divider — no bg, no lines, just a muted label above the group */}
      {showLetter && (
        <div className="px-4 md:px-6 pt-3 pb-0.5 min-w-[640px]">
          <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#fb923c]/55">
            {letter}
          </span>
        </div>
      )}

      {/* Player Row */}
      <div
        data-pid={player.id}
        onMouseEnter={handleMouseEnter}
        onClick={handleClick}
        className={`${GRID_TEMPLATE} ${GRID_GAPS}
          px-4 md:px-6 py-2.5 md:py-3 min-w-[640px]
          border-b border-[#F3EFE6]/10
          cursor-pointer transition-colors
          ${
            isActive
              ? "bg-[#fb923c]/10 border-l-2 md:border-l-4 border-l-[#fb923c]"
              : "hover:bg-[#13131d]"
          }`}
        role="button"
        aria-pressed={isActive}
      >
        {/* Photo */}
        <div className="flex items-center">
          <div
            className="relative h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12 overflow-hidden border-2"
            style={{
              borderColor: isActive
                ? "#fb923c"
                : "rgba(243,239,230,0.2)",
              background: "#13131d",
            }}
          >
            <PlayerImage
              src={displayPhoto}
              alt={`${player.first_name} ${player.last_name}`}
              width={48}
              height={48}
              className="w-full h-full object-cover"
              animate={false}
            />
          </div>
        </div>

        {/* Player Info */}
        <div className="flex flex-col justify-center min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[9px] tabular-nums text-[#F3EFE6]/40 shrink-0">
              {pad2(index + 1)}
            </span>
            <div className="font-[var(--f-display)] text-sm md:text-base font-semibold italic text-[#F3EFE6] truncate">
              {player.first_name} {player.last_name}
            </div>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[9px] md:text-[10px] uppercase tracking-[0.22em] text-[#F3EFE6]/50">
            <span className="truncate">{player.team?.name || "—"}</span>
            {player.position && (
              <>
                <span className="text-[#F3EFE6]/25 hidden sm:inline">·</span>
                <span className="hidden sm:inline">{player.position}</span>
              </>
            )}
          </div>
        </div>

        {/* Stats */}
        <StatCell value={matches} />
        <StatCell value={wins} />
        <StatCell value={goals} highlight={goals > 0} />
        <StatCell value={assists} />
        <StatCell value={mvp} highlight={mvp > 0} accent="#E8B931" />
        <StatCell value={bestGk} highlight={bestGk > 0} accent="#60a5fa" />
      </div>
    </div>
  );
});

function StatCell({
  value,
  highlight,
  accent = "#fb923c",
}: {
  value: number;
  highlight?: boolean;
  accent?: string;
}) {
  return (
    <div className="flex items-center justify-center">
      <span
        className="font-[var(--f-brutal)] text-sm md:text-base leading-none tabular-nums"
        style={{
          color: highlight ? accent : value === 0 ? "rgba(243,239,230,0.35)" : "#F3EFE6",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function PlayersListV2Component({
  players,
  activeId,
  onPlayerSelect,
  onPlayerHover,
  isAlphaSort = false,
  isTournamentScoped = false,
}: Props) {
  const itemRefs = useRef<Record<number, HTMLDivElement | null>>({});

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        {players.length === 0 ? (
          <div className="flex items-center justify-center p-12">
            <div className="border-2 border-dashed border-[#F3EFE6]/25 bg-[#13131d]/40 px-10 py-8 text-center">
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#fb923c]">
                / 00 · Κατάλογος
              </span>
              <p className="mt-3 font-[var(--f-display)] text-2xl font-black italic leading-tight text-[#F3EFE6]">
                Δεν βρέθηκαν παίκτες
              </p>
              <p className="mt-2 font-[var(--f-body)] text-sm text-[#F3EFE6]/60">
                Δοκιμάστε άλλα κριτήρια αναζήτησης.
              </p>
            </div>
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            {/* Header */}
            <div className="sticky top-0 z-20 bg-[#0a0a14]/95 backdrop-blur-sm border-b-2 border-[#F3EFE6]/15 min-w-[640px]">
              <div
                className={`${GRID_TEMPLATE} ${GRID_GAPS} px-4 md:px-6 py-2.5 font-mono text-[9px] md:text-[10px] uppercase tracking-[0.25em] text-[#F3EFE6]/55`}
              >
                {COLUMN_HEADERS.map((col) => (
                  <div key={col.key} className={col.align}>
                    <span className="hidden md:inline">{col.fullLabel}</span>
                    <span className="md:hidden">{col.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Player rows */}
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
                    index={idx}
                    isActive={isActive}
                    showLetter={showLetter}
                    letter={letter}
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

const PlayersListV2 = memo(PlayersListV2Component);
export default PlayersListV2;
