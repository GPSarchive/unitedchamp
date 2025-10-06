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

      // identity
      name={name || "—"}
      title={teamTitle || "—"}
      handle={(player.first_name + player.last_name).toLowerCase() || "player"}
      status={[
        player.age != null ? `${player.age}y` : null,
        player.height_cm ? `${player.height_cm}cm` : null,
      ]
        .filter(Boolean)
        .join(" • ") || "—"}

      // look & feel
      showBehindGradient={false}
      enableTilt={true}
      enableMobileTilt={false}
      mobileTiltSensitivity={5}

      // action
      contactText="View profile"
      onContactClick={() => {
        // hook this to router if you want
        // e.g., router.push(`/players/${player.id}`)
        console.log("clicked profile for", player.id);
      }}
    />
  );
}
