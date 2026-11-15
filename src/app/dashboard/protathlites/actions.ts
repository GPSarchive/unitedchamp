"use server";

// Server actions for /dashboard/protathlites: give a special card skin to
// players (one or a whole team), take it away, and save how a card frames
// the player's photo / which team's logo it wears.
//
// Server Actions are public POST endpoints — every action re-checks that the
// caller is an admin before touching player_card_skins. Writes go through the
// service role (the table's RLS admits admins only).

import { revalidatePath, updateTag } from "next/cache";
import { createSupabaseRouteClient } from "@/app/lib/supabase/supabaseServer";
import { isAdmin } from "@/app/lib/supabase/apiAuth";
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import {
  holderFromRow,
  isSkinKey,
  SKIN_ROW_SELECT,
  type CardFraming,
  type SkinHolder,
  type SkinKey,
  type SkinRow,
} from "./skins";
import { CARD_SKINS_TAG } from "@/app/preview/special-cards/skinTypes";

const TABLE = "player_card_skins";
const PAGE = "/dashboard/protathlites";

/** After every write: this page, and the skins every public card reads. */
function refresh() {
  revalidatePath(PAGE);
  updateTag(CARD_SKINS_TAG);
}
/** Biggest team roster is ~30; this only stops absurd payloads. */
const MAX_PLAYERS_PER_CALL = 200;

type Result<T = undefined> = { success: true; data: T } | { success: false; error: string };

async function requireAdminUser() {
  const supabase = await createSupabaseRouteClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user || !isAdmin(user)) return null;
  return user;
}

function readableError(err: { code?: string; message?: string } | null | undefined): string {
  if (!err) return "Άγνωστο σφάλμα.";
  if (err.code === "42P01" || err.code === "PGRST205") {
    return "Ο πίνακας player_card_skins δεν υπάρχει ακόμη. Τρέξτε το migrations/add-player-card-skins.sql στη Supabase.";
  }
  if (err.code === "23503") return "Ο παίκτης ή η ομάδα δεν υπάρχει πια. Ανανεώστε τη σελίδα.";
  return err.message ?? "Άγνωστο σφάλμα.";
}

const isId = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n > 0;

function cleanIds(ids: unknown): number[] | null {
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_PLAYERS_PER_CALL) return null;
  if (!ids.every(isId)) return null;
  return [...new Set(ids as number[])];
}

function cleanFraming(f: unknown): CardFraming | null {
  const v = f as CardFraming | null;
  if (!v || ![v.x, v.y, v.zoom].every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
  return {
    x: Number(clamp(v.x, 0, 100).toFixed(1)),
    y: Number(clamp(v.y, 0, 100).toFixed(1)),
    zoom: Number(clamp(v.zoom, 1, 3).toFixed(2)),
  };
}

async function readHolders(skin: SkinKey, playerIds: number[]): Promise<Result<SkinHolder[]>> {
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select(SKIN_ROW_SELECT)
    .eq("skin", skin)
    .in("player_id", playerIds);
  if (error) return { success: false, error: readableError(error) };
  return { success: true, data: ((data ?? []) as SkinRow[]).map(holderFromRow) };
}

/**
 * Give `skin` to these players. Each player brings the team whose logo their
 * card wears. A player who already holds the skin keeps their row as it is
 * (framing and team untouched). Returns the rows of all these players.
 */
export async function giveSkin(input: {
  skin: string;
  players: { playerId: number; teamId: number | null }[];
}): Promise<Result<SkinHolder[]>> {
  try {
    const user = await requireAdminUser();
    if (!user) return { success: false, error: "Δεν έχετε δικαίωμα διαχειριστή." };
    if (!isSkinKey(input.skin)) return { success: false, error: "Άγνωστη κάρτα." };
    const players = Array.isArray(input.players) ? input.players : [];
    const ids = cleanIds(players.map((p) => p?.playerId));
    if (!ids) return { success: false, error: "Άκυρη λίστα παικτών." };
    if (players.some((p) => p.teamId != null && !isId(p.teamId))) {
      return { success: false, error: "Άκυρη ομάδα." };
    }

    const teamByPlayer = new Map(players.map((p) => [p.playerId, p.teamId ?? null] as const));
    const email = user.email ?? null;
    const { error } = await supabaseAdmin.from(TABLE).upsert(
      ids.map((playerId) => ({
        player_id: playerId,
        skin: input.skin,
        team_id: teamByPlayer.get(playerId) ?? null,
        created_by_email: email,
        updated_by_email: email,
      })),
      { onConflict: "player_id,skin", ignoreDuplicates: true },
    );
    if (error) return { success: false, error: readableError(error) };

    refresh();
    return readHolders(input.skin, ids);
  } catch (err) {
    console.error("[protathlites/giveSkin]", err);
    return { success: false, error: err instanceof Error ? err.message : "Άγνωστο σφάλμα." };
  }
}

/** Take `skin` away from these players (their framing for it goes too). */
export async function takeSkin(input: { skin: string; playerIds: number[] }): Promise<Result> {
  try {
    const user = await requireAdminUser();
    if (!user) return { success: false, error: "Δεν έχετε δικαίωμα διαχειριστή." };
    if (!isSkinKey(input.skin)) return { success: false, error: "Άγνωστη κάρτα." };
    const ids = cleanIds(input.playerIds);
    if (!ids) return { success: false, error: "Άκυρη λίστα παικτών." };

    const { error } = await supabaseAdmin.from(TABLE).delete().eq("skin", input.skin).in("player_id", ids);
    if (error) return { success: false, error: readableError(error) };

    refresh();
    return { success: true, data: undefined };
  } catch (err) {
    console.error("[protathlites/takeSkin]", err);
    return { success: false, error: err instanceof Error ? err.message : "Άγνωστο σφάλμα." };
  }
}

/** Save one card's photo framing and/or the team whose logo it wears. */
export async function updateSkinCard(input: {
  skin: string;
  playerId: number;
  framing?: CardFraming;
  teamId?: number | null;
}): Promise<Result<SkinHolder>> {
  try {
    const user = await requireAdminUser();
    if (!user) return { success: false, error: "Δεν έχετε δικαίωμα διαχειριστή." };
    if (!isSkinKey(input.skin)) return { success: false, error: "Άγνωστη κάρτα." };
    if (!isId(input.playerId)) return { success: false, error: "Άκυρος παίκτης." };

    const patch: Record<string, unknown> = { updated_by_email: user.email ?? null };
    if (input.framing !== undefined) {
      const framing = cleanFraming(input.framing);
      if (!framing) return { success: false, error: "Άκυρη προσαρμογή φωτογραφίας." };
      patch.frame_x = framing.x;
      patch.frame_y = framing.y;
      patch.frame_zoom = framing.zoom;
    }
    if (input.teamId !== undefined) {
      if (input.teamId !== null && !isId(input.teamId)) return { success: false, error: "Άκυρη ομάδα." };
      patch.team_id = input.teamId;
    }

    const { data, error } = await supabaseAdmin
      .from(TABLE)
      .update(patch)
      .eq("skin", input.skin)
      .eq("player_id", input.playerId)
      .select(SKIN_ROW_SELECT)
      .maybeSingle();
    if (error) return { success: false, error: readableError(error) };
    if (!data) return { success: false, error: "Ο παίκτης δεν έχει πια αυτή την κάρτα. Ανανεώστε τη σελίδα." };

    refresh();
    return { success: true, data: holderFromRow(data as SkinRow) };
  } catch (err) {
    console.error("[protathlites/updateSkinCard]", err);
    return { success: false, error: err instanceof Error ? err.message : "Άγνωστο σφάλμα." };
  }
}
