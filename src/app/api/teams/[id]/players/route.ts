// src/app/api/teams/[id]/players/route.ts
import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/app/lib/supabase/supabaseServer";
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import { normalizeTeamPlayers, type TeamPlayersRowRaw } from "@/app/lib/types";

type Ctx = { params: Promise<{ id: string }> };

function ensureSameOrigin(req: Request) {
  const m = req.method.toUpperCase();
  if (m === "GET" || m === "HEAD" || m === "OPTIONS") return;
  const wl = new Set((process.env.ALLOWED_ORIGINS ?? "").split(",").map(s => s.trim()).filter(Boolean));
  try { wl.add(new URL(req.url).origin); } catch {}
  const ok = [req.headers.get("origin"), req.headers.get("referer")].some(v => {
    try { return !!v && wl.has(new URL(v).origin); } catch { return false; }
  });
  if (!ok) throw new Error("bad-origin");
}

const parseId = (v: unknown) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

// ────────────────────────────
// Debug helpers
// ────────────────────────────
const now = () => Date.now();

function isDebug(req: Request) {
  const u = new URL(req.url);
  const q = u.searchParams.get("debug");
  const h = req.headers.get("x-debug");
  return q === "1" || h === "1";
}
function sampleRow<T>(rows: T[] | null | undefined): any {
  if (!rows || rows.length === 0) return null;
  const r: any = rows[0];
  if (r?.player?.player_statistics?.length) {
    r.player = {
      ...r.player,
      player_statistics: [r.player.player_statistics[0]],
    };
  }
  return r;
}
function addDebugHeaders(headers: Headers, obj: Record<string, any>) {
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    const val = typeof v === "object" ? JSON.stringify(v) : String(v);
    if (val.length < 200) headers.set(`X-Debug-${k}`, val);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { Allow: "GET,POST,OPTIONS,HEAD" } });
}
export async function HEAD() {
  return new NextResponse(null, { status: 200, headers: { Allow: "GET,POST,OPTIONS,HEAD" } });
}

/** GET /api/teams/:id/players — read with service role (latest 1 stats row per player) */
export async function GET(req: Request, ctx: Ctx) {
  const requestId = (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
  const t0 = Date.now();
  const headers = new Headers({ "X-Request-Id": requestId });

  const dbg = (() => {
    const u = new URL(req.url);
    return u.searchParams.get("debug") === "1" || req.headers.get("x-debug") === "1";
  })();

  const { id: idParam } = await ctx.params; // Next 15: params is a Promise
  const teamId = parseId(idParam);
  if (!teamId) return NextResponse.json({ error: "Invalid team id" }, { status: 400, headers });

  // cookie-session admin gate
  const supa = await createSupabaseRouteClient();
  const { data: { user } } = await supa.auth.getUser();
  const roles = (user?.app_metadata?.roles ?? []) as string[];
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  if (!roles.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers });

  // ── Probe that the team actually exists (support "team" or "teams" table) ─────────
  async function probeTeamExistence(id: number) {
    const candidates = [process.env.TEAM_TABLE || "team", "teams"];
    for (const table of candidates) {
      try {
        const { data, error } = await supabaseAdmin
          .from(table)
          .select("id")
          .eq("id", id)
          .limit(1);
        if (error) {
          if ((error as any).code === "42P01") continue; // unknown table
          return { table, exists: false, error: error.message };
        }
        return { table, exists: (data?.length ?? 0) > 0, error: null };
      } catch (e: any) {
        return { table, exists: false, error: e?.message ?? String(e) };
      }
    }
    return { table: null, exists: false, error: "No team table found (tried 'team' and 'teams'). Set TEAM_TABLE env var." };
  }

  const teamProbe = await probeTeamExistence(teamId);
  if (!teamProbe.exists) {
    const respBody: Record<string, any> = {
      error: "Team not found",
      requestId,
    };
    if (dbg) {
      respBody.debug = {
        teamId,
        teamTableTried: teamProbe.table,
        teamProbeError: teamProbe.error,
        hint: "Use an existing team_id in the URL or create the team first.",
      };
    }
    return NextResponse.json(respBody, { status: 404, headers });
  }

  const t1 = Date.now();
  const { data, error, status, statusText, count } = await supabaseAdmin
    .from("player_teams")
    .select(`
      id,
      player:player_id(
        id, first_name, last_name,
        player_statistics(
          id,
          age,
          total_goals,
          total_assists,
          yellow_cards,
          red_cards,
          blue_cards,
          created_at,
          updated_at
        )
      )
    `, { count: "estimated" })
    .eq("team_id", teamId)
    .order("id", { ascending: true })
    .order("id", { foreignTable: "player.player_statistics", ascending: false })
    .limit(1, { foreignTable: "player.player_statistics" });

  const t2 = Date.now();

  if (error) {
    if (dbg) {
      console.error(`[GET /api/teams/${teamId}/players] requestId=${requestId} DB error`, {
        status, statusText, error: error.message
      });
    }
    return NextResponse.json({ error: error.message, requestId }, { status: 400, headers });
  }

  const playerAssociations = normalizeTeamPlayers((data ?? []) as TeamPlayersRowRaw[]);

  const hasStats = playerAssociations.some(a => (a.player.player_statistics?.length ?? 0) > 0);
  headers.set("X-Debug-TeamId", String(teamId));
  headers.set("X-Debug-AssocCount", String(playerAssociations.length));
  headers.set("X-Debug-HasStats", String(hasStats));
  headers.set("X-Debug-DBStatus", String(status));
  headers.set("X-Debug-DBCount", String(count ?? ""));
  headers.set("X-Debug-T_Auth_ms", String(t1 - t0));
  headers.set("X-Debug-T_DB_ms", String(t2 - t1));
  headers.set("X-Debug-T_Total_ms", String(Date.now() - t0));

  let diag: any = undefined;
  if (dbg && playerAssociations.length === 0) {
    const { data: assocSample, error: assocErr } = await supabaseAdmin
      .from("player_teams")
      .select("id, team_id, player_id")
      .eq("team_id", teamId)
      .order("id", { ascending: true })
      .limit(5);

    const { data: statsSample, error: statsErr } = await supabaseAdmin
      .from("player_statistics")
      .select("id, player_id, age, total_goals, total_assists, updated_at")
      .order("updated_at", { ascending: false })
      .limit(3);

    let joinProbe: any = null; let joinProbeErr: string | null = null;
    if (assocSample && assocSample.length > 0) {
      const { data: jp, error: jpe } = await supabaseAdmin
        .from("player_teams")
        .select(`
          id,
          player:player_id(
            id, first_name, last_name,
            player_statistics(
              id, age, total_goals, total_assists, yellow_cards, red_cards, blue_cards, created_at, updated_at
            )
          )
        `)
        .eq("id", assocSample[0].id)
        .order("id", { foreignTable: "player.player_statistics", ascending: false })
        .limit(1, { foreignTable: "player.player_statistics" })
        .single();
      joinProbe = jp ?? null;
      joinProbeErr = jpe?.message ?? null;
    }

    const hint =
      !assocSample?.length
        ? "No rows in player_teams for this team_id, so there is nothing to join stats onto. Link players to the team (via POST) or use a valid team_id."
        : (!joinProbe
            ? "Associations exist, but nested join returned nothing. Check FK: player_teams.player_id -> player.id and the alias syntax 'player:player_id(...)'."
            : "Join for at least one row looks OK. If the UI is still empty, inspect normalizeTeamPlayers or client filters.");

    diag = {
      teamId,
      teamTable: teamProbe.table,
      dbStatus: { status, statusText, count },
      assocSample: assocSample ?? null,
      assocErr: assocErr?.message ?? null,
      statsSample: statsSample ?? null,
      statsErr: statsErr?.message ?? null,
      joinProbe,
      joinProbeErr,
      hint,
    };

    console.info(`[GET /api/teams/${teamId}/players] requestId=${requestId} zero-assoc diagnostics`, diag);
  }

  const respBody: Record<string, any> = { playerAssociations };
  if (dbg) {
    const sample = (rows: any[] | null | undefined) => {
      if (!rows || rows.length === 0) return null;
      const r: any = rows[0];
      if (r?.player?.player_statistics?.length) {
        r.player = { ...r.player, player_statistics: [r.player.player_statistics[0]] };
      }
      return r;
    };
    respBody.debug = {
      requestId,
      resultCount: data?.length ?? 0,
      sampleRawRow: sample(data as any),
      sampleNormalizedRow: playerAssociations[0] ?? null,
      diag
    };
  }

  return NextResponse.json(respBody, { status: 200, headers });
}

/** POST /api/teams/:id/players — link existing (or create+link), then re-read via service role */
export async function POST(req: Request, ctx: Ctx) {
  const requestId = (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
  const t0 = now();
  const headers = new Headers({ "X-Request-Id": requestId });

  try {
    ensureSameOrigin(req);
    const dbg = isDebug(req);

    const supa = await createSupabaseRouteClient();
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
    const roles = Array.isArray(user.app_metadata?.roles) ? user.app_metadata.roles : [];
    if (!roles.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers });

    const { id: idParam } = await ctx.params; // Next 15: params is a Promise
    const teamId = parseId(idParam);
    if (!teamId) return NextResponse.json({ error: "Invalid team id" }, { status: 400, headers });

    const reqBody = await req.json().catch(() => null);
    if (!reqBody || typeof reqBody !== "object") {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers });
    }

    if (dbg) {
      console.info(`[POST /api/teams/${teamId}/players] requestId=${requestId} incoming body`, reqBody);
    }

    // A) link an existing player
    let playerId = parseId((reqBody as any).player_id);

    // B) create new player (+ optional stats) then link
    if (!playerId) {
      const first = String((reqBody as any).first_name ?? "").trim();
      const last  = String((reqBody as any).last_name ?? "").trim();
      const age   = (reqBody as any).age == null || (reqBody as any).age === "" ? null : Number((reqBody as any).age);

      const toNum = (x: any, d = 0) => (x == null || x === "" ? d : Number(x));
      const total_goals   = toNum((reqBody as any).total_goals, 0);
      const total_assists = toNum((reqBody as any).total_assists, 0);
      const yellow_cards  = toNum((reqBody as any).yellow_cards, 0);
      const red_cards     = toNum((reqBody as any).red_cards, 0);
      const blue_cards    = toNum((reqBody as any).blue_cards, 0);

      if (!first || !last) return NextResponse.json({ error: "First/last name required" }, { status: 400, headers });
      if (age !== null && (Number.isNaN(age) || age < 0 || age > 120)) {
        return NextResponse.json({ error: "Invalid age" }, { status: 400, headers });
      }
      if ([total_goals, total_assists, yellow_cards, red_cards, blue_cards].some(n => Number.isNaN(n) || n < 0)) {
        return NextResponse.json({ error: "Invalid stats" }, { status: 400, headers });
      }

      // ---- CHANGED: use service role to avoid RLS; set safe photo placeholder if NOT NULL without default
      const tCreatePlayer0 = now();
      const { data: pRow, error: pErr, status: pStatus } = await supabaseAdmin
        .from("player")
        .insert({ first_name: first, last_name: last, photo: "/player-placeholder.jpg" })
        .select("id")
        .single();
      const tCreatePlayer1 = now();
      if (pErr || !pRow) {
        if (dbg) console.error(`[POST] requestId=${requestId} create player failed`, { pStatus, error: pErr?.message });
        return NextResponse.json({ error: pErr?.message || "Create player failed", requestId }, { status: 400, headers });
      }

      playerId = pRow.id as number;

      const tCreateStats0 = now();
      const { error: sErr, status: sStatus } = await supabaseAdmin
        .from("player_statistics")
        .insert({ player_id: playerId, age, total_goals, total_assists, yellow_cards, red_cards, blue_cards });
      const tCreateStats1 = now();
      if (sErr) {
        await supabaseAdmin.from("player").delete().eq("id", playerId).limit(1);
        if (dbg) console.error(`[POST] requestId=${requestId} create stats failed`, { sStatus, error: sErr.message });
        return NextResponse.json({ error: sErr.message || "Create stats failed", requestId }, { status: 400, headers });
      }

      if (dbg) {
        console.info(`[POST] requestId=${requestId} created player + stats`, {
          playerId,
          timings: {
            createPlayer_ms: tCreatePlayer1 - tCreatePlayer0,
            createStats_ms: tCreateStats1 - tCreateStats0,
          },
        });
      }
    }

    // ---- CHANGED: link with service role (preserves 23505 → 409 behavior)
    const tLink0 = now();
    const { data: assocRow, error: aErr, status: aStatus } = await supabaseAdmin
      .from("player_teams")
      .insert({ team_id: teamId, player_id: playerId! })
      .select("id")
      .single();
    const tLink1 = now();

    if (aErr) {
      if ((aErr as any)?.code === "23505") {
        if (dbg) console.warn(`[POST] requestId=${requestId} duplicate link`, { teamId, playerId });
        return NextResponse.json({ error: "Player already linked to this team", requestId, player_id: playerId }, { status: 409, headers });
      }
      if (dbg) console.error(`[POST] requestId=${requestId} link failed`, { aStatus, error: aErr.message });
      return NextResponse.json({ error: aErr.message, requestId }, { status: 400, headers });
    }

    const tFetch0 = now();
    const { data: association, error: refErr, status: refStatus } = await supabaseAdmin
      .from("player_teams")
      .select(`
        id,
        player:player_id(
          id, first_name, last_name,
          player_statistics(
            id,
            age,
            total_goals,
            total_assists,
            yellow_cards,
            red_cards,
            blue_cards,
            created_at,
            updated_at
          )
        )
      `)
      .eq("id", assocRow.id)
      .order("id", { foreignTable: "player.player_statistics", ascending: false })
      .limit(1, { foreignTable: "player.player_statistics" })
      .single();
    const tFetch1 = now();

    if (refErr || !association) {
      if (dbg) console.error(`[POST] requestId=${requestId} fetch failed`, { refStatus, error: refErr?.message });
      return NextResponse.json({ error: refErr?.message || "Fetch failed", requestId }, { status: 400, headers });
    }

    const [normalized] = normalizeTeamPlayers([association as TeamPlayersRowRaw]);

    addDebugHeaders(headers, {
      TeamId: teamId,
      PlayerId: playerId!,
      AssocId: assocRow.id,
      T_Link_ms: tLink1 - tLink0,
      T_Fetch_ms: tFetch1 - tFetch0,
      T_Total_ms: now() - t0,
    });

    if (dbg) {
      console.info(`[POST /api/teams/${teamId}/players] requestId=${requestId} done`, {
        assocId: assocRow.id,
        playerId,
        timings: {
          link_ms: tLink1 - tLink0,
          fetch_ms: tFetch1 - tFetch0,
          total_ms: now() - t0,
        },
        sampleRawRow: sampleRow([association] as any),
        sampleNormalizedRow: normalized,
      });
    }

    // ---- NOTE: preserve original shape, but ALSO include player_id for your modal
    const respBody: Record<string, any> = { association: normalized, requestId, player_id: playerId };
    if (dbg) {
      respBody.debug = {
        assocId: assocRow.id,
        playerId,
        sampleRawRow: sampleRow([association] as any),
        sampleNormalizedRow: normalized,
      };
    }

    return NextResponse.json(respBody, { status: 201, headers });
  } catch (e: any) {
    if (String(e?.message) === "bad-origin") return NextResponse.json({ error: "Forbidden" }, { status: 403, headers });
    console.error(`[POST] requestId=${requestId} server error`, e);
    return NextResponse.json({ error: "Server error", requestId }, { status: 500, headers });
  }
}
