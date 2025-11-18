// src/app/paiktes/PlayerProfileCard.tsx
"use client";

import { memo, useMemo } from "react";
import ProfileCard from "./ProfileCard";
import type { PlayerLite } from "./types";

type Props = {
  player: PlayerLite;
  isTournamentScoped?: boolean;
};

function StatPill({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={[
        "flex flex-col items-center justify-center rounded-2xl px-2.5 py-2 bg-black/45 border transition-all",
        highlight
          ? "border-amber-400/80 shadow-[0_0_20px_rgba(251,191,36,0.35)]"
          : "border-white/10",
      ].join(" ")}
    >
      <span className="text-[10px] uppercase tracking-[0.16em] text-white/55">
        {label}
      </span>
      <span className="mt-0.5 text-lg font-semibold text-white tabular-nums">
        {value}
      </span>
    </div>
  );
}

function PlayerProfileCardComponent({
  player,
  isTournamentScoped = false,
}: Props) {
  const name = useMemo(
    () => `${player.first_name} ${player.last_name}`.trim() || "—",
    [player.first_name, player.last_name]
  );

  const teamTitle = useMemo(
    () =>
      [player.team?.name, player.position].filter(Boolean).join(" • ") || "—",
    [player.team?.name, player.position]
  );

  const handle = useMemo(
    () =>
      (player.first_name + player.last_name).toLowerCase() || "player",
    [player.first_name, player.last_name]
  );

  const status = useMemo(
    () =>
      [
        player.age != null ? `${player.age}y` : null,
        player.height_cm ? `${player.height_cm}cm` : null,
      ]
        .filter(Boolean)
        .join(" • ") || "—",
    [player.age, player.height_cm]
  );

  // Teams: main + up to 2 secondary (already ranked in page.tsx)
  const teams = useMemo(() => {
    if (player.teams && player.teams.length > 0) {
      return player.teams.slice(0, 3).map((t) => ({
        id: t.id,
        name: t.name,
        logo: t.logo ?? null,
      }));
    }
    if (player.team) {
      return [
        {
          id: player.team.id,
          name: player.team.name,
          logo: player.team.logo ?? null,
        },
      ];
    }
    return [];
  }, [player.teams, player.team]);

  // Tournament-aware stats
  const matchesPlayed = useMemo(
    () =>
      isTournamentScoped && player.tournament_matches !== undefined
        ? player.tournament_matches
        : player.matches ?? 0,
    [isTournamentScoped, player.tournament_matches, player.matches]
  );

  const totalGoals = useMemo(
    () =>
      isTournamentScoped && player.tournament_goals !== undefined
        ? player.tournament_goals
        : player.goals ?? 0,
    [isTournamentScoped, player.tournament_goals, player.goals]
  );

  const totalAssists = useMemo(
    () =>
      isTournamentScoped && player.tournament_assists !== undefined
        ? player.tournament_assists
        : player.assists ?? 0,
    [isTournamentScoped, player.tournament_assists, player.assists]
  );

  const mvpAwards = useMemo(
    () =>
      isTournamentScoped && player.tournament_mvp !== undefined
        ? player.tournament_mvp
        : player.mvp ?? 0,
    [isTournamentScoped, player.tournament_mvp, player.mvp]
  );

  const bestGkAwards = useMemo(
    () =>
      isTournamentScoped && player.tournament_best_gk !== undefined
        ? player.tournament_best_gk
        : player.best_gk ?? 0,
    [isTournamentScoped, player.tournament_best_gk, player.best_gk]
  );

  return (
    <div className="relative flex flex-col gap-4">
      {/* Card itself – stats turned off */}
      <ProfileCard
        avatarUrl={player.photo}
        miniAvatarUrl={player.team?.logo ?? null}
        iconUrl={player.team?.logo ?? null}
        name={name}
        title={teamTitle}
        handle={handle}
        status={status}
        teams={teams}
        // we move stats out of the card into the modal below
        showStats={false}
        showBehindGradient={false}
        enableTilt={true}
        enableMobileTilt={false}
        mobileTiltSensitivity={5}
      />

      {/* Stats “modal” under the card */}
      <div className="relative -mt-2">
        <div className="mx-auto max-w-md">
          <div className="relative rounded-[30px] border border-white/10 bg-gradient-to-b from-zinc-950/95 via-zinc-900/95 to-black/98 shadow-[0_18px_45px_rgba(0,0,0,0.85)] overflow-hidden">
            {/* Glow that follows the card theme (gold / sporty) */}
            <div className="pointer-events-none absolute inset-x-10 -top-10 h-20 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.7),_transparent_60%)] opacity-70" />

            <div className="relative px-5 pt-4 pb-4 space-y-3">
              {/* Header row */}
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-2 rounded-full bg-black/60 border border-amber-400/60 px-3 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-amber-50 flex items-center gap-1">
                    Στατιστικά παίκτη
                    <span aria-hidden>🔥</span>
                  </span>
                </div>

                <div className="text-[11px] font-medium text-white/60">
                  {isTournamentScoped ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-400/70 px-2 py-0.5 text-[10px] text-amber-50">
                      <span className="w-1 h-1 rounded-full bg-amber-300" />
                      Τουρνουά
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/15 px-2 py-0.5 text-[10px] text-white/65">
                      All-time
                    </span>
                  )}
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-5 gap-2">
              <StatPill label="Matches" value={matchesPlayed} />
                <StatPill label="Goals" value={totalGoals} highlight />
                <StatPill label="Assists" value={totalAssists} />
                <StatPill label="MVP" value={mvpAwards} highlight={bestGkAwards > 0}/>
                <StatPill
                  label="GK"
                  value={bestGkAwards}
                  
                />
               
              </div>

              {/* Optional subtle footer line */}
              <div className="flex items-center justify-between pt-1 text-[10px] text-white/35">
                
                {player.team?.name && (
                  <span className="truncate max-w-[60%] text-right">
                    {player.team.name}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const PlayerProfileCard = memo(PlayerProfileCardComponent);
export default PlayerProfileCard;
