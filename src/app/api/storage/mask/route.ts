import { NextRequest } from "next/server";
import { createSupabaseRouteClient } from "@/app/lib/supabase/supabaseServer";
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";

const BUCKET = process.env.NEXT_PUBLIC_MASK_BUCKET || "assets";
const ALLOWED_PREFIX = /^masks\//;       // only allow files under masks/
const SAFE_KEY = /^[a-zA-Z0-9/_\.-]{1,200}$/;

function guessType(p: string) {
  const ext = p.toLowerCase().split(".").pop() || "";
  return (
    { jpg:"image/jpeg", jpeg:"image/jpeg", png:"image/png", webp:"image/webp", gif:"image/gif", avif:"image/avif" }[ext]
    || "application/octet-stream"
  );
}

export async function GET(req: NextRequest) {
  // Require auth; remove/relax if masks are public
  const supa = await createSupabaseRouteClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { searchParams } = new URL(req.url);
  const rawPath = searchParams.get("path");
  if (!rawPath) return new Response("Missing path", { status: 400 });

  const path = decodeURIComponent(rawPath).replace(/^\/+/, "");
  if (!SAFE_KEY.test(path) || !ALLOWED_PREFIX.test(path) || path.includes("..")) {
    return new Response("Bad path", { status: 400 });
  }

  const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(path);
  if (error || !data) return new Response(error?.message ?? "Not found", { status: 404 });

  const type = (data as any)?.type || guessType(path);
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
