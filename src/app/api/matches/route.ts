// app/api/matches/route.ts
import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/app/lib/supabase/supabaseServer";

const ALLOWED_STATUSES = new Set(["scheduled", "finished"]);

// 🔒 Allow-list of fields you actually insert. Add your own columns here.
const INSERTABLE_FIELDS = new Set<keyof any>([
  "status",
  "team_a_id",
  "team_b_id",
  "winner_team_id",
  "match_date",     // ✅ now allowed
  "team_a_score",   // ✅ now allowed
  "team_b_score",   // ✅ now allowed
  // add more if needed:
  // "tournament_id","stage_id","group_id","matchday","round","bracket_pos","venue"
]);

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

  const whitelist = new Set(allowedOrigins);
  try {
    whitelist.add(new URL(req.url).origin);
  } catch {}
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
function parseNonNegativeInt(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? n : null;
}
function parseNullableISODate(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function devDiag(err?: any) {
  if (process.env.NODE_ENV === "production" || !err) return {};
  return {
    __debug: {
      code: err?.code ?? null,
      message: err?.message ?? null,
      details: err?.details ?? null,
      hint: err?.hint ?? null,
    },
  };
}

function jsonError(status: number, msg: string, err?: any) {
  return NextResponse.json({ error: msg, ...devDiag(err) }, { status });
}

/** Map common Postgres/PostgREST errors to clear messages */
function mapDbError(err: any): { status: number; msg: string } {
  const code = String(err?.code ?? "");
  const msg = String(err?.message ?? "");
  const details = String(err?.details ?? "");

  // Special-case NOT NULL on winner_team_id so "scheduled" flows make sense
  if (code === "23502" && (details.includes("winner_team_id") || msg.includes(`"winner_team_id"`))) {
    return {
      status: 400,
      msg:
        "Your database requires winner_team_id (NOT NULL). " +
        "Either make the column nullable (recommended) or only create 'finished' matches with a winner.",
    };
  }

  switch (code) {
    case "42501": // insufficient_privilege (often RLS)
      return { status: 403, msg: "Operation not allowed by row-level security." };
    case "23503": // foreign_key_violation
      return { status: 409, msg: "Related record does not exist (foreign key violation)." };
    case "23505": // unique_violation
      return { status: 409, msg: "Duplicate violates a unique constraint." };
    case "23502": // not_null_violation
      return { status: 400, msg: "Missing required field (NOT NULL constraint)." };
    case "23514": // check_violation
      return { status: 400, msg: "A database check constraint was violated." };
    case "22P02": // invalid_text_representation
      return { status: 400, msg: "Invalid input format for one of the fields." };
    default:
      if (code.startsWith("PGRST")) {
        return { status: 400, msg: "Request rejected by API constraints." };
      }
      return { status: 400, msg: "Create failed." };
  }
}

/* ======================
   OPTIONS / HEAD handlers
   ====================== */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { Allow: "POST,OPTIONS,HEAD" },
  });
}
export async function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: { Allow: "POST,OPTIONS,HEAD" },
  });
}

/* ======================================
   POST /api/matches  (admin, strict)
   Body: match fields
   - Requires team_a_id, team_b_id (positive ints)
   - status ∈ {"scheduled","finished"} (defaults to "scheduled")
   - If "finished": winner_team_id required and must be one of the two teams
   - If "scheduled": reject non-null winner; avoid writing the column
   - Accepts optional match_date (ISO) and non-negative scores
   ====================================== */
export async function POST(req: Request) {
  try {
    ensureSameOrigin(req);

    const supa = await createSupabaseRouteClient();

    // Auth + admin role
    const {
      data: { user },
      error: userErr,
    } = await supa.auth.getUser();
    if (userErr || !user) return jsonError(401, "Unauthorized", userErr);
    const roles = Array.isArray(user.app_metadata?.roles)
      ? (user.app_metadata!.roles as string[])
      : [];
    if (!roles.includes("admin")) return jsonError(403, "Forbidden");

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonError(400, "Invalid JSON");
    }

    // Accept aliases for easier migration (home/away → team_a/b)
    const unified: Record<string, any> = { ...body };
    if (unified.home_team_id != null && unified.team_a_id == null) {
      unified.team_a_id = unified.home_team_id;
    }
    if (unified.away_team_id != null && unified.team_b_id == null) {
      unified.team_b_id = unified.away_team_id;
    }

    // Build sanitized payload from allow-list
    const payload: Record<string, any> = {};
    for (const [k, v] of Object.entries(unified)) {
      if (INSERTABLE_FIELDS.has(k)) payload[k] = v;
    }

    // Default + validate status
    if (payload.status == null) payload.status = "scheduled";
    if (!ALLOWED_STATUSES.has(payload.status)) {
      return jsonError(400, "Invalid status");
    }

    // Normalize/require team ids
    payload.team_a_id = parsePositiveInt(payload.team_a_id);
    payload.team_b_id = parsePositiveInt(payload.team_b_id);
    if (!payload.team_a_id || !payload.team_b_id) {
      return jsonError(400, "team_a_id and team_b_id are required");
    }

    // Normalize scores (optional, must be ≥ 0 if provided)
    if ("team_a_score" in payload) {
      const s = parseNonNegativeInt(payload.team_a_score);
      if (s == null && payload.team_a_score != null && payload.team_a_score !== "")
        return jsonError(400, "Invalid team_a_score");
      if (s == null) delete payload.team_a_score; else payload.team_a_score = s;
    }
    if ("team_b_score" in payload) {
      const s = parseNonNegativeInt(payload.team_b_score);
      if (s == null && payload.team_b_score != null && payload.team_b_score !== "")
        return jsonError(400, "Invalid team_b_score");
      if (s == null) delete payload.team_b_score; else payload.team_b_score = s;
    }

    // Normalize match_date (optional ISO or null)
    if ("match_date" in payload) {
      const iso = parseNullableISODate(payload.match_date);
      if (payload.match_date != null && iso === null) {
        return jsonError(400, "Invalid match_date");
      }
      payload.match_date = iso; // can be null
    }

    // Normalize winner
    if (Object.prototype.hasOwnProperty.call(payload, "winner_team_id")) {
      payload.winner_team_id = parseNullablePositiveInt(payload.winner_team_id);
    }

    // Business rules
    if (payload.status === "finished") {
      if (!payload.winner_team_id) {
        return jsonError(400, "Winner required when status is 'finished'.");
      }
      if (![payload.team_a_id, payload.team_b_id].includes(payload.winner_team_id)) {
        return jsonError(400, "winner_team_id must equal team_a_id or team_b_id");
      }
    } else {
      // scheduled
      if (payload.winner_team_id != null) {
        return jsonError(400, "winner_team_id must be empty while status is 'scheduled'");
      }
      // Avoid writing NULL explicitly (safer if column is NOT NULL with a default)
      delete payload.winner_team_id;
    }

    // Final prune: remove undefined/NaN
    for (const k of Object.keys(payload)) {
      // Note: allow 0 for scores; only prune undefined or NaN
      // @ts-ignore
      if (payload[k] === undefined || Number.isNaN(payload[k])) delete payload[k];
    }

    const { data, error } = await supa
      .from("matches")
      .insert(payload)
      .select("id")
      .single();

    if (error || !data) {
      console.error("Create match failed", error);
      const mapped = mapDbError(error);
      return jsonError(mapped.status, mapped.msg, error);
    }

    return NextResponse.json({ ok: true, id: data.id }, { status: 201 });
  } catch (e: any) {
    if (String(e?.message ?? "") === "bad-origin") return jsonError(403, "Forbidden");
    console.error("POST /api/matches failed", e);
    return jsonError(500, "Server error", e);
  }
}
