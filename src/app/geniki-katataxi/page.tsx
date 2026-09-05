// app/geniki-katataxi/page.tsx
// Γενική Κατάταξη — the ACTIVE season's overall team standings, read from the
// stored season_team_standings rows (written by lib/refreshStandings.ts at
// every points-affecting mutation) and rendered by ./StandingsViewGrand.
// Static ISR page: no searchParams, no per-visit compute. Mutations call
// revalidateStandingsSurfaces() after refreshing the rows.
import type { Metadata } from "next";
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import { getActiveSeasonCached, NO_SEASON } from "@/app/lib/seasonScope";
import { getSeasonStandings } from "@/app/lib/refreshStandings";
import StandingsViewGrand, { type TeamInfo } from "./StandingsViewGrand";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Γενική Κατάταξη",
  description: "Η γενική κατάταξη των ομάδων της σεζόν, με ενιαίο σύστημα πόντων.",
};

export default async function GenikiKataxiPage() {
  const active = await getActiveSeasonCached();

  const [rows, teamsRes] = await Promise.all([
    active ? getSeasonStandings(active.label) : Promise.resolve([]),
    // The active season's teams, soft-deleted ones excluded: a disbanded team
    // stops appearing and the ranks close up (their stored rows stay for the
    // archive, which shows every team of the season). The team page ranks
    // with exactly this set — see standingsShape.rankVisible.
    supabaseAdmin
      .from("teams")
      .select("id, name, logo")
      .eq("season_label", active?.label ?? NO_SEASON)
      .is("deleted_at", null),
  ]);
  if (teamsRes.error) throw new Error(`[geniki-katataxi] teams: ${teamsRes.error.message}`);

  return (
    <StandingsViewGrand
      seasonDisplay={active?.display_label ?? "—"}
      rows={rows}
      teams={(teamsRes.data ?? []) as TeamInfo[]}
      archiveHref="/seasons"
    />
  );
}
