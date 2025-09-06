// app/tournoua/[slug]/components/FixturesByMatchday.tsx

type Match = {
    id: number;
    match_date: string | null;
    team_a_id: number | null;
    team_b_id: number | null;
    team_a_score: number | null;
    team_b_score: number | null;
    status: "scheduled" | "live" | "finished" | string;
    matchday: number | null;
    round: number | null;
  };
  
  type TeamsMap = Record<number, { name: string }>;
  
  export default function FixturesByMatchday({
    matches,
    teams,
  }: {
    matches: Match[];
    teams: TeamsMap;
  }) {
    const nameOf = (id?: number | null) =>
      (id ? teams[id]?.name : null) ?? (id ? `Team #${id}` : "—");
  
    // group by matchday (fallback to date label)
    const buckets = new Map<string, Match[]>();
    matches.forEach((m) => {
      const label =
        typeof m.matchday === "number"
          ? `Αγωνιστική ${m.matchday}`
          : m.match_date
          ? new Date(m.match_date).toDateString()
          : "—";
      buckets.set(label, [...(buckets.get(label) ?? []), m]);
    });
  
    const sections = Array.from(buckets.entries());
  
    return (
      <div className="space-y-6">
        {sections.length === 0 && (
          <div className="text-white/60">Δεν υπάρχουν αγώνες.</div>
        )}
        {sections.map(([title, rows]) => (
          <section key={title}>
            <h3 className="text-lg font-semibold mb-3">{title}</h3>
            <div className="space-y-2">
              {rows.map((m) => (
                <div
                  key={m.id}
                  className="rounded-lg border border-white/10 bg-white/5 p-3 flex items-center justify-between"
                >
                  <div className="text-sm">
                    <span className="font-medium">{nameOf(m.team_a_id)}</span>
                    <span className="text-white/60"> vs </span>
                    <span className="font-medium">{nameOf(m.team_b_id)}</span>
                    {typeof m.round === "number" && (
                      <span className="ml-2 text-white/60">R {m.round}</span>
                    )}
                  </div>
                  <div className="text-sm">
                    {m.status === "finished" ? (
                      <span className="font-semibold">
                        {m.team_a_score} - {m.team_b_score}
                      </span>
                    ) : (
                      <span className="text-white/60">
                        {m.match_date
                          ? new Date(m.match_date).toLocaleString()
                          : "—"}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }
  