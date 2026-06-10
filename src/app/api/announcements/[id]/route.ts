// app/api/announcements/[id]/route.ts
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
  return new NextResponse(null, { status: 204, headers: { Allow: "PATCH,DELETE,OPTIONS,HEAD" } });
}
export async function HEAD() {
  return new NextResponse(null, { status: 200, headers: { Allow: "PATCH,DELETE,OPTIONS,HEAD" } });
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    ensureSameOrigin(req);

    const { id: idParam } = await ctx.params; // ← await params
    const id = parseId(idParam);
    if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const supa = await createSupabaseRouteClient();

    // Auth + admin role (same as matches)
    const {
      data: { user },
    } = await supa.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const roles = Array.isArray(user.app_metadata?.roles) ? user.app_metadata.roles : [];
    if (!roles.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const patch = await req.json().catch(() => null);
    if (!patch || typeof patch !== "object") {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    ["id", "created_at", "updated_at"].forEach(k => delete (patch as any)[k]);
    if ((patch as any).end_at && (patch as any).start_at) {
      const endAt = new Date((patch as any).end_at);
      const startAt = new Date((patch as any).start_at);
      if (endAt < startAt) {
        return NextResponse.json({ error: "end_at must be after start_at" }, { status: 400 });
      }
    }

    const { data, error } = await supa
      .from("announcements")
      .update(patch)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) return dbError(error, 400, "announcements/[id].PATCH");
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

    const { id: idParam } = await ctx.params; // ← await params
    const id = parseId(idParam);
    if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const supa = await createSupabaseRouteClient();

    // Auth + admin role
    const {
      data: { user },
    } = await supa.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const roles = Array.isArray(user.app_metadata?.roles) ? user.app_metadata.roles : [];
    if (!roles.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { data, error } = await supa
      .from("announcements")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) return dbError(error, 400, "announcements/[id].DELETE");
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const msg = String(e?.message ?? "");
    if (msg === "bad-origin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
