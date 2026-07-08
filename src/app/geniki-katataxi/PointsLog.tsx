// app/geniki-katataxi/PointsLog.tsx
// Public log: every points award of the season, filterable by reason.
"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { ADJUSTMENT_PRESETS, type EventKind, type PointsEvent } from "./rules";

export type LogTeam = { name: string; logo: string | null };

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
  { key: "adjustment", label: "Χειροκίνητα" },
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

  const shown = useMemo(() => {
    const list = filter === "all" ? events : events.filter((e) => e.kind === filter);
    return [...list].sort((a, b) => {
      const ac = a.cancelledBy ? 1 : 0;
      const bc = b.cancelledBy ? 1 : 0;
      if (ac !== bc) return ac - bc; // cancelled entries sink to the bottom
      return (
        Math.abs(b.points) - Math.abs(a.points) ||
        (teams[a.teamId]?.name ?? "").localeCompare(teams[b.teamId]?.name ?? "", "el")
      );
    });
  }, [events, filter, teams]);

  return (
    <section className="mt-10 border-2 border-[#F3EFE6]/20 bg-[#0f0f19]/70">
      <div className="flex flex-col gap-3 border-b border-[#F3EFE6]/15 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.3em] text-[#fb923c]">
          Αναλυτικό μητρώο πόντων
        </h2>
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
                return (
                  <tr
                    key={`${e.teamId}-${e.kind}-${e.label}-${i}`}
                    className={`border-b border-[#F3EFE6]/10 last:border-b-0 hover:bg-[#fb923c]/[0.05] ${
                      cancelled ? "opacity-45" : ""
                    }`}
                  >
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-2.5">
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
                      {cancelled && (
                        <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.15em] text-red-300/80">
                          · ακυρώθηκε
                        </span>
                      )}
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
