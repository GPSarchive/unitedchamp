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
  accent = "#F3EFE6",
  highlight = false,
}: {
  label: string;
  value: number;
  accent?: string;
  highlight?: boolean;
}) {
  const active = highlight && value > 0;
  return (
    <div
      className="flex flex-col items-center justify-center border-2 px-1.5 py-2 transition-colors"
      style={{
        borderColor: active ? accent : "rgba(243,239,230,0.2)",
        background: active ? `${accent}12` : "#0a0a14",
      }}
    >
      <span
        className="font-mono text-[9px] uppercase tracking-[0.22em] leading-tight"
        style={{ color: active ? accent : "rgba(243,239,230,0.6)" }}
      >
        {label}
      </span>
      <span
        className="mt-1 font-[var(--f-brutal)] text-lg leading-none tabular-nums"
        style={{
          color: active
            ? accent
            : value === 0
            ? "rgba(243,239,230,0.45)"
            : "#F3EFE6",
        }}
      >
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

      {/* Stats panel under the 3D card — editorial Midnight */}
      <div className="relative -mt-2">
        <div className="mx-auto w-full max-w-md px-1 sm:px-0">
          <div
            className="relative border-2 border-[#F3EFE6]/20 bg-[#0a0a14]/90 backdrop-blur-sm"
            style={{ boxShadow: "6px 6px 0 0 #fb923c" }}
          >
            {/* Header row */}
            <div className="flex items-center justify-between gap-2 border-b-2 border-[#F3EFE6]/15 bg-[#13131d] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.25em]">
              <div className="flex items-center gap-2 text-[#fb923c]">
                <span className="h-[2px] w-6 bg-[#fb923c]" />
                <span className="font-bold">Στατιστικά</span>
              </div>
              <span
                className="inline-flex items-center gap-1.5 border px-2 py-0.5"
                style={{
                  borderColor: isTournamentScoped
                    ? "#fb923c"
                    : "rgba(243,239,230,0.2)",
                  color: isTournamentScoped
                    ? "#fb923c"
                    : "rgba(243,239,230,0.7)",
                  background: isTournamentScoped
                    ? "rgba(251,146,60,0.1)"
                    : "transparent",
                }}
              >
                {isTournamentScoped && (
                  <span className="h-1 w-1 rounded-full bg-[#fb923c]" />
                )}
                {isTournamentScoped ? "Τουρνουά" : "Καριέρα"}
              </span>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 p-3">
              <StatPill label="Αγώνες" value={matchesPlayed} />
              <StatPill
                label="Γκολ"
                value={totalGoals}
                accent="#fb923c"
                highlight
              />
              <StatPill label="Ασίστ" value={totalAssists} />
              <StatPill
                label="MVP"
                value={mvpAwards}
                accent="#E8B931"
                highlight
              />
              <StatPill
                label="Τερμ."
                value={bestGkAwards}
                accent="#60a5fa"
                highlight
              />
            </div>

            {/* Footer team line */}
            {player.team?.name && (
              <div className="flex items-center justify-between gap-2 border-t border-[#F3EFE6]/10 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.25em] text-[#F3EFE6]/45">
                <span>Κύρια Ομάδα</span>
                <span className="truncate max-w-[70%] text-right text-[#F3EFE6]/65">
                  {player.team.name}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const PlayerProfileCard = memo(PlayerProfileCardComponent);
export default PlayerProfileCard;
