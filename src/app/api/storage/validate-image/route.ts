import { NextResponse } from "next/server";
import { validateImage } from "@/app/lib/utils/imageValidation";
import { createSupabaseRouteClient } from "@/app/lib/supabase/supabaseServer";

/**
 * POST /api/storage/validate-image
 *
 * Test endpoint to validate images without uploading
 * Useful for testing validation rules
 */
export async function POST(req: Request) {
  // Admin auth check
  const supa = await createSupabaseRouteClient();
  const { data: { user }, error: userErr } = await supa.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const roles = Array.isArray(user.app_metadata?.roles) ? user.app_metadata.roles : [];
  if (!roles.includes("admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Convert to buffer
  const ab = await file.arrayBuffer();
  const buffer = Buffer.from(ab);

  // Validate with same rules as team logo upload
  const validation = await validateImage(buffer, {
    maxSizeBytes: 5 * 1024 * 1024, // 5MB
    minWidth: 64,
    maxWidth: 4096,
    minHeight: 64,
    maxHeight: 4096,
    allowedFormats: ['jpeg', 'png', 'webp', 'svg', 'gif', 'avif'],
    sanitizeSVG: true,
  });

  if (!validation.valid) {
    return NextResponse.json({
      valid: false,
      error: validation.error,
      fileInfo: {
        name: file.name,
        size: file.size,
        type: file.type,
      },
    }, { status: 400 });
  }

  return NextResponse.json({
    valid: true,
    message: "Image is valid!",
    metadata: validation.metadata,
    fileInfo: {
      name: file.name,
      size: file.size,
      type: file.type,
    },
  });
}
