// app/geniki-katataxi/PointsLog.tsx
// Public log: every points award of the season, filterable by reason.
"use client";

import { Fragment, useMemo, useState } from "react";
import Image from "next/image";
import { ADJUSTMENT_PRESETS, type EventKind, type PointsEvent } from "./rules";
import { formatMatchDate } from "@/app/lib/datetime";
import TeamFilter from "@/components/TeamFilter";

export type LogTeam = { name: string; logo: string | null };

const fmtDate = (iso: string | null | undefined) =>
  iso ? formatMatchDate(iso, { day: "2-digit", month: "short", year: "numeric" }) : "";

type Filter = "all" | EventKind;

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "all", label: "Όλα" },
  { key: "participation", label: "Συμμετοχές" },
  { key: "qualification", label: "Προκρίσεις" },
  { key: "title", label: "Τίτλοι" },
  { key: "runner_up", label: "Τελικοί" },
  { key: "win", label: "Νίκες" },
  { key: "draw", label: "Ισοπαλίες" },
  { key: "loss", label: "Ήττες" },
  { key: "adjustment", label: "Άλλο" },
];

const KIND_LABEL: Record<EventKind, string> = {
  participation: "Συμμετοχή",
  qualification: "Πρόκριση",
  title: "Νικητής τουρνουά",
  runner_up: "Διεκδικητής",
  win: "Νίκη",
  draw: "Ισοπαλία",
  loss: "Ήττα",
  adjustment: "Χειροκίνητο",
};

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

function chipTone(kind: EventKind, points: number): string {
  if (kind === "title") return "border-[#fb923c]/70 bg-[#fb923c]/15 text-[#fb923c]";
  if (points < 0) return "border-red-400/40 bg-red-500/10 text-red-300";
  return "border-[#F3EFE6]/25 bg-[#13131d] text-[#F3EFE6]/75";
}

export default function PointsLog({
  events,
  teams,
}: {
  events: PointsEvent[];
  teams: Record<number, LogTeam>;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [teamFilter, setTeamFilter] = useState<"all" | number>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  const oppName = (id: number | null) =>
    id == null ? "—" : teams[id]?.name ?? `Ομάδα #${id}`;

  // Only teams that actually appear in this season's log, alphabetised (Greek).
  const teamOptions = useMemo(() => {
    const ids = new Set(events.map((e) => e.teamId));
    return [...ids]
      .map((id) => ({ id, name: teams[id]?.name ?? `Ομάδα #${id}` }))
      .sort((a, b) => a.name.localeCompare(b.name, "el"));
  }, [events, teams]);

  // Name-keyed shapes for the shared TeamFilter combobox.
  const teamNames = useMemo(() => teamOptions.map((t) => t.name), [teamOptions]);
  const teamLogos = useMemo(() => {
    const m: Record<string, string> = {};
    for (const t of teamOptions) {
      const logo = teams[t.id]?.logo;
      if (logo) m[t.name] = logo;
    }
    return m;
  }, [teamOptions, teams]);
  const idByName = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of teamOptions) m.set(t.name, t.id);
    return m;
  }, [teamOptions]);
  const selectedTeamName =
    teamFilter === "all"
      ? null
      : teamOptions.find((t) => t.id === teamFilter)?.name ?? null;

  const shown = useMemo(() => {
    let list = filter === "all" ? events : events.filter((e) => e.kind === filter);
    if (teamFilter !== "all") list = list.filter((e) => e.teamId === teamFilter);
    return [...list].sort((a, b) => {
      const ac = a.cancelledBy ? 1 : 0;
      const bc = b.cancelledBy ? 1 : 0;
      if (ac !== bc) return ac - bc; // cancelled entries sink to the bottom
      return (
        Math.abs(b.points) - Math.abs(a.points) ||
        (teams[a.teamId]?.name ?? "").localeCompare(teams[b.teamId]?.name ?? "", "el")
      );
    });
  }, [events, filter, teamFilter, teams]);

  return (
    <section className="mt-10 border-2 border-[#F3EFE6]/20 bg-[#0f0f19]/70">
      <div className="flex flex-col gap-3 border-b border-[#F3EFE6]/15 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.3em] text-[#fb923c]">
          Αναλυτικό μητρώο πόντων
        </h2>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {/* Team filter — shared searchable combobox (same as the homepage teams dashboard),
              sized down to sit uniformly beside the reason-filter tabs. */}
          <TeamFilter
            className="w-full sm:w-56"
            controlClassName="!rounded !px-2.5 !py-1 !text-[11px] !gap-1.5 [&_svg]:!h-3.5 [&_svg]:!w-3.5 [&_img]:!h-4 [&_img]:!w-4 [&_.relative]:!h-4 [&_.relative]:!w-4"
            options={teamNames}
            logosByTeam={teamLogos}
            value={selectedTeamName}
            placeholder="Όλες οι ομάδες"
            onChange={(name) =>
              setTeamFilter(name == null ? "all" : idByName.get(name) ?? "all")
            }
          />

          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => {
              const active = f.key === filter;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className={`border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors ${
                    active
                      ? "border-[#fb923c] bg-[#fb923c] text-[#0a0a14]"
                      : "border-[#F3EFE6]/25 bg-[#13131d] text-[#F3EFE6]/70 hover:border-[#fb923c]/60 hover:text-[#fb923c]"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-[#F3EFE6]/55">
          Δεν υπάρχουν εγγραφές για αυτό το φίλτρο.
        </p>
      ) : (
        <div className="max-h-[32rem] overflow-y-auto overflow-x-auto">
          <table className="min-w-full text-sm">
            <tbody>
              {shown.map((e, i) => {
                const team = teams[e.teamId];
                const name = team?.name ?? `Ομάδα #${e.teamId}`;
                const chipText =
                  e.kind === "adjustment" && e.adjustmentKind
                    ? ADJUSTMENT_PRESETS[e.adjustmentKind]?.label ?? KIND_LABEL.adjustment
                    : KIND_LABEL[e.kind];
                const cancelled = Boolean(e.cancelledBy);
                const details = e.matches ?? [];
                const expandable = details.length > 1;
                const rowKey = e.sourceKey ?? `adj-${e.adjustmentId}-${i}`;
                const isOpen = expanded.has(rowKey);
                const dateText = fmtDate(e.date);
                return (
                  <Fragment key={rowKey}>
                  <tr
                    className={`border-b border-[#F3EFE6]/10 last:border-b-0 hover:bg-[#fb923c]/[0.05] ${
                      cancelled ? "opacity-45" : ""
                    } ${expandable ? "cursor-pointer" : ""}`}
                    onClick={expandable ? () => toggle(rowKey) : undefined}
                  >
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-2.5">
                        {expandable ? (
                          <span className="font-mono text-[10px] text-[#fb923c]">
                            {isOpen ? "▾" : "▸"}
                          </span>
                        ) : (
                          <span className="w-[10px]" />
                        )}
                        {team?.logo ? (
                          <Image
                            src={team.logo}
                            alt={name}
                            width={20}
                            height={20}
                            className="h-5 w-5 rounded-sm object-cover"
                          />
                        ) : (
                          <div className="h-5 w-5 rounded-sm border border-[#F3EFE6]/15 bg-[#13131d]" />
                        )}
                        <span className="whitespace-nowrap font-medium text-[#F3EFE6]/90">
                          {name}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-flex whitespace-nowrap border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${chipTone(
                          e.kind,
                          e.points
                        )}`}
                      >
                        {chipText}
                        {e.count > 1 && ` ×${e.count}`}
                      </span>
                    </td>
                    <td className="w-full px-3 py-2.5 text-[13px] text-[#F3EFE6]/60">
                      {e.label}
                      {details.length === 1 && details[0].opponentId != null && (
                        <span className="text-[#F3EFE6]/45"> · vs {oppName(details[0].opponentId)}</span>
                      )}
                      {cancelled && (
                        <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.15em] text-red-300/80">
                          · ακυρώθηκε
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono text-[11px] text-[#F3EFE6]/55">
                      {expandable ? `${details.length} αγ.` : dateText}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <span
                        className={`font-mono text-sm font-bold tabular-nums ${
                          cancelled
                            ? "text-[#F3EFE6]/40 line-through"
                            : e.points < 0
                              ? "text-red-400"
                              : "text-[#F3EFE6]"
                        }`}
                      >
                        {signed(e.points)}
                      </span>
                    </td>
                  </tr>

                  {expandable && isOpen &&
                    details.map((m, mi) => (
                      <tr
                        key={`${rowKey}-m${mi}`}
                        className="border-b border-[#F3EFE6]/5 bg-black/30 text-[12px]"
                      >
                        <td className="py-1.5 pl-12 pr-5 text-[#F3EFE6]/55">
                          vs {oppName(m.opponentId)}
                        </td>
                        <td className="px-3 py-1.5 font-mono text-[11px] text-[#F3EFE6]/45">
                          {m.goalsFor != null && m.goalsAgainst != null
                            ? `${m.goalsFor}–${m.goalsAgainst}`
                            : ""}
                        </td>
                        <td className="px-3 py-1.5" />
                        <td className="whitespace-nowrap px-3 py-1.5 text-right font-mono text-[11px] text-[#F3EFE6]/50">
                          {fmtDate(m.date)}
                        </td>
                        <td />
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
