// app/api/tournaments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/app/lib/supabase/supabaseServer";
import { dbError } from "@/app/lib/api-error";

export async function GET(req: NextRequest) {
  const s = await createSupabaseRouteClient();
  const { searchParams } = new URL(req.url);

  const status = searchParams.get("status"); // scheduled|running|completed|archived
  const limit = Number(searchParams.get("limit") ?? "0");

  let q = s.from("tournaments")
    .select("id,name,slug,logo,season,status,format,start_date,end_date,winner_team_id")
    .order("id", { ascending: false });

  if (status) q = q.eq("status", status);
  if (limit && Number.isFinite(limit)) q = q.limit(limit);

  const { data, error } = await q;
  if (error) return dbError(error, 500, "tournaments.GET");

  return NextResponse.json({ items: data ?? [] });
}
