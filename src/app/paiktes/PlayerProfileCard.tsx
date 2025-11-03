// src/app/paiktes/PlayerProfileCard.tsx
"use client";

import ProfileCard from "./ProfileCard";
import type { PlayerLite } from "./types";

export default function PlayerProfileCard({ player }: { player: PlayerLite }) {
  const name = `${player.first_name} ${player.last_name}`.trim();
  const teamTitle = [player.team?.name, player.position].filter(Boolean).join(" • ");

  return (
    <ProfileCard
      // media
      avatarUrl={player.photo}
      miniAvatarUrl={player.team?.logo ?? null}
      iconUrl={player.team?.logo ?? null}

      // identity
      name={name || "—"}
      title={teamTitle || "—"}
      handle={(player.first_name + player.last_name).toLowerCase() || "player"}
      status={[
        player.age != null ? `${player.age}y` : null,
        player.height_cm ? `${player.height_cm}cm` : null,
      ].filter(Boolean).join(" • ") || "—"}

      // stats
      teams={player.team ? [{ id: player.team.id, name: player.team.name, logo: player.team.logo ?? null }] : []}
      matchesPlayed={player.matches ?? 0}
      totalGoals={(player as any).tournament_goals ?? player.goals ?? 0}   // use tournament goals when present
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
