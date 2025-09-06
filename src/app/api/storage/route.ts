import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { createSupabaseRouteClient } from "@/app/lib/supabaseServer";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const bucket = url.searchParams.get("bucket") || "GPSarchive's Project";
  const path = url.searchParams.get("path") || "";
  if (!path) return NextResponse.json({ error: "Missing path" }, { status: 400 });

  // Keep this admin-only since it signs a private object
  const supa = await createSupabaseRouteClient();
  const { data: { user } } = await supa.auth.getUser();
  const roles = Array.isArray(user?.app_metadata?.roles) ? user!.app_metadata!.roles : [];
  if (!user || !roles.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUrl(path, 60 * 60);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ signedUrl: data?.signedUrl ?? null });
}
