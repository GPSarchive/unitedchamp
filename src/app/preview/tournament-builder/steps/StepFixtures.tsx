"use client";

import { useMemo, useState } from "react";
import type { NewTournamentPayload } from "@/app/lib/types";
import type { TeamDraft } from "@/app/dashboard/tournaments/TournamentCURD/TournamentWizard";

import SegmentedControl from "../ui/SegmentedControl";
import { card } from "../ui/tokens";
import StageFixturesPanel from "./fixtures/StageFixturesPanel";

export default function StepFixtures({
  payload,
  teams,
}: {
  payload: NewTournamentPayload;
  teams: TeamDraft[];
}) {
  const stages = payload.stages ?? [];
  const [activeStage, setActiveStage] = useState(0);

  const segments = useMemo(
    () =>
      stages.map((s, i) => ({
        id: String(i),
        label: s.name || `Στάδιο ${i + 1}`,
      })),
    [stages]
  );

  if (stages.length === 0) {
    return (
      <div className={`${card} p-6 text-sm text-zinc-400`}>
        Δεν υπάρχουν στάδια ακόμη — πρόσθεσε ένα στάδιο πρώτα.
      </div>
    );
  }

  const idx = Math.min(activeStage, stages.length - 1);

  return (
    <div className="space-y-4">
      {segments.length > 1 && (
        <SegmentedControl
          segments={segments}
          activeId={String(idx)}
          onSelect={(id) => setActiveStage(Number(id))}
        />
      )}
      <StageFixturesPanel key={idx} payload={payload} teams={teams} index={idx} />
    </div>
  );
}
