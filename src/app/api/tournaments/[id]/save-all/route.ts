import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import { createSupabaseRouteClient } from "@/app/lib/supabase/supabaseServer";

/** This route must be dynamic; the editor needs fresh writes/reads */
export const dynamic = "force-dynamic";

/* ------------ Shared (request/response) shapes ------------ */

type PatchTournament = Partial<{
  name: string;
  slug: string;
  logo: string | null;
  season: string | null;
  status: "scheduled" | "running" | "completed" | "archived";
  format: "league" | "groups" | "knockout" | "mixed";
  start_date: string | null;
  end_date: string | null;
  winner_team_id: number | null;
}>;

type StageRow = {
  id?: number | null;
  tournament_id: number;
  name: string;
  kind: "league" | "groups" | "knockout";
  ordering: number;
  config?: any | null;
};

type GroupRow = {
  id?: number | null;
  stage_id: number;
  name: string;
  ordering?: number | null;
};

type TournamentTeamRow = {
  id?: number | null;
  tournament_id: number;
  team_id: number;
  stage_id?: number | null;
  group_id?: number | null;
  seed?: number | null;
};

type StageSlotRow = {
  stage_id: number;
  group_id: number; // index-based
  slot_id: number;  // 1-based
  team_id?: number | null;
  source?: "manual" | "intake";
  updated_at?: string; // optimistic lock token
};

type IntakeMappingRow = {
  id?: number | null;
  target_stage_id: number;
  group_idx: number;
  slot_idx: number;
  from_stage_id: number;
  round: number;
  bracket_pos: number;
  outcome: "W" | "L";
};

type MatchRow = {
  id?: number | null;
  stage_id: number;
  group_id?: number | null;
  team_a_id?: number | null;
  team_b_id?: number | null;
  team_a_score?: number | null;
  team_b_score?: number | null;
  winner_team_id?: number | null;
  status?: "scheduled" | "finished";
  match_date?: string | null;
  matchday?: number | null;
  round?: number | null;
  bracket_pos?: number | null;
  home_source_round?: number | null;
  home_source_bracket_pos?: number | null;
  away_source_round?: number | null;
  away_source_bracket_pos?: number | null;
  updated_at?: string | null; // optimistic lock token
  is_ko?: boolean; // Add this line to include 'is_ko' property
  // two-legged KO
  leg?: number | null;
  tie_leg1_match_id?: number | null;
  penalty_a?: number | null;
  penalty_b?: number | null;
};


type SaveAllRequest = {
  tournament?: { patch: PatchTournament };
  stages?: { upsert?: StageRow[]; deleteIds?: number[] };
  groups?: { upsert?: GroupRow[]; deleteIds?: number[] };
  tournamentTeams?: { upsert?: TournamentTeamRow[]; deleteIds?: number[] };
  stageSlots?: { upsert?: StageSlotRow[] };
  intakeMappings?: { replace?: IntakeMappingRow[]; targetStageIds?: number[] };
  matches?: { upsert?: MatchRow[]; deleteIds?: number[] };
  force?: {
    matches?: boolean;
    stageSlots?: boolean;
  };
};

type SaveAllResponse = {
  ok: true;
  tournament?: any | null;
  stages?: StageRow[];
  deletedStageIds?: number[];
  groups?: GroupRow[];
  deletedGroupIds?: number[];
  tournamentTeams?: TournamentTeamRow[];
  stageSlots?: StageSlotRow[];
  intakeMappings?: IntakeMappingRow[];
  matches?: MatchRow[];
};

type Params = { id: string };

/* ------------ Helpers ------------ */

function matchNaturalKey(r: {
  stage_id: number;
  group_id?: number | null;
  matchday?: number | null;
  round?: number | null;
  bracket_pos?: number | null;
}) {
  const isKO = r.round != null && r.bracket_pos != null;
  if (isKO) return `KO|${r.stage_id}|${r.round}|${r.bracket_pos}`;
  return `LG|${r.stage_id}|${r.group_id ?? -1}|${r.matchday ?? -1}|${r.bracket_pos ?? -1}`;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<Params> }
) {
  const rid = req.headers.get("x-debug-id") ?? "no-id";
  const phase = req.headers.get("x-debug-phase") ?? "n/a";
  const { id } = await params;

  // Authentication check
  const supa = await createSupabaseRouteClient();
  const {
    data: { user },
    error: userErr,
  } = await supa.auth.getUser();

  if (userErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check for admin role
  const roles = Array.isArray(user.app_metadata?.roles) ? user.app_metadata.roles : [];
  if (!roles.includes("admin")) {
    return NextResponse.json({ error: "Forbidden - admin role required" }, { status: 403 });
  }

  let body: SaveAllRequest;
  try {
    body = (await req.json()) as SaveAllRequest;
    console.log("[save-all][in] body:", JSON.stringify(body, null, 2));
  } catch {
    console.error("[save-all][in]", rid, "bad JSON");
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  console.log('[save-all-debug] Received body:', JSON.stringify(body, null, 2));
  const tournamentId = Number(id);
  if (!Number.isFinite(tournamentId)) {
    return NextResponse.json({ error: "Invalid tournament id" }, { status: 400 });
  }

  const forceMatches = !!body.force?.matches;
  const forceSlots = !!body.force?.stageSlots;

  const out: SaveAllResponse = { ok: true };

  try {
    /* 1) Tournament basics (PATCH) ---------------------------------------- */
    if (body.tournament?.patch) {
      const { patch } = body.tournament;
      const { data: tData, error: tErr } = await supabaseAdmin
        .from("tournaments")
        .update(patch)
        .eq("id", tournamentId)
        .select()
        .single();
      if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });
      out.tournament = tData;
    }

    /* 2) Groups — deletions first ----------------------------------------- */
    if (body.groups?.deleteIds?.length) {
      console.log("[save-all][delete-groups]", body.groups.deleteIds);
      const { error: grpDelErr } = await supabaseAdmin
        .from("tournament_groups")
        .delete()
        .in("id", body.groups.deleteIds);
      if (grpDelErr) return NextResponse.json({ error: grpDelErr.message }, { status: 500 });
      out.deletedGroupIds = body.groups.deleteIds;
    }

    /* 3) Stages — deletions next (after groups) --------------------------- */
    if (body.stages?.deleteIds?.length) {
      console.log("[save-all][delete-stages]", body.stages.deleteIds);
      const { error: stgDelErr } = await supabaseAdmin
        .from("tournament_stages")
        .delete()
        .in("id", body.stages.deleteIds);
      if (stgDelErr) return NextResponse.json({ error: stgDelErr.message }, { status: 500 });
      out.deletedStageIds = body.stages.deleteIds;
    }

   /* Matches deletions (before upserts) */
let matchDeleteStageIds: number[] = [];
if (body.matches?.deleteIds?.length) {
  const deleteIds = body.matches.deleteIds.filter((n) => typeof n === "number" && n > 0);
  if (!deleteIds.length) {
    return NextResponse.json({ error: "No valid match ids to delete" }, { status: 400 });
  }

  // optional: clear KO pointers first — use typed .in() to avoid string-templated filters
  await supabaseAdmin.from("matches").update({ home_source_match_id: null }).in("home_source_match_id", deleteIds);
  await supabaseAdmin.from("matches").update({ away_source_match_id: null }).in("away_source_match_id", deleteIds);

  // fetch stages for KO resolution
  const { data: delRows, error: delFetchErr } = await supabaseAdmin
    .from("matches").select("id,stage_id").in("id", deleteIds);
  if (delFetchErr) return NextResponse.json({ error: delFetchErr.message }, { status: 500 });
  matchDeleteStageIds = Array.from(new Set((delRows ?? []).map((r) => r.stage_id)));

  // delete and verify
  const { data: deleted, error: delErr } = await supabaseAdmin
    .from("matches").delete().in("id", deleteIds).select("id");
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  const deletedIds = new Set((deleted ?? []).map((r: any) => r.id));
  const missing = deleteIds.filter((id) => !deletedIds.has(id));
  if (missing.length) {
    return NextResponse.json(
      { error: "Some matches were not deleted", missing, tried: deleteIds },
      { status: 409 }
    );
  }
}


    /* 5) Stages upsert ----------------------------------------------------- */
    if (body.stages?.upsert?.length) {
      const createRows = body.stages.upsert
        .filter((r) => r.id == null)
        .map(({ id: _drop, ...r }) => ({ ...r, tournament_id: tournamentId }));
      const updateRows = body.stages.upsert.filter((r) => r.id != null);

      let upserted: any[] = [];

      if (createRows.length) {
        const { data, error } = await supabaseAdmin
          .from("tournament_stages")
          .insert(createRows)
          .select();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        upserted = upserted.concat(data ?? []);
      }

      if (updateRows.length) {
        const { data, error } = await supabaseAdmin
          .from("tournament_stages")
          .upsert(updateRows.map(r => ({ ...r, tournament_id: tournamentId })), )
          .select();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        upserted = upserted.concat(data ?? []);
      }

      out.stages = upserted;
    }

    /* 5b) Groups upsert --------------------------------------------------- */
    if (body.groups?.upsert?.length) {
      const createRows = body.groups.upsert
        .filter((r) => r.id == null)
        .map(({ id: _drop, ...r }) => r);
      const updateRows = body.groups.upsert.filter((r) => r.id != null);

      let upserted: any[] = [];

      if (createRows.length) {
        const { data, error } = await supabaseAdmin
          .from("tournament_groups")
          .insert(createRows)
          .select();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        upserted = upserted.concat(data ?? []);
      }

      if (updateRows.length) {
        const { data, error } = await supabaseAdmin
          .from("tournament_groups")
          .upsert(updateRows)
          .select();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        upserted = upserted.concat(data ?? []);
      }

      // Also return any groups that weren't touched but belong to tournament stages
      // so the client gets a complete picture
      const touchedStageIds = Array.from(
        new Set(body.groups.upsert.map((r) => r.stage_id))
      );
      if (touchedStageIds.length) {
        const { data: allGroups } = await supabaseAdmin
          .from("tournament_groups")
          .select()
          .in("stage_id", touchedStageIds);
        out.groups = allGroups ?? upserted;
      } else {
        out.groups = upserted;
      }
    }

    /* 6) Tournament teams: delete then upsert ----------------------------- */
    if (body.tournamentTeams?.deleteIds?.length) {
      const { error } = await supabaseAdmin
        .from("tournament_teams")
        .delete()
        .eq("tournament_id", tournamentId)
        .in("id", body.tournamentTeams.deleteIds);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (
      body.tournamentTeams?.upsert?.length ||
      body.tournamentTeams?.deleteIds?.length
    ) {
      const upsertRows = body.tournamentTeams?.upsert ?? [];
      const createRows = upsertRows
        .filter((r) => r.id == null)
        .map(({ id: _drop, ...r }) => ({ ...r, tournament_id: tournamentId }));
      const updateRows = upsertRows.filter((r) => r.id != null);

      if (createRows.length) {
        const { error } = await supabaseAdmin
          .from("tournament_teams")
          .insert(createRows)
          .select();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (updateRows.length) {
        const { error } = await supabaseAdmin
          .from("tournament_teams")
          .upsert(updateRows)
          .select();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Return the authoritative current set so the client can reconcile
      // after both inserts and deletions in a single round trip.
      const { data: allRows, error: listErr } = await supabaseAdmin
        .from("tournament_teams")
        .select("*")
        .eq("tournament_id", tournamentId);
      if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });
      out.tournamentTeams = allRows ?? [];
    }

    /* 7) Stage slots upsert (optimistic, with optional force) -------------- */
    if (body.stageSlots?.upsert?.length) {
      const rows = body.stageSlots.upsert;

      const guarded = forceSlots ? [] : rows.filter((r) => r.updated_at);
      const rest = forceSlots ? rows : rows.filter((r) => !r.updated_at);

      for (const r of guarded) {
        const { data, error } = await supabaseAdmin
          .from("stage_slots")
          .update({ team_id: r.team_id ?? null, source: r.source ?? "manual" })
          .eq("stage_id", r.stage_id)
          .eq("group_id", r.group_id)
          .eq("slot_id", r.slot_id)
          .eq("updated_at", r.updated_at)
          .select("*");

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        if (!data || data.length === 0) {
          const { data: cur } = await supabaseAdmin
            .from("stage_slots")
            .select("stage_id,group_id,slot_id,updated_at")
            .eq("stage_id", r.stage_id)
            .eq("group_id", r.group_id)
            .eq("slot_id", r.slot_id)
            .single();

          return NextResponse.json(
            {
              error: "Stage slot is stale. Please reload.",
              entity: "stage_slots",
              key: { stage_id: r.stage_id, group_id: r.group_id, slot_id: r.slot_id },
              sent_updated_at: r.updated_at,
              db_updated_at: cur?.updated_at ?? null,
            },
            { status: 409 }
          );
        }
      }

      if (rest.length) {
        const { error } = await supabaseAdmin
          .from("stage_slots")
          .upsert(rest, { onConflict: "stage_id,group_id,slot_id" });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const affectedStageIds = Array.from(new Set(rows.map((r) => r.stage_id)));
      const { data, error } = await supabaseAdmin
        .from("stage_slots")
        .select("*")
        .in("stage_id", affectedStageIds);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      out.stageSlots = data ?? [];
    }

    /* 8) Intake mappings replace (delete → insert) ------------------------- */
    if (body.intakeMappings?.replace) {
      const targetStageIds =
        body.intakeMappings.targetStageIds ??
        Array.from(new Set(body.intakeMappings.replace.map((r) => r.target_stage_id)));

      if (targetStageIds.length) {
        const { error } = await supabaseAdmin
          .from("intake_mappings")
          .delete()
          .in("target_stage_id", targetStageIds);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const createRows = (body.intakeMappings.replace ?? []).map(({ id: _drop, ...r }) => r);

      if (createRows.length) {
        const { data, error } = await supabaseAdmin
          .from("intake_mappings")
          .insert(createRows)
          .select();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        out.intakeMappings = data ?? [];
      } else {
        out.intakeMappings = [];
      }
    }

    /* 9) Matches upsert with slot fill + duplicate guard + onConflict */
/* Matches upsert with slot fill + duplicate guard + onConflict */
if (body.matches?.upsert?.length) {
  const rows = body.matches.upsert.map(m => ({ ...m, tournament_id: tournamentId }));

  // Guard: a match in a GROUPS stage must carry a group_id. A null here means the
  // client failed to assign the match to a group (e.g. added from the "All groups"
  // view), which silently orphans it — the standings recompute buckets by
  // (group_id ?? 0) and it never counts toward its group. league/knockout stages
  // legitimately have null group_id, so this only applies to kind === 'groups'.
  {
    const stageIds = Array.from(
      new Set(rows.map(r => r.stage_id).filter((x): x is number => x != null))
    );
    if (stageIds.length) {
      const { data: stageKinds, error: kindErr } = await supabaseAdmin
        .from("tournament_stages")
        .select("id, kind")
        .in("id", stageIds);
      if (kindErr) return NextResponse.json({ error: kindErr.message }, { status: 500 });

      const kindByStage = new Map((stageKinds ?? []).map(s => [s.id, s.kind]));
      const orphaned = rows.filter(
        r => kindByStage.get(r.stage_id) === "groups" && r.group_id == null
      );
      if (orphaned.length) {
        return NextResponse.json(
          {
            error:
              "A match in a groups stage is missing its group. Assign every group " +
              "match to a group before saving (select a specific όμιλος rather than " +
              "the “All groups” view when adding matches).",
            entity: "matches",
            stage_ids: Array.from(new Set(orphaned.map(r => r.stage_id))),
            count: orphaned.length,
          },
          { status: 400 }
        );
      }
    }
  }

  // Split by type based on is_ko column
  const koRowsAll = rows.filter(r => r.is_ko);  // KO matches where is_ko = true
  const lgRowsAll = rows.filter(r => !r.is_ko); // Non-KO matches where is_ko = false

  

  // Updates (respect optimistic updated_at unless forced)
  const toUpdate = rows.filter(r => r.id != null);
  const updated: any[] = [];

  if (forceMatches && toUpdate.length) {
    // Batch upsert when forced (no optimistic locking needed)
    const upsertRows = toUpdate.map(r => ({
      id: r.id as number,
      stage_id: r.stage_id,
      tournament_id: tournamentId,
      group_id: r.group_id ?? null,
      team_a_id: r.team_a_id ?? null,
      team_b_id: r.team_b_id ?? null,
      team_a_score: r.team_a_score ?? null,
      team_b_score: r.team_b_score ?? null,
      winner_team_id: r.winner_team_id ?? null,
      status: r.status ?? "scheduled",
      match_date: r.match_date ?? null,
      matchday: r.matchday ?? null,
      round: r.round ?? null,
      bracket_pos: r.bracket_pos ?? null,
      home_source_round: r.home_source_round ?? null,
      home_source_bracket_pos: r.home_source_bracket_pos ?? null,
      away_source_round: r.away_source_round ?? null,
      away_source_bracket_pos: r.away_source_bracket_pos ?? null,
      is_ko: r.is_ko ?? false,
      leg: r.leg ?? null,
      penalty_a: r.penalty_a ?? null,
      penalty_b: r.penalty_b ?? null,
    }));
    const { data, error } = await supabaseAdmin
      .from("matches")
      .upsert(upsertRows, { onConflict: "id" })
      .select("*");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    updated.push(...(data ?? []));
  } else {
    // Per-row updates with optimistic locking
    for (const r of toUpdate) {
      let q = supabaseAdmin.from("matches").update({
        stage_id: r.stage_id,
        tournament_id: tournamentId,
        group_id: r.group_id ?? null,
        team_a_id: r.team_a_id ?? null,
        team_b_id: r.team_b_id ?? null,
        team_a_score: r.team_a_score ?? null,
        team_b_score: r.team_b_score ?? null,
        winner_team_id: r.winner_team_id ?? null,
        status: r.status ?? "scheduled",
        match_date: r.match_date ?? null,
        matchday: r.matchday ?? null,
        round: r.round ?? null,
        bracket_pos: r.bracket_pos ?? null,
        home_source_round: r.home_source_round ?? null,
        home_source_bracket_pos: r.home_source_bracket_pos ?? null,
        away_source_round: r.away_source_round ?? null,
        away_source_bracket_pos: r.away_source_bracket_pos ?? null,
        is_ko: r.is_ko ?? false,
        leg: r.leg ?? null,
        penalty_a: r.penalty_a ?? null,
        penalty_b: r.penalty_b ?? null,
      }).eq("id", r.id as number);

      if (r.updated_at) q = q.eq("updated_at", r.updated_at);

      const { data, error } = await q.select("*");
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      if (r.updated_at && (!data || data.length === 0)) {
        const { data: cur } = await supabaseAdmin
          .from("matches").select("id,updated_at").eq("id", r.id as number).single();
        return NextResponse.json(
          { error: "Match is stale. Please reload.", entity: "matches", id: r.id,
            sent_updated_at: r.updated_at, db_updated_at: cur?.updated_at ?? null },
          { status: 409 }
        );
      }
      updated.push(...(data ?? []));
    }
  }

  // Creates via upsert on natural keys to avoid duplicates
  const strip = ({ id:_1, updated_at:_2, ...rest }: any) => rest;
  const created: any[] = [];

  // KO Matches — natural key is (stage_id, round, bracket_pos, leg). Two-legged
  // ties share (stage,round,bracket_pos) and differ only by leg, so the leg MUST
  // be part of the key or both legs collapse into one row.
  //
  // We dedup in code + plain INSERT (mirroring the non-KO path below) rather than
  // upsert-on-conflict: ON CONFLICT against the PARTIAL unique index `unique_ko_match`
  // (WHERE round IS NOT NULL AND bracket_pos IS NOT NULL) is fragile to infer and
  // fails outright if that index isn't present in the DB. A pre-fetch dedup is robust
  // either way. `tie_leg1_match_id` is resolved in the KO-id post-pass below.
  if (koRowsAll.some(r => r.id == null)) {
    const koKey = (m: any) =>
      `${m.stage_id}#${m.round ?? "n"}#${m.bracket_pos ?? "n"}#${m.leg ?? "n"}`;

    const toCreateKO = koRowsAll
      .filter(r => r.id == null)
      .map(strip)
      // never send a transient/unknown tie link on create
      .map(({ tie_leg1_match_id: _t, ...rest }: any) => rest);

    // Existing KO rows for the affected stages (so we don't duplicate a slot/leg).
    const koStageIds = Array.from(new Set(toCreateKO.map((m: any) => m.stage_id).filter(Boolean)));
    const { data: existingKO } = await supabaseAdmin
      .from("matches")
      .select("stage_id, round, bracket_pos, leg")
      .in("stage_id", koStageIds)
      .not("round", "is", null);

    const existingKOKeys = new Set((existingKO ?? []).map(koKey));
    // Also dedup within this batch itself (e.g. a slot sent twice).
    const seenInBatch = new Set<string>();
    const dedupedKO = toCreateKO.filter((m: any) => {
      const k = koKey(m);
      if (existingKOKeys.has(k) || seenInBatch.has(k)) return false;
      seenInBatch.add(k);
      return true;
    });

    if (dedupedKO.length) {
      const { data, error } = await supabaseAdmin
        .from("matches")
        .insert(dedupedKO)
        .select();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      created.push(...(data ?? []));
    }
  }

  // Non-KO Matches - Insert only (no upsert since bracket_pos can be null)
  if (lgRowsAll.some(r => r.id == null)) {
    const toCreateLG = lgRowsAll.filter(r => r.id == null).map(strip);

    // Batch duplicate check: fetch all existing non-KO matches for affected stages in one query
    const lgStageIds = Array.from(new Set(toCreateLG.map(m => m.stage_id).filter(Boolean)));
    const { data: existingMatches } = await supabaseAdmin
      .from("matches")
      .select("stage_id, group_id, matchday, round, bracket_pos")
      .in("stage_id", lgStageIds)
      .is("round", null);

    const existingKeys = new Set((existingMatches ?? []).map(matchNaturalKey));
    const deduped = toCreateLG.filter(m => !existingKeys.has(matchNaturalKey(m)));

    if (deduped.length) {
      const { data, error } = await supabaseAdmin
        .from("matches")
        .insert(deduped)
        .select();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      created.push(...(data ?? []));
    }
  }

  out.matches = [...updated, ...created];
}

    // ===== KO ID RESOLUTION (no RPC) ======================================
    const upsertStageIds = Array.from(
      new Set((body.matches?.upsert ?? []).map((r) => r.stage_id).filter(Boolean))
    ) as number[];

    const touchedStageIds = Array.from(
      new Set([...(upsertStageIds ?? []), ...(matchDeleteStageIds ?? [])])
    ) as number[];

    if (touchedStageIds.length) {
      const { data: allStageMatches, error: stageSelErr } = await supabaseAdmin
        .from("matches")
        .select(
          `
          id,
          stage_id,
          round,
          bracket_pos,
          leg,
          tie_leg1_match_id,
          home_source_round,
          home_source_bracket_pos,
          away_source_round,
          away_source_bracket_pos,
          home_source_match_id,
          away_source_match_id
          `
        )
        .in("stage_id", touchedStageIds);

      if (stageSelErr) return NextResponse.json({ error: stageSelErr.message }, { status: 500 });

      type Key = string;
      const keyOf = (s: number, r: number | null | undefined, p: number | null | undefined): Key =>
        `${s}#${r ?? "n"}#${p ?? "n"}`;

      const idByPos = new Map<Key, number>();
      // Leg-1 id per slot, so leg-2 deciders can be linked via tie_leg1_match_id.
      const leg1IdByPos = new Map<Key, number>();
      for (const m of allStageMatches ?? []) {
        if (m.round != null && m.bracket_pos != null) {
          idByPos.set(keyOf(m.stage_id, m.round, m.bracket_pos), m.id);
          if ((m as any).leg === 1) leg1IdByPos.set(keyOf(m.stage_id, m.round, m.bracket_pos), m.id);
        }
      }

      const pointerPatches = (allStageMatches ?? [])
        .map((m) => {
          const homeId =
            m.home_source_round != null && m.home_source_bracket_pos != null
              ? idByPos.get(keyOf(m.stage_id, m.home_source_round, m.home_source_bracket_pos)) ?? null
              : null;

          const awayId =
            m.away_source_round != null && m.away_source_bracket_pos != null
              ? idByPos.get(keyOf(m.stage_id, m.away_source_round, m.away_source_bracket_pos)) ?? null
              : null;

          const changes: any = { id: m.id };
          if (homeId !== (m.home_source_match_id ?? null)) changes.home_source_match_id = homeId;
          if (awayId !== (m.away_source_match_id ?? null)) changes.away_source_match_id = awayId;

          // Two-legged KO: link a leg-2 decider to its leg-1 sibling (same slot).
          // Leg-1 rows get their FK cleared (only the decider carries the link).
          if ((m as any).leg === 2) {
            const leg1Id =
              m.round != null && m.bracket_pos != null
                ? leg1IdByPos.get(keyOf(m.stage_id, m.round, m.bracket_pos)) ?? null
                : null;
            if (leg1Id !== ((m as any).tie_leg1_match_id ?? null)) changes.tie_leg1_match_id = leg1Id;
          } else if ((m as any).tie_leg1_match_id != null) {
            changes.tie_leg1_match_id = null;
          }

          return changes;
        })
        .filter((p) => Object.keys(p).length > 1);

      if (pointerPatches.length) {
        const { error } = await supabaseAdmin
          .from("matches")
          .upsert(pointerPatches, { onConflict: "id" });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const { data: resolvedMatches, error: resolvedFetchErr } = await supabaseAdmin
        .from("matches")
        .select("*")
        .in("stage_id", touchedStageIds);

      if (resolvedFetchErr) return NextResponse.json({ error: resolvedFetchErr.message }, { status: 500 });

      out.matches = resolvedMatches ?? out.matches;
    }
    // ======================================================================

    console.log("[save-all][out] Final:", JSON.stringify(out, null, 2));
    return NextResponse.json(out, { status: 200 });
  } catch (e: any) {
    console.error("[save-all] Error:", e?.message ?? "Unknown error");
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
