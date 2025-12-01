// app/api/matches/[id]/postpone/route.ts
import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/app/lib/supabase/supabaseServer";

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

   Postpones a scheduled match to a new date and creates an announcement.

   Request body:
   {
     new_match_date: string (ISO 8601),
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
    const roles = Array.isArray(user.app_metadata?.roles) ? user.app_metadata.roles : [];
    if (!roles.includes("admin")) return jsonError(403, "Forbidden - admin role required");

    // Parse request body
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return jsonError(400, "Invalid JSON");

    const { new_match_date, postponement_reason } = body;

    // Validate new_match_date is provided and valid
    if (!new_match_date) {
      return jsonError(400, "new_match_date is required");
    }

    const newDateISO = parseNullableISODate(new_match_date);
    if (!newDateISO) {
      return jsonError(400, "Invalid new_match_date format (must be ISO 8601)");
    }

    // Validate new date is in the future
    const newDate = new Date(newDateISO);
    const now = new Date();
    if (newDate <= now) {
      return jsonError(400, "New match date must be in the future");
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

    // Only allow postponing scheduled or already postponed matches
    if (current.status !== "scheduled" && current.status !== "postponed") {
      return jsonError(409, `Cannot postpone a ${current.status} match. Only scheduled matches can be postponed.`);
    }

    if (!current.match_date) {
      return jsonError(400, "Cannot postpone a match without a date set");
    }

    // Extract team names for announcement
    const teamA = Array.isArray(current.teamA) ? current.teamA[0] : current.teamA;
    const teamB = Array.isArray(current.teamB) ? current.teamB[0] : current.teamB;
    const teamAName = teamA?.name ?? `Team #${current.team_a_id}`;
    const teamBName = teamB?.name ?? `Team #${current.team_b_id}`;

    // Format dates for announcement (Greek format)
    const formatGreekDate = (isoDate: string) => {
      const d = new Date(isoDate);
      return d.toLocaleString("el-GR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
      });
    };

    const oldDateFormatted = formatGreekDate(current.match_date);
    const newDateFormatted = formatGreekDate(newDateISO);

    // Store original date only if this is the first postponement
    const originalDate = current.original_match_date ?? current.match_date;

    // Prepare postponement update
    const postponementUpdate = {
      status: "postponed" as const,
      match_date: newDateISO,
      original_match_date: originalDate,
      postponement_reason: postponement_reason || null,
      postponed_at: new Date().toISOString(),
      postponed_by: user.id,
    };

    // Update the match
    const { data: updatedMatch, error: updateErr } = await supa
      .from("matches")
      .update(postponementUpdate)
      .eq("id", id)
      .select("id, match_date, status, postponement_reason, original_match_date, postponed_at")
      .maybeSingle();

    if (updateErr) {
      console.error("Postpone: failed to update match", updateErr);
      return jsonError(500, "Failed to postpone match", updateErr);
    }
    if (!updatedMatch) return jsonError(404, "Match not found after update");

    // Create announcement for users
    const announcementTitle = `Αναβολή Αγώνα: ${teamAName} - ${teamBName}`;

    let announcementBody = `Ο αγώνας **${teamAName}** vs **${teamBName}** που ήταν προγραμματισμένος για **${oldDateFormatted}** αναβλήθηκε.\n\n`;
    announcementBody += `📅 **Νέα ημερομηνία**: ${newDateFormatted}\n\n`;

    if (postponement_reason) {
      announcementBody += `ℹ️ **Λόγος**: ${postponement_reason}\n\n`;
    }

    announcementBody += `Σας ευχαριστούμε για την κατανόησή σας.`;

    // Calculate announcement end date (show until 1 day after new match date)
    const endDate = new Date(newDate);
    endDate.setDate(endDate.getDate() + 1);

    const announcementPayload = {
      title: announcementTitle,
      body: announcementBody,
      status: "published",
      format: "md",
      pinned: true,
      priority: 1, // High priority
      start_at: new Date().toISOString(),
      end_at: endDate.toISOString(),
    };

    // Create the announcement
    const { data: announcement, error: announcementErr } = await supa
      .from("announcements")
      .insert(announcementPayload)
      .select("id, title")
      .maybeSingle();

    if (announcementErr) {
      // Don't fail the postponement if announcement creation fails, just log it
      console.error("Postpone: failed to create announcement", announcementErr);
    }

    return NextResponse.json({
      ok: true,
      match: updatedMatch,
      announcement: announcement ?? null,
      message: `Match postponed successfully from ${oldDateFormatted} to ${newDateFormatted}`,
    });
  } catch (e: any) {
    const msg = String(e?.message ?? "");
    if (msg === "bad-origin") return jsonError(403, "Forbidden");
    console.error("POST /matches/:id/postpone failed", e);
    return jsonError(500, "Server error", e);
  }
}
