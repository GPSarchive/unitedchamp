// app/components/DashboardPageComponents/TournamentCURD/preview/WizardPreview.tsx
"use client";

import { useMemo } from "react";
import type { NewTournamentPayload } from "@/app/lib/types";
import type { TeamDraft, DraftMatch } from "../TournamentWizard";
import MatchPlanner from "./MatchPlanner";
import StagePreview from "@/app/components/DashboardPageComponents/TournamentCURD/stages/StagePreview";

export default function WizardPreview({
  payload,
  teams,
  draftMatches,
  onBack,
  onProceed,
  onRegenerate,
  onDraftChange,   // persist edits to matches
  onTeamsChange,   // persist seed updates for Auto-seed
}: {
  payload: NewTournamentPayload;
  teams: TeamDraft[];
  draftMatches: DraftMatch[];
  onBack: () => void;
  onProceed: () => void;
  onRegenerate: () => void;
  onDraftChange: (next: DraftMatch[]) => void;
  onTeamsChange: (next: TeamDraft[]) => void;
}) {
  // Display helper (used only for seeding order)
  const displayName = (t: TeamDraft): string =>
    (t as any)?.name ? String((t as any).name) : `Team #${t.id}`;

  // 🔹 Auto-assign seeds 1..N alphabetically (then bracket auto-pairs)
  const onAutoAssignTeamSeeds = () => {
    const order = [...teams].sort((a, b) => {
      const an = displayName(a).toLowerCase();
      const bn = displayName(b).toLowerCase();
      if (an < bn) return -1;
      if (an > bn) return 1;
      return a.id - b.id;
    });

    const idToSeed = new Map<number, number>(order.map((t, i) => [t.id, i + 1]));
    onTeamsChange(teams.map((t) => ({ ...t, seed: idToSeed.get(t.id)! })));

    // Return IDs ordered by ascending seed so the KO tree can pair immediately
    return order.map((t) => t.id);
  };

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onBack}
          className="px-3 py-2 rounded-md border border-white/10 bg-slate-900/40 text-white/90 hover:bg-cyan-500/5 hover:border-cyan-400/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
        >
          Back
        </button>
        <button
          onClick={onRegenerate}
          className="px-3 py-2 rounded-md border border-cyan-400/30 text-cyan-200 hover:bg-cyan-500/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
        >
          Regenerate
        </button>
        <button
          onClick={onProceed}
          className="ml-auto px-3 py-2 rounded-md border border-emerald-400/40 text-emerald-200 bg-emerald-600/20 hover:bg-emerald-600/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
        >
          Continue
        </button>
      </div>

      {/* 🔁 Dynamic, per-stage preview (KO trees, Groups/League fixtures, KO→Groups intake, Groups→KO chips) */}
      <div className="space-y-4">
        {payload.stages.map((_s, stageIdx) => (
          <StagePreview
            key={stageIdx}
            payload={payload}
            teams={teams}
            draftMatches={draftMatches}
            stageIdx={stageIdx}
            onDraftChange={onDraftChange}
            onAutoAssignTeamSeeds={onAutoAssignTeamSeeds}
          />
        ))}
      </div>

      {/* 🔧 Match Planner — edits persist up via onDraftChange */}
      <section className="rounded-xl border border-cyan-400/25 bg-slate-900/40 p-4">
        <h4 className="text-cyan-200 font-semibold mb-3">Match Planner</h4>
        <MatchPlanner
          payload={payload}
          teams={teams}
          draftMatches={draftMatches}
          onChange={onDraftChange}
        />
      </section>
    </div>
  );
}
