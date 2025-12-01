// app/api/teams/[id]/trim-logo/route.ts

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import { createSupabaseRouteClient } from "@/app/lib/supabase/supabaseServer";
import sharp from "sharp";

// Use Node runtime for Sharp image processing
export const runtime = "nodejs";
// Allow up to 60 seconds for image processing
export const maxDuration = 60;

const BUCKET = "GPSarchive's Project";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Auth check
  const supa = await createSupabaseRouteClient();
  const { data: { user }, error: userErr } = await supa.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const roles = Array.isArray(user.app_metadata?.roles) ? user.app_metadata.roles : [];
  if (!roles.includes("admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const teamId = parseInt(id, 10);
  if (isNaN(teamId)) {
    return NextResponse.json({ error: "Invalid team ID" }, { status: 400 });
  }

  // Fetch team to get logo path
  const { data: team, error: teamErr } = await supabaseAdmin
    .from("teams")
    .select("id, name, logo")
    .eq("id", teamId)
    .single();

  if (teamErr || !team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  if (!team.logo) {
    return NextResponse.json({ error: "Team has no logo" }, { status: 400 });
  }

  // Extract storage path from logo
  // Logo could be:
  // - Full proxy URL: https://domain.com/api/public/team-logo/slug/uuid.png
  // - Raw storage path: slug/uuid.png
  let storagePath = team.logo;
  
  // If it's a full URL, extract the path after /api/public/team-logo/
  const proxyMatch = team.logo.match(/\/api\/public\/team-logo\/(.+)$/);
  if (proxyMatch) {
    storagePath = decodeURIComponent(proxyMatch[1]);
  }
  
  // If it starts with http but isn't our proxy, we can't trim it
  if (storagePath.startsWith("http")) {
    return NextResponse.json({ 
      error: "Cannot trim external URLs, only storage logos" 
    }, { status: 400 });
  }

  try {
    // Download the file from storage
    const { data: fileData, error: downloadErr } = await supabaseAdmin
      .storage
      .from(BUCKET)
      .download(storagePath);

    if (downloadErr || !fileData) {
      return NextResponse.json({ 
        error: `Failed to download: ${downloadErr?.message || "No data"}` 
      }, { status: 500 });
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());

    // Get original dimensions and trim in one operation
    const originalMeta = await sharp(buffer).metadata();

    // Trim transparent pixels and get metadata in single pipeline
    const trimmedImage = sharp(buffer).trim();
    const [trimmedBuffer, trimmedMeta] = await Promise.all([
      trimmedImage.toBuffer(),
      trimmedImage.metadata()
    ]);

    const wasTrimmed =
      originalMeta.width !== trimmedMeta.width ||
      originalMeta.height !== trimmedMeta.height;

    if (!wasTrimmed) {
      return NextResponse.json({
        message: "Logo already trimmed, no changes needed",
        trimmed: false,
        dimensions: {
          width: originalMeta.width,
          height: originalMeta.height,
        },
      });
    }

    // Determine content type
    const ext = storagePath.split(".").pop()?.toLowerCase();
    const contentType = ext === "png" ? "image/png"
      : ext === "webp" ? "image/webp"
      : "image/jpeg";

    // Re-upload with upsert to overwrite
    const { error: uploadErr } = await supabaseAdmin
      .storage
      .from(BUCKET)
      .upload(storagePath, trimmedBuffer, {
        contentType,
        upsert: true,
      });

    if (uploadErr) {
      return NextResponse.json({ 
        error: `Failed to upload: ${uploadErr.message}` 
      }, { status: 500 });
    }

    return NextResponse.json({
      message: "Logo trimmed successfully",
      trimmed: true,
      before: {
        width: originalMeta.width,
        height: originalMeta.height,
      },
      after: {
        width: trimmedMeta.width,
        height: trimmedMeta.height,
      },
    });

  } catch (err: any) {
    console.error("Trim error:", err);
    return NextResponse.json({ 
      error: err.message || "Unknown error" 
    }, { status: 500 });
  }
}