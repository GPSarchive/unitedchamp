// app/tournoua/[slug]/players/page.tsx
import { getTournamentBySlug } from "@/app/lib/repos/tournaments";
import { createSupabaseRSCClient } from "@/app/lib/supabaseServer";
import PlayerRow from "../components/PlayerRow";

export const revalidate = 60;

type Ctx = {
  // Next.js 15: both params and searchParams are Promises on pages
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ [k: string]: string | string[] | undefined }>;
};

export default async function TournamentPlayersPage({ params, searchParams }: Ctx) {
  const { slug } = await params;
  const sp = (await searchParams) ?? {};
  const pick = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  // goals|assists|mvp_count|best_gk_count|yellow_cards|red_cards|blue_cards
  const sort = (pick(sp.sort) ?? "goals") as string;

  const t = await getTournamentBySlug(slug);
  if (!t) return <div className="p-6">Δεν βρέθηκε το τουρνουά.</div>;

  const s = await createSupabaseRSCClient();
  const { data: stats } = await s
    .from("v_tournament_player_stats")
    .select("*")
    .eq("tournament_id", t.id)
    .order(sort as any, { ascending: false })
    .limit(200);

  const playerIds = Array.from(new Set((stats ?? []).map((r: any) => r.player_id)));
  const { data: players } = playerIds.length
    ? await s.from("player").select("id,first_name,last_name").in("id", playerIds)
    : { data: [] as any[] };
  const byId = Object.fromEntries((players ?? []).map((p: any) => [p.id, p]));

  const headers = [
    ["goals", "Goals"],
    ["assists", "Assists"],
    ["mvp_count", "MVP"],
    ["best_gk_count", "Best GK"],
    ["yellow_cards", "Yellow"],
    ["red_cards", "Red"],
    ["blue_cards", "Blue"],
  ] as const;

  return (
    <div className="px-6 py-6">
      <div className="flex gap-2 mb-4 text-sm">
        {headers.map(([key, label]) => (
          <a
            key={key}
            href={`?sort=${key}`}
            className={`px-2 py-1 rounded border ${
              sort === key ? "border-white/80" : "border-white/20 hover:bg-white/10"
            }`}
          >
            {label}
          </a>
        ))}
      </div>

      <table className="w-full text-sm border-separate border-spacing-y-2">
        <thead className="text-white/70">
          <tr>
            <th className="text-left px-2">Παίκτης</th>
            {headers.map(([key, label]) => (
              <th key={key} className={`text-right px-2 ${sort === key ? "underline" : ""}`}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(stats ?? []).map((r: any) => (
            <PlayerRow
              key={r.player_id}
              player={{
                id: r.player_id,
                first_name: byId[r.player_id]?.first_name,
                last_name: byId[r.player_id]?.last_name,
              }}
              stats={r}
            />
          ))}
          {(!stats || stats.length === 0) && (
            <tr>
              <td colSpan={headers.length + 1} className="px-2 py-4 text-center text-white/60">
                Δεν υπάρχουν στατιστικά.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
