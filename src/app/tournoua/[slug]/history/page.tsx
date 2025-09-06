// app/tournoua/[slug]/history/page.tsx
import { getTournamentBySlug } from "@/app/lib/repos/tournaments";
import { createSupabaseRSCClient } from "@/app/lib/supabaseServer";

export const revalidate = 300;

type Ctx = {
  params: Promise<{ slug: string }>; // Next.js 15: params is a Promise
};

export default async function TournamentHistoryPage({ params }: Ctx) {
  const { slug } = await params;

  const t = await getTournamentBySlug(slug);
  if (!t) return <div className="p-6">Δεν βρέθηκε το τουρνουά.</div>;

  const s = await createSupabaseRSCClient();
  const [{ data: awards }, { data: winner }] = await Promise.all([
    s.from("tournament_awards").select("*").eq("tournament_id", t.id).maybeSingle(),
    t.winner_team_id
      ? s.from("teams").select("id,name,logo").eq("id", t.winner_team_id).maybeSingle()
      : Promise.resolve({ data: null as any }),
  ]);

  // Resolve player names for awards
  const playerIds = [awards?.top_scorer_id, awards?.mvp_player_id, awards?.best_gk_player_id].filter(
    Boolean
  ) as number[];
  const { data: players } = playerIds.length
    ? await s.from("player").select("id,first_name,last_name").in("id", playerIds)
    : { data: [] as any[] };

  const pname = (id?: number | null) => {
    const p = players?.find((x: any) => x.id === id);
    return p ? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() : null;
    };

  return (
    <div className="px-6 py-8 space-y-6">
      <section className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h3 className="text-lg font-semibold mb-2">Νικήτρια Ομάδα</h3>
        {winner ? <div className="text-white/90">{winner.name}</div> : <div className="text-white/60">—</div>}
      </section>

      <section className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h3 className="text-lg font-semibold mb-2">Βραβεία / Μονολεκτικά στατιστικά</h3>
        <ul className="space-y-1 text-sm">
          <li>
            <span className="text-white/70">Top Scorer: </span>
            <span className="font-medium">{pname(awards?.top_scorer_id) ?? "—"}</span>
            {awards?.top_scorer_goals != null && (
              <span className="text-white/60"> ({awards.top_scorer_goals} γκολ)</span>
            )}
          </li>
          <li>
            <span className="text-white/70">MVP: </span>
            <span className="font-medium">{pname(awards?.mvp_player_id) ?? "—"}</span>
          </li>
          <li>
            <span className="text-white/70">Καλύτερος Τερματοφύλακας: </span>
            <span className="font-medium">{pname(awards?.best_gk_player_id) ?? "—"}</span>
          </li>
        </ul>
      </section>
    </div>
  );
}
