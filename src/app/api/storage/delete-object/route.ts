// app/api/storage/delete-object/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export const runtime = "nodejs";

// Minimal read-only cookies adapter (works when cookies() is Readonly)
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
  const isAdmin = Array.isArray(roles) && roles.includes("admin");
  return isAdmin ? { ok: true as const } : { ok: false as const, reason: "Not admin" };
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: admin.reason }, { status: 403 });

  const { bucket, path } = await req.json().catch(() => ({}));
  if (!bucket || !path) {
    return NextResponse.json({ error: "bucket and path are required" }, { status: 400 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Supabase expects paths without a leading slash
  const normalized = String(path).replace(/^\/+/, "");

  const { data, error } = await supabaseAdmin.storage.from(bucket).remove([normalized]);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, removed: data });
}
