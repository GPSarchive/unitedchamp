// app/components/TournamentHeader.tsx

"use client";

import React from "react";

// Props for the TournamentHeader
type TournamentHeaderProps = {
  tournamentName: string;
  season: string;
  numTeams: number;
  numStages: number;
  numMatches: number;
  logoUrl: string; // Optional, in case you want to display a logo
};

const TournamentHeader: React.FC<TournamentHeaderProps> = ({
  tournamentName,
  season,
  numTeams,
  numStages,
  numMatches,
  logoUrl,
}) => {
  return (
    <div className="relative bg-black text-white py-10 px-8 rounded-lg shadow-xl overflow-hidden">
      {/* Animated Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-orange-600 to-transparent opacity-50 animate-gradient"></div>

      {/* Header Content */}
      <div className="relative z-10 flex items-center justify-between">
        {/* Left Section - Logo and Tournament Info */}
        <div className="flex items-center gap-6">
          {logoUrl && (
            <img src={logoUrl} alt="Tournament Logo" className="h-16 rounded-lg shadow-lg" />
          )}
          <div>
            <h1 className="text-5xl font-bold hover:text-orange-400 transition-colors duration-300">{tournamentName}</h1>
            <p className="text-xl text-orange-400">Season {season}</p>
          </div>
        </div>

        {/* Right Section - Stats */}
        <div className="text-center space-y-4">
          <div className="text-xl mb-4">Tournament Stats</div>
          <div className="flex justify-center gap-12 text-white/80">
            <div className="stat-card hover:bg-orange-600 hover:text-white transition-all duration-300 p-4 rounded-lg">
              <div className="text-2xl font-semibold">{numTeams}</div>
              <div className="text-sm text-gray-400">TEAMS</div>
            </div>
            <div className="stat-card hover:bg-orange-600 hover:text-white transition-all duration-300 p-4 rounded-lg">
              <div className="text-2xl font-semibold">{numStages}</div>
              <div className="text-sm text-gray-400">STAGES</div>
            </div>
            <div className="stat-card hover:bg-orange-600 hover:text-white transition-all duration-300 p-4 rounded-lg">
              <div className="text-2xl font-semibold">{numMatches}</div>
              <div className="text-sm text-gray-400">MATCHES</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TournamentHeader;
