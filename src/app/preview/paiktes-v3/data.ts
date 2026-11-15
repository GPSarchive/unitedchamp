// v3 shows a player's profile as an overlay on top of the list, so everything
// the profile needs travels with the list: the v2 directory plus, per player,
// age, height, their earlier seasons and this season split by team. Opening a
// profile is then instant — no request, so the card's spin runs straight into
// a complete profile.
import "server-only";

import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import { getActiveSeasonCached, NO_SEASON } from "@/app/lib/seasonScope";
import { listSeasons, listTournamentIdsForSeason } from "@/app/lib/seasons";
import { fetchInBatches, BATCH_SIZE, PAGE_SIZE } from "@/app/lib/supabasePaging";
import { aggregateTournamentBuckets, chunk, type MpsRow } from "@/app/lib/playerStatsAggregation";
import { ageFromBirthDate } from "@/app/lib/playerAge";
import { loadDirectory, STAT_COLUMNS, toTuple, type StatColumns } from "../paiktes-v2/data";
import type { DirectoryData, DirectoryTeam, StatTuple } from "../paiktes-v2/model";

export type SeasonLine = {
  /** Storage key of the season, e.g. "2025-2026". */
  season: string;
  /** What the UI prints, e.g. "2025/26". */
  label: string;
  /** Season archive page, when the season is a known one. */
  href: string | null;
  stats: StatTuple;
};

/** The active season's numbers for one team the player played for. */
export type TeamLine = { teamId: number; stats: StatTuple };

export type PlayerExtra = {
  age: number | null;
  heightCm: number | null;
  /** Earlier seasons, newest first. */
  history: SeasonLine[];
  /** This season, one line per team the player has played for, most matches first. */
  teams: TeamLine[];
};

export type DirectoryV3 = DirectoryData & {
  /** Keyed by player id; a player with nothing extra has no entry. */
  extras: Record<number, PlayerExtra>;
  /**
   * Teams named in someone's team lines that are not in `teams` (archived
   * during the season). Kept apart so they stay out of the team filter.
   */
  extraTeams: DirectoryTeam[];
};

type BioRow = { id: number; height_cm: number | null; birth_date: string | null };
type SeasonRow = StatColumns & { player_id: number; season_label: string };

const MPS_COLUMNS =
  "player_id, match_id, team_id, goals, assists, yellow_cards, red_cards, blue_cards, mvp, best_goalkeeper";

/**
 * This season split by team, per player. Unlike the season and tournament
 * totals this is not stored anywhere, so it is aggregated here from the
 * season's per-match rows — with the same pure aggregator, over the same rows,
 * as the season writer (refreshSeasonStats), so a player's team lines add up
 * to their season row. Costs one read of the season's per-match rows per page
 * rebuild.
 */
async function loadTeamLines(seasonLabel: string): Promise<Map<number, TeamLine[]>> {
  const tournamentIds = await listTournamentIdsForSeason(seasonLabel);
  const matches = await fetchInBatches<{ id: number; winner_team_id: number | null }>(
    "matches",
    "tournament_id",
    tournamentIds,
    "id, winner_team_id",
  );
  const winnerByMatch = new Map(matches.map((m) => [m.id, m.winner_team_id] as const));
  const rows = await fetchInBatches<MpsRow>(
    "match_player_stats",
    "match_id",
    matches.map((m) => m.id),
    MPS_COLUMNS,
  );

  const rowsByTeam = new Map<number, MpsRow[]>();
  for (const row of rows) {
    const list = rowsByTeam.get(row.team_id) ?? [];
    list.push(row);
    rowsByTeam.set(row.team_id, list);
  }

  const out = new Map<number, TeamLine[]>();
  for (const [teamId, teamRows] of rowsByTeam) {
    for (const [playerId, b] of aggregateTournamentBuckets(teamRows, winnerByMatch)) {
      if (b.matches === 0) continue;
      const lines = out.get(playerId) ?? [];
      lines.push({
        teamId,
        stats: [
          b.matches,
          b.wins,
          b.goals,
          b.assists,
          b.mvp_count,
          b.best_gk_count,
          b.yellow_cards,
          b.red_cards,
          b.blue_cards,
        ],
      });
      out.set(playerId, lines);
    }
  }
  for (const lines of out.values()) lines.sort((a, b) => b.stats[0] - a.stats[0] || a.teamId - b.teamId);
  return out;
}

/**
 * Every season row of the given players. Paged on the (player_id,
 * season_label) pair — that pair is the table's key, a single column is not.
 */
async function fetchSeasonRows(playerIds: number[]): Promise<SeasonRow[]> {
  const out: SeasonRow[] = [];
  for (const batch of chunk(playerIds, BATCH_SIZE)) {
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await supabaseAdmin
        .from("player_season_stats")
        .select(`player_id, season_label, ${STAT_COLUMNS}`)
        .in("player_id", batch)
        .order("player_id", { ascending: true })
        .order("season_label", { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw new Error(`Failed reading player_season_stats: ${error.message}`);
      const rows = (data ?? []) as SeasonRow[];
      out.push(...rows);
      if (rows.length < PAGE_SIZE) break;
    }
  }
  return out;
}

export async function loadDirectoryV3(): Promise<DirectoryV3> {
  const directory = await loadDirectory();
  const playerIds = directory.players.map((p) => p.id);

  const activeSeason = await getActiveSeasonCached();
  const activeLabel = activeSeason?.label ?? NO_SEASON;
  const [seasons, bios, seasonRows, teamLines] = await Promise.all([
    listSeasons(),
    fetchInBatches<BioRow>("player", "id", playerIds, "id, height_cm, birth_date"),
    fetchSeasonRows(playerIds),
    loadTeamLines(activeLabel),
  ]);
  const displayBySeason = new Map(seasons.map((s) => [s.label, s.display_label] as const));

  // Name the teams a line points at that the directory does not list.
  const listed = new Set(directory.teams.map((t) => t.id));
  const unlisted = new Set<number>();
  for (const id of playerIds) {
    for (const line of teamLines.get(id) ?? []) if (!listed.has(line.teamId)) unlisted.add(line.teamId);
  }
  const extraTeams = (
    await fetchInBatches<{ id: number; name: string | null; logo: string | null }>(
      "teams",
      "id",
      [...unlisted],
      "id, name, logo",
    )
  ).map((t) => ({ id: t.id, name: t.name ?? "", logo: t.logo }));

  const historyByPlayer = new Map<number, SeasonLine[]>();
  for (const row of seasonRows) {
    if (row.season_label === activeLabel) continue;
    const lines = historyByPlayer.get(row.player_id) ?? [];
    lines.push({
      season: row.season_label,
      label: displayBySeason.get(row.season_label) ?? row.season_label,
      href: displayBySeason.has(row.season_label)
        ? `/seasons/${encodeURIComponent(row.season_label)}`
        : null,
      stats: toTuple(row),
    });
    historyByPlayer.set(row.player_id, lines);
  }

  const extras: Record<number, PlayerExtra> = {};
  for (const bio of bios) {
    const age = ageFromBirthDate(bio.birth_date);
    const heightCm = bio.height_cm ?? null;
    const history = (historyByPlayer.get(bio.id) ?? []).sort((a, b) =>
      b.season.localeCompare(a.season),
    );
    const teams = teamLines.get(bio.id) ?? [];
    if (age == null && heightCm == null && history.length === 0 && teams.length === 0) continue;
    extras[bio.id] = { age, heightCm, history, teams };
  }

  return { ...directory, extras, extraTeams };
}
