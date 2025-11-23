"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Zap, Shield } from "lucide-react";
import VantaBg from "../../lib/VantaBg";
import TeamSidebar from "./TeamSidebar";
import TeamMatchesTimeline from "./TeamMatchesTimeline";
import TeamRosterShowcase from "./TeamRosterShowcase";
import type { Team, PlayerAssociation, Match } from "@/app/lib/types";

interface TeamPageContentProps {
  team: Team;
  tournaments: any[];
  wins: any[];
  errors: {
    membership?: string;
    wins?: string;
  };
  playerAssociations: PlayerAssociation[];
  seasonStatsByPlayer: Record<
    number,
    {
      matches: number;
      goals: number;
      assists: number;
      yellow_cards: number;
      red_cards: number;
      blue_cards: number;
      mvp: number;
      best_gk: number;
    }
  >;
  playersErrorMessage: string | null;
  matches: Match[] | null;
  teamId: number;
  matchesErrorMessage: string | null;
}

export default function TeamPageContent({
  team,
  tournaments,
  wins,
  errors,
  playerAssociations,
  seasonStatsByPlayer,
  playersErrorMessage,
  matches,
  teamId,
  matchesErrorMessage,
}: TeamPageContentProps) {
  const [bgEffectsEnabled, setBgEffectsEnabled] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <section className="relative min-h-screen text-slate-50 overflow-x-hidden">
      {/* Fixed Vanta background that stays in place while content scrolls */}
      <VantaBg className="fixed inset-0 -z-10" mode="eco" visible={bgEffectsEnabled} />

      {/* Page content scrolling over the fixed background */}
      <div className="relative z-10">
        <div className="container mx-auto px-4 py-8 max-w-7xl space-y-8">
          {/* Top: team hero */}
          <TeamSidebar
            team={team}
            tournaments={tournaments}
            wins={wins}
            errors={errors}
          />

          {/* Middle: roster */}
          <TeamRosterShowcase
            playerAssociations={playerAssociations}
            seasonStatsByPlayer={seasonStatsByPlayer}
            errorMessage={playersErrorMessage}
            bgEffectsEnabled={bgEffectsEnabled}
            setBgEffectsEnabled={setBgEffectsEnabled}
            onModalOpenChange={setIsModalOpen}
          />

          {/* Bottom: matches timeline */}
          <TeamMatchesTimeline
            matches={matches}
            teamId={teamId}
            errorMessage={matchesErrorMessage}
          />
        </div>
      </div>

      {/* Global Background Effects Toggle - Sticky Button (not in TeamRosterShowcase) */}
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5 }}
        onClick={() => !isModalOpen && setBgEffectsEnabled(!bgEffectsEnabled)}
        className="fixed bottom-6 right-6 z-40 bg-gradient-to-br from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-full p-4 shadow-2xl transition-all duration-300 hover:scale-110 border-2 border-white/30 backdrop-blur-sm group disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100"
        aria-label="Toggle background effects"
        disabled={isModalOpen}
        title={isModalOpen ? "Background effects always on in modal" : bgEffectsEnabled ? "Disable background effects" : "Enable background effects"}
      >
        <div className="relative">
          {bgEffectsEnabled ? (
            <Zap className="w-6 h-6" />
          ) : (
            <Shield className="w-6 h-6 opacity-50" />
          )}
          {isModalOpen && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse border-2 border-white" />
          )}
        </div>
        <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-black/90 text-white text-xs px-3 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
          {isModalOpen ? "Effects locked ON" : bgEffectsEnabled ? "Effects ON" : "Effects OFF"}
        </span>
      </motion.button>
    </section>
  );
}
