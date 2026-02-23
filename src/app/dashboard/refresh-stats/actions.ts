"use server";

import { refreshAllPlayerStats } from "@/app/lib/refreshPlayerStats";
import { refreshAllTournamentCounts } from "@/app/lib/refreshTournamentCounts";
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

export async function runTournamentCountsBackfill(): Promise<{
  success: boolean;
  tournamentsUpdated?: number;
  error?: string;
}> {
  try {
    const count = await refreshAllTournamentCounts();
    revalidatePath("/");
    revalidatePath("/dashboard/refresh-stats");
    return { success: true, tournamentsUpdated: count };
  } catch (err) {
    console.error("[runTournamentCountsBackfill] error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
