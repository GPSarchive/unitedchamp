// The skin map's React context, on its own. The root layout mounts
// CardSkinsProvider for every page, so this module must stay tiny: only the
// context, the provider and the hook. It must NOT import any card component
// (HoloShieldCard, MiniCard, skin cards, framing) — those belong to
// ./SkinnedCards.tsx, which only pages that draw cards load. Importing a card
// here would put all the card code in every page's JS.
"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { PublicSkin, PublicSkinMap } from "./skinTypes";

const SkinsContext = createContext<PublicSkinMap>({});

export function CardSkinsProvider({ skins, children }: { skins: PublicSkinMap; children: ReactNode }) {
  return <SkinsContext.Provider value={skins}>{children}</SkinsContext.Provider>;
}

/** The skin a player's cards show, or null. Outside a provider: always null. */
export function useCardSkin(playerId: number | null | undefined): PublicSkin | null {
  const skins = useContext(SkinsContext);
  return playerId != null ? (skins[playerId] ?? null) : null;
}
