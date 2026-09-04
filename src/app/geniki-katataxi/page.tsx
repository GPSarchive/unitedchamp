// app/geniki-katataxi/page.tsx
// Γενική Κατάταξη — the ACTIVE season's overall team standings, read from the
// stored season_team_standings rows (written by lib/refreshStandings.ts at
// every points-affecting mutation) and rendered by ./StandingsViewGrand.
// Static ISR page: no searchParams, no per-visit compute. Mutations call
// revalidateStandingsSurfaces() after refreshing the rows.
import type { Metadata } from "next";
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import { getActiveSeason } from "@/app/lib/seasons";
import { getSeasonStandings } from "@/app/lib/refreshStandings";
import StandingsViewGrand, { type TeamInfo } from "./StandingsViewGrand";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Γενική Κατάταξη",
  description: "Η γενική κατάταξη των ομάδων της σεζόν, με ενιαίο σύστημα πόντων.",
};

export default async function GenikiKataxiPage() {
  const active = await getActiveSeason();

  const [rows, teamsRes] = await Promise.all([
    active ? getSeasonStandings(active.label) : Promise.resolve([]),
    // Active teams only — soft-deleted (deleted_at set) teams are excluded so a
    // disbanded team stops appearing; their stored rows stay for the archive.
    // (Phase 4 narrows this to teams.season_label = active as well.)
    supabaseAdmin.from("teams").select("id, name, logo").is("deleted_at", null),
  ]);
  if (teamsRes.error) throw new Error(`[geniki-katataxi] teams: ${teamsRes.error.message}`);

  return (
    <StandingsViewGrand
      seasonDisplay={active?.display_label ?? "—"}
      rows={rows}
      teams={(teamsRes.data ?? []) as TeamInfo[]}
    />
  );
}
