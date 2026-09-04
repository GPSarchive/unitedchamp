// Season lookups for the write side (engines, actions, scripts). Plain
// service-role queries, no request cache: the active season is THE pointer
// (plans/seasonal-data-contract.md §4) and a refresh must never act on a
// stale value. Page-side cached readers wrap these (Phase 2+).
import "server-only";

import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";

export type SeasonStatus = "active" | "archived";

export interface SeasonRow {
  /** Storage key, e.g. "2025-2026" (also the value of tournaments.season). */
  label: string;
  /** What the UI prints, e.g. "2025/26". */
  display_label: string;
  status: SeasonStatus;
  started_on: string | null;
  ended_on: string | null;
  archived_at: string | null;
  created_at: string;
}

/** Cache tag for anything that renders the season list / active pointer. */
export const SEASONS_CACHE_TAG = "seasons";

const SEASON_COLUMNS =
  "label, display_label, status, started_on, ended_on, archived_at, created_at";

/** All seasons, newest label first. */
export async function listSeasons(): Promise<SeasonRow[]> {
  const { data, error } = await supabaseAdmin
    .from("seasons")
    .select(SEASON_COLUMNS)
    .order("label", { ascending: false });
  if (error) throw new Error(`Failed reading seasons: ${error.message}`);
  return (data ?? []) as SeasonRow[];
}

/** The single status='active' row (the pointer), or null if none exists yet. */
export async function getActiveSeason(): Promise<SeasonRow | null> {
  const { data, error } = await supabaseAdmin
    .from("seasons")
    .select(SEASON_COLUMNS)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new Error(`Failed reading active season: ${error.message}`);
  return (data as SeasonRow | null) ?? null;
}

export async function getSeasonByLabel(label: string): Promise<SeasonRow | null> {
  const { data, error } = await supabaseAdmin
    .from("seasons")
    .select(SEASON_COLUMNS)
    .eq("label", label)
    .maybeSingle();
  if (error) throw new Error(`Failed reading season ${label}: ${error.message}`);
  return (data as SeasonRow | null) ?? null;
}

/** The season label a tournament is assigned to (tournaments.season). */
export async function getTournamentSeasonLabel(tournamentId: number): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("tournaments")
    .select("season")
    .eq("id", tournamentId)
    .maybeSingle();
  if (error) throw new Error(`Failed reading tournament ${tournamentId}: ${error.message}`);
  return (data?.season as string | null | undefined) ?? null;
}

/** Ids of every tournament assigned to `label`. */
export async function listTournamentIdsForSeason(label: string): Promise<number[]> {
  const { data, error } = await supabaseAdmin
    .from("tournaments")
    .select("id")
    .eq("season", label)
    .order("id", { ascending: true });
  if (error) throw new Error(`Failed reading tournaments for season ${label}: ${error.message}`);
  return (data ?? []).map((t) => t.id as number);
}
