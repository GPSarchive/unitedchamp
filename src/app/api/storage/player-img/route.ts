//api/storage/player-img/route.ts
import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";

const BUCKET = process.env.NEXT_PUBLIC_PLAYER_PHOTO_BUCKET || "GPSarchive's Project";

function guessTypeFromPath(p: string) {
  const ext = p.toLowerCase().split(".").pop() || "";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "avif") return "image/avif";
  return "application/octet-stream";
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const path = searchParams.get("path");
  if (!path) return new Response("Missing path", { status: 400 });

  // basic safety: no traversal
  if (path.includes("..")) return new Response("Bad path", { status: 400 });

  // Supabase expects no leading slash
  const normalized = path.replace(/^\/+/, "");

  const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(normalized);
  if (error || !data) return new Response(error?.message ?? "Not found", { status: 404 });

  // Some blobs may miss type; fall back from extension
  const type = (data as any)?.type || guessTypeFromPath(normalized);
  const body = data instanceof Blob ? data.stream() : (data as any);

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": type,
      "Cache-Control": "public, max-age=86400",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });
}
