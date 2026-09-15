// GET /api/teams/:id/previous-roster
//
// The players a team had LAST season, offered for re-signing. Teams are one
// row per season (plans/seasonal-data-contract.md D1); the lineage column
// teams.copied_from_team_id ("Δημιουργία από παλιά ομάδα") says which older
// row this one continues. When the column is empty — a team created by hand —
// the same name in the newest other season is used and the response says so
// (`source.via = "name"`), so the admin can judge the guess.
//
// Players already on this team's roster and archived players are left out;
// each remaining player carries their numbers from the source season so the
// admin sees who they are approving.
import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/app/lib/supabase/supabaseServer";
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import { canEditContent } from "@/app/lib/supabase/apiAuth";
import { getSeasonByLabel } from "@/app/lib/seasons";
import { ageFromBirthDate } from "@/app/lib/playerAge";
import { foldName } from "@/app/lib/playerSearch";

type Ctx = { params: Promise<{ id: string }> };

export type PreviousRosterSource = {
  id: number;
  name: string;
  season_label: string;
  display_label: string;
  deleted: boolean;
  via: "lineage" | "name";
};

export type PreviousRosterPlayer = {
  id: number;
  first_name: string;
  last_name: string;
  photo: string | null;
  position: string | null;
  player_number: number | null;
  birth_date: string | null;
  age: number | null;
  /** Numbers in the source season; null = no appearances recorded. */
  season_stats: { matches: number; goals: number; assists: number } | null;
};

const parseId = (v: unknown) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

type TeamLite = { id: number; name: string | null; season_label: string | null; deleted_at: string | null };

type RawPlayer = {
  id: number;
  first_name: string;
  last_name: string;
  photo: string | null;
  position: string | null;
  player_number: number | null;
  birth_date: string | null;
  deleted_at: string | null;
};

export async function GET(_req: Request, ctx: Ctx) {
  const supa = await createSupabaseRouteClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditContent(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: idParam } = await ctx.params;
  const teamId = parseId(idParam);
  if (!teamId) return NextResponse.json({ error: "Invalid team id" }, { status: 400 });

  const { data: team, error: teamErr } = await supabaseAdmin
    .from("teams")
    .select("id, name, season_label, copied_from_team_id")
    .eq("id", teamId)
    .maybeSingle();
  if (teamErr) return NextResponse.json({ error: teamErr.message }, { status: 400 });
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  // 1) lineage, 2) same name in the newest other season
  let source: TeamLite | null = null;
  let via: PreviousRosterSource["via"] = "lineage";
  if (team.copied_from_team_id) {
    const { data, error } = await supabaseAdmin
      .from("teams")
      .select("id, name, season_label, deleted_at")
      .eq("id", team.copied_from_team_id)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    source = (data as TeamLite | null) ?? null;
  }
  if (!source && team.name) {
    const { data, error } = await supabaseAdmin
      .from("teams")
      .select("id, name, season_label, deleted_at")
      .neq("id", teamId)
      .order("season_label", { ascending: false })
      .order("deleted_at", { ascending: true, nullsFirst: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    const want = foldName(team.name);
    source =
      ((data ?? []) as TeamLite[]).find(
        (t) => t.season_label !== team.season_label && foldName(t.name) === want,
      ) ?? null;
    via = "name";
  }
  if (!source || !source.season_label) {
    return NextResponse.json({ source: null, players: [] });
  }

  const [{ data: rosterRows, error: rosterErr }, { data: currentRows, error: currentErr }] =
    await Promise.all([
      supabaseAdmin
        .from("player_teams")
        .select(
          "player_id, player:player_id(id, first_name, last_name, photo, position, player_number, birth_date, deleted_at)",
        )
        .eq("team_id", source.id),
      supabaseAdmin.from("player_teams").select("player_id").eq("team_id", teamId),
    ]);
  if (rosterErr) return NextResponse.json({ error: rosterErr.message }, { status: 400 });
  if (currentErr) return NextResponse.json({ error: currentErr.message }, { status: 400 });

  const already = new Set((currentRows ?? []).map((r: any) => Number(r.player_id)));
  const seen = new Set<number>();
  const candidates: RawPlayer[] = [];
  for (const row of (rosterRows ?? []) as any[]) {
    const p = (Array.isArray(row.player) ? row.player[0] : row.player) as RawPlayer | null;
    if (!p || p.deleted_at || already.has(p.id) || seen.has(p.id)) continue;
    seen.add(p.id);
    candidates.push(p);
  }

  const statsByPlayer = new Map<number, { matches: number; goals: number; assists: number }>();
  if (candidates.length > 0) {
    const { data: stats, error: statsErr } = await supabaseAdmin
      .from("player_season_stats")
      .select("player_id, matches, goals, assists")
      .eq("season_label", source.season_label)
      .in(
        "player_id",
        candidates.map((p) => p.id),
      );
    if (statsErr) return NextResponse.json({ error: statsErr.message }, { status: 400 });
    for (const s of (stats ?? []) as any[]) {
      statsByPlayer.set(Number(s.player_id), {
        matches: Number(s.matches ?? 0),
        goals: Number(s.goals ?? 0),
        assists: Number(s.assists ?? 0),
      });
    }
  }

  const players: PreviousRosterPlayer[] = candidates
    .map((p) => ({
      id: p.id,
      first_name: p.first_name,
      last_name: p.last_name,
      photo: p.photo,
      position: p.position,
      player_number: p.player_number,
      birth_date: p.birth_date,
      age: ageFromBirthDate(p.birth_date),
      season_stats: statsByPlayer.get(p.id) ?? null,
    }))
    .sort(
      (a, b) =>
        foldName(a.last_name).localeCompare(foldName(b.last_name), "el") ||
        foldName(a.first_name).localeCompare(foldName(b.first_name), "el") ||
        a.id - b.id,
    );

  let display_label = source.season_label;
  try {
    display_label = (await getSeasonByLabel(source.season_label))?.display_label ?? source.season_label;
  } catch {
    /* the raw label is fine */
  }

  const out: PreviousRosterSource = {
    id: source.id,
    name: source.name ?? `Ομάδα #${source.id}`,
    season_label: source.season_label,
    display_label,
    deleted: !!source.deleted_at,
    via,
  };
  return NextResponse.json({ source: out, players, already_on_roster: already.size });
}
