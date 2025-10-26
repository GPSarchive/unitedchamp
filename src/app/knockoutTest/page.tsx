"use client";

import { useState, useEffect } from "react";
import { useTournamentData } from "@/app/tournaments/useTournamentData";
import KOStageDisplay from "@/app/tournaments/koStage/KoStageDisplay";

// You can create a dummy/mock tournament if needed
const KnockoutTestPage = () => {
  return (
    <div className="page-container">
      <h1 className="text-center text-3xl font-semibold text-white mb-4">
        Knockout Stage Display
      </h1>

      {/* Pass stages, teams, and matches to KOStageDisplay */}
      <KOStageDisplay/>
    </div>
  );
};

export default KnockoutTestPage;