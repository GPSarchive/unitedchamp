// app/api/stages/[id]/standings/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Make sure this runs on the Node runtime, not Edge
export const runtime = "nodejs";
// Cache for 60 seconds (ISR) - reduces CPU load on Vercel
export const revalidate = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // server-only
);

type Row = { group_id: number | null; team_id: number; rank: number };

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> } // <-- Promise-based params (no union)
) {
  try {
    const { id } = await params; // <-- await params per Next.js guidance
    const stageId = Number(id);
    if (!Number.isFinite(stageId) || stageId <= 0) {
      return NextResponse.json({ error: "Invalid stage id" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("stage_standings")
      .select("group_id, team_id, rank")
      .eq("stage_id", stageId)
      .order("group_id", { ascending: true, nullsFirst: true })
      .order("rank", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const rows: Row[] = (data ?? []).map((r: any) => ({
      group_id: r.group_id ?? null,
      team_id: Number(r.team_id),
      rank: Number(r.rank),
    }));

    return NextResponse.json({ rows });
  } catch (e) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
