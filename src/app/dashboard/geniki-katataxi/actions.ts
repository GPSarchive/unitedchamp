"use server";

// Server actions for the Γενική Κατάταξη manual point adjustments.
// Server Actions are public POST endpoints — every action re-checks that the
// caller is an admin before touching season_team_adjustments.

import { revalidatePath } from "next/cache";
import { createSupabaseRouteClient } from "@/app/lib/supabase/supabaseServer";
import { isAdmin } from "@/app/lib/supabase/apiAuth";
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import {
  ADJUSTMENT_KINDS,
  makeCancelTag,
  type AdjustmentKind,
} from "@/app/geniki-katataxi/rules";

type ActionResult = { success: boolean; error?: string };

async function requireAdminUser() {
  const supabase = await createSupabaseRouteClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user || !isAdmin(user)) return null;
  return user;
}

function revalidate() {
  revalidatePath("/geniki-katataxi");
  revalidatePath("/dashboard/geniki-katataxi");
}

export async function addAdjustment(input: {
  season: string;
  teamId: number;
  kind: AdjustmentKind;
  points: number;
  reason: string;
}): Promise<ActionResult> {
  try {
    const user = await requireAdminUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const season = (input.season ?? "").trim();
    const points = Math.trunc(Number(input.points));
    if (!season) return { success: false, error: "Συμπλήρωσε σεζόν." };
    if (!Number.isFinite(input.teamId) || input.teamId <= 0)
      return { success: false, error: "Διάλεξε ομάδα." };
    if (!ADJUSTMENT_KINDS.includes(input.kind))
      return { success: false, error: "Άγνωστος τύπος πόντων." };
    if (!Number.isFinite(points) || points === 0)
      return { success: false, error: "Οι πόντοι δεν μπορεί να είναι 0." };

    const { error } = await supabaseAdmin.from("season_team_adjustments").insert({
      season,
      team_id: input.teamId,
      kind: input.kind,
      points,
      reason: (input.reason ?? "").trim() || null,
      created_by: user.id,
    });
    if (error) return { success: false, error: error.message };

    revalidate();
    return { success: true };
  } catch (err) {
    console.error("[addAdjustment] error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function deleteAdjustment(id: number): Promise<ActionResult> {
  try {
    const user = await requireAdminUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const { error } = await supabaseAdmin
      .from("season_team_adjustments")
      .delete()
      .eq("id", id);
    if (error) return { success: false, error: error.message };

    revalidate();
    return { success: true };
  } catch (err) {
    console.error("[deleteAdjustment] error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * Cancels an automatic points event (a computed win/title/participation/…) by writing
 * a counter-adjustment of equal, opposite points, tagged so we can pair it back to the
 * source event. Does NOT touch tournament/match data, and is fully reversible via
 * uncancelEvent. Idempotent: refuses to double-cancel the same sourceKey.
 */
export async function cancelEvent(input: {
  season: string;
  teamId: number;
  sourceKey: string;
  points: number;
  note: string;
}): Promise<ActionResult> {
  try {
    const user = await requireAdminUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const season = (input.season ?? "").trim();
    const sourceKey = (input.sourceKey ?? "").trim();
    const points = Math.trunc(Number(input.points));
    if (!season) return { success: false, error: "Λείπει η σεζόν." };
    if (!Number.isFinite(input.teamId) || input.teamId <= 0)
      return { success: false, error: "Λείπει η ομάδα." };
    if (!sourceKey) return { success: false, error: "Λείπει το αναγνωριστικό του event." };
    if (!Number.isFinite(points) || points === 0)
      return { success: false, error: "Το event δεν έχει πόντους προς ακύρωση." };

    const tag = makeCancelTag(sourceKey);

    // Guard against double-cancel: is there already a counter-adjustment for this key?
    const { data: existing, error: exErr } = await supabaseAdmin
      .from("season_team_adjustments")
      .select("id")
      .ilike("reason", `%${tag}%`)
      .limit(1);
    if (exErr) return { success: false, error: exErr.message };
    if (existing && existing.length > 0)
      return { success: false, error: "Το event είναι ήδη ακυρωμένο." };

    const note = (input.note ?? "").trim();
    const reason = note ? `${note} ${tag}` : `Ακύρωση αυτόματου πόντου ${tag}`;

    const { error } = await supabaseAdmin.from("season_team_adjustments").insert({
      season,
      team_id: input.teamId,
      kind: "other",
      points: -points, // opposite sign → nets the automatic event to zero
      reason,
      created_by: user.id,
    });
    if (error) return { success: false, error: error.message };

    revalidate();
    return { success: true };
  } catch (err) {
    console.error("[cancelEvent] error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/** Reverses a cancellation by deleting the counter-adjustment row. */
export async function uncancelEvent(adjustmentId: number): Promise<ActionResult> {
  return deleteAdjustment(adjustmentId);
}
