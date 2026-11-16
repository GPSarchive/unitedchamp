// The player cards with special skins applied. Every place that draws a
// player card uses these instead of HoloShieldCard / MiniCard directly: a
// player who holds a skin (given on /dashboard/protathlites) gets that skin's
// card, framed as set there; everyone else gets the normal card unchanged.
//
// The skins arrive once per page through CardSkinsProvider (./skinsContext,
// mounted by the root layout src/app/layout.tsx with the server-loaded map),
// so no card fetches anything. Outside a provider every card is normal.
// The provider lives in its own tiny module so the root layout does not pull
// this file's card code into every page.
"use client";

import HoloShieldCard from "@/app/preview/paiktes-v2/[id]/HoloShieldCard";
import type { DirectoryTeam, StatTuple } from "@/app/preview/paiktes-v2/model";
import MiniCard from "@/app/paiktes/MiniCard";
import { SKIN_CARDS } from "@/app/dashboard/protathlites/skinCards";
import { Framed, FramingStyles } from "./framing";
import { useCardSkin } from "./skinsContext";

/** The big card: HoloShieldCard, or the player's skin card. */
export function SkinnedBigCard({
  playerId,
  first,
  last,
  photo,
  team,
  stats,
  intro,
  surface,
}: {
  playerId: number | null | undefined;
  first: string;
  last: string;
  photo: string | null;
  team: DirectoryTeam | null;
  stats: StatTuple | null;
  intro?: boolean;
  /** Passed to the normal card only (skin cards have their own surface). */
  surface?: string;
}) {
  const skin = useCardSkin(playerId);
  if (!skin) {
    return <HoloShieldCard first={first} last={last} photo={photo} team={team} stats={stats} intro={intro} surface={surface} />;
  }
  const { Big } = SKIN_CARDS[skin.skin];
  return (
    <>
      <FramingStyles />
      <Framed framing={skin.framing}>
        <Big first={first} last={last} photo={photo} team={skin.team ?? team} stats={stats} intro={intro} />
      </Framed>
    </>
  );
}

/** The small card: MiniCard, or the player's skin mini card. */
export function SkinnedMiniCard({
  playerId,
  photo,
  logo,
  initial,
}: {
  playerId: number | null | undefined;
  photo: string | null;
  logo: string | null;
  initial: string;
}) {
  const skin = useCardSkin(playerId);
  if (!skin) return <MiniCard photo={photo} logo={logo} initial={initial} />;
  const { Mini } = SKIN_CARDS[skin.skin];
  return (
    <>
      <FramingStyles />
      <Framed framing={skin.framing}>
        <Mini photo={photo} logo={skin.team?.logo ?? logo} initial={initial} />
      </Framed>
    </>
  );
}
