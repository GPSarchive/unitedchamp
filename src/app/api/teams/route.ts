// app/api/teams/route.ts
import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/app/lib/supabase/supabaseServer";

// If possible, rename your bucket to an id without spaces/apostrophes (e.g. "gpsarchives-project").
const BUCKET = "GPSarchive's Project";

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

function ensureSameOrigin(req: Request) {
  const m = req.method.toUpperCase();
  if (m === "GET" || m === "HEAD" || m === "OPTIONS") return;

  // Build a whitelist: env + the API’s own origin at runtime (dev/preview safe)
  const whitelist = new Set(
    (process.env.ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
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
function toStoragePathOrUrlSafe(input: unknown) {
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
        const objectPath = decodeURIComponent(m[2].split("?")[0]);
        if (bucket === BUCKET) {
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

// Create a short-lived signed URL with a *user* client (Storage RLS applies).
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
  return new NextResponse(null, { status: 204, headers: { Allow: "GET,POST,OPTIONS,HEAD" } });
}
export async function HEAD() {
  return new NextResponse(null, { status: 200, headers: { Allow: "GET,POST,OPTIONS,HEAD" } });
}

/* ======================================
   GET /api/teams?sign=1&include=active|archived|all
   ====================================== */
// Uses user/anon client so table RLS applies.
// Default: only non-deleted teams (active) and non-dummy teams.
// include=archived → only soft-deleted (still excludes dummy)
// include=all      → both (still excludes dummy)
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const shouldSign = url.searchParams.get("sign") === "1";
    const include = (url.searchParams.get("include") || "active").toLowerCase();

    const supa = await createSupabaseRouteClient();

    let q = supa
      .from("teams")
      .select("id, name, am, logo, created_at, deleted_at, season_score")
      .neq("is_dummy", true); // ⬅️ exclude dummy teams globally from this endpoint

    if (include === "archived") {
      q = q.not("deleted_at", "is", null);
    } else if (include === "all") {
      // no deleted_at filter; still excludes dummy via .neq above
    } else {
      // default: active only
      q = q.is("deleted_at", null);
    }

    const { data, error } = await q.order("name", { ascending: true });

    if (error) {
      console.error("GET /api/teams failed", error);
      return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
    }

    if (!shouldSign) {
      // Return raw (including deleted_at/season_score/am for admin UI badges/fields)
      return NextResponse.json({ teams: data ?? [] });
    }

    const teams = await Promise.all(
      (data ?? []).map(async (t) => ({
        id: t.id,
        name: t.name,
        am: t.am, // NEW: include AM in signed payload too
        created_at: t.created_at,
        deleted_at: t.deleted_at,
        season_score: t.season_score,
        logo: await signLogoIfNeededSafe(supa, t.id, t.logo),
      }))
    );

    return NextResponse.json({ teams });
  } catch (e) {
    console.error("GET /api/teams error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/* ======================================
   POST /api/teams  (admin only)
   Body: { name, am?, logo?, season_score? }
   - logo may be an external URL or a signed URL
   - If a storage path is provided, it will be validated *after* creation against teams/<newId>/...
   ====================================== */
export async function POST(req: Request) {
  try {
    ensureSameOrigin(req);

    const supa = await createSupabaseRouteClient();

    // auth + admin role
    const {
      data: { user },
      error: userErr,
    } = await supa.auth.getUser();
    if (userErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const roles = Array.isArray(user.app_metadata?.roles) ? user.app_metadata.roles : [];
    if (!roles.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const nameRaw = typeof body.name === "string" ? body.name.trim() : "";
    if (nameRaw.length < 2 || nameRaw.length > 128) {
      return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    }

    // AM (optional text). Empty -> null. Adjust length/regex as needed.
    const amRaw = typeof body.am === "string" ? body.am.trim() : "";
    if (amRaw && amRaw.length > 64) {
      return NextResponse.json({ error: "AM too long (max 64 characters)" }, { status: 400 });
    }

    // season_score (optional, non-negative integer)
    let seasonScoreRaw: number | null = null;
    if (Object.prototype.hasOwnProperty.call(body, "season_score")) {
      const n = Number(body.season_score);
      if (!Number.isInteger(n) || n < 0) {
        return NextResponse.json({ error: "Invalid season_score" }, { status: 400 });
      }
      seasonScoreRaw = n;
    }

    const logoCandidate = toStoragePathOrUrlSafe(body.logo);

    // Insert first; if logoCandidate is an external URL, we can include it now.
    const initialLogo = logoCandidate && /^https?:\/\//i.test(logoCandidate) ? logoCandidate : null;

    const { data: created, error: insErr } = await supa
      .from("teams")
      .insert({
        name: nameRaw,
        am: amRaw || null, // NEW
        logo: initialLogo,
        season_score: seasonScoreRaw ?? 0,
      })
      .select("id, name, am, logo, created_at, deleted_at, season_score")
      .single();

    if (insErr || !created) {
      // Postgres unique violation (duplicate AM)
      if ((insErr as any)?.code === "23505") {
        return NextResponse.json({ error: "AM must be unique" }, { status: 400 });
      }
      console.error("Create team failed", insErr);
      return NextResponse.json({ error: "Create failed" }, { status: 400 });
    }

    let team = created;

    // If a storage path was provided, validate against teams/<newId>/... and set it.
    if (logoCandidate && !/^https?:\/\//i.test(logoCandidate)) {
      if (isSafeObjectPath(logoCandidate, team.id)) {
        const { data: updated, error: upErr } = await supa
          .from("teams")
          .update({ logo: logoCandidate })
          .eq("id", team.id)
          .select("id, name, am, logo, created_at, deleted_at, season_score")
          .single();

        if (upErr) {
          console.error("Update team logo failed", upErr);
          // keep initial team row
        } else if (updated) {
          team = updated;
        }
      } else {
        // Invalid storage path; ignore it
        console.warn("Rejected invalid logo path on create", { provided: logoCandidate, teamId: team.id });
      }
    }

    // Sign in response so the list can render immediately
    const signedLogo = await signLogoIfNeededSafe(supa, team.id, team.logo);
    return NextResponse.json({ team: { ...team, logo: signedLogo } }, { status: 201 });
  } catch (e: any) {
    const msg = String(e?.message ?? "");
    if (msg === "bad-origin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("POST /api/teams failed", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
