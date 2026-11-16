// Plain types and the cache tag shared by the skin loader (server), the card
// wrappers (client) and the dashboard actions. No React, no server imports.

import type { CardFraming, SkinKey } from "@/app/dashboard/protathlites/skins";
import type { DirectoryTeam } from "@/app/preview/paiktes-v2/model";

/** Cache tag of the public skin map (see publicSkins.ts). */
export const CARD_SKINS_TAG = "card-skins";

/** The one skin a player's cards show on public pages. */
export type PublicSkin = {
  skin: SkinKey;
  framing: CardFraming;
  /** Team whose logo the card wears; null = the page's own choice. */
  team: DirectoryTeam | null;
};

/** player id → skin; only players who hold one are in it. */
export type PublicSkinMap = Record<number, PublicSkin>;
