// app/tournoua/[slug]/fixtures/page.tsx
import { getStagesAndGroups, getTournamentBySlug } from "@/app/lib/repos/tournaments";
import { createSupabaseRSCClient } from "@/app/lib/supabaseServer";
import FixturesByMatchday from "../components/FixturesByMatchday";

export const revalidate = 60;

type Ctx = {
  // Next.js 15: both are Promises
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ [k: string]: string | string[] | undefined }>;
};

export default async function FixturesPage({ params, searchParams }: Ctx) {
  const { slug } = await params;
  const sp = (await searchParams) ?? {};

  const [t, sg] = await Promise.all([getTournamentBySlug(slug), getStagesAndGroups(slug)]);
  if (!t) return <div className="p-6">Δεν βρέθηκε το τουρνουά.</div>;

  const pick = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;

  const stageId = Number(pick(sp.stage_id) ?? sg.stages[0]?.id ?? 0);
  const groupId = Number(pick(sp.group_id) ?? 0);
  const matchdayStr = pick(sp.matchday);
  const matchday =
    matchdayStr != null && matchdayStr !== "" && !Number.isNaN(Number(matchdayStr))
      ? Number(matchdayStr)
      : undefined;

  const s = await createSupabaseRSCClient();

  let q = s
    .from("matches")
    .select(
      "id,match_date,team_a_id,team_b_id,team_a_score,team_b_score,status,matchday,round,bracket_pos"
    )
    .eq("tournament_id", t.id)
    .eq("stage_id", stageId)
    .order("matchday", { ascending: true })
    .order("match_date", { ascending: true });

  if (groupId) q = q.eq("group_id", groupId);
  if (typeof matchday === "number") q = q.eq("matchday", matchday);

  const { data: matches } = await q;

  const teamIds = Array.from(
    new Set((matches ?? []).flatMap((m: any) => [m.team_a_id, m.team_b_id]).filter(Boolean))
  );
  const { data: teams } = teamIds.length
    ? await s.from("teams").select("id,name").in("id", teamIds)
    : { data: [] as any[] };
  const teamsMap = Object.fromEntries((teams ?? []).map((t: any) => [t.id, { name: t.name }]));

  return (
    <div className="px-6 py-6">
      <FixturesByMatchday matches={(matches ?? []) as any} teams={teamsMap} />
    </div>
  );
}
