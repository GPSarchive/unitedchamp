// app/tournoua/[slug]/components/StandingsTable.tsx

type Row = {
    team_id: number;
    played: number;
    wins: number;
    draws: number;
    losses: number;
    goals_for: number;
    goals_against: number;
    goal_diff: number;
    points: number;
  };
  
  type TeamsMap = Record<number, { name: string; logo?: string | null }>;
  
  export default function StandingsTable({
    rows,
    teams,
  }: {
    rows: Row[];
    teams?: TeamsMap;
  }) {
    const nameOf = (id: number) => teams?.[id]?.name ?? `Team #${id}`;
  
    return (
      <table className="w-full text-sm border-separate border-spacing-y-2">
        <thead className="text-white/70">
          <tr>
            <th className="text-left px-2">Ομάδα</th>
            <th className="text-right px-2">Π</th>
            <th className="text-right px-2">Ν</th>
            <th className="text-right px-2">Ι</th>
            <th className="text-right px-2">Η</th>
            <th className="text-right px-2">GF</th>
            <th className="text-right px-2">GA</th>
            <th className="text-right px-2">GD</th>
            <th className="text-right px-2">Β</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.team_id} className="bg-white/5">
              <td className="px-2 py-2 font-medium">{nameOf(r.team_id)}</td>
              <td className="px-2 py-2 text-right">{r.played}</td>
              <td className="px-2 py-2 text-right">{r.wins}</td>
              <td className="px-2 py-2 text-right">{r.draws}</td>
              <td className="px-2 py-2 text-right">{r.losses}</td>
              <td className="px-2 py-2 text-right">{r.goals_for}</td>
              <td className="px-2 py-2 text-right">{r.goals_against}</td>
              <td className="px-2 py-2 text-right">{r.goal_diff}</td>
              <td className="px-2 py-2 text-right font-semibold">{r.points}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={9} className="px-2 py-4 text-center text-white/60">
                Δεν υπάρχουν αποτελέσματα.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    );
  }
  