// src/app/paiktes/PlayerProfileCard.tsx (OPTIMIZED - React.memo)
"use client";

import { memo, useMemo } from "react";
import ProfileCard from "./ProfileCard";
import type { PlayerLite } from "./types";

function PlayerProfileCardComponent({ player }: { player: PlayerLite }) {
  // ✅ Memoize computed values
  const name = useMemo(
    () => `${player.first_name} ${player.last_name}`.trim() || "—",
    [player.first_name, player.last_name]
  );

  const teamTitle = useMemo(
    () => [player.team?.name, player.position].filter(Boolean).join(" • ") || "—",
    [player.team?.name, player.position]
  );

  const handle = useMemo(
    () => (player.first_name + player.last_name).toLowerCase() || "player",
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

  // ✅ Memoize teams array to prevent recreation
  const teams = useMemo(
    () =>
      player.team
        ? [{ id: player.team.id, name: player.team.name, logo: player.team.logo ?? null }]
        : [],
    [player.team]
  );

  const totalGoals = (player as any).tournament_goals ?? player.goals ?? 0;

  return (
    <ProfileCard
      // media
      avatarUrl={player.photo}
      miniAvatarUrl={player.team?.logo ?? null}
      iconUrl={player.team?.logo ?? null}
      // identity
      name={name}
      title={teamTitle}
      handle={handle}
      status={status}
      // stats
      teams={teams}
      matchesPlayed={player.matches ?? 0}
      totalGoals={totalGoals}
      totalAssists={player.assists ?? 0}
      mvpAwards={player.mvp ?? 0}
      bestGkAwards={player.best_gk ?? 0}
      showStats={true}
      // look & feel
      showBehindGradient={false}
      enableTilt={true}
      enableMobileTilt={false}
      mobileTiltSensitivity={5}
    />
  );
}

// ✅ Export memoized component
const PlayerProfileCard = memo(PlayerProfileCardComponent);
export default PlayerProfileCard;
