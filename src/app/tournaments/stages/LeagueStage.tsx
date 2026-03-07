"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronUp, ChevronDown } from "lucide-react";
import type { Stage } from "../useTournamentData";
import { useTournamentData } from "../useTournamentData";
import MatchCarousel from "./MatchCarousel";

type StandingSortKey = "rank" | "played" | "won" | "drawn" | "lost" | "gf" | "ga" | "gd" | "points";

const LeagueStage: React.FC<{ stage: Stage }> = ({ stage }) => {
  const stageIdx = useTournamentData((s) => s.ids.stageIndexById[stage.id]);
  const standings = useTournamentData((s) => s.standings);
  const matches = useTournamentData((s) => s.matches);
  const getTeamName = useTournamentData((s) => s.getTeamName);
  const getTeamLogo = useTournamentData((s) => s.getTeamLogo);

  const [sortKey, setSortKey] = useState<StandingSortKey>("rank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  if (stageIdx === undefined) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5">
        <p className="text-red-400 text-sm font-medium">⚠️ Stage index not found. ID: {stage.id}</p>
      </div>
    );
  }

  const stageStandings = useMemo(() => {
    if (!standings) return [];
    const filtered = standings.filter((s) => s.stage_id === stage.id);
    if (filtered.length === 0) return [];

    const sorted = [...filtered];

    if (sortKey === "rank") {
      sorted.sort((a, b) => {
        const dir = sortDir === "asc" ? 1 : -1;
        const aRank = a.rank ?? 999;
        const bRank = b.rank ?? 999;
        if (aRank !== bRank) return (aRank - bRank) * dir;
        if (a.points !== b.points) return (b.points - a.points) * dir;
        if (a.gd !== b.gd) return (b.gd - a.gd) * dir;
        return (b.gf - a.gf) * dir;
      });
    } else {
      sorted.sort((a, b) => {
        const aVal = a[sortKey];
        const bVal = b[sortKey];
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      });
    }

    return sorted;
  }, [standings, stage.id, sortKey, sortDir]);

  const handleSort = (key: StandingSortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "rank" ? "asc" : "desc");
    }
  };

  return (
    <div className="space-y-8">
      {/* Standings Table */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-white/[0.04] bg-white/[0.02]">
          <h3 className="text-base font-semibold text-white/80">
            Βαθμολογία
            <span className="text-white/30 font-normal ml-2 text-sm">
              ({stageStandings.length} ομάδες)
            </span>
          </h3>
        </div>

        {stageStandings.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-white/30 text-sm">Δεν υπάρχουν βαθμολογίες ακόμα</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  <SortableHeader label="Θέση" sortKey="rank" currentKey={sortKey} currentDir={sortDir} onClick={handleSort} className="w-14 text-center" />
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-white/35">Ομάδα</th>
                  <SortableHeader label="ΑΓ" sortKey="played" currentKey={sortKey} currentDir={sortDir} onClick={handleSort} className="text-center" title="Αγώνες" />
                  <SortableHeader label="Ν" sortKey="won" currentKey={sortKey} currentDir={sortDir} onClick={handleSort} className="text-center" title="Νίκες" />
                  <SortableHeader label="Ι" sortKey="drawn" currentKey={sortKey} currentDir={sortDir} onClick={handleSort} className="text-center" title="Ισοπαλίες" />
                  <SortableHeader label="Η" sortKey="lost" currentKey={sortKey} currentDir={sortDir} onClick={handleSort} className="text-center" title="Ήττες" />
                  <SortableHeader label="ΓΥ" sortKey="gf" currentKey={sortKey} currentDir={sortDir} onClick={handleSort} className="text-center hidden sm:table-cell" title="Γκολ Υπέρ" />
                  <SortableHeader label="ΓΚ" sortKey="ga" currentKey={sortKey} currentDir={sortDir} onClick={handleSort} className="text-center hidden sm:table-cell" title="Γκολ Κατά" />
                  <SortableHeader label="ΔΤ" sortKey="gd" currentKey={sortKey} currentDir={sortDir} onClick={handleSort} className="text-center" title="Διαφορά Τερμάτων" />
                  <SortableHeader label="ΒΘ" sortKey="points" currentKey={sortKey} currentDir={sortDir} onClick={handleSort} className="text-center" title="Βαθμοί" />
                </tr>
              </thead>
              <tbody>
                <AnimatePresence mode="popLayout">
                  {stageStandings.map((standing, idx) => (
                    <motion.tr
                      key={standing.team_id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25, delay: idx * 0.02 }}
                      className="border-b border-white/[0.03] last:border-0 hover:bg-white/[0.03] transition-colors duration-150 group"
                    >
                      {/* Rank */}
                      <td className="px-4 py-3.5 text-center">
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold ${
                          idx === 0 ? 'bg-emerald-500/15 text-emerald-400' :
                          idx === 1 ? 'bg-emerald-500/10 text-emerald-400/70' :
                          idx === 2 ? 'bg-emerald-500/5 text-emerald-400/50' :
                          'text-white/30'
                        }`}>
                          {standing.rank ?? idx + 1}
                        </span>
                      </td>

                      {/* Team */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          {getTeamLogo(standing.team_id) && (
                            <img
                              src={getTeamLogo(standing.team_id)!}
                              alt=""
                              className="w-8 h-8 rounded-lg object-cover ring-1 ring-white/10 transition-transform duration-200 group-hover:scale-105"
                            />
                          )}
                          <span className="font-semibold text-sm text-white/90 truncate">
                            {getTeamName(standing.team_id)}
                          </span>
                        </div>
                      </td>

                      {/* Stats */}
                      <td className="px-4 py-3.5 text-center text-sm text-white/50 tabular-nums">{standing.played}</td>
                      <td className="px-4 py-3.5 text-center text-sm text-emerald-400/80 font-medium tabular-nums">{standing.won}</td>
                      <td className="px-4 py-3.5 text-center text-sm text-white/40 tabular-nums">{standing.drawn}</td>
                      <td className="px-4 py-3.5 text-center text-sm text-red-400/60 tabular-nums">{standing.lost}</td>
                      <td className="px-4 py-3.5 text-center text-sm text-white/40 tabular-nums hidden sm:table-cell">{standing.gf}</td>
                      <td className="px-4 py-3.5 text-center text-sm text-white/40 tabular-nums hidden sm:table-cell">{standing.ga}</td>
                      <td className="px-4 py-3.5 text-center text-sm font-medium tabular-nums text-white/60">
                        {standing.gd > 0 ? "+" : ""}{standing.gd}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="text-base font-bold text-emerald-400 tabular-nums">
                          {standing.points}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Matches Carousel */}
      <MatchCarousel
        stageIdx={stageIdx}
        matches={matches ?? []}
        getTeamName={getTeamName}
        getTeamLogo={getTeamLogo}
      />
    </div>
  );
};

/* ─── Sortable Header ─── */
function SortableHeader({
  label,
  sortKey,
  currentKey,
  currentDir,
  onClick,
  className = "",
  title,
}: {
  label: string;
  sortKey: StandingSortKey;
  currentKey: StandingSortKey;
  currentDir: "asc" | "desc";
  onClick: (key: StandingSortKey) => void;
  className?: string;
  title?: string;
}) {
  const isActive = currentKey === sortKey;
  return (
    <th className={`px-4 py-3 ${className}`}>
      <button
        onClick={() => onClick(sortKey)}
        title={title || label}
        className={`inline-flex items-center gap-0.5 text-[11px] font-semibold uppercase tracking-wider transition-colors duration-150 ${
          isActive ? 'text-emerald-400' : 'text-white/35 hover:text-white/60'
        }`}
      >
        {label}
        {isActive && (
          currentDir === "asc"
            ? <ChevronUp className="w-3 h-3" />
            : <ChevronDown className="w-3 h-3" />
        )}
      </button>
    </th>
  );
}

export default LeagueStage;
