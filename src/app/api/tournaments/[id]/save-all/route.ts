import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";

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

export async function POST(
  req: Request,
  { params }: { params: Promise<Params> }
) {
  const rid = req.headers.get("x-debug-id") ?? "no-id";
  const phase = req.headers.get("x-debug-phase") ?? "n/a";
  const { id } = await params;

  let body: SaveAllRequest;
  try {
    // Parse the body as SaveAllRequest
    body = (await req.json()) as SaveAllRequest;

    // Log the received body to inspect what the server is receiving
    console.log("[save-all][in] Received request body:", JSON.stringify(body, null, 2));

  } catch {
    console.error("[save-all][in]", rid, "bad JSON");
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sum = {
    tournament: !!body.tournament?.patch,
    stages: {
      upsert: body.stages?.upsert?.length ?? 0,
      deleteIds: body.stages?.deleteIds ?? [],
    },
    groups: {
      upsert: body.groups?.upsert?.length ?? 0,
      deleteIds: body.groups?.deleteIds ?? [],
    },
    tournamentTeams: body.tournamentTeams?.upsert?.length ?? 0,
    stageSlots: body.stageSlots?.upsert?.length ?? 0,
    intakeMappings: body.intakeMappings?.replace?.length ?? 0,
    matches: {
      upsert: body.matches?.upsert?.length ?? 0,
      deleteIds: body.matches?.deleteIds ?? [],
      updateIds: (body.matches?.upsert ?? []).filter((m) => m.id != null).map((m) => m.id),
      createCount: (body.matches?.upsert ?? []).filter((m) => m.id == null).length,
    },
    force: body.force ?? {},
    phase,
  };
  console.log("[save-all][in]", rid, "tid=", id, JSON.stringify(sum));

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
      console.log("[save-all][delete-groups] Deleting group IDs:", body.groups.deleteIds);
      const { error: grpDelErr } = await supabaseAdmin
        .from("tournament_groups")
        .delete()
        .in("id", body.groups.deleteIds);
      if (grpDelErr) return NextResponse.json({ error: grpDelErr.message }, { status: 500 });
      out.deletedGroupIds = body.groups.deleteIds;
      console.log("[save-all][delete-groups] Successfully deleted group IDs:", out.deletedGroupIds);
    }

    /* 3) Stages — deletions next (after groups) --------------------------- */
    if (body.stages?.deleteIds?.length) {
      console.log("[save-all][delete-stages] Deleting stage IDs:", body.stages.deleteIds);
      const { error: stgDelErr } = await supabaseAdmin
        .from("tournament_stages")
        .delete()
        .in("id", body.stages.deleteIds);
      if (stgDelErr) return NextResponse.json({ error: stgDelErr.message }, { status: 500 });
      out.deletedStageIds = body.stages.deleteIds;
      console.log("[save-all][delete-stages] Successfully deleted stage IDs:", out.deletedStageIds);
    }

    /* 4) Matches deletions (before upserts) ------------------------------ */
    let matchDeleteStageIds: number[] = [];
    if (body.matches?.deleteIds?.length) {
      console.log("[save-all][delete-matches] Deleting match IDs:", body.matches.deleteIds);
      const { data: delRows, error: delFetchErr } = await supabaseAdmin
        .from("matches")
        .select("id,stage_id")
        .in("id", body.matches.deleteIds);
      if (delFetchErr) {
        return NextResponse.json({ error: delFetchErr.message }, { status: 500 });
      }
      matchDeleteStageIds = Array.from(new Set((delRows ?? []).map((r) => r.stage_id)));

      const { error: delErr } = await supabaseAdmin
        .from("matches")
        .delete()
        .in("id", body.matches.deleteIds);
      if (delErr) {
        return NextResponse.json({ error: delErr.message }, { status: 500 });
      }
      console.log("[save-all][delete-matches] Successfully deleted match IDs:", body.matches.deleteIds);
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
          .upsert(updateRows, { onConflict: "id" })
          .select();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        upserted = upserted.concat(data ?? []);
      }

      out.stages = upserted;
    }

    /* 6) Tournament teams upsert ------------------------------------------ */
    if (body.tournamentTeams?.upsert?.length) {
      const createRows = body.tournamentTeams.upsert
        .filter((r) => r.id == null)
        .map(({ id: _drop, ...r }) => ({ ...r, tournament_id: tournamentId }));
      const updateRows = body.tournamentTeams.upsert.filter((r) => r.id != null);

      let upserted: any[] = [];

      if (createRows.length) {
        const { data, error } = await supabaseAdmin
          .from("tournament_teams")
          .insert(createRows)
          .select();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        upserted = upserted.concat(data ?? []);
      }

      if (updateRows.length) {
        const { data, error } = await supabaseAdmin
          .from("tournament_teams")
          .upsert(updateRows, { onConflict: "id" })
          .select();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        upserted = upserted.concat(data ?? []);
      }

      out.tournamentTeams = upserted;
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
        body.intakeMappings.targetStageIds ?? Array.from(new Set(body.intakeMappings.replace.map((r) => r.target_stage_id)));

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

    /* 8.5) Matches deletions (before upserts) ------------------------------ */

    if (body.matches?.deleteIds?.length) {
      console.log("[save-all][delete-matches] Deleting match IDs:", body.matches.deleteIds);
      const { data: delRows, error: delFetchErr } = await supabaseAdmin
        .from("matches")
        .select("id,stage_id")
        .in("id", body.matches.deleteIds);
      if (delFetchErr) {
        return NextResponse.json({ error: delFetchErr.message }, { status: 500 });
      }
      matchDeleteStageIds = Array.from(new Set((delRows ?? []).map((r) => r.stage_id)));

      const { error: delErr } = await supabaseAdmin
        .from("matches")
        .delete()
        .in("id", body.matches.deleteIds);
      if (delErr) {
        return NextResponse.json({ error: delErr.message }, { status: 500 });
      }
      console.log("[save-all][delete-matches] Successfully deleted match IDs:", body.matches.deleteIds);
    }

    /* 9) Matches upsert (optimistic, with optional force) ------------------ */
    if (body.matches?.upsert?.length) {
      const rows = body.matches.upsert.map((m) => ({ ...m, tournament_id: tournamentId }));

      const toUpdate = rows.filter((r) => r.id != null);
      const toCreate = rows
        .filter((r) => r.id == null)
        .map(({ id: _drop, updated_at: _drop2, ...r }) => r);

      const updated: any[] = [];
      const created: any[] = [];

      for (const r of toUpdate) {
        let q = supabaseAdmin
          .from("matches")
          .update({
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
          })
          .eq("id", r.id as number);

        if (!forceMatches && r.updated_at) {
          q = q.eq("updated_at", r.updated_at);
        }

        const { data, error } = await q.select("*");
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        if (!forceMatches && r.updated_at && (!data || data.length === 0)) {
          const { data: cur } = await supabaseAdmin
            .from("matches")
            .select("id, updated_at")
            .eq("id", r.id as number)
            .single();

          return NextResponse.json(
            {
              error: "Match is stale. Please reload.",
              entity: "matches",
              id: r.id,
              sent_updated_at: r.updated_at,
              db_updated_at: cur?.updated_at ?? null,
            },
            { status: 409 }
          );
        }

        updated.push(...(data ?? []));
      }

      if (toCreate.length) {
        const { data, error } = await supabaseAdmin
          .from("matches")
          .insert(toCreate)
          .select();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        created.push(...(data ?? []));
      }

      out.matches = [...updated, ...created];
      
    }

    // ===== KO ID RESOLUTION (no RPC) ======================================
    const upsertStageIds = Array.from(
      new Set((body.matches?.upsert ?? []).map((r) => r.stage_id).filter(Boolean))
    ) as number[];

    const touchedStageIds = Array.from(new Set([...upsertStageIds, ...matchDeleteStageIds])) as number[];

    if (touchedStageIds.length) {
      const { data: allStageMatches, error: stageSelErr } = await supabaseAdmin
        .from("matches")
        .select(
          `
          id,
          stage_id,
          round,
          bracket_pos,
          home_source_round,
          home_source_bracket_pos,
          away_source_round,
          away_source_bracket_pos,
          home_source_match_id,
          away_source_match_id
          `
        )
        .in("stage_id", touchedStageIds);

      if (stageSelErr) {
        return NextResponse.json({ error: stageSelErr.message }, { status: 500 });
      }

      type Key = string;
      const keyOf = (s: number, r: number | null | undefined, p: number | null | undefined): Key =>
        `${s}#${r ?? "n"}#${p ?? "n"}`;

      const idByPos = new Map<Key, number>();
      for (const m of allStageMatches ?? []) {
        if (m.round != null && m.bracket_pos != null) {
          idByPos.set(keyOf(m.stage_id, m.round, m.bracket_pos), m.id);
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
          return changes;
        })
        .filter((p) => Object.keys(p).length > 1);

      if (pointerPatches.length) {
        const { error } = await supabaseAdmin
          .from("matches")
          .upsert(pointerPatches, { onConflict: "id" });
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
      }

      const { data: resolvedMatches, error: resolvedFetchErr } = await supabaseAdmin
        .from("matches")
        .select("*")
        .in("stage_id", touchedStageIds);

      if (resolvedFetchErr) {
        return NextResponse.json({ error: resolvedFetchErr.message }, { status: 500 });
      }

      out.matches = resolvedMatches ?? out.matches;
    }
    // ======================================================================
    console.log("[save-all][out] Final output:", JSON.stringify(out, null, 2));
    return NextResponse.json(out, { status: 200 });
  } catch (e: any) {
    console.error("[save-all] Error:", e?.message ?? "Unknown error");
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
