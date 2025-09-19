import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import { createSupabaseRouteClient } from "@/app/lib/supabase/supabaseServer";
import { randomUUID } from "crypto";

const BUCKET = "GPSarchive's Project";
const MAX_BYTES = 3 * 1024 * 1024; // 3MB

export async function POST(req: Request) {
  // Admin auth check (same pattern as your teams routes)
  const supa = await createSupabaseRouteClient();
  const { data: { user }, error: userErr } = await supa.auth.getUser();
  if (userErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const roles = Array.isArray(user.app_metadata?.roles) ? user.app_metadata.roles : [];
  if (!roles.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const team = String(form.get("team") || "").trim(); // optional, used for folder/slug

  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 3MB)" }, { status: 400 });
  }

  // Build a neat path like "athens-city-fc/uuid.png"
  const slug = team
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "team";
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${slug}/${randomUUID()}.${ext}`;

  const ab = await file.arrayBuffer();
  const { error: upErr } = await supabaseAdmin
    .storage
    .from(BUCKET)
    .upload(path, Buffer.from(ab), { contentType: file.type, upsert: false });

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

  // Return a stable proxy URL (served via your Next.js route), no signing needed.
  const origin = new URL(req.url).origin;
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const publicUrl = `${origin}/api/public/team-logo/${encodedPath}`;

  return NextResponse.json({
    bucket: BUCKET,
    path,          // keep for debugging/audits or future migrations
    publicUrl,     // 👈 store this in teams.logo
    previewUrl: publicUrl
  }, { status: 201 });
}
