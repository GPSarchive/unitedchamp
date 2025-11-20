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
        "flex flex-col items-center justify-center rounded-xl sm:rounded-2xl px-1.5 sm:px-2.5 py-1.5 sm:py-2 bg-black/45 border transition-all",
        highlight
          ? "border-amber-400/80 shadow-[0_0_20px_rgba(251,191,36,0.35)]"
          : "border-white/10",
      ].join(" ")}
    >
      <span className="text-[8px] sm:text-[10px] uppercase tracking-[0.12em] sm:tracking-[0.16em] text-white/55 leading-tight">
        {label}
      </span>
      <span className="mt-0.5 text-sm sm:text-lg font-semibold text-white tabular-nums">
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
    <div className="relative flex flex-col gap-3 sm:gap-4">
      {/* Premium background behind card */}
      <div className="absolute inset-0 -z-10 overflow-hidden rounded-[40px]">
        {/* Radial glow effect */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(212,175,55,0.15)_0%,_rgba(140,108,0,0.08)_25%,_transparent_60%)]" />

        {/* Animated mesh gradient */}
        <div
          className="absolute inset-0 opacity-40"
          style={{
            background: `
              radial-gradient(circle at 20% 30%, rgba(212, 175, 55, 0.2) 0%, transparent 40%),
              radial-gradient(circle at 80% 70%, rgba(255, 193, 7, 0.15) 0%, transparent 40%),
              radial-gradient(circle at 40% 80%, rgba(140, 108, 0, 0.25) 0%, transparent 50%),
              radial-gradient(circle at 90% 20%, rgba(212, 175, 55, 0.18) 0%, transparent 45%)
            `,
            animation: 'meshMove 20s ease-in-out infinite',
          }}
        />

        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(212, 175, 55, 0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(212, 175, 55, 0.3) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
          }}
        />

        {/* Spotlight effect from top */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-[40%] bg-[radial-gradient(ellipse_at_top,_rgba(255,255,255,0.08)_0%,_transparent_60%)] blur-2xl" />

        {/* Corner accents */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-[radial-gradient(circle_at_top_right,_rgba(212,175,55,0.2)_0%,_transparent_70%)] blur-xl" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-[radial-gradient(circle_at_bottom_left,_rgba(212,175,55,0.2)_0%,_transparent_70%)] blur-xl" />
      </div>

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

      {/* Stats "modal" under the card */}
      <div className="relative -mt-2">
        <div className="mx-auto w-full max-w-md px-1 sm:px-0">
          <div className="relative rounded-[20px] sm:rounded-[30px] border border-white/10 bg-gradient-to-b from-zinc-950/95 via-zinc-900/95 to-black/98 shadow-[0_18px_45px_rgba(0,0,0,0.85)] overflow-hidden">
            {/* Glow that follows the card theme (gold / sporty) */}
            <div className="pointer-events-none absolute inset-x-10 -top-10 h-20 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.7),_transparent_60%)] opacity-70" />

            <div className="relative px-3 sm:px-5 pt-3 sm:pt-4 pb-3 sm:pb-4 space-y-2 sm:space-y-3">
              {/* Header row */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full bg-black/60 border border-amber-400/60 px-2 sm:px-3 py-0.5 sm:py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[9px] sm:text-[11px] font-semibold tracking-[0.12em] uppercase text-amber-50 flex items-center gap-1">
                    Στατιστικά παίκτη
                    <span aria-hidden>🔥</span>
                  </span>
                </div>

                <div className="text-[10px] sm:text-[11px] font-medium text-white/60">
                  {isTournamentScoped ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-400/70 px-2 py-0.5 text-[9px] sm:text-[10px] text-amber-50">
                      <span className="w-1 h-1 rounded-full bg-amber-300" />
                      Τουρνουά
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/15 px-2 py-0.5 text-[9px] sm:text-[10px] text-white/65">
                      All-time
                    </span>
                  )}
                </div>
              </div>

              {/* Stats grid - responsive columns */}
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 sm:gap-2">
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
              {player.team?.name && (
                <div className="flex items-center justify-end pt-1 text-[9px] sm:text-[10px] text-white/35">
                  <span className="truncate max-w-full text-right">
                    {player.team.name}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const PlayerProfileCard = memo(PlayerProfileCardComponent);
export default PlayerProfileCard;
