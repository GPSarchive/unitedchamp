// app/api/announcements/route.ts
import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/app/lib/supabase/supabaseServer";

// ---- same-origin guard (copy of matches) ----
function ensureSameOrigin(req: Request) {
  const m = req.method.toUpperCase();
  if (m === "GET" || m === "HEAD" || m === "OPTIONS") return;

  const whitelist = new Set(
    (process.env.ALLOWED_ORIGINS ?? "")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean)
  );
  try { whitelist.add(new URL(req.url).origin); } catch {}

  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const ok = [origin, referer].some(val => {
    try { return !!val && whitelist.has(new URL(val).origin); } catch { return false; }
  });
  if (!ok) throw new Error("bad-origin");
}
// --------------------------------------------

function toBool(v: string | null) {
  return v === "1" || v === "true";
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { Allow: "GET,POST,OPTIONS,HEAD" } });
}
export async function HEAD() {
  return new NextResponse(null, { status: 200, headers: { Allow: "GET,POST,OPTIONS,HEAD" } });
}

export async function GET(req: Request) {
  const supa = await createSupabaseRouteClient();
  const url = new URL(req.url);
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? "0"));
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "10"), 1), 50);
  const active = toBool(url.searchParams.get("active"));
  const nowIso = new Date().toISOString();

  let q = supa
    .from("announcements")
    .select("*", { count: "exact" })
    .order("pinned", { ascending: false })
    .order("priority", { ascending: false })
    .order("start_at", { ascending: false })
    .order("created_at", { ascending: false });

  // FIX: combine the time-window ORs into a single .or(...) call.
  // Active means: published AND ((start_at IS NULL OR start_at <= now) AND (end_at IS NULL OR end_at >= now))
  if (active) {
    q = q
      .eq("status", "published")
      .or(
        [
          `and(start_at.is.null,end_at.is.null)`,
          `and(start_at.is.null,end_at.gte.${nowIso})`,
          `and(start_at.lte.${nowIso},end_at.is.null)`,
          `and(start_at.lte.${nowIso},end_at.gte.${nowIso})`,
        ].join(",")
      );
  }

  const { data, error, count } = await q.range(offset, offset + limit - 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const total = typeof count === "number" ? count : null;
  const nextOffset = total !== null && offset + limit < total ? offset + limit : null;

  return NextResponse.json({
    data,
    page: Math.floor(offset / limit) + 1,
    limit,
    total,
    nextOffset,
  });
}

export async function POST(req: Request) {
  try {
    ensureSameOrigin(req);

    const supa = await createSupabaseRouteClient();

    // Require authenticated admin (matches your /api/matches logic)
    const { data: { user }, error: userErr } = await supa.auth.getUser();
    if (userErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const roles = Array.isArray(user.app_metadata?.roles) ? user.app_metadata.roles : [];
    if (!roles.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const payload = await req.json().catch(() => null);
    if (!payload || typeof payload !== "object") {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    // Drop system fields + validate dates
    ["id", "created_at", "updated_at"].forEach(k => delete (payload as any)[k]);
    if (payload.end_at && payload.start_at && new Date(payload.end_at) < new Date(payload.start_at)) {
      return NextResponse.json({ error: "end_at must be after start_at" }, { status: 400 });
    }

    const { data, error } = await supa
      .from("announcements")
      .insert(payload)
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data }, { status: 201 });
  } catch (e: any) {
    const msg = String(e?.message ?? "");
    if (msg === "bad-origin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
