// app/api/tournaments/[id]/save-all/route.ts
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
  slot_id: number; // 1-based
  team_id?: number | null;
  source?: "manual" | "intake";
  updated_at?: string; // for concurrency
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
  updated_at?: string | null; // for concurrency
};

type SaveAllRequest = {
  tournament?: { patch: PatchTournament };
  stages?: { upsert?: StageRow[]; deleteIds?: number[] };
  groups?: { upsert?: GroupRow[]; deleteIds?: number[] };
  tournamentTeams?: { upsert?: TournamentTeamRow[]; deleteIds?: number[] };
  stageSlots?: { upsert?: StageSlotRow[] };
  intakeMappings?: { replace?: IntakeMappingRow[]; targetStageIds?: number[] };
  matches?: { upsert?: MatchRow[]; deleteIds?: number[] };
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
  const { id } = await params;
  const tournamentId = Number(id);
  if (!Number.isFinite(tournamentId)) {
    return NextResponse.json({ error: "Invalid tournament id" }, { status: 400 });
  }

  const body = (await req.json()) as SaveAllRequest;
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
      const { error: grpDelErr } = await supabaseAdmin
        .from("tournament_groups")
        .delete()
        .in("id", body.groups.deleteIds);
      if (grpDelErr) return NextResponse.json({ error: grpDelErr.message }, { status: 500 });
      out.deletedGroupIds = body.groups.deleteIds;
    }

    /* 3) Stages — deletions next (after groups) --------------------------- */
    if (body.stages?.deleteIds?.length) {
      const { error: stgDelErr } = await supabaseAdmin
        .from("tournament_stages")
        .delete()
        .in("id", body.stages.deleteIds);
      if (stgDelErr) return NextResponse.json({ error: stgDelErr.message }, { status: 500 });
      out.deletedStageIds = body.stages.deleteIds;
    }

    /* 4) Stages upsert ----------------------------------------------------- */
    if (body.stages?.upsert?.length) {
      const createRows = body.stages.upsert
        .filter((r) => r.id == null) // null or undefined → create
        .map(({ id: _drop, ...r }) => ({ ...r, tournament_id: tournamentId }));
      const updateRows = body.stages.upsert
        .filter((r) => r.id != null);

      let upserted: any[] = [];

      if (createRows.length) {
        const { data: stgCreateData, error: stgCreateErr } = await supabaseAdmin
          .from("tournament_stages")
          .insert(createRows) // id omitted → default sequence
          .select();
        if (stgCreateErr) return NextResponse.json({ error: stgCreateErr.message }, { status: 500 });
        upserted = upserted.concat(stgCreateData ?? []);
      }

      if (updateRows.length) {
        const { data: stgUpdateData, error: stgUpdateErr } = await supabaseAdmin
          .from("tournament_stages")
          .upsert(updateRows, { onConflict: "id" })
          .select();
        if (stgUpdateErr) return NextResponse.json({ error: stgUpdateErr.message }, { status: 500 });
        upserted = upserted.concat(stgUpdateData ?? []);
      }

      out.stages = upserted;
    }

    /* 5) Groups upsert ----------------------------------------------------- */
    if (body.groups?.upsert?.length) {
      const createRows = body.groups.upsert
        .filter((r) => r.id == null)
        .map(({ id: _drop, ...r }) => r);
      const updateRows = body.groups.upsert
        .filter((r) => r.id != null);

      let upserted: any[] = [];

      if (createRows.length) {
        const { data: grpCreateData, error: grpCreateErr } = await supabaseAdmin
          .from("tournament_groups")
          .insert(createRows)
          .select();
        if (grpCreateErr) return NextResponse.json({ error: grpCreateErr.message }, { status: 500 });
        upserted = upserted.concat(grpCreateData ?? []);
      }

      if (updateRows.length) {
        const { data: grpUpdateData, error: grpUpdateErr } = await supabaseAdmin
          .from("tournament_groups")
          .upsert(updateRows, { onConflict: "id" })
          .select();
        if (grpUpdateErr) return NextResponse.json({ error: grpUpdateErr.message }, { status: 500 });
        upserted = upserted.concat(grpUpdateData ?? []);
      }

      out.groups = upserted;
    }

    /* 6) Tournament teams upsert ------------------------------------------ */
    if (body.tournamentTeams?.upsert?.length) {
      const createRows = body.tournamentTeams.upsert
        .filter((r) => r.id == null)
        .map(({ id: _drop, ...r }) => ({ ...r, tournament_id: tournamentId }));
      const updateRows = body.tournamentTeams.upsert
        .filter((r) => r.id != null);

      let upserted: any[] = [];

      if (createRows.length) {
        const { data: ttCreateData, error: ttCreateErr } = await supabaseAdmin
          .from("tournament_teams")
          .insert(createRows)
          .select();
        if (ttCreateErr) return NextResponse.json({ error: ttCreateErr.message }, { status: 500 });
        upserted = upserted.concat(ttCreateData ?? []);
      }

      if (updateRows.length) {
        const { data: ttUpdateData, error: ttUpdateErr } = await supabaseAdmin
          .from("tournament_teams")
          .upsert(updateRows, { onConflict: "id" })
          .select();
        if (ttUpdateErr) return NextResponse.json({ error: ttUpdateErr.message }, { status: 500 });
        upserted = upserted.concat(ttUpdateData ?? []);
      }

      out.tournamentTeams = upserted;
    }

    /* 7) Stage slots upsert (PK: stage_id,group_id,slot_id) + concurrency -- */
    if (body.stageSlots?.upsert?.length) {
      const rows = body.stageSlots.upsert;

      const guarded = rows.filter((r) => r.updated_at);
      const rest = rows.filter((r) => !r.updated_at);

      for (const r of guarded) {
        const { data: slotUpdData, error: slotUpdErr } = await supabaseAdmin
          .from("stage_slots")
          .update({ team_id: r.team_id ?? null, source: r.source ?? "manual" })
          .eq("stage_id", r.stage_id)
          .eq("group_id", r.group_id)
          .eq("slot_id", r.slot_id)
          .eq("updated_at", r.updated_at)
          .select("*");

        if (slotUpdErr) return NextResponse.json({ error: slotUpdErr.message }, { status: 500 });
        if (!slotUpdData || slotUpdData.length === 0) {
          return NextResponse.json(
            {
              error: "Stage slot is stale. Please reload.",
              entity: "stage_slots",
              key: { stage_id: r.stage_id, group_id: r.group_id, slot_id: r.slot_id },
            },
            { status: 409 }
          );
        }
      }

      if (rest.length) {
        const { error: slotUpsertErr } = await supabaseAdmin
          .from("stage_slots")
          .upsert(rest, { onConflict: "stage_id,group_id,slot_id" });
        if (slotUpsertErr) return NextResponse.json({ error: slotUpsertErr.message }, { status: 500 });
      }

      const affectedStageIds = Array.from(new Set(rows.map((r) => r.stage_id)));
      const { data: slotCur, error: slotFetchErr } = await supabaseAdmin
        .from("stage_slots")
        .select("*")
        .in("stage_id", affectedStageIds);
      if (slotFetchErr) return NextResponse.json({ error: slotFetchErr.message }, { status: 500 });

      out.stageSlots = slotCur ?? [];
    }

    /* 8) Intake mappings replace (delete → insert) ------------------------- */
    if (body.intakeMappings?.replace) {
      const targetStageIds =
        body.intakeMappings.targetStageIds ??
        Array.from(new Set(body.intakeMappings.replace.map((r) => r.target_stage_id)));

      if (targetStageIds.length) {
        const { error: intakeDelErr } = await supabaseAdmin
          .from("intake_mappings")
          .delete()
          .in("target_stage_id", targetStageIds);
        if (intakeDelErr) return NextResponse.json({ error: intakeDelErr.message }, { status: 500 });
      }

      const createRows = (body.intakeMappings.replace ?? []).map(({ id: _drop, ...r }) => r);

      if (createRows.length) {
        const { data: intakeInsData, error: intakeInsErr } = await supabaseAdmin
          .from("intake_mappings")
          .insert(createRows) // id omitted
          .select();
        if (intakeInsErr) return NextResponse.json({ error: intakeInsErr.message }, { status: 500 });
        out.intakeMappings = intakeInsData ?? [];
      } else {
        out.intakeMappings = [];
      }
    }

    /* 8.5) Matches deletions (before upserts) ------------------------------ */
    let matchDeleteStageIds: number[] = [];
    if (body.matches?.deleteIds?.length) {
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
    }

    /* 9) Matches upsert (with concurrency on updated_at) ------------------- */
    if (body.matches?.upsert?.length) {
      const rows = body.matches.upsert.map((m) => ({ ...m, tournament_id: tournamentId }));

      const toUpdate = rows.filter((r) => r.id != null);
      const toCreate = rows
        .filter((r) => r.id == null)
        .map(({ id: _drop, updated_at: _drop2, ...r }) => r); // strip id & updated_at

      const updated: any[] = [];
      const created: any[] = [];

      // Concurrency-aware updates
      for (const r of toUpdate) {
        const q = supabaseAdmin.from("matches").update({
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
        });

        if (r.updated_at) q.eq("updated_at", r.updated_at);

        const { data: updMatchData, error: updMatchErr } = await q.eq("id", r.id as number).select("*");
        if (updMatchErr) return NextResponse.json({ error: updMatchErr.message }, { status: 500 });
        if (r.updated_at && (!updMatchData || updMatchData.length === 0)) {
          return NextResponse.json(
            { error: "Match is stale. Please reload.", entity: "matches", id: r.id },
            { status: 409 }
          );
        }

        updated.push(...(updMatchData ?? []));
      }

      if (toCreate.length) {
        const { data: createdMatches, error: createMatchErr } = await supabaseAdmin
          .from("matches")
          .insert(toCreate) // id omitted → default sequence
          .select();
        if (createMatchErr) return NextResponse.json({ error: createMatchErr.message }, { status: 500 });
        created.push(...(createdMatches ?? []));
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
        const { error: pointerUpsertErr } = await supabaseAdmin
          .from("matches")
          .upsert(pointerPatches, { onConflict: "id" });
        if (pointerUpsertErr) {
          return NextResponse.json({ error: pointerUpsertErr.message }, { status: 500 });
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

    return NextResponse.json(out, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
