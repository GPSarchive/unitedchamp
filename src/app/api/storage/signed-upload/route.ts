// app/api/storage/signed-upload/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export const runtime = "nodejs";

// read-only cookies adapter
async function getServerSupabase() {
  const jar = await cookies(); // in your setup this returns a Promise<ReadonlyRequestCookies>
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

async function requireAdmin() {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { ok: false as const, reason: "Not authenticated" };
  const roles = (data.user.app_metadata as any)?.roles ?? [];
  return Array.isArray(roles) && roles.includes("admin")
    ? { ok: true as const, user: data.user }
    : { ok: false as const, reason: "Not admin" };
}

// tiny helper to make a safe folder slug from a name
function slugify(input: string) {
  return String(input || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")    // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")        // non-alnum -> -
    .replace(/^-+|-+$/g, "");           // trim -
}

export async function POST(req: Request) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) {
    return NextResponse.json({ error: adminCheck.reason }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));

  // Accept bucket + desired folder name from client
  const bucket: string = String(body?.bucket || "GPSarchive's Project");
  const dirNameRaw: string = String(body?.dirName ?? ""); // e.g. "john doe 42"
  const dirSlug = slugify(dirNameRaw);

  const contentType: string = String(body?.contentType || "image/jpeg").toLowerCase();
  const ext =
    contentType.includes("png") ? "png" :
    contentType.includes("webp") ? "webp" :
    contentType.includes("gif") ? "gif" :
    contentType.includes("avif") ? "avif" : "jpg";

  // Build a folder under players/
  // If dirSlug is empty, fall back to a random folder so nothing ever lands at the bucket root.
  const folder = `players/${dirSlug || crypto.randomUUID()}`;
  const filename = `${crypto.randomUUID()}.${ext}`;
  const path = `${folder}/${filename}`; // e.g. players/john-doe-42/3f9c....jpg

  // Service-role client (server only)
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabaseAdmin
    .storage
    .from(bucket)
    .createSignedUploadUrl(path);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Private bucket flow: return path + signed upload URL
  return NextResponse.json({
    bucket,
    path,               // <- store this in player.photo
    signedUrl: data.signedUrl,
    token: data.token,
  });
}
