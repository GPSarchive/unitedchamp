// app/tournoua/[slug]/components/teams/TeamsGroupsWithMatches.tsx
import TeamCard from "../../TeamCard";

type UiTeam = { id: number; name: string; logo?: string | null; seed?: number | null; group_id?: number | null };
type Group = { id: number; name: string };

type Match = {
  id: number;
  group_id: number | null;
  matchday: number | null;
  match_date: string | null;
  team_a_id: number | null;
  team_b_id: number | null;
  team_a_score: number | null;
  team_b_score: number | null;
  status: string; // scheduled|live|finished
};

type TeamsMap = Record<number, { name: string; logo?: string | null; seed?: number | null }>;

export default function TeamsGroupsWithMatches({
  title = "Groups",
  groups,
  teams,
  matches,
  teamsMap,
}: {
  title?: string;
  groups: Group[];
  teams: UiTeam[];
  matches: Match[];
  teamsMap: TeamsMap;
}) {
  // Bucket teams by group
  const teamsByGroup = new Map<number | "ungrouped", UiTeam[]>();
  teams.forEach((t) => {
    const k = t.group_id ?? ("ungrouped" as const);
    teamsByGroup.set(k, [...(teamsByGroup.get(k) ?? []), t]);
  });

  // Bucket matches by group
  const matchesByGroup = new Map<number | "ungrouped", Match[]>();
  matches.forEach((m) => {
    const k = m.group_id ?? ("ungrouped" as const);
    matchesByGroup.set(k, [...(matchesByGroup.get(k) ?? []), m]);
  });

  const sections = [
    ...groups.map((g) => ({ key: g.id as number | "ungrouped", label: g.name })),
    ...(teamsByGroup.has("ungrouped") || matchesByGroup.has("ungrouped")
      ? [{ key: "ungrouped" as const, label: "Unassigned" }]
      : []),
  ];

  return (
    <section className="space-y-6">
      <h2 className="text-xl font-semibold">{title}</h2>

      {sections.map((sec) => {
        const gTeams = (teamsByGroup.get(sec.key) ?? []).slice().sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999) || a.name.localeCompare(b.name));
        const gMatches = (matchesByGroup.get(sec.key) ?? []).slice().sort((a, b) => {
          const md = (a.matchday ?? 0) - (b.matchday ?? 0);
          if (md !== 0) return md;
          const da = a.match_date ? new Date(a.match_date).getTime() : 0;
          const db = b.match_date ? new Date(b.match_date).getTime() : 0;
          return da - db;
        });

        return (
          <div key={String(sec.key)} className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h3 className="text-lg font-medium mb-3">{sec.label}</h3>

            {/* Teams grid */}
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {gTeams.map((t) => (
                <TeamCard key={t.id} team={{ id: t.id, name: t.name, logo: t.logo }} seed={t.seed ?? undefined} />
              ))}
              {gTeams.length === 0 && <div className="text-white/60">Καμία ομάδα.</div>}
            </div>

            {/* Matches list */}
            <div className="mt-5 space-y-2">
              <h4 className="text-sm font-semibold text-white/80">Αγώνες</h4>
              {gMatches.length === 0 && <div className="text-white/60">Δεν υπάρχουν αγώνες.</div>}
              {gMatches.map((m) => (
                <GroupMatchRow key={m.id} m={m} teamsMap={teamsMap} />
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function GroupMatchRow({ m, teamsMap }: { m: Match; teamsMap: TeamsMap }) {
  const name = (id?: number | null) => (id ? teamsMap[id]?.name ?? `Team #${id}` : "—");
  const right = m.status === "finished"
    ? <span className="font-semibold">{m.team_a_score} - {m.team_b_score}</span>
    : <span className="text-white/60">
        {m.matchday ? `MD ${m.matchday} • ` : ""}
        {m.match_date ? new Date(m.match_date).toLocaleString() : "—"}
      </span>;
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-2 flex items-center justify-between">
      <div className="text-sm">
        <span className="font-medium">{name(m.team_a_id)}</span>
        <span className="text-white/60"> vs </span>
        <span className="font-medium">{name(m.team_b_id)}</span>
      </div>
      <div className="text-sm">{right}</div>
    </div>
  );
}
