"use client";

import type { NewTournamentPayload } from "@/app/lib/types";
import TournamentBasicsForm from "@/app/dashboard/tournaments/TournamentCURD/basics/TournamentBasicsForm";

export default function StepBasics({
  tournament,
  onChange,
}: {
  tournament: NewTournamentPayload["tournament"];
  onChange: (t: NewTournamentPayload["tournament"]) => void;
}) {
  return (
    <div className="space-y-4">
      <TournamentBasicsForm value={tournament} onChange={onChange} />
    </div>
  );
}
