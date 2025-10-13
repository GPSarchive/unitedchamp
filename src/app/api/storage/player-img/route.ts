import { NextRequest } from "next/server";
import { createSupabaseRouteClient } from "@/app/lib/supabase/supabaseServer";
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";

const BUCKET = process.env.NEXT_PUBLIC_PLAYER_PHOTO_BUCKET || "players";
const SAFE_KEY = /^[a-zA-Z0-9/_\.-]{1,200}$/;

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
  // Require logged-in user; switch to role checks if needed
  const supa = await createSupabaseRouteClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("path");
  if (!raw) return new Response("Missing path", { status: 400 });

  const decoded = decodeURIComponent(raw).replace(/^\/+/, "");
  if (!SAFE_KEY.test(decoded) || decoded.includes("..")) {
    return new Response("Bad path", { status: 400 });
  }

  const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(decoded);
  if (error || !data) return new Response(error?.message ?? "Not found", { status: 404 });

  const type = (data as any)?.type || guessTypeFromPath(decoded);
  const body = data instanceof Blob ? data.stream() : (data as any);

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": type,
      "Cache-Control": "private, max-age=86400",
      "Cross-Origin-Resource-Policy": "same-origin",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
