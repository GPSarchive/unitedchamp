// Shared by every /preview page: hands the special card skins (given on
// /dashboard/protathlites) to the card wrappers in
// special-cards/SkinnedCards.tsx, so a player's skin shows on every new page
// (players, match, team, tournament, profile overlay) from one cached read.
//
// When the new pages are promoted out of /preview, move this provider with
// them (or into the root layout).

import type { ReactNode } from "react";
import { loadPublicSkinsCached } from "./special-cards/publicSkins";
import { CardSkinsProvider } from "./special-cards/SkinnedCards";

export default async function PreviewLayout({ children }: { children: ReactNode }) {
  const skins = await loadPublicSkinsCached();
  return <CardSkinsProvider skins={skins}>{children}</CardSkinsProvider>;
}
