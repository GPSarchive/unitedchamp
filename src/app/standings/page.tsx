// app/standings/page.tsx
// or app/tournoua/[slug]/standings/page.tsx (works the same)
import Image from "next/image";
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import { createSupabaseRSCClient } from "@/app/lib/supabase/supabaseServer";

export const revalidate = 60;

type Ctx = {
  params?: Promise<{ slug: string }>;
  searchParams?: Promise<{ [k: string]: string | string[] | undefined }>;
};

type TeamRow = {
  id: number;
  name: string | null;
  logo: string | null;
  deleted_at: string | null;
  season_score: number | null;
};

export default async function StandingsPage({ params, searchParams }: Ctx) {
  const slug = (await params)?.slug;
  const sp = (await searchParams) ?? {};
  const pick = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  // Season label ONLY (no filtering by it) — same season for all teams.
  let seasonLabel = (pick(sp.season) ?? "").toString().trim();
  if (!seasonLabel && slug) {
    const s = await createSupabaseRSCClient();
    const { data: t } = await s.from("tournaments").select("season").eq("slug", slug).single();
    seasonLabel = (t?.season ?? "").toString().trim();
  }
  if (!seasonLabel) seasonLabel = "Τρέχουσα";

  // Pull all non-deleted teams with their general season_score
  const { data: teams, error } = await supabaseAdmin
    .from("teams")
    .select("id, name, logo, deleted_at, season_score")
    .is("deleted_at", null);

  if (error) {
    console.error("[standings] teams query error:", error.message);
  }

  const rows = (teams ?? []) as TeamRow[];

  // Enrich & sort by season_score desc, then name asc
  const enriched = rows.map((t) => ({
    team_id: t.id,
    team: { name: t.name ?? `Team #${t.id}`, logo: t.logo ?? null },
    points: Number.isFinite(t.season_score as number) ? (t.season_score as number) : 0,
  }));

  enriched.sort(
    (a, b) =>
      b.points - a.points || a.team.name.localeCompare(b.team.name)
  );

  // Dense rank by points
  let lastPts: number | null = null;
  let rank = 0;
  const ranked = enriched.map((row) => {
    if (lastPts === null || row.points !== lastPts) {
      rank += 1;
      lastPts = row.points;
    }
    return { ...row, rank };
  });

  // Simple prize set (edit freely)
  const prizes: Record<number, { title: string; perk: string }> = {
    1: { title: "🥇 Πρωτιά", perk: "Free Entry + VIP kit" },
    2: { title: "🥈 Δεύτερη θέση", perk: "50% έκπτωση συμμετοχής" },
    3: { title: "🥉 Τρίτη θέση", perk: "Priority scheduling" },
  };

  return (
    <div className="min-h-[100svh] bg-black px-6 py-6 space-y-6">
      <header className="flex flex-col md:flex-row md:items-end gap-2 md:gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-white">Γενική Κατάταξη</h1>
          <p className="text-white/70">
            Σεζόν: <span className="text-white">{seasonLabel}</span> • Ενιαίο point-system για όλες τις ομάδες.
          </p>
        </div>

        {/* Optional season label override (display-only) */}
        <form className="flex items-center gap-2" method="get">
          <input
            type="text"
            name="season"
            placeholder="season (π.χ. 2024/25)"
            defaultValue={seasonLabel}
            className="bg-slate-950 border border-white/15 rounded-md px-3 py-2 text-white text-sm"
          />
          <button className="px-3 py-2 rounded-md border border-cyan-400/30 text-cyan-200 hover:bg-cyan-500/10">
            Ενημέρωση ετικέτας
          </button>
        </form>
      </header>

      {/* PRIZES */}
      <section className="rounded-xl border border-amber-400/30 bg-gradient-to-br from-yellow-900/30 via-amber-800/20 to-amber-900/30 p-4">
        <h2 className="text-lg font-semibold text-amber-200 mb-3">Έπαθλα / Παροχές</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {Object.entries(prizes).map(([place, p]) => (
            <div
              key={place}
              className="rounded-lg border border-white/10 bg-white/5 p-3 flex flex-col items-start gap-1"
            >
              <div className="text-white/80 font-medium">
                Θέση {place}: <span className="text-white">{p.title}</span>
              </div>
              <div className="text-white/70 text-sm">{p.perk}</div>
            </div>
          ))}
        </div>
        <p className="text-[12px] text-white/60 mt-2">
          * Η κατάταξη βασίζεται αποκλειστικά στο <code>teams.season_score</code>.
        </p>
      </section>

      {/* TABLE */}
      <section className="rounded-xl border border-white/10 bg-white/[0.03]">
        <div className="px-3 py-2 border-b border-white/10 text-white/80 text-sm">
          {ranked.length} ομάδες
        </div>

        {ranked.length === 0 ? (
          <div className="p-4 text-white/60">Δεν υπάρχουν ομάδες.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-zinc-900/60 text-white">
                <tr>
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Ομάδα</th>
                  <th className="px-3 py-2 text-right">Βαθμοί</th>
                  <th className="px-3 py-2 text-left">Έπαθλο</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((r) => {
                  const prize = prizes[r.rank];
                  return (
                    <tr key={r.team_id} className="odd:bg-zinc-950/50 even:bg-zinc-900/40">
                      <td className="px-3 py-2 tabular-nums text-white/90">{r.rank}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          {r.team.logo ? (
                            <Image
                              src={r.team.logo}
                              alt={r.team.name}
                              width={22}
                              height={22}
                              className="rounded-sm object-cover"
                            />
                          ) : (
                            <div className="w-[22px] h-[22px] rounded-sm bg-white/10" />
                          )}
                          <span className="text-white">{r.team.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right text-white tabular-nums font-medium">
                        {r.points}
                      </td>
                      <td className="px-3 py-2">
                        {prize ? (
                          <span className="inline-flex items-center rounded-md border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-amber-100 text-[12px]">
                            {prize.title}
                          </span>
                        ) : (
                          <span className="text-white/50 text-[12px]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
