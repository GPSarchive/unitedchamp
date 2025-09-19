// app/tournoua/[slug]/bracket/page.tsx
import { getStagesAndGroups, getTournamentBySlug } from "@/app/lib/repos/tournaments";
import { createSupabaseRSCClient } from "@/app/lib/supabase/supabaseServer";
import BracketTree from "../components/BracketTree";

export const revalidate = 60;

type Ctx = {
  params: Promise<{ slug: string }>; // Next.js 15: params is a Promise
  searchParams?: Promise<{ [k: string]: string | string[] | undefined }>; // ...and so is searchParams
};

export default async function BracketPage({ params, searchParams }: Ctx) {
  const { slug } = await params;
  const sp = (await searchParams) ?? {};

  const [t, sg] = await Promise.all([getTournamentBySlug(slug), getStagesAndGroups(slug)]);
  if (!t) return <div className="p-6">Δεν βρέθηκε το τουρνουά.</div>;

  const knockoutStage = sg.stages.find((s: any) => s.kind === "knockout");
  const stageParam = sp.stage_id;
  const stageFromQuery =
    Array.isArray(stageParam) ? stageParam[0] : stageParam; // handle string[]
  const stageId = Number(stageFromQuery ?? knockoutStage?.id ?? 0);

  const s = await createSupabaseRSCClient();
  const { data: matches } = await s
    .from("matches")
    .select("id,team_a_id,team_b_id,team_a_score,team_b_score,status,round,bracket_pos")
    .eq("tournament_id", t.id)
    .eq("stage_id", stageId)
    .order("round", { ascending: true })
    .order("bracket_pos", { ascending: true });

  const teamIds = Array.from(
    new Set((matches ?? []).flatMap((m: any) => [m.team_a_id, m.team_b_id]).filter(Boolean))
  );
  const { data: teams } = teamIds.length
    ? await s.from("teams").select("id,name").in("id", teamIds)
    : { data: [] as any[] };
  const teamsMap = Object.fromEntries((teams ?? []).map((t: any) => [t.id, { name: t.name }]));

  return (
    <div className="px-6 py-6">
      {!matches || matches.length === 0 ? (
        <div className="text-white/60">Δεν υπάρχει πρόγραμμα Bracket για αυτό το stage.</div>
      ) : (
        <BracketTree matches={(matches ?? []) as any} teams={teamsMap} />
      )}
    </div>
  );
}
