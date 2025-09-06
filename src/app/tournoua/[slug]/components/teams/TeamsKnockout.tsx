// app/tournoua/[slug]/components/teams/TeamsKnockout.tsx
import TeamCard from "../TeamCard";

type UiTeam = { id: number; name: string; logo?: string | null; seed?: number | null };

function seedOrFallback(a?: number | null, b?: number | null) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a - b;
}

export default function TeamsKnockout({
  teams,
  title = "Seeds",
}: {
  teams: UiTeam[];
  title?: string;
}) {
  // order by seed; if empty seeds, fall back to name
  const seeded = [...teams].sort((x, y) => {
    const s = seedOrFallback(x.seed, y.seed);
    if (s !== 0) return s;
    return x.name.localeCompare(y.name);
  });

  // build simple “top vs bottom” pairs (1vN, 2vN-1, ...)
  const pairs: { a: UiTeam; b: UiTeam }[] = [];
  for (let i = 0, j = seeded.length - 1; i < j; i++, j--) {
    pairs.push({ a: seeded[i], b: seeded[j] });
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">{title}</h2>

      {/* Seeded list */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {seeded.map((t) => (
          <TeamCard
            key={t.id}
            team={{ id: t.id, name: t.name, logo: t.logo }}
            seed={t.seed ?? undefined}
          />
        ))}
      </div>

      {/* Visual pairings */}
      {pairs.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-medium mb-2">Seeded Pairings</h3>
          <div className="space-y-2">
            {pairs.map((p, i) => (
              <div key={i} className="rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="text-sm flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-white/60">QF {i + 1}</span>
                    <span className="px-2 py-0.5 text-xs rounded-full border border-white/20">
                      #{p.a.seed ?? "—"}
                    </span>
                    <span className="font-medium">{p.a.name}</span>
                  </div>
                  <div className="text-white/60">vs</div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{p.b.name}</span>
                    <span className="px-2 py-0.5 text-xs rounded-full border border-white/20">
                      #{p.b.seed ?? "—"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {pairs.length === 0 && (
              <div className="text-white/60">Δεν υπάρχουν αρκετές ομάδες για ζευγάρια.</div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
