// app/api/teams/[id]/route.ts
import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/app/lib/supabase/supabaseServer";

/* =========================
   Storage / Bucket settings
   ========================= */
const BUCKET = "GPSarchive's Project";

/* =========================
   Types
   ========================= */
type Ctx = { params: Promise<{ id: string }> };

/* =======================
   Minimal same-origin guard
   ======================= */
// .env: ALLOWED_ORIGINS=https://app.example.com,http://localhost:3000
const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);

/** Tokenless CSRF mitigation: enforce same-origin via Origin/Referer on mutating verbs. */
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

  const ok = [origin, referer].some((val) => {
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

// Strict path validation: no leading "/", no "..", no empty segments; must start with teams/<id>/
function isSafeObjectPath(raw: string, teamId: number): boolean {
  if (!raw || typeof raw !== "string") return false;

  let p: string;
  try {
    p = decodeURIComponent(raw);
  } catch {
    return false;
  }

  if (p.startsWith("/")) return false;
  if (p.includes("..")) return false;

  const parts = p.split("/");
  if (parts.some((seg) => !seg || seg === ".")) return false;

  const prefix = `teams/${teamId}/`;
  return p.startsWith(prefix);
}

// Normalize to storage path or keep external URL; tolerant of bucket ids with spaces/apostrophes.
function toStoragePathOrUrlSafe(input: string | null | undefined, teamId?: number) {
  if (input == null) return null;
  const v = String(input).trim();
  if (!v) return null;

  // external https? → keep (but try to extract storage path if it's a signed URL to our bucket)
  if (/^https?:\/\//i.test(v)) {
    try {
      const u = new URL(v);
      // pattern: /storage/v1/object/sign/<bucket>/<path>?token=...
      const m = u.pathname.match(/\/object\/sign\/([^/]+)\/(.+)$/);
      if (m) {
        const bucket = decodeURIComponent(m[1]);
        const pathAndMaybeQuery = m[2];
        const objectPath = decodeURIComponent(pathAndMaybeQuery.split("?")[0]);
        if (bucket === BUCKET) {
          if (teamId && !isSafeObjectPath(objectPath, teamId)) return null;
          return objectPath; // storage path
        }
      }
      return v; // leave other external URLs alone
    } catch {
      return v; // non-URL string; treat as storage path below
    }
  }

  // raw storage path (validate later when we know teamId)
  return v;
}

/** Create a short-lived signed URL with a *user* client (Storage RLS applies). */
async function signLogoIfNeededSafe(
  supaUserClient: Awaited<ReturnType<typeof createSupabaseRouteClient>>,
  teamId: number,
  logo: string | null
) {
  if (!logo) return null;
  if (/^https?:\/\//i.test(logo)) return logo; // external/public

  if (!isSafeObjectPath(logo, teamId)) return null;

  const { data, error } = await supaUserClient.storage.from(BUCKET).createSignedUrl(logo, 60 * 10); // 10 minutes
  if (error) {
    console.error("signLogoIfNeededSafe error", { error, teamId, logo });
    return null;
  }
  return data?.signedUrl ?? null;
}

/* ======================
   OPTIONS / HEAD handlers
   ====================== */

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { Allow: "GET,PATCH,DELETE,OPTIONS,HEAD" } });
}

export async function HEAD() {
  return new NextResponse(null, { status: 200, headers: { Allow: "GET,PATCH,DELETE,OPTIONS,HEAD" } });
}

/* ==========================
   GET /api/teams/[id]
   ========================== */
// Uses user/anon client so table RLS applies.
export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { id: idParam } = await ctx.params; // Next 15: params is a Promise
    const id = parsePositiveInt(idParam);
    if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const supa = await createSupabaseRouteClient();

    const { data, error } = await supa
      .from("teams")
      .select("id, name, am, logo, colour, created_at, deleted_at, season_score")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("GET teams error", error);
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({
      team: { ...data, logo: await signLogoIfNeededSafe(supa, data.id, data.logo) },
    });
  } catch (e) {
    console.error("GET /teams/[id] failed", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/* ==========================
   PATCH /api/teams/[id] (admin)
   ========================== */
export async function PATCH(req: Request, ctx: Ctx) {
  try {
    ensureSameOrigin(req);

    const supa = await createSupabaseRouteClient();
    const {
      data: { user },
      error: userErr,
    } = await supa.auth.getUser();
    if (userErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const roles = Array.isArray(user.app_metadata?.roles) ? user.app_metadata.roles : [];
    if (!roles.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id: idParam } = await ctx.params;
    const id = parsePositiveInt(idParam);
    if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const nameRaw =
      typeof (body as any).name === "string" ? (body as any).name.trim() : undefined;
    const logoCandidate = toStoragePathOrUrlSafe((body as any).logo, id);

    // Optional: season_score
    let seasonScoreVal: number | undefined;
    if (Object.prototype.hasOwnProperty.call(body, "season_score")) {
      const n = Number((body as any).season_score);
      if (!Number.isInteger(n) || n < 0) {
        return NextResponse.json({ error: "Invalid season_score" }, { status: 400 });
      }
      seasonScoreVal = n;
    }

    // Optional: AM (text, unique). Empty string -> null. Adjust length/regex as needed.
    let amVal: string | null | undefined;
    if (Object.prototype.hasOwnProperty.call(body, "am")) {
      const vRaw = typeof (body as any).am === "string" ? (body as any).am.trim() : null;
      if (vRaw && vRaw.length > 64) {
        return NextResponse.json({ error: "AM too long (max 64 characters)" }, { status: 400 });
      }
      amVal = vRaw || null;
    }

    // Optional: colour (hex color string)
    let colourVal: string | null | undefined;
    if (Object.prototype.hasOwnProperty.call(body, "colour")) {
      const cRaw = typeof (body as any).colour === "string" ? (body as any).colour.trim() : null;
      colourVal = cRaw || null;
    }

    const update: Record<string, any> = {};
    if (nameRaw !== undefined) {
      if (nameRaw.length < 2 || nameRaw.length > 128) {
        return NextResponse.json({ error: "Invalid name" }, { status: 400 });
      }
      update.name = nameRaw;
    }

    if (Object.prototype.hasOwnProperty.call(body, "logo")) {
      if (logoCandidate && !/^https?:\/\//i.test(logoCandidate) && !isSafeObjectPath(logoCandidate, id)) {
        return NextResponse.json({ error: "Invalid logo path" }, { status: 400 });
      }
      update.logo = logoCandidate ?? null;
    }

    if (seasonScoreVal !== undefined) {
      update.season_score = seasonScoreVal;
    }

    if (amVal !== undefined) {
      update.am = amVal;
    }

    if (colourVal !== undefined) {
      update.colour = colourVal;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const { data, error } = await supa
      .from("teams")
      .update(update)
      .eq("id", id)
      .is("deleted_at", null) // don't update soft-deleted rows
      .select("id, name, am, logo, colour, created_at, deleted_at, season_score")
      .maybeSingle();

    if (error) {
      // Postgres unique violation (e.g., duplicate AM)
      if ((error as any)?.code === "23505") {
        return NextResponse.json({ error: "AM must be unique" }, { status: 400 });
      }
      console.error("PATCH teams error", error);
      return NextResponse.json({ error: "Update failed" }, { status: 400 });
    }
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({
      team: { ...data, logo: await signLogoIfNeededSafe(supa, data.id, data.logo) },
    });
  } catch (e: any) {
    const msg = String(e?.message ?? "");
    if (msg === "bad-origin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("PATCH /teams/[id] failed", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/* ==========================================
   DELETE /api/teams/[id] (admin, soft delete)
   ========================================== */
export async function DELETE(req: Request, ctx: Ctx) {
  try {
    ensureSameOrigin(req);

    const supa = await createSupabaseRouteClient();
    const {
      data: { user },
      error: userErr,
    } = await supa.auth.getUser();
    if (userErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const roles = Array.isArray(user.app_metadata?.roles) ? user.app_metadata.roles : [];
    if (!roles.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id: idParam } = await ctx.params;
    const id = parsePositiveInt(idParam);
    if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const { data, error } = await supa
      .from("teams")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .is("deleted_at", null) // only delete if not already deleted
      .select("id, name, am, logo, colour, created_at, deleted_at, season_score")
      .maybeSingle();

    if (error) {
      console.error("DELETE teams error", error);
      return NextResponse.json({ error: "Delete failed" }, { status: 400 });
    }
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({
      ok: true,
      team: { ...data, logo: await signLogoIfNeededSafe(supa, data.id, data.logo) },
      soft_deleted: true,
    });
  } catch (e: any) {
    const msg = String(e?.message ?? "");
    if (msg === "bad-origin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("DELETE /teams/[id] failed", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
