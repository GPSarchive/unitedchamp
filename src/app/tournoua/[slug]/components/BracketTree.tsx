// app/tournoua/[slug]/components/BracketTree.tsx

type Match = {
    id: number;
    team_a_id: number | null;
    team_b_id: number | null;
    team_a_score: number | null;
    team_b_score: number | null;
    status: "scheduled" | "live" | "finished" | string;
    round: number | null;       // 1=QF, 2=SF, 3=Final (example)
    bracket_pos: number | null; // ordering within round
  };
  
  type TeamsMap = Record<number, { name: string }>;
  
  export default function BracketTree({
    matches,
    teams,
  }: {
    matches: Match[];
    teams: TeamsMap;
  }) {
    const nameOf = (id?: number | null) =>
      (id ? teams[id]?.name : null) ?? (id ? `Team #${id}` : "—");
  
    // group matches by round
    const byRound = new Map<number, Match[]>();
    matches.forEach((m) => {
      const r = m.round ?? 0;
      byRound.set(r, [...(byRound.get(r) ?? []), m]);
    });
  
    const rounds = Array.from(byRound.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([round, list]) => ({
        round,
        list: list.sort(
          (a, b) => (a.bracket_pos ?? 0) - (b.bracket_pos ?? 0)
        ),
      }));
  
    if (rounds.length === 0) {
      return <div className="text-white/60">Δεν υπάρχει πρόγραμμα Bracket.</div>;
    }
  
    return (
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {rounds.map(({ round, list }) => (
          <div
            key={round}
            className="rounded-xl border border-white/10 bg-white/5 p-3"
          >
            <h3 className="font-semibold mb-2">Round {round}</h3>
            <div className="space-y-3">
              {list.map((m) => (
                <div
                  key={m.id}
                  className="rounded-md border border-white/10 p-2 bg-black/20"
                >
                  <div className="flex items-center justify-between">
                    <span>{nameOf(m.team_a_id)}</span>
                    <span className="text-sm">
                      {m.status === "finished" ? m.team_a_score : "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>{nameOf(m.team_b_id)}</span>
                    <span className="text-sm">
                      {m.status === "finished" ? m.team_b_score : "-"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }
  