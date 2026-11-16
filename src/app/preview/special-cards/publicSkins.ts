// SERVER: who holds which special card skin, for the public (preview) pages.
//
// Staff give skins on /dashboard/protathlites (table player_card_skins,
// migrations/add-player-card-skins.sql). Every page that draws a player card
// gets this map through the root layout (CardSkinsProvider, ./skinsContext),
// and the card wrappers in ./SkinnedCards.tsx swap the normal card for the
// skin's card.
//
// - One skin per player: when a player holds several, the first in the
//   dashboard's list wins (CARD_SKINS order: Θρύλος, ΤΟΤΥ, ΤΟΤW, Ήρωας,
//   Επαγγελματίας).
// - The card wears the logo of the team chosen on the dashboard; no team
//   chosen = the logo the page would show anyway.
// - Read with the service role (the table is admin-only under RLS) and cached
//   under CARD_SKINS_TAG with no time limit; the dashboard actions expire the
//   tag on every write.
// - Table missing (migration not run) or a read error: no skins, every card
//   stays normal. A decoration never breaks a public page. Read errors are
//   not cached (the next request tries again); a missing table is.

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

/** A real read failure: thrown so unstable_cache does not store it. */
class SkinReadError extends Error {}

// Throws SkinReadError on a read error (never cached, see below). A missing
// table or zero rows is a normal empty result and is cached like any other.
async function loadPublicSkins(): Promise<PublicSkinMap> {
  const probe = await supabaseAdmin.from("player_card_skins").select("id").limit(1);
  if (probe.error) {
    if (isMissingTable(probe.error)) return {};
    throw new SkinReadError(probe.error.message);
  }

  let rows: SkinRow[];
  try {
    rows = await fetchAllRows<SkinRow>("player_card_skins", SKIN_ROW_SELECT, "id");
  } catch (err) {
    throw new SkinReadError(err instanceof Error ? err.message : String(err));
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
    // Not cached either: a map with the logos missing would stick until the
    // next dashboard write. This request shows normal cards instead.
    if (error) throw new SkinReadError(`team read failed: ${error.message}`);
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

// Cached with NO time limit: only the dashboard's updateTag(CARD_SKINS_TAG)
// (on every give / take / framing save) expires it. A time limit here would
// become every page's revalidate, since the root layout reads this.
const cachedSkins = unstable_cache(loadPublicSkins, ["public-card-skins-v1"], {
  revalidate: false,
  tags: [CARD_SKINS_TAG],
});

/**
 * The map, cached; expired by the dashboard on every skin change. Never
 * throws: a read error gives no skins for this request only. The error is
 * thrown inside the cache, so unstable_cache stores nothing and the next
 * request reads again (an empty map cached after a transient error would
 * otherwise stick until the next dashboard write).
 */
export async function loadPublicSkinsCached(): Promise<PublicSkinMap> {
  try {
    return await cachedSkins();
  } catch (err) {
    console.error("[card skins] read failed, showing normal cards:", err instanceof Error ? err.message : err);
    return {};
  }
}
