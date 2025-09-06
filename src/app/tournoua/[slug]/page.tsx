// app/tournoua/[slug]/teams/page.tsx
import { getTournamentBySlug, getStagesAndGroups } from "@/app/lib/repos/tournaments";
import { createSupabaseRSCClient } from "@/app/lib/supabaseServer";

import TeamsLeagueList from "./components/teams/TeamsLeagueList";
import TeamsGroupsWithMatches from "./components/teams/TeamsGroupsWithMatches";
import ModernKnockoutTree from "./components/teams/ModernKnockoutTree";

export const revalidate = 60;

type UiTeam = { id: number; name: string; logo?: string | null; seed?: number | null; group_id?: number | null };

type Ctx = { params: Promise<{ slug: string }> }; // ← Next 15: params is a Promise

export default async function TournamentTeamsPage({ params }: Ctx) {
  const { slug } = await params; // ← await it

  const [t, sg] = await Promise.all([getTournamentBySlug(slug), getStagesAndGroups(slug)]);
  if (!t) return <div className="p-6">Δεν βρέθηκε το τουρνουά.</div>;

  const s = await createSupabaseRSCClient();

  // All registered teams
  const { data: regs } = await s
    .from("tournament_teams")
    .select("id, seed, group_id, teams:team_id(id,name,logo)")
    .eq("tournament_id", t.id)
    .order("seed", { ascending: true })
    .order("id", { ascending: true });

  const teams: UiTeam[] = (regs ?? []).map((row: any) => ({
    id: row.teams?.id,
    name: row.teams?.name ?? "—",
    logo: row.teams?.logo ?? null,
    seed: row.seed ?? null,
    group_id: row.group_id ?? null,
  }));

  const teamsMap = Object.fromEntries(
    teams.map((tm) => [tm.id, { name: tm.name, logo: tm.logo, seed: tm.seed }])
  );

  // figure out stages by kind
  const leagueStage   = sg.stages.find((x: any) => x.kind === "league");
  const groupsStage   = sg.stages.find((x: any) => x.kind === "groups");
  const knockoutStage = sg.stages.find((x: any) => x.kind === "knockout");

  // fetch matches per needed stage(s)
  const [groupMatches, koMatches] = await Promise.all([
    groupsStage
      ? s.from("matches")
          .select("id,group_id,matchday,match_date,team_a_id,team_b_id,team_a_score,team_b_score,status")
          .eq("tournament_id", t.id)
          .eq("stage_id", groupsStage.id)
          .order("matchday", { ascending: true })
          .order("match_date", { ascending: true })
          .then(({ data }) => data ?? [])
      : Promise.resolve([]),
    knockoutStage
      ? s.from("matches")
          .select("id,round,bracket_pos,team_a_id,team_b_id,team_a_score,team_b_score,status,home_source_match_id,away_source_match_id")
          .eq("tournament_id", t.id)
          .eq("stage_id", knockoutStage.id)
          .order("round", { ascending: true })
          .order("bracket_pos", { ascending: true })
          .then(({ data }) => data ?? [])
      : Promise.resolve([]),
  ]);

  return (
    <div className="px-6 py-6 space-y-10">
      {t.format === "groups" && groupsStage ? (
        <TeamsGroupsWithMatches
          title="Όμιλοι"
          groups={sg.groupsByStage[groupsStage.id] ?? []}
          teams={teams}
          matches={groupMatches}
          teamsMap={teamsMap}
        />
      ) : t.format === "knockout" && knockoutStage ? (
        <ModernKnockoutTree
          title="Bracket"
          matches={koMatches as any}
          teamsMap={teamsMap as any}
        />
      ) : t.format === "mixed" ? (
        <>
          {groupsStage && (
            <TeamsGroupsWithMatches
              title="Group Stage"
              groups={sg.groupsByStage[groupsStage.id] ?? []}
              teams={teams}
              matches={groupMatches}
              teamsMap={teamsMap}
            />
          )}
          {knockoutStage && (
            <ModernKnockoutTree
              title="Knockout Bracket"
              matches={koMatches as any}
              teamsMap={teamsMap as any}
            />
          )}
          {!groupsStage && !knockoutStage && <TeamsLeagueList teams={teams} title="Ομάδες" />}
        </>
      ) : (
        <TeamsLeagueList teams={teams} title={leagueStage ? "Ομάδες" : "Ομάδες"} />
      )}

      {(teams ?? []).length === 0 && (
        <div className="text-white/60">Καμία ομάδα καταχωρημένη ακόμα.</div>
      )}
    </div>
  );
}
