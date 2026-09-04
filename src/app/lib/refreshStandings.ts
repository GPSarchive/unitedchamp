// Server-only writer/reader for public.season_team_standings — the STORED
// Γενική Κατάταξη (plans/seasonal-data-contract.md §2.1, §4).
//
// Write side: refreshSeasonStandings(label) runs the points engine scoped to
// one season, dense-ranks the lines, and upserts one row per team with the
// team's points log (events jsonb) and the owner-required extras. Only the
// ACTIVE season is refreshed automatically (refreshActiveSeasonStandings at
// every points-affecting mutation site); an archived season changes only via
// an explicit re-snapshot, i.e. a deliberate refreshSeasonStandings(label).
//
// Read side: getSeasonStandings(label) is a plain indexed SELECT — this is
// what every public page reads, the active season included.
//
// Same contract as the stats refreshers: no "use server", no auth of its own,
// write failures THROW (except the *Safely* wrapper, see below).
import "server-only";

import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import { chunk } from "@/app/lib/playerStatsAggregation";
import { BATCH_SIZE, fetchAllRows } from "@/app/lib/supabasePaging";
import { getActiveSeason } from "@/app/lib/seasons";
import { computeGeneralStandings } from "@/app/geniki-katataxi/points";
import type { PointsEvent } from "@/app/geniki-katataxi/rules";
import {
  rankLines,
  storedRowFromLine,
  type SeasonStandingRow,
} from "@/app/geniki-katataxi/standingsShape";

export type { SeasonStandingRow } from "@/app/geniki-katataxi/standingsShape";

const ROW_COLUMNS =
  "season_label, team_id, rank, points, participations, qualifications, titles, runner_ups, " +
  "wins, draws, losses, adjustment_points, adjustment_count, matches_played, goals_for, " +
  "goals_against, clean_sheets, longest_win_streak, events, refreshed_at";

/** Pure step shared by the writer and the audit script: engine → stored-row shapes. */
export async function computeSeasonStandingRows(
  seasonLabel: string,
): Promise<Omit<SeasonStandingRow, "refreshed_at">[]> {
  const standings = await computeGeneralStandings({ seasonScope: { onlyLabel: seasonLabel } });
  const lines = standings.bySeason.get(seasonLabel) ?? [];
  const eventsByTeam = new Map<number, PointsEvent[]>();
  for (const e of standings.events) {
    if (e.season !== seasonLabel) continue;
    const list = eventsByTeam.get(e.teamId) ?? [];
    list.push(e);
    eventsByTeam.set(e.teamId, list);
  }
  return rankLines(lines).map((l) =>
    storedRowFromLine(seasonLabel, l, eventsByTeam.get(l.teamId) ?? []),
  );
}

/**
 * Rebuild one season's rows. Non-destructive: upsert first, then delete only
 * the rows of this season whose team no longer appears in the compute.
 */
export async function refreshSeasonStandings(seasonLabel: string): Promise<{
  seasonLabel: string;
  rows: number;
  staleRowsDeleted: number;
}> {
  const computed = await computeSeasonStandingRows(seasonLabel);
  const now = new Date().toISOString();
  const upserts = computed.map((r) => ({ ...r, refreshed_at: now }));

  for (const batch of chunk(upserts, BATCH_SIZE)) {
    const { error } = await supabaseAdmin
      .from("season_team_standings")
      .upsert(batch, { onConflict: "season_label,team_id" });
    if (error) throw new Error(`Failed upserting season_team_standings: ${error.message}`);
  }

  const live = new Set(computed.map((r) => r.team_id));
  const existing = await fetchAllRows<{ team_id: number }>(
    "season_team_standings",
    "team_id",
    "team_id",
    { column: "season_label", value: seasonLabel },
  );
  const stale = existing.map((r) => r.team_id).filter((id) => !live.has(id));
  for (const batch of chunk(stale, BATCH_SIZE)) {
    const { error } = await supabaseAdmin
      .from("season_team_standings")
      .delete()
      .eq("season_label", seasonLabel)
      .in("team_id", batch);
    if (error) throw new Error(`Failed deleting stale season_team_standings: ${error.message}`);
  }

  return { seasonLabel, rows: upserts.length, staleRowsDeleted: stale.length };
}

/**
 * The trigger used at every points-affecting mutation site. Refreshes the
 * ACTIVE season only and NEVER throws: the mutation that called it has
 * already succeeded, and a missed refresh is recoverable from the dashboard
 * (refresh button) or the drift audit — a failed one must not turn a saved
 * result into an error response. `context` names the caller in the log.
 */
export async function refreshActiveSeasonStandings(context: string): Promise<void> {
  try {
    const active = await getActiveSeason();
    if (!active) return;
    await refreshSeasonStandings(active.label);
  } catch (err) {
    console.error(`[refreshActiveSeasonStandings:${context}]`, err);
  }
}

/** Stored rows of one season, rank order. Plain SELECT — what the pages read. */
export async function getSeasonStandings(seasonLabel: string): Promise<SeasonStandingRow[]> {
  const { data, error } = await supabaseAdmin
    .from("season_team_standings")
    .select(ROW_COLUMNS)
    .eq("season_label", seasonLabel)
    .order("rank", { ascending: true })
    .order("points", { ascending: false })
    .order("team_id", { ascending: true })
    .range(0, 999);
  if (error) throw new Error(`Failed reading season_team_standings: ${error.message}`);
  return (data ?? []) as unknown as SeasonStandingRow[];
}
