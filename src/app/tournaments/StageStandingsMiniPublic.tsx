// app/tournaments/StageStandingsMiniPublic.tsx
"use client";

import * as React from "react";
import { useTournamentData } from "./useTournamentData";

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
  gd?: number;
  points: number;
  rank?: number | null;
};

export default function StageStandingsMiniPublic({
  stageIdx,
  kind,
  showLogos = true,
  stageIdOverride,
  groupIdxOverride,
  title = "ΒΑΘΜΟΛΟΓΙΑ",
  subtitle,
}: {
  stageIdx: number;
  kind: Kind;
  showLogos?: boolean;
  stageIdOverride?: number;
  groupIdxOverride?: number;
  title?: string;
  subtitle?: string;
}) {
  const standings = useTournamentData((s) => s.standings) as StandingRow[] | undefined;
  const stageIdByIndex = useTournamentData((s) => s.ids.stageIdByIndex);
  const groupIdByStage = useTournamentData((s) => s.ids.groupIdByStage);
  const getTeamName = useTournamentData((s) => s.getTeamName);
  const getTeamLogo = useTournamentData((s) => s.getTeamLogo) ?? (() => null);

  const stageId = stageIdOverride ?? stageIdByIndex?.[stageIdx];
  const hasStage = typeof stageId === "number" && Number.isFinite(stageId);

  const groupMap: Record<number, number> = React.useMemo(() => {
    if (!hasStage) return {};
    const raw = groupIdByStage?.[stageIdx] ?? {};
    const out: Record<number, number> = {};
    for (const k in (raw as Record<number, number | undefined>)) {
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

  const byGroup = React.useMemo(() => {
    const m = new Map<number, StandingRow[]>();
    (standings ?? []).forEach((r) => {
      if (!hasStage || r.stage_id !== stageId) return;
      const g = kind === "groups" ? Number(r.group_id ?? -1) : 0;
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
      <div className="flex items-center gap-2.5">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo}
            alt=""
            className="h-6 w-6 rounded object-contain"
          />
        ) : null}
        <span className="font-semibold tracking-wide">{name}</span>
      </div>
    );
  };

  const Table: React.FC<{ rows: StandingRow[] }> = ({ rows }) => {
    const sorted = sortRows(rows);

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-gradient-to-r from-rose-700 to-rose-800 text-white uppercase tracking-[0.15em] text-[11px] font-extrabold">
              <th className="px-4 py-3 text-center w-10">#</th>
              <th className="px-4 py-3 text-left">ΟΜΑΔΑ</th>
              <th className="px-2 py-3 text-center w-12" title="Αγώνες">Α</th>
              <th className="px-2 py-3 text-center w-12" title="Νίκες">Ν</th>
              <th className="px-2 py-3 text-center w-12" title="Ισοπαλίες">Ι</th>
              <th className="px-2 py-3 text-center w-12" title="Ήττες">Η</th>
              <th className="px-2 py-3 text-center w-12" title="Γκολ Υπέρ">Υ</th>
              <th className="px-2 py-3 text-center w-12" title="Γκολ Κατά">Κ</th>
              <th className="px-2 py-3 text-center w-12" title="Διαφορά">Δ</th>
              <th className="px-4 py-3 text-center w-14 bg-gradient-to-r from-rose-800 to-rose-900" title="Βαθμοί">Β</th>
            </tr>
          </thead>

          <tbody className="bg-slate-900">
            {sorted.map((r, idx) => {
              const rank = r.rank ?? idx + 1;
              const gd =
                typeof r.gd === "number" ? r.gd : (Number(r.gf) || 0) - (Number(r.ga) || 0);
              const gdDisplay = gd > 0 ? `+${gd}` : gd;

              return (
                <tr
                  key={`${r.team_id}-${r.group_id ?? "0"}`}
                  className="border-b border-slate-700/50 hover:bg-slate-800 transition-colors text-white"
                >
                  <td className="px-4 py-3.5 text-center font-black text-white/90">{rank}</td>
                  <td className="px-4 py-3.5">
                    <TeamCell teamId={r.team_id} />
                  </td>
                  <td className="px-2 py-3.5 text-center text-white/90">{r.played}</td>
                  <td className="px-2 py-3.5 text-center text-white/90">{r.won}</td>
                  <td className="px-2 py-3.5 text-center text-white/90">{r.drawn}</td>
                  <td className="px-2 py-3.5 text-center text-white/90">{r.lost}</td>
                  <td className="px-2 py-3.5 text-center text-white/90">{r.gf}</td>
                  <td className="px-2 py-3.5 text-center text-white/90">{r.ga}</td>
                  <td className="px-2 py-3.5 text-center text-white/90">{gdDisplay}</td>
                  <td className="px-4 py-3.5 text-center font-black text-base bg-slate-800">
                    {r.points}
                  </td>
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
      <section className="rounded-xl overflow-hidden shadow-2xl border border-rose-900/30">
        <div className="bg-slate-900 px-5 pt-5">
          <h2 className="text-center text-white text-[28px] font-extrabold tracking-[0.2em]">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-1 pb-4 text-center text-[11px] uppercase tracking-[0.25em] text-white/80">
              {subtitle}
            </p>
          )}
        </div>

        <Table rows={rows} />

        <div className="bg-slate-900 px-4 py-2 text-xs text-white/60 text-center border-t border-slate-700/50">
          Α (Αγώνες) - Ν (Νίκες) - Ι (Ισοπαλίες) - Η (Ήττες) - Υ (Γκολ Υπέρ) - Κ (Γκολ Κατά) - Δ (Διαφορά τερμάτων) - Β (Βαθμοί)
        </div>
      </section>
    );
  }

  // Single group override
  if (typeof groupIdxOverride === "number") {
    const dbGroupId = groupMap[groupIdxOverride];
    const rows = dbGroupId != null ? byGroup.get(dbGroupId) ?? [] : [];
    const label = `ΟΜΙΛΟΣ ${groupIdxOverride + 1}`;

    return (
      <section className="rounded-xl overflow-hidden shadow-2xl border border-rose-900/30">
        <div className="bg-slate-900 px-5 pt-5">
          <h2 className="text-center text-white text-[28px] font-extrabold tracking-[0.2em]">
            {title}
          </h2>
          <p className="mt-1 pb-4 text-center text-[11px] uppercase tracking-[0.25em] text-white/80">
            {label}
          </p>
        </div>

        <Table rows={rows} />

        <div className="bg-slate-900 px-4 py-2 text-xs text-white/60 text-center border-t border-slate-700/50">
          Α (Αγώνες) - Ν (Νίκες) - Ι (Ισοπαλίες) - Η (Ήττες) - Υ (Γκολ Υπέρ) - Κ (Γκολ Κατά) - Δ (Διαφορά τερμάτων) - Β (Βαθμοί)
        </div>
      </section>
    );
  }

  // Multiple groups
  const groupsForRender =
    groupIdxs.length > 0
      ? groupIdxs
          .map((gi) => {
            const dbGroupId = groupMap[gi];
            return {
              label: `Όμιλος ${gi + 1}`,
              key: `ui-${gi}`,
              rows: dbGroupId != null ? byGroup.get(dbGroupId) ?? [] : [],
            };
          })
          .filter((g) => g.rows.length > 0)
      : Array.from(byGroup.entries())
          .filter(([gId]) => gId >= 0)
          .sort(([a], [b]) => a - b)
          .map(([_, rows], i) => ({
            label: `Όμιλος ${i + 1}`,
            key: `auto-${i}`,
            rows,
          }));

  return (
    <section className="space-y-6">
      <div className="bg-slate-900 px-5 pt-5 rounded-xl">
        <h2 className="text-center text-white text-[28px] font-extrabold tracking-[0.2em]">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1 pb-4 text-center text-[11px] uppercase tracking-[0.25em] text-white/80">
            {subtitle}
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {groupsForRender.map((g) => (
          <div key={g.key} className="rounded-xl overflow-hidden shadow-2xl border border-rose-900/30">
            <div className="bg-gradient-to-r from-rose-700 to-rose-800 px-4 py-3 text-center">
              <h3 className="text-base font-extrabold text-white tracking-[0.18em] uppercase">
                {g.label}
              </h3>
            </div>
            <Table rows={g.rows} />
          </div>
        ))}
      </div>

      <div className="bg-slate-900 px-4 py-3 text-xs text-white/60 text-center rounded-xl border border-slate-700/50">
        Α (Αγώνες) - Ν (Νίκες) - Ι (Ισοπαλίες) - Η (Ήττες) - Υ (Γκολ Υπέρ) - Κ (Γκολ Κατά) - Δ (Διαφορά τερμάτων) - Β (Βαθμοί)
      </div>
    </section>
  );
}
