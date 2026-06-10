// app/api/players/[id]/restore/route.ts
import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/app/lib/supabase/supabaseServer";
import { ensureSameOrigin } from "@/app/lib/same-origin";

type Ctx = { params: Promise<{ id: string }> };

function parsePositiveInt(s: string): number | null {
  const n = Number(s);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { Allow: "POST,OPTIONS,HEAD" } });
}
export async function HEAD() {
  return new NextResponse(null, { status: 200, headers: { Allow: "POST,OPTIONS,HEAD" } });
}

/* ==========================================
   POST /api/players/[id]/restore (admin)
   ========================================== */
export async function POST(req: Request, ctx: Ctx) {
  try {
    ensureSameOrigin(req);

    const supa = await createSupabaseRouteClient();
    const { data: { user }, error: userErr } = await supa.auth.getUser();
    if (userErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const roles = Array.isArray(user.app_metadata?.roles) ? user.app_metadata.roles : [];
    if (!roles.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id: idParam } = await ctx.params;
    const id = parsePositiveInt(idParam);
    if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const { data, error } = await supa
      .from("player")
      .update({ deleted_at: null })
      .eq("id", id)
      .not("deleted_at", "is", null) // only restore if currently archived
      .select("id, first_name, last_name, deleted_at")
      .maybeSingle();

    if (error) {
      console.error("POST restore error", error);
      return NextResponse.json({ error: "Restore failed" }, { status: 400 });
    }
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ ok: true, player: data, restored: true });
  } catch (e: any) {
    const msg = String(e?.message ?? "");
    if (msg === "bad-origin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("POST /players/[id]/restore failed", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
