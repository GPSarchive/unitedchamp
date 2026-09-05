"use server";

// Server actions for the seasons area (/dashboard/seasons). Server Actions are
// public POST endpoints — every action re-checks the admin role first.
//
// Data contract: plans/seasonal-data-contract.md §4. Closing a season is a
// pointer flip on public.seasons after a final snapshot; no other row is
// touched. An archived season's stored numbers change ONLY through
// resnapshotSeason(). The flip itself runs in ONE database transaction
// (migrations/add-season-flip-fn.sql) so readers never see zero active rows.

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
import {
  revalidateMatchSurfaces,
  revalidateSeasonSurfaces,
  revalidateTournamentSurfaces,
} from "@/app/lib/revalidatePublicPages";
import { chunk } from "@/app/lib/playerStatsAggregation";
import { BATCH_SIZE, PAGE_SIZE } from "@/app/lib/supabasePaging";
import {
  calendarDateIn,
  isOpenTournamentStatus,
  unfinishedMatchBuckets,
} from "@/app/lib/seasonChecks";
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

/**
 * "Today" for the preflight and the default start date: the league's own
 * calendar date. Match dates are literal wall-clock strings (lib/datetime.ts),
 * so comparing them against the UTC date would mis-bucket evening matches
 * between midnight and 03:00 Athens time.
 */
const LEAGUE_TZ = "Europe/Athens";
const todayIso = () => calendarDateIn(LEAGUE_TZ);

function revalidateAdmin(...labels: string[]) {
  revalidatePath("/dashboard/seasons");
  for (const l of labels) revalidatePath(`/dashboard/seasons/${encodeURIComponent(l)}`);
  revalidatePath("/dashboard/geniki-katataxi");
  revalidatePath("/dashboard/tournaments");
  revalidatePath("/dashboard/teams");
}

/**
 * The Vercel preview deployment shares the PRODUCTION database, so flipping
 * the pointer there would close the real season. Refused unless explicitly
 * allowed (ALLOW_SEASON_POINTER_ON_PREVIEW=1). Returns the refusal text.
 */
function pointerWriteRefusal(): string | null {
  if (process.env.VERCEL_ENV === "preview" && process.env.ALLOW_SEASON_POINTER_ON_PREVIEW !== "1") {
    return "Το κλείσιμο/άνοιγμα σεζόν επιτρέπεται μόνο από το production deployment — το preview μοιράζεται τη βάση της παραγωγής.";
  }
  return null;
}

/** A missing SQL function means the migration was not run — say so plainly. */
function describeRpcError(err: { code?: string; message: string }, fn: string): string {
  if (err.code === "42883" || err.code === "PGRST202") {
    return `Λείπει η συνάρτηση ${fn} στη βάση — τρέξε migrations/add-season-flip-fn.sql στο Supabase SQL editor και ξαναδοκίμασε.`;
  }
  return err.message;
}

// ─── Preflight ─────────────────────────────────────────────────────────────

/** One unfinished match of the closing season, as the close sheet lists it. */
export interface PreflightMatch {
  id: number;
  tournament_id: number | null;
  tournament_name: string;
  stage_kind: "knockout" | "groups" | "league" | null;
  leg: number | null;
  team_a_id: number | null;
  team_b_id: number | null;
  team_a_name: string;
  team_b_name: string;
  match_date: string | null;
  status: "scheduled" | "postponed";
  /** true → in the blocker bucket (dated before today, not finished). */
  past: boolean;
}

/** One tournament of the closing season whose status is not completed/archived. */
export interface PreflightTournament {
  id: number;
  name: string;
  status: string;
  matches: number;
  finished: number;
  winner_team_id: number | null;
  winner_name: string | null;
}

export interface ClosePreflight {
  label: string;
  /** Conditions that stop the close unless `force` is passed. */
  blockers: string[];
  /** Things the admin should know; the close proceeds. */
  warnings: string[];
  /** Every unfinished match, blockers first, then by date. */
  unfinishedMatches: PreflightMatch[];
  /** Tournaments the status warning refers to. */
  openTournaments: PreflightTournament[];
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

type PreflightMatchRow = {
  id: number;
  tournament_id: number | null;
  stage_id: number | null;
  leg: number | null;
  team_a_id: number | null;
  team_b_id: number | null;
  match_date: string | null;
  status: string | null;
};

const positiveIds = (xs: Iterable<number | null | undefined>) =>
  [...new Set([...xs].filter((x): x is number => typeof x === "number" && x > 0))];

/** id → name for the given teams (any season; the closing season's rows and past winners). */
async function teamNamesById(ids: number[]): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  for (const batch of chunk(ids, 300)) {
    const { data, error } = await supabaseAdmin.from("teams").select("id, name").in("id", batch);
    if (error) throw new Error(error.message);
    for (const t of data ?? []) out.set(t.id as number, ((t.name as string | null) ?? "").trim() || `Ομάδα #${t.id}`);
  }
  return out;
}

async function stageKindsById(ids: number[]): Promise<Map<number, PreflightMatch["stage_kind"]>> {
  const out = new Map<number, PreflightMatch["stage_kind"]>();
  for (const batch of chunk(ids, 300)) {
    const { data, error } = await supabaseAdmin.from("tournament_stages").select("id, kind").in("id", batch);
    if (error) throw new Error(error.message);
    for (const s of data ?? []) out.set(s.id as number, (s.kind as PreflightMatch["stage_kind"]) ?? null);
  }
  return out;
}

/**
 * Why these rules (and only these): after the flip, refreshes serve the
 * ACTIVE season only, an archived season's stored tables change only through
 * an explicit re-snapshot, and the recap payload is computed once. So a
 * result that is missing at close is missing from the archive.
 *   BLOCKER  unfinished match dated before today — with near certainty a
 *            result nobody entered (or a match nobody postponed/forfeited).
 *   WARNING  unfinished match dated today/later/undated — legitimately
 *            unplayed; the admin decides whether to wait or abandon it.
 *   WARNING  tournament status not completed/archived — cosmetic: the points
 *            engine and the stats pipeline never read tournaments.status.
 */
async function buildPreflight(label: string): Promise<ClosePreflight> {
  const tournamentIds = await listTournamentIdsForSeason(label);

  const { data: toursData, error: tErr } = await supabaseAdmin
    .from("tournaments")
    .select("id, name, status, winner_team_id")
    .eq("season", label)
    .order("id", { ascending: true });
  if (tErr) throw new Error(tErr.message);
  const tours = (toursData ?? []) as {
    id: number;
    name: string | null;
    status: string;
    winner_team_id: number | null;
  }[];

  const matches: PreflightMatchRow[] = [];
  for (const batch of chunk(tournamentIds, BATCH_SIZE)) {
    let offset = 0;
    for (;;) {
      const { data, error } = await supabaseAdmin
        .from("matches")
        .select("id, tournament_id, stage_id, leg, team_a_id, team_b_id, match_date, status")
        .in("tournament_id", batch)
        .order("id", { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) break;
      matches.push(...(data as PreflightMatchRow[]));
      if (data.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
  }

  const today = todayIso();
  const { past, future } = unfinishedMatchBuckets(matches, today);
  const unfinished = [...past, ...future];
  const finishedMatches = matches.length - unfinished.length;
  const openTours = tours.filter((t) => isOpenTournamentStatus(t.status));

  const [{ count: teams }, { count: statsRows }, { count: standingsRows }, recapRes, names, kinds] =
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
      teamNamesById(
        positiveIds([
          ...unfinished.flatMap((m) => [m.team_a_id, m.team_b_id]),
          ...openTours.map((t) => t.winner_team_id),
        ]),
      ),
      stageKindsById(positiveIds(unfinished.map((m) => m.stage_id))),
    ]);

  const teamName = (id: number | null) => (id == null ? "TBD" : names.get(id) ?? `Ομάδα #${id}`);
  const tourName = new Map(tours.map((t) => [t.id, (t.name ?? "").trim() || `Τουρνουά #${t.id}`]));
  const pastIds = new Set(past.map((m) => m.id));
  // Dated matches chronologically, undated ones last, ids as the tie-break.
  const byDate = (a: PreflightMatchRow, b: PreflightMatchRow) => {
    if (a.match_date == null || b.match_date == null) {
      return (a.match_date == null ? 1 : 0) - (b.match_date == null ? 1 : 0) || a.id - b.id;
    }
    return a.match_date.localeCompare(b.match_date) || a.id - b.id;
  };
  const unfinishedMatches: PreflightMatch[] = [...[...past].sort(byDate), ...[...future].sort(byDate)].map(
    (m) => ({
      id: m.id,
      tournament_id: m.tournament_id,
      tournament_name:
        m.tournament_id == null ? "—" : tourName.get(m.tournament_id) ?? `Τουρνουά #${m.tournament_id}`,
      stage_kind: (m.stage_id == null ? null : kinds.get(m.stage_id)) ?? null,
      leg: m.leg,
      team_a_id: m.team_a_id,
      team_b_id: m.team_b_id,
      team_a_name: teamName(m.team_a_id),
      team_b_name: teamName(m.team_b_id),
      match_date: m.match_date,
      status: m.status === "postponed" ? "postponed" : "scheduled",
      past: pastIds.has(m.id),
    }),
  );

  const perTour = new Map<number, { total: number; finished: number }>();
  for (const m of matches) {
    if (m.tournament_id == null) continue;
    const e = perTour.get(m.tournament_id) ?? { total: 0, finished: 0 };
    e.total += 1;
    if (m.status === "finished") e.finished += 1;
    perTour.set(m.tournament_id, e);
  }
  const openTournaments: PreflightTournament[] = openTours.map((t) => ({
    id: t.id,
    name: tourName.get(t.id) ?? `Τουρνουά #${t.id}`,
    status: t.status,
    matches: perTour.get(t.id)?.total ?? 0,
    finished: perTour.get(t.id)?.finished ?? 0,
    winner_team_id: t.winner_team_id,
    winner_name: t.winner_team_id == null ? null : teamName(t.winner_team_id),
  }));

  const unfinishedPast = past.length;
  const unfinishedFuture = future.length;
  const tournamentsOpen = openTournaments.length;

  const blockers: string[] = [];
  const warnings: string[] = [];
  if (unfinishedPast > 0) {
    blockers.push(
      `${unfinishedPast} αγώνες με παρελθούσα ημερομηνία δεν έχουν ολοκληρωθεί — αν δεν παίχτηκαν, σβήσε τις ημερομηνίες τους παρακάτω· αλλιώς ολοκλήρωσε, κατακύρωσε ή ανέβαλέ τους (ή κλείσε με «παράβλεψη»).`,
    );
  }
  if (tournamentsOpen > 0) {
    warnings.push(
      `${tournamentsOpen} τουρνουά της σεζόν δεν είναι σε κατάσταση completed/archived· η κατάσταση ΔΕΝ αλλάζει αυτόματα και δεν επηρεάζει πόντους ή στατιστικά.`,
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
    unfinishedMatches,
    openTournaments,
    info: {
      tournaments: tours.length,
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
    const refusal = pointerWriteRefusal();
    if (refusal) return { success: false, error: refusal };

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

    // 2) Flip the pointer in ONE transaction (migrations/add-season-flip-fn.sql):
    //    the next row is created as needed, the current one archived with
    //    ended_on, the next activated. Readers never observe zero active rows
    //    and a concurrent close fails cleanly on the one-active index.
    const { error: flipErr } = await supabaseAdmin.rpc("flip_active_season", {
      p_current: currentLabel,
      p_next: nextLabel,
      p_next_display: nextDisplay,
      p_next_started_on: input.nextStartedOn || todayIso(),
      p_actor: user.id,
    });
    if (flipErr) {
      return { success: false, error: `Αλλαγή ενεργής σεζόν: ${describeRpcError(flipErr, "flip_active_season")}` };
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
 * One transaction (set_active_season in migrations/add-season-flip-fn.sql).
 */
export async function setActiveSeason(label: string): Promise<Result<{ previous: string | null }>> {
  try {
    const user = await requireAdminUser();
    if (!user) return { success: false, error: "Unauthorized" };
    const refusal = pointerWriteRefusal();
    if (refusal) return { success: false, error: refusal };
    const target = await getSeasonByLabel(label);
    if (!target) return { success: false, error: "Άγνωστη σεζόν." };

    const { data, error } = await supabaseAdmin.rpc("set_active_season", {
      p_label: label,
      p_actor: user.id,
    });
    if (error) return { success: false, error: describeRpcError(error, "set_active_season") };
    const previous = ((data as { previous?: string | null } | null)?.previous ?? null) as string | null;

    revalidateSeasonSurfaces(label, ...(previous ? [previous] : []));
    revalidateAdmin(label, ...(previous ? [previous] : []));
    return { success: true, previous };
  } catch (err) {
    console.error("[setActiveSeason] error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ─── Preflight fixes ───────────────────────────────────────────────────────
// Match fixes from the close sheet reuse the existing writers (PATCH
// /api/matches/[id], POST /api/matches/[id]/postpone, awardForfeitWinAction)
// so every rule — KO winners, two-legged ties, progression, standings
// refresh — stays in one place. Only the tournament status has no
// lightweight writer, hence this action.

/**
 * Mark one of `seasonLabel`'s tournaments completed. Status is informational
 * (never read by the points engine or the stats pipeline), so no snapshot
 * runs; public tournament pages are revalidated because they print it.
 */
export async function completeTournament(input: {
  tournamentId: number;
  seasonLabel: string;
}): Promise<Result<{ status: "completed" }>> {
  try {
    if (!(await requireAdminUser())) return { success: false, error: "Unauthorized" };
    const id = Number(input.tournamentId);
    if (!Number.isInteger(id) || id <= 0) return { success: false, error: "Άκυρο τουρνουά." };

    const { data: t, error } = await supabaseAdmin
      .from("tournaments")
      .select("id, season, status")
      .eq("id", id)
      .maybeSingle();
    if (error) return { success: false, error: error.message };
    if (!t) return { success: false, error: "Άγνωστο τουρνουά." };
    if (t.season !== input.seasonLabel) {
      return { success: false, error: `Το τουρνουά #${t.id} δεν ανήκει στη σεζόν ${input.seasonLabel}.` };
    }

    if (isOpenTournamentStatus(t.status as string)) {
      const { error: upErr } = await supabaseAdmin
        .from("tournaments")
        .update({ status: "completed" })
        .eq("id", t.id);
      if (upErr) return { success: false, error: upErr.message };
    }

    revalidateTournamentSurfaces(t.id);
    revalidatePath("/");
    revalidateAdmin(input.seasonLabel);
    return { success: true, status: "completed" };
  } catch (err) {
    console.error("[completeTournament] error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * Forgotten fixtures: matches that were never played and never will be.
 * Clears match_date (the original is kept in original_match_date, the column
 * postponement already uses) so the match stops blocking the close. Status is
 * untouched, no announcement is posted, no result is invented; standings,
 * progression and player stats are unaffected. Only non-finished, dated
 * matches of `seasonLabel`'s tournaments qualify — anything else is skipped.
 */
export async function clearMatchDates(input: {
  seasonLabel: string;
  matchIds: number[];
}): Promise<Result<{ cleared: number; skipped: number }>> {
  try {
    if (!(await requireAdminUser())) return { success: false, error: "Unauthorized" };
    const ids = positiveIds(input.matchIds ?? []);
    if (ids.length === 0) return { success: true, cleared: 0, skipped: 0 };
    const seasonTournaments = new Set(await listTournamentIdsForSeason(input.seasonLabel));

    type Row = {
      id: number;
      tournament_id: number | null;
      status: string | null;
      match_date: string | null;
      original_match_date: string | null;
      team_a_id: number | null;
      team_b_id: number | null;
    };
    const rows: Row[] = [];
    for (const batch of chunk(ids, 300)) {
      const { data, error } = await supabaseAdmin
        .from("matches")
        .select("id, tournament_id, status, match_date, original_match_date, team_a_id, team_b_id")
        .in("id", batch);
      if (error) return { success: false, error: error.message };
      rows.push(...((data ?? []) as Row[]));
    }

    const eligible = rows.filter(
      (r) =>
        r.tournament_id != null &&
        seasonTournaments.has(r.tournament_id) &&
        r.status !== "finished" &&
        r.match_date != null,
    );

    let cleared = 0;
    for (const r of eligible) {
      const { error } = await supabaseAdmin
        .from("matches")
        .update({ match_date: null, original_match_date: r.original_match_date ?? r.match_date })
        .eq("id", r.id);
      if (error) {
        return {
          success: false,
          error: `Αγώνας #${r.id}: ${error.message} (${cleared} από ${eligible.length} καθαρίστηκαν πριν το σφάλμα).`,
        };
      }
      cleared += 1;
      // The date is printed on the home calendar, /matches, the match page,
      // the tournament pages and both team pages.
      revalidateMatchSurfaces({
        id: r.id,
        tournament_id: r.tournament_id,
        team_a_id: r.team_a_id,
        team_b_id: r.team_b_id,
      });
    }

    revalidatePath("/dashboard/matches");
    revalidateAdmin(input.seasonLabel);
    return { success: true, cleared, skipped: ids.length - cleared };
  } catch (err) {
    console.error("[clearMatchDates] error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
