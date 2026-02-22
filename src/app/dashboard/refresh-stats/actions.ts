"use server";

import { refreshAllPlayerStats } from "@/app/lib/refreshPlayerStats";
import { revalidatePath } from "next/cache";

export async function runFullBackfill(): Promise<{
  success: boolean;
  careerRows?: number;
  tournamentRows?: number;
  mpsRowsProcessed?: number;
  error?: string;
}> {
  try {
    const result = await refreshAllPlayerStats();
    revalidatePath("/paiktes");
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
