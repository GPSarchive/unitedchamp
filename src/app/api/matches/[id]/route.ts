// app/api/matches/[id]/route.ts
import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/app/lib/supabase/supabaseServer";
// ⬇️ Run tournament progression after finishing a match
import { progressAfterMatch } from "@/app/dashboard/tournaments/TournamentCURD/progression";

const ALLOWED_STATUSES = new Set(["scheduled", "finished"]);

// ❗ Structural bracket fields are immutable via PATCH (use generators/reseed)
const STRUCTURAL_FIELDS = new Set<keyof any>([
  "round",
  "bracket_pos",
  "home_source_round",
  "home_source_bracket_pos",
  "away_source_round",
  "away_source_bracket_pos",
  "home_source_match_id",
  "away_source_match_id",
]);

// Only allow non-structural edits here
const UPDATABLE_FIELDS = new Set<keyof any>([
  "status",
  "winner_team_id",
  "team_a_id",
  "team_b_id",
  "match_date",     // allow updating date
  "team_a_score",   // allow updating score
  "team_b_score",   // allow updating score
  "matchday",       // planning helper, non-structural
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
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> } // Next 15: params is a Promise
) {
  try {
    ensureSameOrigin(req);

    const { id: idParam } = await ctx.params;
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

    // ❌ Hard-block any structural edits via this endpoint
    const attemptedStructural = Object.keys(body).some((k) => STRUCTURAL_FIELDS.has(k));
    if (attemptedStructural) {
      return jsonError(409, "Bracket wiring fields are immutable via PATCH; use generators/reseed.");
    }

    // Load current row incl. wiring anchors + stage kind
    const { data: current, error: curErr } = await supa
      .from("matches")
      .select("id, tournament_id, stage_id, round, bracket_pos, team_a_id, team_b_id, status, winner_team_id, team_a_score, team_b_score")
      .eq("id", id)
      .maybeSingle();

    if (curErr) {
      console.error("PATCH current fetch error", curErr);
      return jsonError(400, "Failed to load the match.", curErr);
    }
    if (!current) return jsonError(404, "Not found");

    let stageKind: "knockout" | "groups" | "league" | null = null;
    if (current.stage_id) {
      const { data: stg } = await supa
        .from("tournament_stages")
        .select("kind")
        .eq("id", current.stage_id)
        .maybeSingle();
      stageKind = (stg?.kind as any) ?? null;
    }

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

    // Normalize planner helper
    if ("matchday" in update) {
      const n = parseNonNegativeInt(update.matchday);
      if (n == null && update.matchday != null && update.matchday !== "") {
        return jsonError(400, "Invalid matchday");
      }
      if (n == null) delete update.matchday;
      else update.matchday = n;
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

    // 🚫 No revert finished → scheduled
    if (current.status === "finished" && finalStatus === "scheduled") {
      return jsonError(409, "Cannot revert a finished match back to 'scheduled'.");
    }

    // Compute effective scores + winner
    const effAS = "team_a_score" in update ? update.team_a_score : current.team_a_score;
    const effBS = "team_b_score" in update ? update.team_b_score : current.team_b_score;
    const effWinner = "winner_team_id" in update ? update.winner_team_id : current.winner_team_id;

    // Winner rules per stage kind
    if (finalStatus === "finished") {
      if (effAS == null || effBS == null) {
        return jsonError(400, "team_a_score and team_b_score are required when status is 'finished'");
      }

      if (stageKind === "knockout") {
        if (effAS === effBS) {
          return jsonError(400, "Knockout matches cannot finish level; set a winner (pens).");
        }
        const expected = effAS > effBS ? teamA : teamB;
        if (!effWinner) update.winner_team_id = expected;
        else if (![teamA, teamB].includes(effWinner) || effWinner !== expected) {
          return jsonError(400, "winner_team_id must match the scores for KO.");
        }
      } else {
        // groups/league: allow draw with NULL winner; if unequal, enforce consistency
        if (effAS === effBS) {
          update.winner_team_id = null;
        } else {
          const expected = effAS > effBS ? teamA : teamB;
          if (!effWinner) update.winner_team_id = expected;
          else if (![teamA, teamB].includes(effWinner) || effWinner !== expected) {
            return jsonError(400, "winner_team_id must match the scores.");
          }
        }
      }
    } else {
      // scheduled: clear winner/scores
      if ("winner_team_id" in update && update.winner_team_id != null) {
        return jsonError(400, "winner_team_id must be empty while status is 'scheduled'");
      }
      if (!("winner_team_id" in update) && current.winner_team_id != null) {
        return jsonError(409, "Clear winner_team_id before setting status to 'scheduled'.");
      }
      delete update.winner_team_id;
      update.team_a_score = null;
      update.team_b_score = null;
    }

    // Determine risky changes (that affect downstream)
    const winnerChanged = "winner_team_id" in update && update.winner_team_id !== current.winner_team_id;
    const scoresChanged =
      ("team_a_score" in update && update.team_a_score !== current.team_a_score) ||
      ("team_b_score" in update && update.team_b_score !== current.team_b_score);
    const finishingNow = current.status !== "finished" && finalStatus === "finished";
    const riskyChange = winnerChanged || scoresChanged || finishingNow;

    const teamsChanged =
      ("team_a_id" in update && update.team_a_id !== current.team_a_id) ||
      ("team_b_id" in update && update.team_b_id !== current.team_b_id);

    // Scan children in same stage via FK and stable pointers (KO only)
    let hasChildFinished = false;
    let hasAnyChild = false;
    if (current.stage_id && stageKind === "knockout" && (riskyChange || teamsChanged)) {
      const { data: allInStage } = await supa
        .from("matches")
        .select("id,status,home_source_match_id,away_source_match_id,home_source_round,home_source_bracket_pos,away_source_round,away_source_bracket_pos,round,bracket_pos")
        .eq("stage_id", current.stage_id);

      const hasParentPos = current.round != null && current.bracket_pos != null;

      const children = (allInStage ?? []).filter((child: any) => {
        if (child.id === id) return false; // exclude self

        const byId =
          child.home_source_match_id === id || child.away_source_match_id === id;

        let byStable = false;
        if (hasParentPos && child.round != null && current.round != null && child.round > current.round) {
          if (child.home_source_round != null && child.home_source_bracket_pos != null) {
            byStable =
              child.home_source_round === current.round &&
              child.home_source_bracket_pos === current.bracket_pos;
          }
          if (!byStable && child.away_source_round != null && child.away_source_bracket_pos != null) {
            byStable =
              child.away_source_round === current.round &&
              child.away_source_bracket_pos === current.bracket_pos;
          }
        }

        return byId || byStable;
      });

      hasAnyChild = children.length > 0;
      hasChildFinished = children.some((c: any) => c.status === "finished");

      if (riskyChange && hasChildFinished) {
        const blockers = children
          .filter((c: any) => c.status === "finished")
          .map((c: any) => ({ id: c.id, round: c.round, bracket_pos: c.bracket_pos }));
        return NextResponse.json(
          { error: "Downstream match is already finished; cannot change this result. Use wipe & reseed.", blockers },
          { status: 409 }
        );
      }
    }

    if (teamsChanged && stageKind === "knockout" && (current.status === "finished" || hasAnyChild)) {
      return jsonError(409, "Cannot change teams of a finished/wired match.");
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
   ====================================== */
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    ensureSameOrigin(req);

    const { id: idParam } = await ctx.params;
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

    // Load current match with stage + wiring anchors
    const { data: current, error: curErr } = await supa
      .from("matches")
      .select("id, tournament_id, stage_id, round, bracket_pos")
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

    // Extra safety: block if any matches depend on it (KO sources by FK)
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

    // Only check stable-pointer children for KO stages
    let hasStableChild = false;
    if (current.stage_id && current.round != null && current.bracket_pos != null) {
      // Find kind
      const { data: stg } = await supa
        .from("tournament_stages")
        .select("kind")
        .eq("id", current.stage_id)
        .maybeSingle();
      const stageKind = (stg?.kind as any) ?? null;

      if (stageKind === "knockout") {
        const { data: stageMatches, error: stErr } = await supa
          .from("matches")
          .select("id,round,home_source_round,home_source_bracket_pos,away_source_round,away_source_bracket_pos")
          .eq("stage_id", current.stage_id);

        if (stErr) {
          console.error("DELETE stable-pointer dependency check failed", stErr);
          return jsonError(400, "Failed to check match dependencies.", stErr);
        }

        hasStableChild = (stageMatches ?? []).some((m: any) => {
          if (m.id === id) return false;
          const laterRound =
            m.round != null && current.round != null && m.round > current.round;
          if (!laterRound) return false;

          const homeHit =
            m.home_source_round != null &&
            m.home_source_bracket_pos != null &&
            m.home_source_round === current.round &&
            m.home_source_bracket_pos === current.bracket_pos;

          const awayHit =
            m.away_source_round != null &&
            m.away_source_bracket_pos != null &&
            m.away_source_round === current.round &&
            m.away_source_bracket_pos === current.bracket_pos;

          return homeHit || awayHit;
        });
      }
    }

    if ((depHome?.length ?? 0) > 0 || (depAway?.length ?? 0) > 0 || hasStableChild) {
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
