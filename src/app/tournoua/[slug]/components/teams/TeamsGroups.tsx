// app/tournoua/[slug]/components/teams/TeamsGroups.tsx
import TeamCard from "../TeamCard";

type UiTeam = { id: number; name: string; logo?: string | null; seed?: number | null; group_id?: number | null };
type Group = { id: number; name: string };

export default function TeamsGroups({
  teams,
  groups,
  title = "Groups",
}: {
  teams: UiTeam[];
  groups: Group[];
  title?: string;
}) {
  // bucket teams by group_id
  const byGroup = new Map<number | "ungrouped", UiTeam[]>();
  teams.forEach((t) => {
    const key = t.group_id ?? ("ungrouped" as const);
    byGroup.set(key, [...(byGroup.get(key) ?? []), t]);
  });

  const sections = [
    ...groups.map((g) => ({ key: g.id as number | "ungrouped", label: g.name })),
    ...(byGroup.has("ungrouped") ? [{ key: "ungrouped" as const, label: "Unassigned" }] : []),
  ];

  return (
    <section className="space-y-6">
      <h2 className="text-xl font-semibold">{title}</h2>

      {sections.map((sec) => (
        <div key={String(sec.key)}>
          <h3 className="text-lg font-medium mb-2">{sec.label}</h3>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {(byGroup.get(sec.key) ?? []).map((t) => (
              <TeamCard
                key={t.id}
                team={{ id: t.id, name: t.name, logo: t.logo }}
                seed={t.seed ?? undefined}
              />
            ))}
            {(byGroup.get(sec.key) ?? []).length === 0 && (
              <div className="text-white/60">Καμία ομάδα.</div>
            )}
          </div>
        </div>
      ))}
    </section>
  );
}
