// app/api/matches/route.ts
import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/app/lib/supabaseServer";

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
  const whitelist = new Set(
    (process.env.ALLOWED_ORIGINS ?? "")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean)
  );
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
function parsePositiveInt(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
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
  return new NextResponse(null, { status: 204, headers: { Allow: "POST,OPTIONS,HEAD" } });
}
export async function HEAD() {
  return new NextResponse(null, { status: 200, headers: { Allow: "POST,OPTIONS,HEAD" } });
}

/* ======================================
   POST /api/matches  (admin)
   Body: match fields (RLS applies)
   - If status === "finished", winner_team_id must be set
   - Drops immutable/system fields
   ====================================== */
export async function POST(req: Request) {
  try {
    ensureSameOrigin(req);

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

    // Shallow sanitize
    const payload: Record<string, any> = { ...body };
    delete payload.id;
    delete payload.created_at;
    delete payload.updated_at;
    delete payload.deleted_at;

    // Normalize some commonly expected fields if present
    if (Object.prototype.hasOwnProperty.call(payload, "home_team_id")) {
      payload.home_team_id = parsePositiveInt(payload.home_team_id);
      if (!payload.home_team_id) return NextResponse.json({ error: "Invalid home_team_id" }, { status: 400 });
    }
    if (Object.prototype.hasOwnProperty.call(payload, "away_team_id")) {
      payload.away_team_id = parsePositiveInt(payload.away_team_id);
      if (!payload.away_team_id) return NextResponse.json({ error: "Invalid away_team_id" }, { status: 400 });
    }
    if (Object.prototype.hasOwnProperty.call(payload, "winner_team_id")) {
      payload.winner_team_id = parseNullablePositiveInt(payload.winner_team_id);
    }

    // Business rule: finished => winner required
    if (payload.status === "finished" && !payload.winner_team_id) {
      return NextResponse.json({ error: "Winner required when status is 'finished'." }, { status: 400 });
    }

    const { data, error } = await supa
      .from("matches")
      .insert(payload)
      .select("id")
      .single();

    if (error || !data) {
      console.error("Create match failed", error);
      return NextResponse.json({ error: "Create failed" }, { status: 400 });
    }

    return NextResponse.json({ ok: true, id: data.id }, { status: 201 });
  } catch (e: any) {
    const msg = String(e?.message ?? "");
    if (msg === "bad-origin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("POST /api/matches failed", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
