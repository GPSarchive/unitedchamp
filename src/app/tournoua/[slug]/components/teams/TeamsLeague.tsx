// app/tournoua/[slug]/components/teams/TeamsLeague.tsx
import TeamCard from "../TeamCard";

type UiTeam = { id: number; name: string; logo?: string | null; seed?: number | null };

export default function TeamsLeague({ teams, title = "Ομάδες" }: { teams: UiTeam[]; title?: string }) {
  return (
    <section>
      <h2 className="text-xl font-semibold mb-3">{title}</h2>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {teams.map((t) => (
          <TeamCard key={t.id} team={{ id: t.id, name: t.name, logo: t.logo }} />
        ))}
      </div>
    </section>
  );
}
