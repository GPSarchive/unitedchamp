// app/api/articles/[id]/route.ts
import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/app/lib/supabase/supabaseServer";

type Ctx = { params: Promise<{ id: string }> };

// --- same-origin guard ---
const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean)
);
function ensureSameOrigin(req: Request) {
  const m = req.method.toUpperCase();
  if (m === "GET" || m === "HEAD" || m === "OPTIONS") return;

  const whitelist = new Set(allowedOrigins);
  try {
    whitelist.add(new URL(req.url).origin);
  } catch {}

  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const ok = [origin, referer].some(val => {
    try {
      return !!val && whitelist.has(new URL(val).origin);
    } catch {
      return false;
    }
  });
  if (!ok) throw new Error("bad-origin");
}
// -------------------------

function parseId(s: string) {
  const n = Number(s);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { Allow: "GET,PATCH,DELETE,OPTIONS,HEAD" } });
}

export async function HEAD() {
  return new NextResponse(null, { status: 200, headers: { Allow: "GET,PATCH,DELETE,OPTIONS,HEAD" } });
}

export async function GET(req: Request, ctx: Ctx) {
  try {
    const { id: idParam } = await ctx.params;
    const id = parseId(idParam);
    if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const supa = await createSupabaseRouteClient();

    const { data, error } = await supa
      .from("articles")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    ensureSameOrigin(req);

    const { id: idParam } = await ctx.params;
    const id = parseId(idParam);
    if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const supa = await createSupabaseRouteClient();

    // Auth + admin role
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const roles = Array.isArray(user.app_metadata?.roles) ? user.app_metadata.roles : [];
    if (!roles.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const patch = await req.json().catch(() => null);
    if (!patch || typeof patch !== "object") {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    // Drop system fields
    ["id", "created_at", "updated_at", "author_id"].forEach(k => delete (patch as any)[k]);

    // If status is being changed to published and published_at is not set, set it now
    if (patch.status === "published") {
      const { data: current } = await supa
        .from("articles")
        .select("published_at")
        .eq("id", id)
        .maybeSingle();

      if (current && !current.published_at) {
        patch.published_at = new Date().toISOString();
      }
    }

    const { data, error } = await supa
      .from("articles")
      .update(patch)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) {
      // Check for unique constraint violation on slug
      if (error.code === "23505") {
        return NextResponse.json({ error: "Slug already exists" }, { status: 400 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ data });
  } catch (e: any) {
    const msg = String(e?.message ?? "");
    if (msg === "bad-origin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  try {
    ensureSameOrigin(req);

    const { id: idParam } = await ctx.params;
    const id = parseId(idParam);
    if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const supa = await createSupabaseRouteClient();

    // Auth + admin role
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const roles = Array.isArray(user.app_metadata?.roles) ? user.app_metadata.roles : [];
    if (!roles.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { data, error } = await supa
      .from("articles")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const msg = String(e?.message ?? "");
    if (msg === "bad-origin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
