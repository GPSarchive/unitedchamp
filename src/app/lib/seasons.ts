// Season lookups for the write side (engines, actions, scripts). Plain
// service-role queries, no request cache: the active season is THE pointer
// (plans/seasonal-data-contract.md §4) and a refresh must never act on a
// stale value. Page-side cached readers wrap these (Phase 2+).
import "server-only";

import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import { chunk } from "@/app/lib/playerStatsAggregation";
import { teamSeasonMismatches, type TeamSeasonRow } from "@/app/lib/seasonChecks";

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

/**
 * The season a tournament is ASSIGNED to (plans/seasonal-data-contract.md):
 * the requested label, which must exist in public.seasons; else `fallback`
 * (an existing row's current label); else the active season. Dates never
 * decide the season. Throws an admin-readable Error so API routes can answer
 * 400 and actions can return it verbatim.
 */
export async function resolveSeasonLabel(
  requested: string | null | undefined,
  fallback?: string | null,
): Promise<string> {
  const label = (requested ?? "").trim();
  if (label) {
    const row = await getSeasonByLabel(label);
    if (!row) {
      throw new Error(`Άγνωστη σεζόν «${label}» — δημιούργησέ την πρώτα στο /dashboard/seasons.`);
    }
    return row.label;
  }
  const fb = (fallback ?? "").trim();
  if (fb) return fb;
  const active = await getActiveSeason();
  if (!active) throw new Error("Δεν υπάρχει ενεργή σεζόν — όρισε μία στο /dashboard/seasons.");
  return active.label;
}

/**
 * Teams are per-season rows (contract D1): every team attached to a
 * tournament or one of its matches must carry that tournament's season.
 * Throws naming the offending ids (an unknown id counts as a mismatch).
 * Nulls and non-positive ids (TBD slots) are ignored.
 */
export async function assertTeamsInSeason(
  teamIds: Iterable<number | null | undefined>,
  seasonLabel: string,
): Promise<void> {
  const ids = [...new Set([...teamIds].filter((t): t is number => typeof t === "number" && t > 0))];
  if (ids.length === 0) return;
  const rows: TeamSeasonRow[] = [];
  for (const batch of chunk(ids, 300)) {
    const { data, error } = await supabaseAdmin
      .from("teams")
      .select("id, season_label")
      .in("id", batch);
    if (error) throw new Error(`Failed reading teams: ${error.message}`);
    rows.push(...((data ?? []) as TeamSeasonRow[]));
  }
  const bad = teamSeasonMismatches(ids, rows, seasonLabel);
  if (bad.length > 0) {
    throw new Error(
      `Οι ομάδες #${bad.join(", #")} δεν ανήκουν στη σεζόν ${seasonLabel} — κάθε ομάδα είναι εγγραφή μίας σεζόν.`,
    );
  }
}
