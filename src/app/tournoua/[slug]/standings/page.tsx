// app/tournoua/[slug]/standings/page.tsx
import { getStandingsForSlug, getStagesAndGroups } from "@/app/lib/repos/tournaments";
import { createSupabaseRSCClient } from "@/app/lib/supabaseServer";
import StandingsTable from "../components/StandingsTable";

export const revalidate = 60;

type Ctx = {
  // Next.js 15: both are Promises on pages
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ [k: string]: string | string[] | undefined }>;
};

export default async function StandingsPage({ params, searchParams }: Ctx) {
  const { slug } = await params;
  const sp = (await searchParams) ?? {};
  const pick = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const sg = await getStagesAndGroups(slug);
  const stageId = Number(pick(sp.stage_id) ?? sg.stages[0]?.id ?? 0);
  const groupId = Number(pick(sp.group_id) ?? 0);

  const rows = await getStandingsForSlug(slug, { stageId, groupId });

  // Map team_id -> team meta for names/logos
  const s = await createSupabaseRSCClient();
  const teamIds = Array.from(new Set(rows.map((r: any) => r.team_id)));
  const { data: teams } = teamIds.length
    ? await s.from("teams").select("id,name,logo").in("id", teamIds)
    : { data: [] as any[] };

  const teamsMap = Object.fromEntries(
    (teams ?? []).map((t: any) => [t.id, { name: t.name, logo: t.logo }])
  );

  return (
    <div className="px-6 py-6">
      <StandingsTable rows={rows as any} teams={teamsMap} />
    </div>
  );
}
