"use client";

import React, { useState, useMemo } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Autoplay } from "swiper/modules";
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

const MatchCarousel: React.FC<MatchCarouselProps> = ({
  stageIdx,
  groupIdx,
  matches,
  getTeamName,
  getTeamLogo,
  className = "",
}) => {
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);

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

    // Finished matches: most recent to oldest
    const finished = stageMatches
      .filter((m) => m.status === "finished")
      .sort((a, b) => {
        const dateA = a.match_date ? new Date(a.match_date).getTime() : 0;
        const dateB = b.match_date ? new Date(b.match_date).getTime() : 0;
        return dateB - dateA; // Descending (most recent first)
      });

    // Scheduled matches: closest to today to furthest away
    const scheduled = stageMatches
      .filter((m) => m.status === "scheduled" && (m.match_date ?? "") >= todayISO)
      .sort((a, b) => {
        const dateA = a.match_date ? new Date(a.match_date).getTime() : 0;
        const dateB = b.match_date ? new Date(b.match_date).getTime() : 0;
        return dateA - dateB; // Ascending (closest first)
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

  return (
    <div className={`space-y-8 ${className}`}>
      {/* Team Filter - Modern searchable combobox */}
      <div className="max-w-2xl mx-auto">
        <TeamFilter
          options={allTeams}
          logosByTeam={teamLogos}
          value={selectedTeam}
          onChange={setSelectedTeam}
          placeholder="Αναζήτηση ομάδας..."
        />
      </div>

      {/* Scheduled Matches Carousel */}
      {filteredScheduled.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-2xl font-bold text-white">
              Επερχόμενοι Αγώνες
            </h3>
            <span className="text-sm text-gray-400">
              {filteredScheduled.length} {filteredScheduled.length === 1 ? "αγώνας" : "αγώνες"}
            </span>
          </div>

          <Swiper
            modules={[Navigation, Autoplay]}
            spaceBetween={20}
            slidesPerView={1}
            navigation
            autoplay={{ delay: 5000, disableOnInteraction: false }}
            breakpoints={{
              640: { slidesPerView: 2 },
              1024: { slidesPerView: 3 },
              1280: { slidesPerView: 4 },
            }}
            className="match-carousel"
          >
            {filteredScheduled.map((match) => (
              <SwiperSlide key={match.db_id ?? `scheduled-${match.team_a_id}-${match.team_b_id}`}>
                <MatchCard
                  match={match}
                  getTeamName={getTeamName}
                  getTeamLogo={getTeamLogo}
                  isFinished={false}
                />
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      )}

      {/* Finished Matches Carousel */}
      {filteredFinished.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-2xl font-bold text-white">
              Ολοκληρωμένοι Αγώνες
            </h3>
            <span className="text-sm text-gray-400">
              {filteredFinished.length} {filteredFinished.length === 1 ? "αγώνας" : "αγώνες"}
            </span>
          </div>

          <Swiper
            modules={[Navigation, Autoplay]}
            spaceBetween={20}
            slidesPerView={1}
            navigation
            autoplay={{ delay: 5000, disableOnInteraction: false }}
            breakpoints={{
              640: { slidesPerView: 2 },
              1024: { slidesPerView: 3 },
              1280: { slidesPerView: 4 },
            }}
            className="match-carousel"
          >
            {filteredFinished.map((match) => (
              <SwiperSlide key={match.db_id ?? `finished-${match.team_a_id}-${match.team_b_id}`}>
                <MatchCard
                  match={match}
                  getTeamName={getTeamName}
                  getTeamLogo={getTeamLogo}
                  isFinished={true}
                />
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      )}

      {/* Empty State */}
      {filteredScheduled.length === 0 && filteredFinished.length === 0 && (
        <div className="text-center py-12 bg-black rounded-lg border border-gray-800">
          <p className="text-gray-400 text-lg">
            {selectedTeam
              ? `Δεν βρέθηκαν αγώνες για την ομάδα ${selectedTeam}.`
              : "Δεν υπάρχουν αγώνες για αυτό το στάδιο."}
          </p>
        </div>
      )}
    </div>
  );
};

export default MatchCarousel;
