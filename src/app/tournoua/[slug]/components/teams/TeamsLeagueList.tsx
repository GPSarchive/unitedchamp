// app/tournoua/[slug]/components/teams/TeamsLeagueList.tsx
import TeamCard from "../TeamCard";

type UiTeam = { id: number; name: string; logo?: string | null; seed?: number | null };

export default function TeamsLeagueList({ teams, title = "Ομάδες" }: { teams: UiTeam[]; title?: string }) {
  // simple sorted list: by name (fallback by id)
  const sorted = [...teams].sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id);
  return (
    <section>
      <h2 className="text-xl font-semibold mb-3">{title}</h2>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((t) => (
          <TeamCard key={t.id} team={{ id: t.id, name: t.name, logo: t.logo }} />
        ))}
        {sorted.length === 0 && <div className="text-white/60">Καμία ομάδα.</div>}
      </div>
    </section>
  );
}
