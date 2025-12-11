import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import { createSupabaseRouteClient } from "@/app/lib/supabase/supabaseServer";
import { randomUUID } from "crypto";
import { validateImage } from "@/app/lib/utils/imageValidation";

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

  // Convert file to buffer for validation
  const ab = await file.arrayBuffer();
  const buffer = Buffer.from(ab);

  // Validate image using magic bytes and metadata (not just MIME type)
  const validation = await validateImage(buffer, {
    maxSizeBytes: MAX_BYTES,
    minWidth: 64,
    maxWidth: 2048,
    minHeight: 64,
    maxHeight: 2048,
    allowedFormats: ['jpeg', 'png', 'webp', 'svg'],
    sanitizeSVG: true,
  });

  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  // Build a neat path like "athens-city-fc/uuid.png"
  const slug = team
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "team";

  // Use detected format from validation instead of file extension
  const ext = validation.metadata?.format || file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${slug}/${randomUUID()}.${ext}`;

  const { error: upErr } = await supabaseAdmin
    .storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: false });

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
