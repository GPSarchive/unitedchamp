// GET /api/players/search?q=&excludeTeamId=&limit=
//
// Type-ahead search for the admin "add existing player" boxes. Unlike
// GET /api/players (an `ilike` on the raw columns), this folds accents, case
// and final sigma on both sides and ranks word-prefix hits first, so "γιαν
// παπ" or "ΠΑΠΑΔΟΠΟΥΛΟΣ" finds Γιάννης Παπαδόπουλος (lib/playerSearch.ts).
// The fold happens in JS over the full active player list — a few hundred
// light rows — because PostgREST cannot apply unaccent inside a filter.
//
// Each hit carries the ACTIVE-season teams the player is already on, so the
// admin can tell namesakes apart before adding one.
import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/app/lib/supabase/supabaseServer";
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import { canEditContent } from "@/app/lib/supabase/apiAuth";
import { getActiveSeason } from "@/app/lib/seasons";
import { ageFromBirthDate } from "@/app/lib/playerAge";
import { rankPlayers } from "@/app/lib/playerSearch";

export type PlayerSearchHit = {
  id: number;
  first_name: string;
  last_name: string;
  photo: string | null;
  position: string | null;
  player_number: number | null;
  birth_date: string | null;
  age: number | null;
  /** Active-season, non-archived teams the player is rostered on. */
  teams: { id: number; name: string }[];
};

type RawTeam = { id: number; name: string; season_label: string | null; deleted_at: string | null };
type Raw = {
  id: number;
  first_name: string;
  last_name: string;
  photo: string | null;
  position: string | null;
  player_number: number | null;
  birth_date: string | null;
  player_teams: { team_id: number; teams: RawTeam | RawTeam[] | null }[] | null;
};

const MAX_LIMIT = 100;
const PAGE = 1000;

export async function GET(req: Request) {
  const routeClient = await createSupabaseRouteClient();
  const { data: auth } = await routeClient.auth.getUser();
  const user = auth?.user;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditContent(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const excludeTeamId = Number(url.searchParams.get("excludeTeamId") || "");
  const limitRaw = Number(url.searchParams.get("limit") || "30");
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, MAX_LIMIT) : 30;

  if (!q) return NextResponse.json({ players: [], q });

  // Every active player, light columns only; paginated past PostgREST's cap.
  const rows: Raw[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabaseAdmin
      .from("player")
      .select(
        "id, first_name, last_name, photo, position, player_number, birth_date, player_teams(team_id, teams(id, name, season_label, deleted_at))",
      )
      .is("deleted_at", null)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    rows.push(...((data ?? []) as unknown as Raw[]));
    if (!data || data.length < PAGE) break;
  }

  const candidates =
    Number.isFinite(excludeTeamId) && excludeTeamId > 0
      ? rows.filter((r) => !(r.player_teams ?? []).some((pt) => pt.team_id === excludeTeamId))
      : rows;

  const ranked = rankPlayers(candidates, q, limit);

  let activeLabel: string | null = null;
  try {
    activeLabel = (await getActiveSeason())?.label ?? null;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed reading active season" }, { status: 500 });
  }

  const players: PlayerSearchHit[] = ranked.map((r) => {
    const teams: { id: number; name: string }[] = [];
    for (const pt of r.player_teams ?? []) {
      const t = Array.isArray(pt.teams) ? pt.teams[0] : pt.teams;
      if (!t || t.deleted_at || !activeLabel || t.season_label !== activeLabel) continue;
      teams.push({ id: t.id, name: t.name });
    }
    teams.sort((a, b) => a.name.localeCompare(b.name, "el"));
    return {
      id: r.id,
      first_name: r.first_name,
      last_name: r.last_name,
      photo: r.photo,
      position: r.position,
      player_number: r.player_number,
      birth_date: r.birth_date,
      age: ageFromBirthDate(r.birth_date),
      teams,
    };
  });

  return NextResponse.json({ players, q, total_candidates: candidates.length });
}
