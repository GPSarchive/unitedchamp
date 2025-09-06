// app/api/matches/[id]/route.ts
import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/app/lib/supabaseServer";

type Ctx = { params: Promise<{ id: string }> };

/* =======================
   Minimal same-origin guard
   ======================= */
// .env: ALLOWED_ORIGINS=https://app.example.com,http://localhost:3000
const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean)
);

function ensureSameOrigin(req: Request) {
  const m = req.method.toUpperCase();
  if (m === "GET" || m === "HEAD" || m === "OPTIONS") return;

  // Build a whitelist: env + the API’s own origin at runtime (dev/preview safe)
  const whitelist = new Set(allowedOrigins);
  try {
    whitelist.add(new URL(req.url).origin);
  } catch {
    // ignore
  }

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

/* ==============
   Helper utils
   ============== */
function parsePositiveInt(s: string): number | null {
  const n = Number(s);
  return Number.isInteger(n) && n > 0 ? n : null;
}
function parseNullablePositiveInt(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/* ======================
   OPTIONS / HEAD handlers
   ====================== */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { Allow: "PATCH,DELETE,OPTIONS,HEAD" } });
}
export async function HEAD() {
  return new NextResponse(null, { status: 200, headers: { Allow: "PATCH,DELETE,OPTIONS,HEAD" } });
}

/* ======================================
   PATCH /api/matches/:id  (admin)
   ====================================== */
export async function PATCH(req: Request, ctx: Ctx) {
  try {
    ensureSameOrigin(req);

    const { id: idParam } = await ctx.params; // await params (Next 15)
    const id = parsePositiveInt(idParam);
    if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const supa = await createSupabaseRouteClient();

    // Auth + admin role
    const { data: { user }, error: userErr } = await supa.auth.getUser();
    if (userErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const roles = Array.isArray(user.app_metadata?.roles) ? user.app_metadata.roles : [];
    if (!roles.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    // Shallow clone and drop dangerous fields
    const update: Record<string, any> = { ...body };
    delete update.id;
    delete update.created_at;
    delete update.deleted_at;

    // Normalize winner_team_id to number|null if present
    if (Object.prototype.hasOwnProperty.call(update, "winner_team_id")) {
      update.winner_team_id = parseNullablePositiveInt(update.winner_team_id);
    }

    // Business rule: finished => winner required
    if (update.status === "finished" && !update.winner_team_id) {
      return NextResponse.json({ error: "Winner required when status is 'finished'." }, { status: 400 });
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const { data, error } = await supa
      .from("matches")
      .update(update)
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("PATCH /matches update failed", error);
      return NextResponse.json({ error: "Update failed" }, { status: 400 });
    }
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const msg = String(e?.message ?? "");
    if (msg === "bad-origin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("PATCH /matches/:id failed", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/* ======================================
   DELETE /api/matches/:id  (admin)
   ====================================== */
export async function DELETE(req: Request, ctx: Ctx) {
  try {
    ensureSameOrigin(req);

    const { id: idParam } = await ctx.params; // await params (Next 15)
    const id = parsePositiveInt(idParam);
    if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const supa = await createSupabaseRouteClient();

    // Auth + admin role
    const { data: { user }, error: userErr } = await supa.auth.getUser();
    if (userErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const roles = Array.isArray(user.app_metadata?.roles) ? user.app_metadata.roles : [];
    if (!roles.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { data, error } = await supa
      .from("matches")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("DELETE /matches delete failed", error);
      return NextResponse.json({ error: "Delete failed" }, { status: 400 });
    }
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const msg = String(e?.message ?? "");
    if (msg === "bad-origin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("DELETE /matches/:id failed", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
