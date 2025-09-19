// app/api/matches/[id]/route.ts
import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/app/lib/supabase/supabaseServer";
// ⬇️ Run tournament progression after finishing a match
import { progressAfterMatch } from "@/app/dashboard/components/TournamentCURD/progression";

type Ctx = { params: { id: string } };

const ALLOWED_STATUSES = new Set(["scheduled", "finished"]);
const UPDATABLE_FIELDS = new Set<keyof any>([
  "status",
  "winner_team_id",
  "team_a_id",
  "team_b_id",
  "match_date",    // allow updating date
  "team_a_score",  // allow updating score
  "team_b_score",  // allow updating score
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

function detailedMsg(base: string, err?: any) {
  const parts = [base];
  if (err?.details) parts.push(String(err.details));
  if (err?.hint) parts.push(String(err.hint));
  return parts.filter(Boolean).join(" — ");
}

function mapDbError(err: any): { status: number; msg: string } {
  const code = String(err?.code ?? "");
  // Provide user-facing errors with details embedded so UI popups are informative
  switch (code) {
    case "42501": // RLS / insufficient_privilege
      return { status: 403, msg: detailedMsg("Operation not allowed by row-level security.", err) };
    case "23503": // foreign key
      return { status: 409, msg: detailedMsg("Related record does not exist (foreign key violation).", err) };
    case "23505": // unique
      return { status: 409, msg: detailedMsg("Duplicate violates a unique constraint.", err) };
    case "23502": // not null
      return { status: 400, msg: detailedMsg("Missing required field (NOT NULL constraint).", err) };
    case "23514": // check constraint
      return { status: 400, msg: detailedMsg("A database check constraint was violated.", err) };
    case "22P02": // invalid text representation (bad UUID/int, etc.)
      return { status: 400, msg: detailedMsg("Invalid input format for one of the fields.", err) };
    default:
      if (code.startsWith("PGRST")) {
        return { status: 400, msg: detailedMsg("Request rejected by API constraints.", err) };
      }
      return { status: 400, msg: detailedMsg("Operation failed.", err) };
  }
}

function jsonError(status: number, msg: string, err?: any) {
  // Put details directly in error string so your UI (which reads `error`) shows them
  const full = detailedMsg(msg, err);
  return NextResponse.json({ error: full, ...devDiag(err) }, { status });
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

    const { id: idParam } = ctx.params;
    const id = parsePositiveInt(idParam);
    if (!id) return jsonError(400, "Invalid id");

    const supa = await createSupabaseRouteClient();

    // Auth + admin role
    const {
      data: { user },
      error: userErr,
    } = await supa.auth.getUser();
    if (userErr || !user) return jsonError(401, "Unauthorized", userErr);
    const roles = Array.isArray(user.app_metadata?.roles) ? user.app_metadata.roles : [];
    if (!roles.includes("admin")) return jsonError(403, "Forbidden");

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return jsonError(400, "Invalid JSON");

    // Load current row (need scores to satisfy possible DB checks)
    const { data: current, error: curErr } = await supa
      .from("matches")
      .select("id, team_a_id, team_b_id, status, winner_team_id, team_a_score, team_b_score")
      .eq("id", id)
      .maybeSingle();

    if (curErr) {
      console.error("PATCH current fetch error", curErr);
      return jsonError(400, "Failed to load the match.", curErr);
    }
    if (!current) return jsonError(404, "Not found");

    // ---------- Build sanitized update from allow-list ----------
    const update: Record<string, any> = {};
    for (const [k, v] of Object.entries(body)) {
      if (UPDATABLE_FIELDS.has(k)) update[k] = v;
    }

    // Normalize numbers/scores
    if ("team_a_id" in update) update.team_a_id = parsePositiveInt(update.team_a_id);
    if ("team_b_id" in update) update.team_b_id = parsePositiveInt(update.team_b_id);

    if ("team_a_score" in update) {
      const s = parseNonNegativeInt(update.team_a_score);
      if (s == null && update.team_a_score != null && update.team_a_score !== "")
        return jsonError(400, "Invalid team_a_score");
      if (s == null) delete update.team_a_score;
      else update.team_a_score = s;
    }
    if ("team_b_score" in update) {
      const s = parseNonNegativeInt(update.team_b_score);
      if (s == null && update.team_b_score != null && update.team_b_score !== "")
        return jsonError(400, "Invalid team_b_score");
      if (s == null) delete update.team_b_score;
      else update.team_b_score = s;
    }

    // Normalize date
    if ("match_date" in update) {
      const iso = parseNullableISODate(update.match_date);
      if (update.match_date != null && iso === null) return jsonError(400, "Invalid match_date");
      update.match_date = iso; // allow null to clear if schema permits
    }

    // Validate status
    if ("status" in update && !ALLOWED_STATUSES.has(update.status)) {
      return jsonError(400, "Invalid status");
    }

    // Effective values after patch (merge with current)
    const teamA = "team_a_id" in update ? update.team_a_id : current.team_a_id;
    const teamB = "team_b_id" in update ? update.team_b_id : current.team_b_id;
    if (!teamA || !teamB) return jsonError(400, "Both team_a_id and team_b_id must be set");
    if (teamA === teamB) return jsonError(400, "team_a_id and team_b_id must differ");

    if ("winner_team_id" in update) update.winner_team_id = parseNullablePositiveInt(update.winner_team_id);
    const finalStatus = ("status" in update ? update.status : current.status) as string;

    if (finalStatus === "scheduled") {
      // Enforce no winner while scheduled.
      if ("winner_team_id" in update && update.winner_team_id != null) {
        return jsonError(400, "winner_team_id must be empty while status is 'scheduled'");
      }
      if (!("winner_team_id" in update) && current.winner_team_id != null) {
        return jsonError(409, "Clear winner_team_id before setting status to 'scheduled'.");
      }
      delete update.winner_team_id;

      // Common DB check: no scores while scheduled → actively null them out
      update.team_a_score = null;
      update.team_b_score = null;
    } else if (finalStatus === "finished") {
      const winner = "winner_team_id" in update ? update.winner_team_id : current.winner_team_id;
      if (!winner) return jsonError(400, "Winner required when status is 'finished'.");
      if (![teamA, teamB].includes(winner)) {
        return jsonError(400, "winner_team_id must equal team_a_id or team_b_id");
      }

      // If your DB requires scores when finished, enforce:
      const aScore = "team_a_score" in update ? update.team_a_score : current.team_a_score;
      const bScore = "team_b_score" in update ? update.team_b_score : current.team_b_score;
      if (aScore == null || bScore == null) {
        return jsonError(400, "team_a_score and team_b_score are required when status is 'finished'");
      }
    }

    // Prune undefined/NaN (keep 0 and null)
    for (const k of Object.keys(update)) {
      // @ts-ignore
      if (update[k] === undefined || Number.isNaN(update[k])) delete update[k];
    }
    if (Object.keys(update).length === 0) return jsonError(400, "No fields to update");

    // ---------- Update ----------
    const { data, error } = await supa
      .from("matches")
      .update(update)
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("PATCH /matches update failed", error);
      const mapped = mapDbError(error);
      return jsonError(mapped.status, mapped.msg, error);
    }
    if (!data) return jsonError(404, "Not found");

    // ⬇️ Run tournament progression after finishing a match (idempotent)
    if (finalStatus === "finished") {
      try {
        await progressAfterMatch(id);
      } catch (e) {
        // Don’t fail the PATCH because of progression; just log it.
        console.error("progressAfterMatch failed for match", id, e);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const msg = String(e?.message ?? "");
    if (msg === "bad-origin") return jsonError(403, "Forbidden");
    console.error("PATCH /matches/:id failed", e);
    return jsonError(500, "Server error", e);
  }
}

/* ======================================
   DELETE /api/matches/:id  (admin)
   Block if match belongs to a tournament OR
   if it is referenced by other matches (as a source).
   ====================================== */
export async function DELETE(req: Request, ctx: Ctx) {
  try {
    ensureSameOrigin(req);

    const { id: idParam } = ctx.params;
    const id = parsePositiveInt(idParam);
    if (!id) return jsonError(400, "Invalid id");

    const supa = await createSupabaseRouteClient();

    // Auth + admin role
    const {
      data: { user },
      error: userErr,
    } = await supa.auth.getUser();
    if (userErr || !user) return jsonError(401, "Unauthorized", userErr);
    const roles = Array.isArray(user.app_metadata?.roles) ? user.app_metadata.roles : [];
    if (!roles.includes("admin")) return jsonError(403, "Forbidden");

    // Load current match minimal metadata
    const { data: current, error: curErr } = await supa
      .from("matches")
      .select("id, tournament_id")
      .eq("id", id)
      .maybeSingle();

    if (curErr) {
      console.error("DELETE current fetch error", curErr);
      return jsonError(400, "Failed to load the match.", curErr);
    }
    if (!current) return jsonError(404, "Not found");

    // 🚫 Hard-stop if part of a tournament
    if (current.tournament_id != null) {
      return jsonError(
        409,
        "This match is part of a tournament and cannot be deleted. Edit it in the tournament editor instead."
      );
    }

    // Extra safety: block if any matches depend on it (KO sources)
    const { data: depHome, error: depHomeErr } = await supa
      .from("matches")
      .select("id")
      .eq("home_source_match_id", id)
      .limit(1);

    const { data: depAway, error: depAwayErr } = await supa
      .from("matches")
      .select("id")
      .eq("away_source_match_id", id)
      .limit(1);

    if (depHomeErr || depAwayErr) {
      console.error("DELETE dependency check failed", depHomeErr ?? depAwayErr);
      return jsonError(400, "Failed to check match dependencies.", depHomeErr ?? depAwayErr);
    }
    if ((depHome?.length ?? 0) > 0 || (depAway?.length ?? 0) > 0) {
      return jsonError(409, "This match feeds other matches and cannot be deleted.");
    }

    const { data, error } = await supa
      .from("matches")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("DELETE /matches delete failed", error);
      const mapped = mapDbError(error);
      return jsonError(mapped.status, mapped.msg, error);
    }
    if (!data) return jsonError(404, "Not found");

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const msg = String(e?.message ?? "");
    if (msg === "bad-origin") return jsonError(403, "Forbidden");
    console.error("DELETE /matches/:id failed", e);
    return jsonError(500, "Server error", e);
  }
}
