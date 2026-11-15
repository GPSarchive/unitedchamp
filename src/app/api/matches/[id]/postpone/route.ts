// app/api/matches/[id]/postpone/route.ts
import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/app/lib/supabase/supabaseServer";
import { canEditContent } from "@/app/lib/supabase/apiAuth";
import { nowWallClockIso } from "@/app/lib/datetime";
import {
  buildPostponeAnnouncement,
  planPostpone,
  postponeAnnouncementTitles,
} from "@/app/lib/postpone";
import { revalidateMatchSurfaces } from "@/app/lib/revalidatePublicPages";
import { refreshActiveSeasonStandings } from "@/app/lib/refreshStandings";

/* =======================
   Same-origin guard
   ======================= */
const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);

function ensureSameOrigin(req: Request) {
  const m = req.method.toUpperCase();
  if (m === "GET" || m === "HEAD" || m === "OPTIONS") return;

  // Do NOT add req.url origin to the whitelist — the Host header can be spoofed,
  // which would let an attacker self-whitelist their own origin.
  if (allowedOrigins.size === 0) {
    console.error("[postpone] bad-origin: ALLOWED_ORIGINS env is empty/unset");
    throw new Error("bad-origin");
  }
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const ok = [origin, referer].some((val) => {
    try {
      return !!val && allowedOrigins.has(new URL(val).origin);
    } catch {
      return false;
    }
  });
  if (!ok) {
    console.error("[postpone] bad-origin", {
      origin,
      referer,
      allowed: Array.from(allowedOrigins),
    });
    throw new Error("bad-origin");
  }
}

/* ==============
   Helper utils
   ============== */
function parsePositiveInt(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
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

function jsonError(status: number, msg: string, err?: any) {
  const full = detailedMsg(msg, err);
  return NextResponse.json({ error: full, ...devDiag(err) }, { status });
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
   POST /api/matches/:id/postpone (admin)

   Scheduled match → postpones it (new date and reason optional; with a
   new date the match stays "scheduled" on that date, without one it is
   "postponed" with no date).
   Postponed match → sets its new date (required) and puts it back to
   "scheduled". Rules in lib/postpone. Either way an announcement is
   published and the fixture's earlier postponement notices are retired.

   Request body:
   {
     new_match_date: string (ISO 8601, optional),
     postponement_reason: string (optional)
   }
   ====================================== */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    ensureSameOrigin(req);

    const { id: idParam } = await ctx.params;
    const id = parsePositiveInt(idParam);
    if (!id) return jsonError(400, "Invalid match id");

    const supa = await createSupabaseRouteClient();

    // Auth + admin role
    const {
      data: { user },
      error: userErr,
    } = await supa.auth.getUser();
    if (userErr || !user) return jsonError(401, "Unauthorized", userErr);
    if (!canEditContent(user)) return jsonError(403, "Forbidden - admin or editor role required");

    // Parse request body
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return jsonError(400, "Invalid JSON");

    const { new_match_date, postponement_reason: rawReason } = body;

    // Sanitize postponement_reason: strip markdown/HTML injection characters
    const postponement_reason =
      typeof rawReason === "string"
        ? rawReason.replace(/[<>[\](){}*_~`#|!\\]/g, "").trim().slice(0, 500) || null
        : null;

    // Parse new_match_date if provided
    let newDateISO: string | null = null;
    if (new_match_date) {
      newDateISO = parseNullableISODate(new_match_date);
      if (!newDateISO) {
        return jsonError(400, "Invalid new_match_date format (must be ISO 8601)");
      }
    }

    // Load current match with team details for announcement
    const { data: current, error: curErr } = await supa
      .from("matches")
      .select(`
        id,
        match_date,
        status,
        team_a_id,
        team_b_id,
        tournament_id,
        postponement_reason,
        original_match_date,
        teamA:teams!matches_team_a_id_fkey(id, name, logo),
        teamB:teams!matches_team_b_id_fkey(id, name, logo)
      `)
      .eq("id", id)
      .maybeSingle();

    if (curErr) {
      console.error("Postpone: failed to load match", curErr);
      return jsonError(400, "Failed to load the match", curErr);
    }
    if (!current) return jsonError(404, "Match not found");

    // Postpone a scheduled match, or give a postponed match its new date
    // (which puts it back on the schedule) — rules in lib/postpone.
    const now = new Date();
    const plan = planPostpone({
      current,
      newDateISO,
      reason: postponement_reason,
      userId: user.id,
      nowInstant: now.toISOString(),
      nowWall: nowWallClockIso(),
    });
    if (!plan.ok) return jsonError(plan.status, plan.error);

    // Extract team names for announcement
    const teamA = Array.isArray(current.teamA) ? current.teamA[0] : current.teamA;
    const teamB = Array.isArray(current.teamB) ? current.teamB[0] : current.teamB;
    const teamAName = teamA?.name ?? `Team #${current.team_a_id}`;
    const teamBName = teamB?.name ?? `Team #${current.team_b_id}`;

    // Update the match
    const { data: updatedMatch, error: updateErr } = await supa
      .from("matches")
      .update(plan.update)
      .eq("id", id)
      .select("id, match_date, status, postponement_reason, original_match_date, postponed_at")
      .maybeSingle();

    if (updateErr) {
      console.error("Postpone: failed to update match", updateErr);
      return jsonError(500, "Failed to postpone match", updateErr);
    }
    if (!updatedMatch) return jsonError(404, "Match not found after update");

    // One live notice per fixture: the new one supersedes any earlier
    // postponement / new-date notice still showing (e.g. "date TBD").
    // Announcements carry no match id, so the fixture is matched by title.
    const titles = postponeAnnouncementTitles(teamAName, teamBName);
    const { error: staleErr } = await supa
      .from("announcements")
      .update({ end_at: now.toISOString() })
      .in("title", [titles.postpone, titles.reschedule])
      .eq("status", "published")
      .gt("end_at", now.toISOString());
    if (staleErr) console.error("Postpone: failed to retire earlier announcements", staleErr);

    const announcementText = buildPostponeAnnouncement({
      mode: plan.mode,
      teamAName,
      teamBName,
      previousDate: plan.previousDate,
      newDateISO,
      reason: postponement_reason,
      now,
    });

    // Create the announcement
    const { data: announcement, error: announcementErr } = await supa
      .from("announcements")
      .insert({
        title: announcementText.title,
        body: announcementText.body,
        status: "published",
        format: "md",
        pinned: true,
        priority: 1, // High priority
        start_at: now.toISOString(),
        end_at: announcementText.end_at,
      })
      .select("id, title")
      .maybeSingle();

    if (announcementErr) {
      // Don't fail the postponement if announcement creation fails, just log it
      console.error("Postpone: failed to create announcement", announcementErr);
    }

    const message =
      plan.mode === "reschedule"
        ? "Match rescheduled"
        : newDateISO
        ? "Match postponed to a new date"
        : "Match postponed (new date TBD)";

    // Date/status changed → rewrite the stored Γενική Κατάταξη rows (same
    // contract as every other match mutation, even though a postponed match
    // carries no points yet), then refresh the ISR-cached public pages.
    await refreshActiveSeasonStandings("POST /api/matches/[id]/postpone");
    revalidateMatchSurfaces({
      id,
      tournament_id: current.tournament_id,
      team_a_id: current.team_a_id,
      team_b_id: current.team_b_id,
    });

    return NextResponse.json({
      ok: true,
      match: updatedMatch,
      announcement: announcement ?? null,
      message,
    });
  } catch (e: any) {
    const msg = String(e?.message ?? "");
    if (msg === "bad-origin") return jsonError(403, "Forbidden");
    console.error("POST /matches/:id/postpone failed", e);
    return jsonError(500, "Server error", e);
  }
}
