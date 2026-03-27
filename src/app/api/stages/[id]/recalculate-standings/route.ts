import { NextRequest, NextResponse } from "next/server";
import { recomputeStandingsNow } from "@/app/dashboard/tournaments/TournamentCURD/progression";

export const runtime = "nodejs";
export const revalidate = 0;
export const dynamic = "force-dynamic";

/**
 * POST /api/stages/[id]/recalculate-standings
 *
 * Manually trigger standings recalculation for a league or groups stage.
 * This is useful when:
 * - Matches were bulk-imported
 * - Progression didn't run automatically
 * - Standings are missing or incorrect
 */
export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const stageId = Number(id);

    if (!Number.isFinite(stageId) || stageId <= 0) {
      return NextResponse.json(
        { ok: false, error: "Invalid stage ID" },
        { status: 400 }
      );
    }

    console.log(`[Recalculate Standings] Stage ${stageId}: Starting...`);

    // This calls recomputeStandingsIfNeeded internally
    await recomputeStandingsNow(stageId);

    console.log(`[Recalculate Standings] Stage ${stageId}: Success!`);

    return NextResponse.json({
      ok: true,
      message: `Standings recalculated for stage ${stageId}`,
    });
  } catch (error) {
    console.error("[Recalculate Standings] Error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
