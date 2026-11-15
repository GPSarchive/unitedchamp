// The two player cards of the players page, as the match page uses them: the
// small flat shield (MiniCard) wherever a player is listed, and the big
// holographic one (HoloShieldCard) for the few players a match singles out.
"use client";

import MiniCard from "../../paiktes-v3/MiniCard";
import HoloShieldCard from "../../paiktes-v2/[id]/HoloShieldCard";
import type { StatTuple } from "../../paiktes-v2/model";
import type { MatchPlayer, MatchTeam } from "./model";

/** The small card. Takes the width of its parent. */
export function PlayerMini({ player, logo }: { player: MatchPlayer; logo: string | null }) {
  return (
    <MiniCard
      photo={player.photo}
      logo={logo}
      initial={(player.last || player.first || "?").charAt(0).toUpperCase()}
    />
  );
}

/** The big card, with the season's six numbers. Takes the width of its parent. */
export function PlayerHolo({
  player,
  team,
  season,
}: {
  player: MatchPlayer;
  team: MatchTeam;
  season: StatTuple | null;
}) {
  return (
    <HoloShieldCard
      first={player.first}
      last={player.last}
      photo={player.photo}
      team={team}
      stats={season}
    />
  );
}
