// SERVER: who holds which special card skin, for the public (preview) pages.
//
// Staff give skins on /dashboard/protathlites (table player_card_skins,
// migrations/add-player-card-skins.sql). Every page that draws a player card
// gets this map through the /preview layout (CardSkinsProvider), and the card
// wrappers in ./SkinnedCards.tsx swap the normal card for the skin's card.
//
// - One skin per player: when a player holds several, the first in the
//   dashboard's list wins (CARD_SKINS order: Θρύλος, ΤΟΤΥ, ΤΟΤW, Ήρωας,
//   Επαγγελματίας).
// - The card wears the logo of the team chosen on the dashboard; no team
//   chosen = the logo the page would show anyway.
// - Read with the service role (the table is admin-only under RLS) and cached
//   under CARD_SKINS_TAG; the dashboard actions expire the tag on every write.
// - Table missing (migration not run) or a read error: no skins, every card
//   stays normal. A decoration never breaks a public page.

import "server-only";

import { unstable_cache } from "next/cache";
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import { fetchAllRows } from "@/app/lib/supabasePaging";
import { isPlaceholderPhoto } from "@/app/lib/image-config";
import {
  CARD_SKINS,
  holderFromRow,
  isSkinKey,
  SKIN_ROW_SELECT,
  type SkinRow,
} from "@/app/dashboard/protathlites/skins";
import { CARD_SKINS_TAG, type PublicSkin, type PublicSkinMap } from "./skinTypes";

const RANK = new Map<string, number>(CARD_SKINS.map((s, i) => [s.key, i]));

function isMissingTable(err: { code?: string; message?: string }) {
  return (
    err.code === "42P01" ||
    err.code === "PGRST205" ||
    /does not exist|could not find the table/i.test(err.message ?? "")
  );
}

async function loadPublicSkins(): Promise<PublicSkinMap> {
  const probe = await supabaseAdmin.from("player_card_skins").select("id").limit(1);
  if (probe.error) {
    if (!isMissingTable(probe.error)) {
      console.error("[card skins] read failed, showing normal cards:", probe.error.message);
    }
    return {};
  }

  let rows: SkinRow[];
  try {
    rows = await fetchAllRows<SkinRow>("player_card_skins", SKIN_ROW_SELECT, "id");
  } catch (err) {
    console.error("[card skins] read failed, showing normal cards:", err);
    return {};
  }

  // Best-ranked skin per player.
  const best = new Map<number, ReturnType<typeof holderFromRow>>();
  for (const row of rows) {
    if (!isSkinKey(row.skin)) continue; // a skin no longer in the list: unshown
    const holder = holderFromRow(row);
    const current = best.get(holder.playerId);
    if (!current || RANK.get(holder.skin)! < RANK.get(current.skin)!) best.set(holder.playerId, holder);
  }
  if (best.size === 0) return {};

  // The teams whose logos the cards wear.
  const teamIds = [...new Set([...best.values()].map((h) => h.teamId).filter((id): id is number => id != null))];
  const teams = new Map<number, { id: number; name: string; logo: string | null }>();
  if (teamIds.length > 0) {
    const { data, error } = await supabaseAdmin.from("teams").select("id, name, logo").in("id", teamIds);
    if (error) console.error("[card skins] team read failed, cards keep the page's logo:", error.message);
    for (const t of data ?? []) {
      teams.set(t.id, {
        id: t.id,
        name: t.name ?? "",
        logo: t.logo && !isPlaceholderPhoto(t.logo) ? t.logo : null,
      });
    }
  }

  const map: PublicSkinMap = {};
  for (const h of best.values()) {
    const skin: PublicSkin = {
      skin: h.skin,
      framing: h.framing,
      team: h.teamId != null ? (teams.get(h.teamId) ?? null) : null,
    };
    map[h.playerId] = skin;
  }
  return map;
}

/** The map, cached; expired by the dashboard on every skin change. */
export const loadPublicSkinsCached = unstable_cache(loadPublicSkins, ["public-card-skins-v1"], {
  revalidate: 300,
  tags: [CARD_SKINS_TAG],
});
