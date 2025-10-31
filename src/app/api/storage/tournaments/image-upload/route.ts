//api/storage/tournaments/image-upload/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export const runtime = "nodejs";

/**
 * Bucket to store tournament assets.
 * Falls back to your existing bucket if env is not set.
 */
const BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_TOURNAMENTS_BUCKET ||
  "GPSarchive's Project";

/** Read-only cookies adapter for SSR auth */
async function getServerSupabase() {
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return jar.get(name)?.value;
        },
        set(_name: string, _value: string, _opts: CookieOptions) {},
        remove(_name: string, _opts: CookieOptions) {},
      },
    }
  );
}

/** Require an authenticated admin user */
async function requireAdmin() {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user)
    return { ok: false as const, reason: "Not authenticated" };

  const roles = (data.user.app_metadata as any)?.roles ?? [];
  return Array.isArray(roles) && roles.includes("admin")
    ? { ok: true as const, user: data.user }
    : { ok: false as const, reason: "Not admin" };
}

function slugify(input: string) {
  return String(input || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function POST(req: Request) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) {
    return NextResponse.json({ error: adminCheck.reason }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const dirNameRaw: string = String(body?.dirName ?? "tournament"); // usually slug or name
  const contentType: string = String(body?.contentType || "image/jpeg").toLowerCase();
  // Optional secondary folder (e.g., "logos" | "banners"), default "logos"
  const kind: string = slugify(String(body?.kind || "logos"));

  const dirSlug = slugify(dirNameRaw);

  const ext =
    contentType.includes("png") ? "png" :
    contentType.includes("webp") ? "webp" :
    contentType.includes("gif") ? "gif" :
    contentType.includes("avif") ? "avif" : "jpg";

  // Always under leagues/<dirSlug>/<kind>/<uuid>.<ext>
  const folder = `leagues/${dirSlug || crypto.randomUUID()}/${kind}`;
  const filename = `${crypto.randomUUID()}.${ext}`;
  const path = `${folder}/${filename}`;

  // Service-role client (server-only)
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabaseAdmin
    .storage
    .from(BUCKET)
    .createSignedUploadUrl(path);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Return storage info for client-side PUT
  return NextResponse.json({
    bucket: BUCKET,
    path,               // store "/"+path in DB to match your schema rules
    signedUrl: data.signedUrl,
    token: data.token,
  });
}
