"use server";

// Server actions for the seasons area (/dashboard/seasons). Server Actions are
// public POST endpoints — every action re-checks the admin role first.
//
// Data contract: plans/seasonal-data-contract.md §4. Closing a season is a
// pointer flip on public.seasons after a final snapshot; no other row is
// touched. An archived season's stored numbers change ONLY through
// resnapshotSeason().

import { revalidatePath } from "next/cache";
import { createSupabaseRouteClient } from "@/app/lib/supabase/supabaseServer";
import { isAdmin } from "@/app/lib/supabase/apiAuth";
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import {
  getActiveSeason,
  getSeasonByLabel,
  listTournamentIdsForSeason,
} from "@/app/lib/seasons";
import { snapshotSeason, type SeasonSnapshotResult } from "@/app/lib/seasonSnapshot";
import { revalidateSeasonSurfaces } from "@/app/lib/revalidatePublicPages";
import { chunk } from "@/app/lib/playerStatsAggregation";
import { BATCH_SIZE, PAGE_SIZE } from "@/app/lib/supabasePaging";
import {
  displayLabelForSeason,
  nextSeasonLabel,
  seasonLabelFromDate,
} from "@/app/geniki-katataxi/rules";

type Result<T = object> = ({ success: true } & T) | { success: false; error: string };

async function requireAdminUser() {
  const supabase = await createSupabaseRouteClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user || !isAdmin(user)) return null;
  return user;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

function revalidateAdmin(...labels: string[]) {
  revalidatePath("/dashboard/seasons");
  for (const l of labels) revalidatePath(`/dashboard/seasons/${l}`);
  revalidatePath("/dashboard/geniki-katataxi");
  revalidatePath("/dashboard/tournaments");
  revalidatePath("/dashboard/teams");
}

// ─── Preflight ─────────────────────────────────────────────────────────────

export interface ClosePreflight {
  label: string;
  /** Conditions that stop the close unless `force` is passed. */
  blockers: string[];
  /** Things the admin should know; the close proceeds. */
  warnings: string[];
  info: {
    tournaments: number;
    tournamentsOpen: number;
    teams: number;
    matches: number;
    finishedMatches: number;
    unfinishedPast: number;
    unfinishedFuture: number;
    statsRows: number;
    standingsRows: number;
    recapGeneratedAt: string | null;
  };
  suggestedNext: { label: string; display_label: string; started_on: string };
}

async function buildPreflight(label: string): Promise<ClosePreflight> {
  const tournamentIds = await listTournamentIdsForSeason(label);

  const { data: tours, error: tErr } = await supabaseAdmin
    .from("tournaments")
    .select("id, status")
    .eq("season", label);
  if (tErr) throw new Error(tErr.message);

  const matches: { status: string | null; match_date: string | null }[] = [];
  for (const batch of chunk(tournamentIds, BATCH_SIZE)) {
    let offset = 0;
    for (;;) {
      const { data, error } = await supabaseAdmin
        .from("matches")
        .select("status, match_date")
        .in("tournament_id", batch)
        .order("id", { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) break;
      matches.push(...(data as typeof matches));
      if (data.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
  }

  const [{ count: teams }, { count: statsRows }, { count: standingsRows }, recapRes] =
    await Promise.all([
      supabaseAdmin.from("teams").select("*", { count: "exact", head: true }).eq("season_label", label),
      supabaseAdmin
        .from("player_season_stats")
        .select("*", { count: "exact", head: true })
        .eq("season_label", label),
      supabaseAdmin
        .from("season_team_standings")
        .select("*", { count: "exact", head: true })
        .eq("season_label", label),
      supabaseAdmin.from("season_recaps").select("generated_at").eq("season_label", label).maybeSingle(),
    ]);

  const today = todayIso();
  const finishedMatches = matches.filter((m) => m.status === "finished").length;
  const unfinished = matches.filter((m) => m.status !== "finished");
  const unfinishedPast = unfinished.filter(
    (m) => m.match_date && m.match_date.slice(0, 10) < today,
  ).length;
  const unfinishedFuture = unfinished.length - unfinishedPast;
  const tournamentsOpen = (tours ?? []).filter(
    (t) => t.status !== "completed" && t.status !== "archived",
  ).length;

  const blockers: string[] = [];
  const warnings: string[] = [];
  if (unfinishedPast > 0) {
    blockers.push(
      `${unfinishedPast} αγώνες με παρελθούσα ημερομηνία δεν έχουν ολοκληρωθεί — ολοκλήρωσε, ανέβαλε ή κατακύρωσέ τους (ή κλείσε με «παράβλεψη»).`,
    );
  }
  if (tournamentsOpen > 0) {
    warnings.push(
      `${tournamentsOpen} τουρνουά της σεζόν δεν είναι σε κατάσταση completed/archived· η κατάσταση ΔΕΝ αλλάζει αυτόματα.`,
    );
  }
  if (unfinishedFuture > 0) {
    warnings.push(
      `${unfinishedFuture} προγραμματισμένοι αγώνες θα παραμείνουν στην κλειστή σεζόν και δεν θα εμφανίζονται στις ζωντανές σελίδες.`,
    );
  }

  const nextLabel = nextSeasonLabel(label) ?? seasonLabelFromDate(today) ?? "";
  return {
    label,
    blockers,
    warnings,
    info: {
      tournaments: tours?.length ?? 0,
      tournamentsOpen,
      teams: teams ?? 0,
      matches: matches.length,
      finishedMatches,
      unfinishedPast,
      unfinishedFuture,
      statsRows: statsRows ?? 0,
      standingsRows: standingsRows ?? 0,
      recapGeneratedAt: (recapRes.data?.generated_at as string | undefined) ?? null,
    },
    suggestedNext: {
      label: nextLabel,
      display_label: nextLabel ? displayLabelForSeason(nextLabel) : "",
      started_on: today,
    },
  };
}

export async function preflightCloseSeason(
  label: string,
): Promise<Result<{ preflight: ClosePreflight }>> {
  try {
    if (!(await requireAdminUser())) return { success: false, error: "Unauthorized" };
    const season = await getSeasonByLabel(label);
    if (!season) return { success: false, error: "Άγνωστη σεζόν." };
    if (season.status !== "active")
      return { success: false, error: "Μόνο η ενεργή σεζόν μπορεί να κλείσει." };
    return { success: true, preflight: await buildPreflight(label) };
  } catch (err) {
    console.error("[preflightCloseSeason] error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ─── Close ─────────────────────────────────────────────────────────────────

export async function closeSeason(input: {
  currentLabel: string;
  nextLabel: string;
  nextDisplayLabel: string;
  nextStartedOn?: string | null;
  /** Proceed despite blockers (the admin has read them). */
  force?: boolean;
}): Promise<Result<{ snapshot: SeasonSnapshotResult; next: string }>> {
  try {
    const user = await requireAdminUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const currentLabel = (input.currentLabel ?? "").trim();
    const nextLabel = (input.nextLabel ?? "").trim();
    const nextDisplay = (input.nextDisplayLabel ?? "").trim() || displayLabelForSeason(nextLabel);
    if (!currentLabel || !nextLabel) return { success: false, error: "Λείπει σεζόν." };
    if (currentLabel === nextLabel)
      return { success: false, error: "Η νέα σεζόν πρέπει να διαφέρει από την τρέχουσα." };

    const current = await getSeasonByLabel(currentLabel);
    if (!current || current.status !== "active")
      return { success: false, error: "Η σεζόν προς κλείσιμο δεν είναι η ενεργή." };

    const existingNext = await getSeasonByLabel(nextLabel);
    if (existingNext?.status === "active")
      return { success: false, error: "Η επόμενη σεζόν είναι ήδη ενεργή." };

    const preflight = await buildPreflight(currentLabel);
    if (preflight.blockers.length > 0 && !input.force) {
      return {
        success: false,
        error: `Το κλείσιμο μπλοκάρεται: ${preflight.blockers.join(" · ")}`,
      };
    }

    // 1) Final snapshot of the closing season. Throws → nothing flipped.
    const snapshot = await snapshotSeason(currentLabel);

    // 2) Make sure the next season row exists (archived until the flip).
    if (!existingNext) {
      const { error } = await supabaseAdmin.from("seasons").insert({
        label: nextLabel,
        display_label: nextDisplay,
        status: "archived",
        started_on: input.nextStartedOn || todayIso(),
      });
      if (error) return { success: false, error: `Δημιουργία νέας σεζόν: ${error.message}` };
    }

    // 3) Archive the current season.
    const now = new Date().toISOString();
    {
      const { error } = await supabaseAdmin
        .from("seasons")
        .update({ status: "archived", archived_at: now, archived_by: user.id, ended_on: todayIso() })
        .eq("label", currentLabel)
        .eq("status", "active");
      if (error) return { success: false, error: `Αρχειοθέτηση: ${error.message}` };
    }

    // 4) Activate the next one. On failure restore the previous pointer so the
    //    site is never left without an active season.
    {
      const { error } = await supabaseAdmin
        .from("seasons")
        .update({ status: "active", archived_at: null, archived_by: null })
        .eq("label", nextLabel);
      if (error) {
        await supabaseAdmin
          .from("seasons")
          .update({ status: "active", archived_at: null, archived_by: null, ended_on: null })
          .eq("label", currentLabel);
        return { success: false, error: `Ενεργοποίηση νέας σεζόν: ${error.message}` };
      }
    }

    revalidateSeasonSurfaces(currentLabel, nextLabel);
    revalidateAdmin(currentLabel, nextLabel);
    return { success: true, snapshot, next: nextLabel };
  } catch (err) {
    console.error("[closeSeason] error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ─── Snapshots ─────────────────────────────────────────────────────────────

/** Re-run stats + standings + recap for ANY season (the only way archived numbers change). */
export async function resnapshotSeason(
  label: string,
): Promise<Result<{ snapshot: SeasonSnapshotResult }>> {
  try {
    if (!(await requireAdminUser())) return { success: false, error: "Unauthorized" };
    const season = await getSeasonByLabel(label);
    if (!season) return { success: false, error: "Άγνωστη σεζόν." };
    const snapshot = await snapshotSeason(label);
    revalidateSeasonSurfaces(label);
    revalidateAdmin(label);
    return { success: true, snapshot };
  } catch (err) {
    console.error("[resnapshotSeason] error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/** Manual safety net: rebuild the active season's stored tables. */
export async function refreshActiveSeason(): Promise<Result<{ snapshot: SeasonSnapshotResult }>> {
  try {
    if (!(await requireAdminUser())) return { success: false, error: "Unauthorized" };
    const active = await getActiveSeason();
    if (!active) return { success: false, error: "Δεν υπάρχει ενεργή σεζόν." };
    const snapshot = await snapshotSeason(active.label);
    revalidateSeasonSurfaces(active.label);
    revalidateAdmin(active.label);
    return { success: true, snapshot };
  } catch (err) {
    console.error("[refreshActiveSeason] error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ─── Pointer ───────────────────────────────────────────────────────────────

/**
 * Make `label` the active season (archiving the current one). Recovery tool
 * for a half-done close and the way to "reopen" a season. No snapshot runs.
 */
export async function setActiveSeason(label: string): Promise<Result<{ previous: string | null }>> {
  try {
    const user = await requireAdminUser();
    if (!user) return { success: false, error: "Unauthorized" };
    const target = await getSeasonByLabel(label);
    if (!target) return { success: false, error: "Άγνωστη σεζόν." };
    const current = await getActiveSeason();
    if (current?.label === label) return { success: true, previous: label };

    const now = new Date().toISOString();
    if (current) {
      const { error } = await supabaseAdmin
        .from("seasons")
        .update({ status: "archived", archived_at: now, archived_by: user.id })
        .eq("label", current.label);
      if (error) return { success: false, error: error.message };
    }
    const { error } = await supabaseAdmin
      .from("seasons")
      .update({ status: "active", archived_at: null, archived_by: null, ended_on: null })
      .eq("label", label);
    if (error) {
      if (current) {
        await supabaseAdmin
          .from("seasons")
          .update({ status: "active", archived_at: null, archived_by: null })
          .eq("label", current.label);
      }
      return { success: false, error: error.message };
    }

    revalidateSeasonSurfaces(label, ...(current ? [current.label] : []));
    revalidateAdmin(label, ...(current ? [current.label] : []));
    return { success: true, previous: current?.label ?? null };
  } catch (err) {
    console.error("[setActiveSeason] error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
