// What this version of the page reads on top of the tournament itself
// (tournaments-v3/[id]/data.ts): each team's colour, for the stripe down the
// side of its row on the «Ομάδες» tab.
import "server-only";

import { cache } from "react";
import { fetchInBatches } from "@/app/lib/supabasePaging";
import { teamAccent } from "@/app/OMADA/[id]/accent";
import { loadBase } from "@/app/preview/tournaments-v3/[id]/data";
import { TOURNAMENT_PATH } from "./paths";

/**
 * Team id → its colour, made light enough to show on the dark page. A team
 * with no colour of its own (none stored, or a black, white or grey) is not in
 * the map.
 */
export const loadColours = cache(async (id: number): Promise<Map<number, string>> => {
  const base = await loadBase(id);
  if (!base) return new Map();
  const ids = new Set(base.teams.map((t) => t.id));
  if (base.winner) ids.add(base.winner.id);
  const rows = await fetchInBatches<{ id: number; colour: string | null }>("teams", "id", [...ids], "id, colour");
  const colours = new Map<number, string>();
  for (const row of rows) {
    const { kit, accent } = teamAccent(row.colour);
    // `accent` falls back to the site's orange; only a real team colour counts here.
    if (kit && accent.toLowerCase() !== "#fb923c") colours.set(Number(row.id), accent);
  }
  return colours;
});

/**
 * A player card's address: this page itself with `?player=`, so the card opens
 * the profile on top of the tab it is on (see paiktes/ProfileHost).
 */
export const profileHref = (tournamentId: number, tab: "players" | "teams", playerId: number) =>
  `${TOURNAMENT_PATH}/${tournamentId}/${tab}?player=${playerId}`;
