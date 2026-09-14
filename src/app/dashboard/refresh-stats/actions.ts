"use server";

import { refreshAllPlayerStats } from "@/app/lib/refreshPlayerStats";
import { revalidatePath } from "next/cache";
import { createSupabaseRouteClient } from "@/app/lib/supabase/supabaseServer";
import { canEditContent } from "@/app/lib/supabase/apiAuth";
import { logAdminAction } from "@/app/lib/audit/log";

export async function runFullBackfill(): Promise<{
  success: boolean;
  tournamentRows?: number;
  mpsRowsProcessed?: number;
  seasonLabel?: string | null;
  seasonRows?: number;
  error?: string;
}> {
  try {
    // Server Actions are public POST endpoints — verify the caller is an
    // admin/editor before wiping and rebuilding the stat caches.
    const supabase = await createSupabaseRouteClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();
    if (authErr || !user || !canEditContent(user)) {
      return { success: false, error: "Unauthorized" };
    }

    const result = await refreshAllPlayerStats();
    // Rebuilds derived caches only (not audited row by row): record the run.
    await logAdminAction({
      action: "stats.rebuild_all",
      summary: `Πλήρης επαναϋπολογισμός στατιστικών παικτών (${result.mpsRowsProcessed} γραμμές αγώνων, σεζόν ${result.seasonLabel ?? "—"})`,
      meta: { ...result },
      actor: { id: user.id, email: user.email },
    });
    revalidatePath("/paiktes");
    revalidatePath("/"); // home top-players section reads the same caches
    revalidatePath("/dashboard/refresh-stats");
    return { success: true, ...result };
  } catch (err) {
    console.error("[runFullBackfill] error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
