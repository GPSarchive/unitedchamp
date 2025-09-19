// app/tournoua/[slug]/teams/page.tsx
import { getTournamentBySlug, getStagesAndGroups } from "@/app/lib/repos/tournaments";
import { createSupabaseRSCClient } from "@/app/lib/supabase/supabaseServer";

import TeamsLeague from "../components/teams/leauge/TeamsLeague";
import TeamsGroups from "../components/teams/groups/TeamsGroups";
import TeamsKnockout from "../components/teams/TeamsKnockout";

export const revalidate = 60;

type UiTeam = {
  id: number;
  name: string;
  logo?: string | null;
  seed?: number | null;
  group_id?: number | null;
};

type Ctx = { params: Promise<{ slug: string }> }; // Next.js 15: params is a Promise

export default async function TournamentTeamsPage({ params }: Ctx) {
  const { slug } = await params;

  const [t, sg] = await Promise.all([getTournamentBySlug(slug), getStagesAndGroups(slug)]);
  if (!t) return <div className="p-6">Δεν βρέθηκε το τουρνουά.</div>;

  const s = await createSupabaseRSCClient();
  const { data } = await s
    .from("tournament_teams")
    .select("id, seed, group_id, teams:team_id(id,name,logo)")
    .eq("tournament_id", t.id)
    .order("seed", { ascending: true })
    .order("id", { ascending: true });

  const teams: UiTeam[] = (data ?? []).map((row: any) => ({
    id: row.teams?.id,
    name: row.teams?.name ?? "—",
    logo: row.teams?.logo ?? null,
    seed: row.seed ?? null,
    group_id: row.group_id ?? null,
  }));

  // helpers for groups layout
  const groupsStage = sg.stages.find((x: any) => x.kind === "groups");
  const groups = groupsStage ? sg.groupsByStage[groupsStage.id] ?? [] : [];

  return (
    <div className="px-6 py-6 space-y-6">
      {t.format === "groups" && groupsStage ? (
        <TeamsGroups groups={groups} teams={teams} />
      ) : t.format === "knockout" ? (
        <TeamsKnockout teams={teams} title="Bracket seeds" />
      ) : t.format === "mixed" ? (
        <>
          {groupsStage && <TeamsGroups groups={groups} teams={teams} title="Group Stage" />}
          <TeamsKnockout teams={teams} title="Knockout seeds" />
        </>
      ) : (
        // default: league or unknown → simple grid
        <TeamsLeague teams={teams} />
      )}

      {(teams ?? []).length === 0 && (
        <div className="text-white/60">Καμία ομάδα καταχωρημένη ακόμα.</div>
      )}
    </div>
  );
}
