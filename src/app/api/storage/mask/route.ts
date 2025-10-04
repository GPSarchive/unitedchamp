// src/app/api/storage/mask/route.ts
import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const bucket = searchParams.get("bucket");
  const path = searchParams.get("path");

  if (!bucket || !path) {
    return new Response("Missing bucket or path", { status: 400 });
  }

  const { data, error } = await supabaseAdmin.storage.from(bucket).download(path);
  if (error || !data) {
    return new Response(error?.message ?? "Not found", { status: 404 });
  }

  const type = (data as any)?.type || "image/png";
  const body = data instanceof Blob ? data.stream() : (data as any);

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": type,
      "Cache-Control": "public, max-age=31536000, immutable",
      // Important so CSS mask-image can use it safely:
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });
}