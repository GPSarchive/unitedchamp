"use client";

import { Fragment, useState } from "react";
import type { CompRow, Stats } from "./page";
import ApplyFixButton from "./ApplyFixButton";

const STAT_KEYS: { key: keyof Stats; label: string }[] = [
  { key: "total_goals", label: "Goals" },
  { key: "total_assists", label: "Assists" },
  { key: "yellow_cards", label: "Yellow" },
  { key: "red_cards", label: "Red" },
  { key: "blue_cards", label: "Blue" },
];

function formatDate(d: string | null) {
  if (!d) return "No date";
  try {
    return new Date(d).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

export default function StatsTable({ rows }: { rows: CompRow[] }) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);

  const diffCount = rows.filter((r) => r.hasDiff).length;
  const visibleRows = showAll ? rows : rows.filter((r) => r.hasDiff);

  function toggle(pid: number) {
    setExpandedId((prev) => (prev === pid ? null : pid));
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Player Statistics Sync Preview
          </h1>
          <p className="text-sm text-white/60 mt-1">
            Click a player name to see their individual match stats.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-white/50">
            {diffCount} player{diffCount !== 1 ? "s" : ""} with mismatched data
          </span>
          {diffCount > 0 && <ApplyFixButton />}
        </div>
      </div>

      {diffCount === 0 && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-8 text-center">
          <span className="text-emerald-400 text-lg font-semibold">
            All player statistics are in sync!
          </span>
        </div>
      )}

      {/* Toggle to show all players */}
      {rows.length > diffCount && (
        <button
          onClick={() => setShowAll((p) => !p)}
          className="text-sm text-white/50 hover:text-white/80 underline underline-offset-2"
        >
          {showAll
            ? `Hide ${rows.length - diffCount} synced players`
            : `Show all ${rows.length} players (including ${rows.length - diffCount} already in sync)`}
        </button>
      )}

      {/* Table */}
      {visibleRows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-white/60 text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-3 w-8" />
                <th className="text-left px-2 py-3">Player</th>
                <th className="px-3 py-3 text-center text-white/40 text-[10px]">Matches</th>
                {STAT_KEYS.map((s) => (
                  <th key={s.key} className="px-3 py-3 text-center" colSpan={2}>
                    {s.label}
                  </th>
                ))}
              </tr>
              <tr className="border-b border-white/10 text-white/40 text-[10px] uppercase tracking-widest">
                <th />
                <th />
                <th />
                {STAT_KEYS.map((s) => (
                  <Fragment key={s.key}>
                    <th className="px-3 py-1 text-center">Now</th>
                    <th className="px-3 py-1 text-center">Recalc</th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r) => {
                const isExpanded = expandedId === r.player_id;
                return (
                  <Fragment key={r.player_id}>
                    {/* Summary row */}
                    <tr
                      onClick={() => toggle(r.player_id)}
                      className={`border-b border-white/5 cursor-pointer transition-colors ${
                        isExpanded
                          ? "bg-white/10"
                          : r.hasDiff
                            ? "hover:bg-white/5"
                            : "hover:bg-white/5 opacity-60"
                      }`}
                    >
                      <td className="px-4 py-2.5 text-white/40">
                        <span
                          className={`inline-block transition-transform text-xs ${
                            isExpanded ? "rotate-90" : ""
                          }`}
                        >
                          &#9654;
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-white font-medium whitespace-nowrap">
                        {r.name}
                        <span className="ml-2 text-white/30 text-xs">
                          #{r.player_id}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono text-white/50">
                        {r.matches.length}
                      </td>
                      {STAT_KEYS.map((s) => {
                        const curVal = r.cur[s.key];
                        const nextVal = r.next[s.key];
                        const changed = curVal !== nextVal;
                        return (
                          <Fragment key={s.key}>
                            <td
                              className={`px-3 py-2.5 text-center font-mono ${
                                changed
                                  ? "text-red-400 line-through opacity-70"
                                  : "text-white/50"
                              }`}
                            >
                              {curVal}
                            </td>
                            <td
                              className={`px-3 py-2.5 text-center font-mono ${
                                changed
                                  ? "text-emerald-400 font-semibold"
                                  : "text-white/50"
                              }`}
                            >
                              {nextVal}
                            </td>
                          </Fragment>
                        );
                      })}
                    </tr>

                    {/* Expanded match details */}
                    {isExpanded && (
                      <tr>
                        <td
                          colSpan={3 + STAT_KEYS.length * 2}
                          className="px-0 py-0"
                        >
                          <div className="bg-white/[0.03] border-b border-white/10">
                            <div className="px-6 py-3">
                              <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">
                                Match breakdown for {r.name} ({r.matches.length}{" "}
                                match{r.matches.length !== 1 ? "es" : ""})
                              </h3>
                              {r.matches.length === 0 ? (
                                <p className="text-white/40 text-sm py-2">
                                  No match_player_stats rows found for this
                                  player.
                                </p>
                              ) : (
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-white/40 uppercase tracking-wider border-b border-white/10">
                                      <th className="text-left py-2 px-2">
                                        Date
                                      </th>
                                      <th className="text-left py-2 px-2">
                                        Match
                                      </th>
                                      <th className="text-center py-2 px-2">
                                        Score
                                      </th>
                                      <th className="text-center py-2 px-2">
                                        Status
                                      </th>
                                      <th className="text-center py-2 px-2">
                                        Goals
                                      </th>
                                      <th className="text-center py-2 px-2">
                                        Assists
                                      </th>
                                      <th className="text-center py-2 px-2">
                                        OG
                                      </th>
                                      <th className="text-center py-2 px-2">
                                        YC
                                      </th>
                                      <th className="text-center py-2 px-2">
                                        RC
                                      </th>
                                      <th className="text-center py-2 px-2">
                                        BC
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {r.matches.map((m) => (
                                      <tr
                                        key={m.match_id}
                                        className="border-b border-white/5 hover:bg-white/5"
                                      >
                                        <td className="py-1.5 px-2 text-white/50 whitespace-nowrap">
                                          {formatDate(m.match_date)}
                                        </td>
                                        <td className="py-1.5 px-2 text-white font-medium whitespace-nowrap">
                                          {m.team_a_name} vs {m.team_b_name}
                                        </td>
                                        <td className="py-1.5 px-2 text-center text-white/70 font-mono">
                                          {m.team_a_score}–{m.team_b_score}
                                        </td>
                                        <td className="py-1.5 px-2 text-center">
                                          <span
                                            className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                              m.status === "finished"
                                                ? "bg-emerald-500/20 text-emerald-400"
                                                : m.status === "scheduled"
                                                  ? "bg-blue-500/20 text-blue-400"
                                                  : "bg-amber-500/20 text-amber-400"
                                            }`}
                                          >
                                            {m.status}
                                          </span>
                                        </td>
                                        <td
                                          className={`py-1.5 px-2 text-center font-mono ${
                                            m.goals > 0
                                              ? "text-white font-semibold"
                                              : "text-white/30"
                                          }`}
                                        >
                                          {m.goals}
                                        </td>
                                        <td
                                          className={`py-1.5 px-2 text-center font-mono ${
                                            m.assists > 0
                                              ? "text-white font-semibold"
                                              : "text-white/30"
                                          }`}
                                        >
                                          {m.assists}
                                        </td>
                                        <td
                                          className={`py-1.5 px-2 text-center font-mono ${
                                            m.own_goals > 0
                                              ? "text-orange-400 font-semibold"
                                              : "text-white/30"
                                          }`}
                                        >
                                          {m.own_goals}
                                        </td>
                                        <td
                                          className={`py-1.5 px-2 text-center font-mono ${
                                            m.yellow_cards > 0
                                              ? "text-yellow-400 font-semibold"
                                              : "text-white/30"
                                          }`}
                                        >
                                          {m.yellow_cards}
                                        </td>
                                        <td
                                          className={`py-1.5 px-2 text-center font-mono ${
                                            m.red_cards > 0
                                              ? "text-red-400 font-semibold"
                                              : "text-white/30"
                                          }`}
                                        >
                                          {m.red_cards}
                                        </td>
                                        <td
                                          className={`py-1.5 px-2 text-center font-mono ${
                                            m.blue_cards > 0
                                              ? "text-blue-400 font-semibold"
                                              : "text-white/30"
                                          }`}
                                        >
                                          {m.blue_cards}
                                        </td>
                                      </tr>
                                    ))}
                                    {/* Totals row */}
                                    <tr className="border-t border-white/20 font-semibold">
                                      <td
                                        colSpan={4}
                                        className="py-2 px-2 text-right text-white/60 uppercase text-[10px] tracking-wider"
                                      >
                                        Total from matches
                                      </td>
                                      <td className="py-2 px-2 text-center font-mono text-emerald-400">
                                        {r.matches.reduce(
                                          (s, m) => s + m.goals,
                                          0
                                        )}
                                      </td>
                                      <td className="py-2 px-2 text-center font-mono text-emerald-400">
                                        {r.matches.reduce(
                                          (s, m) => s + m.assists,
                                          0
                                        )}
                                      </td>
                                      <td className="py-2 px-2 text-center font-mono text-orange-400">
                                        {r.matches.reduce(
                                          (s, m) => s + m.own_goals,
                                          0
                                        )}
                                      </td>
                                      <td className="py-2 px-2 text-center font-mono text-yellow-400">
                                        {r.matches.reduce(
                                          (s, m) => s + m.yellow_cards,
                                          0
                                        )}
                                      </td>
                                      <td className="py-2 px-2 text-center font-mono text-red-400">
                                        {r.matches.reduce(
                                          (s, m) => s + m.red_cards,
                                          0
                                        )}
                                      </td>
                                      <td className="py-2 px-2 text-center font-mono text-blue-400">
                                        {r.matches.reduce(
                                          (s, m) => s + m.blue_cards,
                                          0
                                        )}
                                      </td>
                                    </tr>
                                    {/* What's stored row */}
                                    <tr className="bg-white/5">
                                      <td
                                        colSpan={4}
                                        className="py-2 px-2 text-right text-white/60 uppercase text-[10px] tracking-wider"
                                      >
                                        Stored in player_statistics
                                      </td>
                                      <td
                                        className={`py-2 px-2 text-center font-mono ${
                                          r.cur.total_goals !== r.next.total_goals
                                            ? "text-red-400"
                                            : "text-white/50"
                                        }`}
                                      >
                                        {r.cur.total_goals}
                                      </td>
                                      <td
                                        className={`py-2 px-2 text-center font-mono ${
                                          r.cur.total_assists !== r.next.total_assists
                                            ? "text-red-400"
                                            : "text-white/50"
                                        }`}
                                      >
                                        {r.cur.total_assists}
                                      </td>
                                      <td className="py-2 px-2 text-center font-mono text-white/30">
                                        —
                                      </td>
                                      <td
                                        className={`py-2 px-2 text-center font-mono ${
                                          r.cur.yellow_cards !== r.next.yellow_cards
                                            ? "text-red-400"
                                            : "text-white/50"
                                        }`}
                                      >
                                        {r.cur.yellow_cards}
                                      </td>
                                      <td
                                        className={`py-2 px-2 text-center font-mono ${
                                          r.cur.red_cards !== r.next.red_cards
                                            ? "text-red-400"
                                            : "text-white/50"
                                        }`}
                                      >
                                        {r.cur.red_cards}
                                      </td>
                                      <td
                                        className={`py-2 px-2 text-center font-mono ${
                                          r.cur.blue_cards !== r.next.blue_cards
                                            ? "text-red-400"
                                            : "text-white/50"
                                        }`}
                                      >
                                        {r.cur.blue_cards}
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
