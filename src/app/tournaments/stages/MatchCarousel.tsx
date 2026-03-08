"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Autoplay } from "swiper/modules";
import { CheckCircle2, Clock, Swords } from "lucide-react";
import "swiper/css";
import "swiper/css/navigation";

import type { DraftMatch } from "../useTournamentData";
import MatchCard from "./MatchCard";
import TeamFilter from "@/components/TeamFilter";

interface MatchCarouselProps {
  stageIdx: number;
  groupIdx?: number;
  matches: DraftMatch[];
  getTeamName: (id: number) => string;
  getTeamLogo: (id: number) => string | null;
  className?: string;
}

type MatchTab = "all" | "finished" | "scheduled";

const MatchCarousel: React.FC<MatchCarouselProps> = ({
  stageIdx,
  groupIdx,
  matches,
  getTeamName,
  getTeamLogo,
  className = "",
}) => {
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<MatchTab>("all");

  // Filter matches by stage and optional group
  const stageMatches = useMemo(() => {
    return matches.filter(
      (m) => m.stageIdx === stageIdx && (groupIdx === undefined || m.groupIdx === groupIdx)
    );
  }, [matches, stageIdx, groupIdx]);

  // Split into finished and scheduled matches
  const { finishedMatches, scheduledMatches } = useMemo(() => {
    const today = new Date();
    const todayISO = today.toISOString();

    const finished = stageMatches
      .filter((m) => m.status === "finished")
      .sort((a, b) => {
        const dateA = a.match_date ? new Date(a.match_date).getTime() : 0;
        const dateB = b.match_date ? new Date(b.match_date).getTime() : 0;
        return dateB - dateA;
      });

    const scheduled = stageMatches
      .filter((m) => m.status === "scheduled" && (m.match_date ?? "") >= todayISO)
      .sort((a, b) => {
        const dateA = a.match_date ? new Date(a.match_date).getTime() : 0;
        const dateB = b.match_date ? new Date(b.match_date).getTime() : 0;
        return dateA - dateB;
      });

    return { finishedMatches: finished, scheduledMatches: scheduled };
  }, [stageMatches]);

  // Extract all unique teams from stage matches
  const allTeams = useMemo(() => {
    const teams = new Set<string>();
    stageMatches.forEach((match) => {
      if (match.team_a_id) teams.add(getTeamName(match.team_a_id));
      if (match.team_b_id) teams.add(getTeamName(match.team_b_id));
    });
    return Array.from(teams).sort();
  }, [stageMatches, getTeamName]);

  // Map team names to logos
  const teamLogos = useMemo(() => {
    const map: Record<string, string> = {};
    stageMatches.forEach((match) => {
      if (match.team_a_id) {
        const name = getTeamName(match.team_a_id);
        const logo = getTeamLogo(match.team_a_id);
        if (logo && !map[name]) map[name] = logo;
      }
      if (match.team_b_id) {
        const name = getTeamName(match.team_b_id);
        const logo = getTeamLogo(match.team_b_id);
        if (logo && !map[name]) map[name] = logo;
      }
    });
    return map;
  }, [stageMatches, getTeamName, getTeamLogo]);

  // Filter matches by selected team
  const filterMatchesByTeam = (matchList: DraftMatch[]) => {
    if (!selectedTeam) return matchList;
    return matchList.filter((match) => {
      const teamAName = getTeamName(match.team_a_id ?? 0);
      const teamBName = getTeamName(match.team_b_id ?? 0);
      return teamAName === selectedTeam || teamBName === selectedTeam;
    });
  };

  const filteredFinished = filterMatchesByTeam(finishedMatches);
  const filteredScheduled = filterMatchesByTeam(scheduledMatches);

  const tabCounts = {
    all: filteredFinished.length + filteredScheduled.length,
    finished: filteredFinished.length,
    scheduled: filteredScheduled.length,
  };

  const renderCarousel = (matchList: DraftMatch[], isFinished: boolean) => {
    if (matchList.length === 0) return null;
    return (
      <Swiper
        modules={[Navigation, Autoplay]}
        spaceBetween={16}
        slidesPerView={1}
        navigation
        autoplay={{ delay: 6000, disableOnInteraction: true }}
        breakpoints={{
          640: { slidesPerView: 2, spaceBetween: 16 },
          1024: { slidesPerView: 3, spaceBetween: 20 },
          1280: { slidesPerView: 4, spaceBetween: 20 },
        }}
        className="match-carousel"
      >
        {matchList.map((match) => (
          <SwiperSlide key={match.db_id ?? `${isFinished ? "f" : "s"}-${match.team_a_id}-${match.team_b_id}`}>
            <MatchCard
              match={match}
              getTeamName={getTeamName}
              getTeamLogo={getTeamLogo}
              isFinished={isFinished}
            />
          </SwiperSlide>
        ))}
      </Swiper>
    );
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Controls Row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Match Type Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          <TabButton
            active={activeTab === "all"}
            onClick={() => setActiveTab("all")}
            icon={<Swords className="w-3.5 h-3.5" />}
            label="Όλοι"
            count={tabCounts.all}
          />
          <TabButton
            active={activeTab === "finished"}
            onClick={() => setActiveTab("finished")}
            icon={<CheckCircle2 className="w-3.5 h-3.5" />}
            label="Ολοκλ."
            count={tabCounts.finished}
          />
          <TabButton
            active={activeTab === "scheduled"}
            onClick={() => setActiveTab("scheduled")}
            icon={<Clock className="w-3.5 h-3.5" />}
            label="Επερχ."
            count={tabCounts.scheduled}
          />
        </div>

        {/* Team Filter */}
        <div className="w-full sm:w-72">
          <TeamFilter
            options={allTeams}
            logosByTeam={teamLogos}
            value={selectedTeam}
            onChange={setSelectedTeam}
            placeholder="Φίλτρο ομάδας..."
          />
        </div>
      </div>

      {/* Match Carousels */}
      <AnimatePresence mode="wait">
        {(activeTab === "all" || activeTab === "scheduled") && filteredScheduled.length > 0 && (
          <motion.div
            key="scheduled"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="space-y-3"
          >
            {activeTab === "all" && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                  <h3 className="text-base font-bold text-white/80">Επερχόμενοι</h3>
                </div>
                <div className="flex-1 h-px bg-white/[0.04]" />
                <span className="text-xs text-white/25 font-medium">
                  {filteredScheduled.length} {filteredScheduled.length === 1 ? "αγώνας" : "αγώνες"}
                </span>
              </div>
            )}
            {renderCarousel(filteredScheduled, false)}
          </motion.div>
        )}

        {(activeTab === "all" || activeTab === "finished") && filteredFinished.length > 0 && (
          <motion.div
            key="finished"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="space-y-3"
          >
            {activeTab === "all" && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <h3 className="text-base font-bold text-white/80">Ολοκληρωμένοι</h3>
                </div>
                <div className="flex-1 h-px bg-white/[0.04]" />
                <span className="text-xs text-white/25 font-medium">
                  {filteredFinished.length} {filteredFinished.length === 1 ? "αγώνας" : "αγώνες"}
                </span>
              </div>
            )}
            {renderCarousel(filteredFinished, true)}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty State */}
      {tabCounts.all === 0 && (
        <div className="rounded-2xl border border-dashed border-white/[0.06] bg-white/[0.01] py-12 text-center">
          <Swords className="w-8 h-8 text-white/10 mx-auto mb-3" />
          <p className="text-white/30 text-sm">
            {selectedTeam
              ? `Δεν βρέθηκαν αγώνες για ${selectedTeam}.`
              : "Δεν υπάρχουν αγώνες για αυτό το στάδιο."}
          </p>
        </div>
      )}
    </div>
  );
};

/* ─── Tab Button ─── */
function TabButton({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
        active
          ? "bg-white/[0.08] text-white shadow-sm"
          : "text-white/35 hover:text-white/55 hover:bg-white/[0.02]"
      }`}
    >
      {icon}
      <span>{label}</span>
      <span className={`ml-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
        active ? "bg-emerald-500/15 text-emerald-400" : "bg-white/[0.04] text-white/25"
      }`}>
        {count}
      </span>
    </button>
  );
}

export default MatchCarousel;
