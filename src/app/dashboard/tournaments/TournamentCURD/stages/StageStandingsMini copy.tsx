"use client";

import * as React from "react";
import { useTournamentStore } from "@/app/dashboard/tournaments/TournamentCURD/submit/tournamentStore";

type Kind = "league" | "groups";

type StandingRow = {
  stage_id: number;
  group_id?: number | null;
  team_id: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd?: number;   // optional in DB; we’ll derive if missing
  points: number;
  rank?: number | null;
};

export default function StageStandingsMini({
  stageIdx,
  kind,
  showLogos = true,
}: {
  stageIdx: number;
  kind: Kind;
  /** if your store can resolve team logos, leave true; otherwise set false where you use it */
  showLogos?: boolean;
}) {
  // store slices
  const standings = useTournamentStore((s) => s.entities.standings) as StandingRow[] | undefined;
  const stageIdByIndex = useTournamentStore((s) => s.ids.stageIdByIndex);
  const groupIdByStage = useTournamentStore((s) => s.ids.groupIdByStage);
  const getTeamName = useTournamentStore((s) => s.getTeamName);
  // optional: some stores expose a logo getter; fall back gracefully
  const getTeamLogo =
    useTournamentStore((s: any) => (s.getTeamLogo as ((id: number) => string | null) | undefined)) ??
    (() => null);

  const stageId = stageIdByIndex[stageIdx];
  const hasStage = Number.isFinite(stageId);

  // 🔧 Sanitize to satisfy Record<number, number>
  const groupMap: Record<number, number> = React.useMemo(() => {
    if (!hasStage) return {};
    const raw = groupIdByStage[stageIdx] ?? {};
    const out: Record<number, number> = {};
    for (const k in raw as Record<number, number | undefined>) {
      const v = (raw as Record<string, number | undefined>)[k];
      if (typeof v === "number") out[Number(k)] = v;
    }
    return out;
  }, [groupIdByStage, hasStage, stageIdx]);

  const groupIdxs = React.useMemo(
    () =>
      Object.keys(groupMap)
        .map(Number)
        .sort((a, b) => a - b),
    [groupMap]
  );

  // slice standings to this stage and index by group
  const byGroup = React.useMemo(() => {
    const m = new Map<number, StandingRow[]>();
    (standings ?? []).forEach((r) => {
      if (!hasStage || r.stage_id !== stageId) return;
      const g = kind === "groups" ? Number(r.group_id ?? -1) : 0; // league = single table
      if (!m.has(g)) m.set(g, []);
      m.get(g)!.push(r);
    });
    return m;
  }, [standings, hasStage, stageId, kind]);

  // empty / not hydrated
  if (!hasStage || byGroup.size === 0) {
    return (
      <div className="rounded-md border border-white/10 bg-white/5 p-2 text-xs text-white/60">
        Δεν υπάρχουν καταγεγραμμένες βαθμολογίες για αυτό το στάδιο ακόμη.
      </div>
    );
  }

  // robust sort:
  // 1) if rank provided, asc rank
  // 2) else points desc, gd desc, gf desc
  // 3) then name asc (stable)
  const sortRows = (rows: StandingRow[]) => {
    const safeName = (id: number) => getTeamName?.(id) ?? `Team #${id}`;
    return rows
      .slice()
      .map((r) => ({
        ...r,
        gd: typeof r.gd === "number" ? r.gd : (Number(r.gf) || 0) - (Number(r.ga) || 0),
      }))
      .sort((a, b) => {
        const ar = a.rank ?? null;
        const br = b.rank ?? null;
        if (ar != null && br != null) return Number(ar) - Number(br);
        if (ar != null) return -1;
        if (br != null) return 1;

        const pd = (Number(b.points) || 0) - (Number(a.points) || 0);
        if (pd !== 0) return pd;
        const gdd = (Number(b.gd) || 0) - (Number(a.gd) || 0);
        if (gdd !== 0) return gdd;
        const gfd = (Number(b.gf) || 0) - (Number(a.gf) || 0);
        if (gfd !== 0) return gfd;
        return safeName(a.team_id).localeCompare(safeName(b.team_id));
      });
  };

  const TeamCell: React.FC<{ teamId: number }> = ({ teamId }) => {
    const name = getTeamName?.(teamId) ?? `Team #${teamId}`;
    const logo = showLogos ? getTeamLogo?.(teamId) : null;

    return (
      <div className="flex items-center gap-2">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo}
            alt=""
            className="h-5 w-5 rounded-sm object-cover border border-white/10"
          />
        ) : null}
        <span className="truncate">{name}</span>
      </div>
    );
  };

  const Table: React.FC<{ rows: StandingRow[] }> = ({ rows }) => {
    const sorted = sortRows(rows);

    return (
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm text-white/90">
          <thead className="text-white/70">
            <tr className="[&>th]:px-2 [&>th]:py-1 border-b border-white/10">
              <th className="w-10 text-right">#</th>
              <th className="text-left">Ομάδα</th>
              <th className="w-10 text-right" title="Αγώνες">Α</th>
              <th className="w-10 text-right" title="Νίκες">Ν</th>
              <th className="w-10 text-right" title="Ισοπαλίες">Ι</th>
              <th className="w-10 text-right" title="Ήττες">Η</th>
              <th className="w-12 text-right" title="Γκολ Υπέρ">GF</th>
              <th className="w-12 text-right" title="Γκολ Κατά">GA</th>
              <th className="w-12 text-right" title="Διαφορά τερμάτων">GD</th>
              <th className="w-12 text-right" title="Βαθμοί">Β</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const rank = r.rank ?? "—";
              const gd = typeof r.gd === "number" ? r.gd : (Number(r.gf) || 0) - (Number(r.ga) || 0);
              return (
                <tr
                  key={`${r.team_id}-${r.group_id ?? "0"}`}
                  className="[&>td]:px-2 [&>td]:py-1 border-b border-white/5"
                >
                  <td className="text-right">{rank}</td>
                  <td className="text-left">
                    <TeamCell teamId={r.team_id} />
                  </td>
                  <td className="text-right">{r.played}</td>
                  <td className="text-right">{r.won}</td>
                  <td className="text-right">{r.drawn}</td>
                  <td className="text-right">{r.lost}</td>
                  <td className="text-right">{r.gf}</td>
                  <td className="text-right">{r.ga}</td>
                  <td className="text-right">{gd}</td>
                  <td className="text-right font-semibold">{r.points}</td>
                </tr>
              );
            })}
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
