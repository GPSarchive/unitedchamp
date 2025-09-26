// app/api/storage/signed-upload/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export const runtime = "nodejs";

// read-only cookies adapter
async function getServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    }
  );
}

async function requireAdmin() {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { ok: false as const, reason: "Not authenticated" };
  const roles = (data.user.app_metadata as any)?.roles ?? [];
  return Array.isArray(roles) && roles.includes("admin")
    ? { ok: true as const, user: data.user }
    : { ok: false as const, reason: "Not admin" };
}

export async function POST(req: Request) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) {
    return NextResponse.json({ error: adminCheck.reason }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const contentType: string = String(body?.contentType || "image/jpeg").toLowerCase();
  const bucket: string = String(body?.bucket || "GPSarchive's Project"); // <— accept bucket from client

  const ext =
    contentType.includes("png") ? "png" :
    contentType.includes("webp") ? "webp" :
    contentType.includes("gif") ? "gif" :
    contentType.includes("avif") ? "avif" : "jpg";

  const path = `players/${crypto.randomUUID()}.${ext}`;

  // service-role client
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUploadUrl(path);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // return only what you need for a private bucket
  return NextResponse.json({
    bucket,
    path,
    signedUrl: data.signedUrl,
    token: data.token,
  });
}
