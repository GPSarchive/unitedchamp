import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import type {
  SaveAllRequest,
  TournamentStageUpsert,
  TournamentGroupUpsert,
  TournamentTeamUpsert,
  StageSlotUpsert,
  IntakeMappingUpsert,
  MatchUpsertRow,
} from "@/app/lib/types";

export const dynamic = "force-dynamic";

type StageRow = TournamentStageUpsert & { id: number; tournament_id: number };
type GroupRow = TournamentGroupUpsert & { id: number };
type TournamentTeamRow = TournamentTeamUpsert & { id: number };
type StageSlotRow = StageSlotUpsert;
type IntakeMappingRow = IntakeMappingUpsert & { id: number };
type MatchRow = MatchUpsertRow & { id: number; stage_id: number };

function uniqueNumberIds(values: Array<number | null | undefined>): number[] {
  return Array.from(
    new Set(
      (values ?? [])
        .map((val) => (typeof val === "number" ? val : Number(val)))
        .filter((val) => Number.isFinite(val) && val > 0)
    )
  ) as number[];
}

async function cascadeDeleteMatches(matchIds: Array<number | null | undefined>) {
  const ids = uniqueNumberIds(matchIds);
  if (!ids.length) return null;

  const relatedTables = ["match_participants", "match_player_stats"] as const;
  for (const table of relatedTables) {
    const { error } = await supabaseAdmin.from(table).delete().in("match_id", ids);
    if (error) return error;
  }

  const { error: homeErr } = await supabaseAdmin
    .from("matches")
    .update({
      home_source_match_id: null,
      home_source_round: null,
      home_source_bracket_pos: null,
      home_source_outcome: null,
    })
    .in("home_source_match_id", ids);
  if (homeErr) return homeErr;

  const { error: awayErr } = await supabaseAdmin
    .from("matches")
    .update({
      away_source_match_id: null,
      away_source_round: null,
      away_source_bracket_pos: null,
      away_source_outcome: null,
    })
    .in("away_source_match_id", ids);
  if (awayErr) return awayErr;

  return null;
}

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

function pickDefined<T extends Record<string, any>>(src: T, keys: Array<keyof T>) {
  const out: Partial<T> = {};
  for (const k of keys) {
    if (src[k] !== undefined) out[k] = src[k];
  }
  return out;
}

export async function POST(
  req: Request,
  ctx: { params: Params } | { params: Promise<Params> }
) {
  const rid = req.headers.get("x-debug-id") ?? "no-id";
  const phase = req.headers.get("x-debug-phase") ?? "n/a";

  const paramsAny: any = (ctx as any).params;
  const { id } =
    paramsAny && typeof paramsAny.then === "function"
      ? await (paramsAny as Promise<Params>)
      : (paramsAny as Params);

  let body: SaveAllRequest;
  try {
    body = (await req.json()) as SaveAllRequest;
  } catch {
    console.error("[save-all][in]", rid, "bad JSON");
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const tournamentId = Number(id);
  if (!Number.isFinite(tournamentId)) {
    return NextResponse.json({ error: "Invalid tournament id" }, { status: 400 });
  }

  console.log("[save-all][in]", rid, "phase:", phase, "tournament:", tournamentId);
  console.log("[save-all][payload]", rid, JSON.stringify({
    tournament: !!body.tournament?.patch,
    stages: { upsert: body.stages?.upsert?.length ?? 0, delete: body.stages?.deleteIds?.length ?? 0 },
    groups: { upsert: body.groups?.upsert?.length ?? 0, delete: body.groups?.deleteIds?.length ?? 0 },
    matches: { upsert: body.matches?.upsert?.length ?? 0, delete: body.matches?.deleteIds?.length ?? 0 },
    tournamentTeams: { upsert: body.tournamentTeams?.upsert?.length ?? 0 },
    stageSlots: { upsert: body.stageSlots?.upsert?.length ?? 0 },
    intakeMappings: { replace: body.intakeMappings?.replace?.length ?? 0 },
  }));

  const forceMatches = !!body.force?.matches;
  const forceSlots = !!body.force?.stageSlots;

  const out: SaveAllResponse = { ok: true };

  try {
    // ===== DELETIONS FIRST =====
    const stageDeleteIds = Array.from(new Set(body.stages?.deleteIds ?? [])).filter(id => id > 0);
    const groupDeleteIds = Array.from(new Set(body.groups?.deleteIds ?? [])).filter(id => id > 0);
    const matchDeleteIds = Array.from(new Set(body.matches?.deleteIds ?? [])).filter(id => id > 0);

    // Delete matches
    if (matchDeleteIds.length) {
      console.log("[save-all][delete]", rid, "deleting matches:", matchDeleteIds);
      const cascadeErr = await cascadeDeleteMatches(matchDeleteIds);
      if (cascadeErr) {
        return NextResponse.json({ error: cascadeErr.message }, { status: 500 });
      }
      const { error: delErr } = await supabaseAdmin.from("matches").delete().in("id", matchDeleteIds);
      if (delErr) {
        return NextResponse.json({ error: delErr.message }, { status: 500 });
      }
    }

    // Delete stages
    if (stageDeleteIds.length) {
      console.log("[save-all][delete]", rid, "deleting stages:", stageDeleteIds);
      const { error: stageDelErr } = await supabaseAdmin.from("tournament_stages").delete().in("id", stageDeleteIds);
      if (stageDelErr) {
        return NextResponse.json({ error: stageDelErr.message }, { status: 500 });
      }
      out.deletedStageIds = stageDeleteIds;
    }

    // Delete groups
    if (groupDeleteIds.length) {
      console.log("[save-all][delete]", rid, "deleting groups:", groupDeleteIds);
      const { error: groupDelErr } = await supabaseAdmin.from("tournament_groups").delete().in("id", groupDeleteIds);
      if (groupDelErr) {
        return NextResponse.json({ error: groupDelErr.message }, { status: 500 });
      }
      out.deletedGroupIds = groupDeleteIds;
    }

    // ===== TOURNAMENT PATCH =====
    if (body.tournament?.patch) {
      console.log("[save-all][tournament]", rid, "patching tournament");
      const { data: updated, error: tErr } = await supabaseAdmin
        .from("tournaments")
        .update(body.tournament.patch)
        .eq("id", tournamentId)
        .select("id,name,slug,format,season")
        .single();
      if (tErr) {
        return NextResponse.json({ error: tErr.message }, { status: 500 });
      }
      out.tournament = updated;
    }

    // ===== STAGES UPSERT =====
    if (body.stages?.upsert?.length) {
      console.log("[save-all][stages]", rid, "upserting", body.stages.upsert.length, "stages");
      const toInsert = body.stages.upsert.filter((s) => !s.id).map((s) => ({ ...s, tournament_id: tournamentId }));
      const toUpdate = body.stages.upsert.filter((s) => s.id);

      const allStages: StageRow[] = [];

      if (toInsert.length) {
        const { data: inserted, error: insErr } = await supabaseAdmin
          .from("tournament_stages")
          .insert(toInsert)
          .select("id,tournament_id,name,kind,ordering,config");
        if (insErr) {
          return NextResponse.json({ error: insErr.message }, { status: 500 });
        }
        allStages.push(...(inserted ?? []));
      }

      for (const s of toUpdate) {
        const { data: updated, error: upErr } = await supabaseAdmin
          .from("tournament_stages")
          .update(pickDefined(s, ["name", "kind", "ordering", "config"]))
          .eq("id", s.id!)
          .select("id,tournament_id,name,kind,ordering,config")
          .single();
        if (upErr) {
          return NextResponse.json({ error: upErr.message }, { status: 500 });
        }
        if (updated) allStages.push(updated);
      }

      out.stages = allStages;
    }

    // ===== GROUPS UPSERT =====
    if (body.groups?.upsert?.length) {
      console.log("[save-all][groups]", rid, "upserting", body.groups.upsert.length, "groups");
      const toInsert = body.groups.upsert.filter((g) => !g.id);
      const toUpdate = body.groups.upsert.filter((g) => g.id);

      const allGroups: GroupRow[] = [];

      if (toInsert.length) {
        const { data: inserted, error: insErr } = await supabaseAdmin
          .from("tournament_groups")
          .insert(toInsert)
          .select("id,stage_id,name,ordering");
        if (insErr) {
          return NextResponse.json({ error: insErr.message }, { status: 500 });
        }
        allGroups.push(...(inserted ?? []));
      }

      for (const g of toUpdate) {
        const { data: updated, error: upErr } = await supabaseAdmin
          .from("tournament_groups")
          .update(pickDefined(g, ["name", "ordering"]))
          .eq("id", g.id!)
          .select("id,stage_id,name,ordering")
          .single();
        if (upErr) {
          return NextResponse.json({ error: upErr.message }, { status: 500 });
        }
        if (updated) allGroups.push(updated);
      }

      out.groups = allGroups;
    }

    // ===== TOURNAMENT TEAMS UPSERT =====
    if (body.tournamentTeams?.upsert?.length) {
      console.log("[save-all][tournament_teams]", rid, "upserting", body.tournamentTeams.upsert.length, "teams");
      const toInsert = body.tournamentTeams.upsert.filter((tt) => !tt.id);
      const toUpdate = body.tournamentTeams.upsert.filter((tt) => tt.id);

      const allTT: TournamentTeamRow[] = [];

      if (toInsert.length) {
        const { data: inserted, error: insErr } = await supabaseAdmin
          .from("tournament_teams")
          .insert(toInsert)
          .select("id,tournament_id,team_id,stage_id,group_id,seed");
        if (insErr) {
          return NextResponse.json({ error: insErr.message }, { status: 500 });
        }
        allTT.push(...(inserted ?? []));
      }

      for (const tt of toUpdate) {
        const { data: updated, error: upErr } = await supabaseAdmin
          .from("tournament_teams")
          .update(pickDefined(tt, ["stage_id", "group_id", "seed"]))
          .eq("id", tt.id!)
          .select("id,tournament_id,team_id,stage_id,group_id,seed")
          .single();
        if (upErr) {
          return NextResponse.json({ error: upErr.message }, { status: 500 });
        }
        if (updated) allTT.push(updated);
      }

      out.tournamentTeams = allTT;
    }

    // ===== STAGE SLOTS UPSERT =====
    if (body.stageSlots?.upsert?.length) {
      console.log("[save-all][stage_slots]", rid, "upserting", body.stageSlots.upsert.length, "slots");
      
      for (const slot of body.stageSlots.upsert) {
        if (!forceSlots && slot.updated_at) {
          const { data: existing, error: fetchErr } = await supabaseAdmin
            .from("stage_slots")
            .select("updated_at")
            .eq("stage_id", slot.stage_id)
            .eq("group_id", slot.group_id)
            .eq("slot_id", slot.slot_id)
            .single();

          if (fetchErr && fetchErr.code !== "PGRST116") {
            return NextResponse.json({ error: fetchErr.message }, { status: 500 });
          }

          if (existing && existing.updated_at !== slot.updated_at) {
            return NextResponse.json({
              ok: false,
              error: "Stale slot data detected",
              entity: "stage_slot",
              sent_updated_at: slot.updated_at,
              db_updated_at: existing.updated_at,
            }, { status: 409 });
          }
        }

        const { error: upsertErr } = await supabaseAdmin
          .from("stage_slots")
          .upsert({
            stage_id: slot.stage_id,
            group_id: slot.group_id,
            slot_id: slot.slot_id,
            team_id: slot.team_id,
            source: slot.source,
          }, {
            onConflict: "stage_id,group_id,slot_id",
          });

        if (upsertErr) {
          return NextResponse.json({ error: upsertErr.message }, { status: 500 });
        }
      }

      const { data: allSlots, error: selectErr } = await supabaseAdmin
        .from("stage_slots")
        .select("stage_id,group_id,slot_id,team_id,source,updated_at")
        .eq("stage_id", body.stageSlots.upsert[0].stage_id);

      if (selectErr) {
        return NextResponse.json({ error: selectErr.message }, { status: 500 });
      }

      out.stageSlots = allSlots ?? [];
    }

    // ===== INTAKE MAPPINGS REPLACE =====
    if (body.intakeMappings?.replace?.length) {
      console.log("[save-all][intake_mappings]", rid, "replacing mappings");
      const targetStageIds = Array.from(new Set(body.intakeMappings.replace.map((m) => m.target_stage_id)));

      if (targetStageIds.length) {
        const { error: delErr } = await supabaseAdmin
          .from("intake_mappings")
          .delete()
          .in("target_stage_id", targetStageIds);
        if (delErr) {
          return NextResponse.json({ error: delErr.message }, { status: 500 });
        }
      }

      const { data: inserted, error: insErr } = await supabaseAdmin
        .from("intake_mappings")
        .insert(body.intakeMappings.replace)
        .select("id,target_stage_id,group_idx,slot_idx,from_stage_id,round,bracket_pos,outcome");

      if (insErr) {
        return NextResponse.json({ error: insErr.message }, { status: 500 });
      }

      out.intakeMappings = inserted ?? [];
    }

    // ===== MATCHES UPSERT =====
    if (body.matches?.upsert?.length) {
      console.log("[save-all][matches]", rid, "upserting", body.matches.upsert.length, "matches");
      const toInsert = body.matches.upsert.filter((m) => !m.id).map((m) => ({ ...m, tournament_id: tournamentId }));
      const toUpdate = body.matches.upsert.filter((m) => m.id);

      const allMatches: MatchRow[] = [];

      if (toInsert.length) {
        const { data: inserted, error: insErr } = await supabaseAdmin
          .from("matches")
          .insert(toInsert)
          .select("id,stage_id,group_id,team_a_id,team_b_id,team_a_score,team_b_score,winner_team_id,status,matchday,match_date,round,bracket_pos,home_source_round,home_source_bracket_pos,away_source_round,away_source_bracket_pos,home_source_outcome,away_source_outcome,updated_at");
        if (insErr) {
          return NextResponse.json({ error: insErr.message }, { status: 500 });
        }
        allMatches.push(...(inserted ?? []));
      }

      for (const m of toUpdate) {
        if (!forceMatches && m.updated_at) {
          const { data: existing, error: fetchErr } = await supabaseAdmin
            .from("matches")
            .select("updated_at")
            .eq("id", m.id!)
            .single();

          if (fetchErr) {
            return NextResponse.json({ error: fetchErr.message }, { status: 500 });
          }

          if (existing && existing.updated_at !== m.updated_at) {
            return NextResponse.json({
              ok: false,
              error: "Stale match data detected",
              entity: "match",
              id: m.id,
              sent_updated_at: m.updated_at,
              db_updated_at: existing.updated_at,
            }, { status: 409 });
          }
        }

        const { data: updated, error: upErr } = await supabaseAdmin
          .from("matches")
          .update(pickDefined(m, [
            "team_a_id", "team_b_id", "team_a_score", "team_b_score", "winner_team_id",
            "status", "matchday", "match_date", "round", "bracket_pos",
            "home_source_round", "home_source_bracket_pos", "away_source_round", "away_source_bracket_pos",
            "home_source_outcome", "away_source_outcome"
          ]))
          .eq("id", m.id!)
          .select("id,stage_id,group_id,team_a_id,team_b_id,team_a_score,team_b_score,winner_team_id,status,matchday,match_date,round,bracket_pos,home_source_round,home_source_bracket_pos,away_source_round,away_source_bracket_pos,home_source_outcome,away_source_outcome,updated_at")
          .single();

        if (upErr) {
          return NextResponse.json({ error: upErr.message }, { status: 500 });
        }
        if (updated) allMatches.push(updated);
      }

      out.matches = allMatches;
    }

    console.log("[save-all][success]", rid, "All operations completed");
    return NextResponse.json(out, { status: 200 });

  } catch (e: any) {
    console.error("[save-all][error]", rid, e?.message ?? "Unknown error", e?.stack);
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}