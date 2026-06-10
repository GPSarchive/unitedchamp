// app/api/articles/[id]/route.ts
import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/app/lib/supabase/supabaseServer";
import { ensureSameOrigin } from "@/app/lib/same-origin";
import { dbError } from "@/app/lib/api-error";

type Ctx = { params: Promise<{ id: string }> };

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

    if (error) return dbError(error, 400, "articles/[id].GET");
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
      return dbError(error, 400, "articles/[id].PATCH");
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

    if (error) return dbError(error, 400, "articles/[id].DELETE");
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const msg = String(e?.message ?? "");
    if (msg === "bad-origin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
