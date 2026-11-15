// app/dashboard/protathlites/data.ts — «Πρωταθλητές»
// SERVER: everything the skin dashboard needs in one go — every player, every
// team of every season with its roster, career numbers for the cards, and who
// holds which special card skin.

import "server-only";

import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import { fetchAllRows } from "@/app/lib/supabasePaging";
import { listSeasons } from "@/app/lib/seasons";
import { isPlaceholderPhoto } from "@/app/lib/image-config";
import { STAT_COLUMNS, toTuple, type StatColumns } from "@/app/preview/paiktes-v2/data";
import type { StatTuple } from "@/app/preview/paiktes-v2/model";
import { holderFromRow, isSkinKey, SKIN_ROW_SELECT, type SkinHolder, type SkinRow } from "./skins";
import type { SkinPlayer, SkinSeason, SkinTeam } from "./ProtathlitesClient";

type TeamRow = { id: number; name: string | null; logo: string | null; season_label: string | null; deleted_at: string | null };
type PlayerRow = { id: number; first_name: string | null; last_name: string | null; photo: string | null; deleted_at: string | null };
type RosterRow = { player_id: number; team_id: number };
type SeasonStatsRow = StatColumns & { player_id: number; primary_team_id: number | null };

function isMissingTable(err: { code?: string; message?: string }) {
  return (
    err.code === "42P01" ||
    err.code === "PGRST205" ||
    /does not exist|could not find the table/i.test(err.message ?? "")
  );
}

/** Holders, or null when the table is not there yet (migration not run). */
async function loadHolders(): Promise<SkinHolder[] | null> {
  const probe = await supabaseAdmin.from("player_card_skins").select("id").limit(1);
  if (probe.error) {
    if (isMissingTable(probe.error)) return null;
    throw new Error(`Failed reading player_card_skins: ${probe.error.message}`);
  }
  // Paged: PostgREST returns at most ~1000 rows per request.
  const rows = await fetchAllRows<SkinRow>("player_card_skins", SKIN_ROW_SELECT, "id");
  // Rows of a skin no longer in the list stay in the database, unshown.
  return rows.filter((r) => isSkinKey(r.skin)).map(holderFromRow);
}

export type ProtathlitesData = {
  seasons: SkinSeason[];
  teams: SkinTeam[];
  players: SkinPlayer[];
  /** null = the table does not exist yet (migration not run). */
  holders: SkinHolder[] | null;
};

export async function loadProtathlitesData(): Promise<ProtathlitesData> {
  const seasonRows = await listSeasons();
  // Newest season first ("2026-2027" sorts after "2025-2026").
  const seasonsDesc = [...seasonRows].sort((a, b) => b.label.localeCompare(a.label));
  const seasonRank = new Map(seasonsDesc.map((s, i) => [s.label, i] as const));

  const [teamRows, playerRows, rosterRows, statsBySeason, holders] = await Promise.all([
    fetchAllRows<TeamRow>("teams", "id, name, logo, season_label, deleted_at"),
    fetchAllRows<PlayerRow>("player", "id, first_name, last_name, photo, deleted_at"),
    fetchAllRows<RosterRow>("player_teams", "player_id, team_id"),
    // One read per season, so each pages on its unique player_id.
    Promise.all(
      seasonsDesc.map((s) =>
        fetchAllRows<SeasonStatsRow>(
          "player_season_stats",
          `player_id, primary_team_id, ${STAT_COLUMNS}`,
          "player_id",
          { column: "season_label", value: s.label },
        ),
      ),
    ),
    loadHolders(),
  ]);

  const teams: SkinTeam[] = teamRows
    .map((t) => ({
      id: t.id,
      name: (t.name ?? "").trim() || `Ομάδα #${t.id}`,
      logo: t.logo,
      season: t.season_label,
      archived: t.deleted_at != null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "el"));
  const teamSeasonRank = new Map(
    teams.map((t) => [t.id, t.season == null ? Number.MAX_SAFE_INTEGER : (seasonRank.get(t.season) ?? Number.MAX_SAFE_INTEGER)] as const),
  );

  // Career numbers = every season added up. Main team = the primary team of
  // the newest season that has one.
  const career = new Map<number, StatTuple>();
  const mainTeam = new Map<number, number>();
  for (const rows of statsBySeason) {
    for (const r of rows) {
      const line = toTuple(r);
      const sum = career.get(r.player_id);
      career.set(r.player_id, sum ? (sum.map((n, i) => n + line[i]) as StatTuple) : line);
      if (r.primary_team_id != null && !mainTeam.has(r.player_id)) mainTeam.set(r.player_id, r.primary_team_id);
    }
  }

  const teamIdsByPlayer = new Map<number, Set<number>>();
  for (const r of rosterRows) {
    if (!teamSeasonRank.has(r.team_id)) continue;
    const set = teamIdsByPlayer.get(r.player_id) ?? new Set<number>();
    set.add(r.team_id);
    teamIdsByPlayer.set(r.player_id, set);
  }

  const players: SkinPlayer[] = playerRows
    .filter((p) => p.deleted_at == null)
    .map((p) => {
      // Newest season first, so [0] is the team the player is on now.
      const teamIds = [...(teamIdsByPlayer.get(p.id) ?? [])].sort(
        (a, b) => (teamSeasonRank.get(a) ?? 0) - (teamSeasonRank.get(b) ?? 0),
      );
      const main = mainTeam.get(p.id);
      return {
        id: p.id,
        first: (p.first_name ?? "").trim(),
        last: (p.last_name ?? "").trim(),
        photo: p.photo,
        hasPhoto: !isPlaceholderPhoto(p.photo),
        teamIds,
        mainTeamId: main != null && teamSeasonRank.has(main) ? main : (teamIds[0] ?? null),
        stats: career.get(p.id) ?? null,
      };
    })
    .sort((a, b) => `${a.last} ${a.first}`.localeCompare(`${b.last} ${b.first}`, "el"));

  const seasons: SkinSeason[] = seasonsDesc.map((s) => ({
    label: s.label,
    display: s.display_label ?? s.label,
    active: s.status === "active",
  }));

  return { seasons, teams, players, holders };
}
