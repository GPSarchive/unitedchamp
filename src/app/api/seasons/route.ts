// app/api/seasons/route.ts
// Public, read-only: the season list and the active pointer. Used by the
// tournament wizard's season dropdown (client) — labels are not sensitive
// (public.seasons is public-read under RLS as well).
import { NextResponse } from "next/server";
import { listSeasons } from "@/app/lib/seasons";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const seasons = await listSeasons();
    const active = seasons.find((s) => s.status === "active")?.label ?? null;
    return NextResponse.json(
      {
        active,
        seasons: seasons.map((s) => ({
          label: s.label,
          display_label: s.display_label,
          status: s.status,
        })),
      },
      { headers: { "Cache-Control": "public, max-age=60, s-maxage=60" } },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 },
    );
  }
}
