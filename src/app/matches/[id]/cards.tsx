// The two player cards of the players page, as the match page uses them: the
// small flat shield (MiniCard) wherever a player is listed, and the big
// holographic one (HoloShieldCard) for the few players a match singles out.
// A player who holds a special card skin gets that skin instead (see
// special-cards/SkinnedCards.tsx).
"use client";

import { SkinnedBigCard, SkinnedMiniCard } from "@/app/preview/special-cards/SkinnedCards";
import type { StatTuple } from "@/app/preview/paiktes-v2/model";
import type { MatchPlayer, MatchTeam } from "./model";

/** The small card. Takes the width of its parent. */
export function PlayerMini({ player, logo }: { player: MatchPlayer; logo: string | null }) {
  return (
    <SkinnedMiniCard
      playerId={player.id}
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
    <SkinnedBigCard
      playerId={player.id}
      first={player.first}
      last={player.last}
      photo={player.photo}
      team={team}
      stats={season}
    />
  );
}
