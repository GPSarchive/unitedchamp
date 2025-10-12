// app/api/tournaments/[id]/snapshot/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin"; // service role for server routes
import type { FullTournamentSnapshot } from "@/app/dashboard/tournaments/TournamentCURD/submit/tournamentStore";

/** Avoid ISR here; editor needs fresh reads */
export const dynamic = "force-dynamic";

type Params = { id: string };

export async function GET(
  _req: Request,
  { params }: { params: Promise<Params> }
) {
  // Next.js App Router: params is async; await it before use
  const { id } = await params;
  const num = Number(id);
  if (!Number.isFinite(num)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  // ---- 1) Tournament -------------------------------------------------------
  const { data: t, error: tErr } = await supabaseAdmin
    .from("tournaments")
    .select("id,name,slug,format,season")
    .eq("id", num)
    .single();

  if (tErr || !t) {
    return NextResponse.json({ error: tErr?.message || "Not found" }, { status: 404 });
  }

  // ---- 2) Stages -----------------------------------------------------------
  const { data: stages, error: sErr } = await supabaseAdmin
    .from("tournament_stages")
    .select("id,tournament_id,name,kind,ordering,config")
    .eq("tournament_id", num)
    .order("ordering", { ascending: true });

  if (sErr) {
    return NextResponse.json({ error: sErr.message }, { status: 500 });
  }

  const stageIds = (stages ?? []).map((s) => s.id);

  // ---- 3) Groups -----------------------------------------------------------
  const { data: groups, error: gErr } = await supabaseAdmin
    .from("tournament_groups")
    .select("id,stage_id,name,ordering")
    .in("stage_id", stageIds.length ? stageIds : [-1]);

  if (gErr) {
    return NextResponse.json({ error: gErr.message }, { status: 500 });
  }

  // ---- 4) Matches (all useful fields + updated_at) -------------------------
  // Note: group_id here is a FK for groups stages; null for league/KO
  const { data: matches, error: mErr } = await supabaseAdmin
    .from("matches")
    .select(`
      id, stage_id, group_id,
      team_a_id, team_b_id,
      team_a_score, team_b_score, winner_team_id,
      status, matchday, match_date,
      round, bracket_pos,
      home_source_round, home_source_bracket_pos,
      away_source_round, away_source_bracket_pos,
      updated_at
    `)
    .eq("tournament_id", num)
    .order("round", { ascending: true, nullsFirst: true })
    .order("bracket_pos", { ascending: true, nullsFirst: true })
    .order("matchday", { ascending: true, nullsFirst: true })
    .order("id", { ascending: true });

  if (mErr) {
    return NextResponse.json({ error: mErr.message }, { status: 500 });
  }

  // ---- 5) Participation (tournament_teams) --------------------------------
  const { data: tournamentTeams, error: pErr } = await supabaseAdmin
    .from("tournament_teams")
    .select("id,tournament_id,team_id,stage_id,group_id,seed")
    .eq("tournament_id", num);

  if (pErr) {
    return NextResponse.json({ error: pErr.message }, { status: 500 });
  }

  // ---- 6) KO→Groups intake helpers ----------------------------------------
  // stage_slots: (stage_id, group_id=index, slot_id, team_id, source, updated_at)
  const { data: stageSlots, error: ssErr } = await supabaseAdmin
    .from("stage_slots")
    .select("stage_id,group_id,slot_id,team_id,source,updated_at")
    .in("stage_id", stageIds.length ? stageIds : [-1]);

  if (ssErr) {
    return NextResponse.json({ error: ssErr.message }, { status: 500 });
  }

  // intake_mappings for KO→Groups (target stage perspective)
  const { data: intakeMappings, error: imErr } = await supabaseAdmin
    .from("intake_mappings")
    .select("id,target_stage_id,group_idx,slot_idx,from_stage_id,round,bracket_pos,outcome")
    .in("target_stage_id", stageIds.length ? stageIds : [-1]);

  if (imErr) {
    return NextResponse.json({ error: imErr.message }, { status: 500 });
  }

  // ---- 7) Standings (league/groups) ---------------------------------------
  const { data: standings, error: stErr } = await supabaseAdmin
    .from("stage_standings")
    .select("stage_id,group_id,team_id,played,won,drawn,lost,gf,ga,gd,points,rank")
    .in("stage_id", stageIds.length ? stageIds : [-1]);

  if (stErr) {
    return NextResponse.json({ error: stErr.message }, { status: 500 });
  }

  // ---- 8) Teams used anywhere (participants, matches, slots, standings) ----
  const teamIds = new Set<number>();
  (tournamentTeams ?? []).forEach((r: any) => teamIds.add(Number(r.team_id)));
  (matches ?? []).forEach((m: any) => {
    if (m.team_a_id != null) teamIds.add(Number(m.team_a_id));
    if (m.team_b_id != null) teamIds.add(Number(m.team_b_id));
    if (m.winner_team_id != null) teamIds.add(Number(m.winner_team_id));
  });
  (stageSlots ?? []).forEach((s: any) => {
    if (s.team_id != null) teamIds.add(Number(s.team_id));
  });
  (standings ?? []).forEach((r: any) => {
    if (r.team_id != null) teamIds.add(Number(r.team_id));
  });

  let teams: Array<{ id: number; name: string; logo?: string | null; am?: string | null }> = [];
  if (teamIds.size > 0) {
    const { data: teamRows, error: tErr2 } = await supabaseAdmin
      .from("teams")
      .select("id,name,logo,am")
      .in("id", Array.from(teamIds));

    if (tErr2) {
      return NextResponse.json({ error: tErr2.message }, { status: 500 });
    }
    teams = (teamRows ?? []).map((r) => ({
      id: Number(r.id),
      name: String(r.name ?? `Team #${r.id}`),
      logo: r.logo ?? null,
      am: r.am ?? null,
    }));
  }

  // ---- 9) Assemble snapshot for the store ---------------------------------
  const snapshot: FullTournamentSnapshot = {
    tournament: {
      id: Number(t.id),
      name: String(t.name),
      slug: String(t.slug ?? ""),
      format: (t as any).format ?? "mixed",
      season: (t as any).season ?? null,
    },
    stages: (stages ?? []).map((s) => ({
      id: Number(s.id),
      tournament_id: Number(s.tournament_id),
      name: String(s.name),
      kind: s.kind as any,
      ordering: Number(s.ordering ?? 0),
      config: s.config ?? null,
    })),
    groups: (groups ?? []).map((g) => ({
      id: Number(g.id),
      stage_id: Number(g.stage_id),
      name: String(g.name),
      ordering: g.ordering == null ? null : Number(g.ordering),
    })),
    teams,
    tournamentTeams: (tournamentTeams ?? []).map((r) => ({
      id: Number(r.id),
      tournament_id: Number(r.tournament_id),
      team_id: Number(r.team_id),
      stage_id: r.stage_id == null ? null : Number(r.stage_id),
      group_id: r.group_id == null ? null : Number(r.group_id),
      seed: r.seed == null ? null : Number(r.seed),
    })),
    matches: (matches ?? []).map((m) => ({
      id: Number(m.id),
      stage_id: Number(m.stage_id),
      group_id: m.group_id == null ? null : Number(m.group_id),
      team_a_id: m.team_a_id == null ? null : Number(m.team_a_id),
      team_b_id: m.team_b_id == null ? null : Number(m.team_b_id),
      team_a_score: m.team_a_score == null ? null : Number(m.team_a_score),
      team_b_score: m.team_b_score == null ? null : Number(m.team_b_score),
      winner_team_id: m.winner_team_id == null ? null : Number(m.winner_team_id),
      status: (m.status as any) ?? "scheduled",
      matchday: m.matchday == null ? null : Number(m.matchday),
      match_date: m.match_date ?? null,
      round: m.round == null ? null : Number(m.round),
      bracket_pos: m.bracket_pos == null ? null : Number(m.bracket_pos),
      home_source_round: m.home_source_round == null ? null : Number(m.home_source_round),
      home_source_bracket_pos: m.home_source_bracket_pos == null ? null : Number(m.home_source_bracket_pos),
      away_source_round: m.away_source_round == null ? null : Number(m.away_source_round),
      away_source_bracket_pos: m.away_source_bracket_pos == null ? null : Number(m.away_source_bracket_pos),
      updated_at: (m as any).updated_at ?? null, // ← concurrency token
    })),
    stageSlots: (stageSlots ?? []).map((s) => ({
      stage_id: Number(s.stage_id),
      group_id: Number(s.group_id), // index-based (0..)
      slot_id: Number(s.slot_id),
      team_id: s.team_id == null ? null : Number(s.team_id),
      source: (s.source as "manual" | "intake") ?? "manual",
      updated_at: (s as any).updated_at ?? undefined, // ← concurrency token
    })),
    intakeMappings: (intakeMappings ?? []).map((r) => ({
      id: Number(r.id),
      target_stage_id: Number(r.target_stage_id),
      group_idx: Number(r.group_idx),
      slot_idx: Number(r.slot_idx),
      from_stage_id: Number(r.from_stage_id),
      round: Number(r.round),
      bracket_pos: Number(r.bracket_pos),
      outcome: (r.outcome as "W" | "L") ?? "W",
    })),
    standings: (standings ?? []).map((row) => ({
      stage_id: Number(row.stage_id),
      group_id: Number(row.group_id),
      team_id: Number(row.team_id),
      played: Number(row.played),
      won: Number(row.won),
      drawn: Number(row.drawn),
      lost: Number(row.lost),
      gf: Number(row.gf),
      ga: Number(row.ga),
      gd: Number(row.gd),
      points: Number(row.points),
      rank: row.rank == null ? null : Number(row.rank),
    })),
  };

  return NextResponse.json(snapshot, { status: 200 });
}
