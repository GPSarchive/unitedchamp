"use client";

import * as React from "react";
import { useTournamentStore } from "@/app/dashboard/tournaments/TournamentCURD/submit/tournamentStore";

export default function StageStandingsMini({
  stageIdx,
  kind,
}: {
  stageIdx: number;
  kind: "league" | "groups";
}) {
  // store slices
  const standings = useTournamentStore((s) => s.entities.standings);
  const stageIdByIndex = useTournamentStore((s) => s.ids.stageIdByIndex);
  const groupIdByStage = useTournamentStore((s) => s.ids.groupIdByStage);
  const getTeamName = useTournamentStore((s) => s.getTeamName);

  const stageId = stageIdByIndex[stageIdx];
  const hasStage = typeof stageId === "number";

  // for groups: map of {groupIdx -> dbGroupId} belonging to this stage
  const groupMap: Record<number, number> = hasStage ? (groupIdByStage[stageIdx] ?? {}) : {};
  const groupIdxs = Object.keys(groupMap)
    .map(Number)
    .sort((a, b) => a - b);

  // slice standings to this stage and index by group
  const byGroup = React.useMemo(() => {
    const m = new Map<number, any[]>();
    (standings ?? []).forEach((r: any) => {
      if (!hasStage || r.stage_id !== stageId) return;
      const g = kind === "groups" ? Number(r.group_id ?? -1) : 0; // league = single table
      if (!m.has(g)) m.set(g, []);
      m.get(g)!.push(r);
    });
    return m;
  }, [standings, hasStage, stageId, kind]);

  if (!hasStage || byGroup.size === 0) {
    return (
      <div className="rounded-md border border-white/10 bg-white/5 p-2 text-xs text-white/60">
        Δεν υπάρχουν καταγεγραμμένες βαθμολογίες για αυτό το στάδιο ακόμη.
      </div>
    );
  }

  const Table = ({ rows }: { rows: any[] }) => {
    const sorted = rows
      .slice()
      .sort(
        (a, b) =>
          (Number(a.rank ?? 9999) - Number(b.rank ?? 9999)) ||
          getTeamName(a.team_id).localeCompare(getTeamName(b.team_id))
      );

    return (
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm text-white/90">
          <thead className="text-white/70">
            <tr className="[&>th]:px-2 [&>th]:py-1 border-b border-white/10">
              <th className="w-10 text-right">#</th>
              <th className="text-left">Ομάδα</th>
              <th className="w-10 text-right">Α</th>
              <th className="w-10 text-right">Ν</th>
              <th className="w-10 text-right">Ι</th>
              <th className="w-10 text-right">Η</th>
              <th className="w-12 text-right">GF</th>
              <th className="w-12 text-right">GA</th>
              <th className="w-12 text-right">GD</th>
              <th className="w-12 text-right">Β</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={`${r.team_id}-${r.group_id ?? "0"}`} className="[&>td]:px-2 [&>td]:py-1 border-b border-white/5">
                <td className="text-right">{r.rank ?? "—"}</td>
                <td className="text-left">{getTeamName(r.team_id)}</td>
                <td className="text-right">{r.played}</td>
                <td className="text-right">{r.won}</td>
                <td className="text-right">{r.drawn}</td>
                <td className="text-right">{r.lost}</td>
                <td className="text-right">{r.gf}</td>
                <td className="text-right">{r.ga}</td>
                <td className="text-right">{r.gd}</td>
                <td className="text-right font-semibold">{r.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  if (kind === "league") {
    const rows = byGroup.get(0) ?? [];
    return (
      <section className="rounded-lg border border-white/10 bg-slate-950/50 p-3 space-y-2">
        <header className="text-sm text-white/80 font-medium">Βαθμολογία (League)</header>
        <Table rows={rows} />
      </section>
    );
  }

  // groups
  return (
    <section className="rounded-lg border border-white/10 bg-slate-950/50 p-3 space-y-3">
      <header className="text-sm text-white/80 font-medium">Βαθμολογίες Ομίλων</header>
      <div className="grid gap-3 md:grid-cols-2">
        {groupIdxs.map((gi) => {
          const dbGroupId = groupMap[gi];
          const rows = dbGroupId != null ? (byGroup.get(dbGroupId) ?? []) : [];
          return (
            <div key={gi} className="rounded-md border border-white/10 bg-white/5 p-2">
              <div className="text-xs text-white/70 mb-2">Όμιλος {gi + 1}</div>
              <Table rows={rows} />
            </div>
          );
        })}
      </div>
    </section>
  );
}
