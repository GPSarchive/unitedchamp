"use server";

import { refreshAllPlayerStats } from "@/app/lib/refreshPlayerStats";
import { revalidatePath } from "next/cache";
import { createSupabaseRouteClient } from "@/app/lib/supabase/supabaseServer";
import { canEditContent } from "@/app/lib/supabase/apiAuth";

export async function runFullBackfill(): Promise<{
  success: boolean;
  careerRows?: number;
  tournamentRows?: number;
  mpsRowsProcessed?: number;
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
