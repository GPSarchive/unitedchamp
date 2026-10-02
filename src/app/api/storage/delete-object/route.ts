// app/api/storage/delete-object/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { logAdminAction } from "@/app/lib/audit/log";

export const runtime = "nodejs";

// Editors may only remove player photos — the prefix signed-upload issues
// slots under. Admins may remove any object.
const EDITOR_PREFIX = "players/";

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

async function requireStaff() {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { ok: false as const, reason: "Not authenticated" };

  const roles = (data.user.app_metadata as any)?.roles ?? [];
  const isAdmin = Array.isArray(roles) && roles.includes("admin");
  const isEditor = Array.isArray(roles) && roles.includes("editor");
  return isAdmin || isEditor
    ? { ok: true as const, user: data.user, isAdmin }
    : { ok: false as const, reason: "Not staff" };
}

export async function POST(req: Request) {
  const staff = await requireStaff();
  if (!staff.ok) return NextResponse.json({ error: staff.reason }, { status: 403 });

  const { bucket, path } = await req.json().catch(() => ({}));
  if (!bucket || !path) {
    return NextResponse.json({ error: "bucket and path are required" }, { status: 400 });
  }

  // Supabase expects paths without a leading slash
  const normalized = String(path).replace(/^\/+/, "");

  if (!staff.isAdmin && !normalized.startsWith(EDITOR_PREFIX)) {
    return NextResponse.json({ error: "Editors may only delete player photos" }, { status: 403 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabaseAdmin.storage.from(bucket).remove([normalized]);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Storage objects have no row trigger: record the deletion here.
  await logAdminAction({
    action: "storage.delete",
    table: "storage",
    recordId: `${bucket}/${normalized}`,
    summary: `Διαγραφή αρχείου ${bucket}/${normalized}`,
    meta: { bucket, path: normalized, removed: (data ?? []).map((o) => o.name) },
    actor: { id: staff.user.id, email: staff.user.email },
  });

  return NextResponse.json({ ok: true, removed: data });
}
