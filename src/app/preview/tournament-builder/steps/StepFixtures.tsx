"use client";

import { useMemo, useState } from "react";
import type { NewTournamentPayload } from "@/app/lib/types";
import type {
  TeamDraft,
  DraftMatch,
} from "@/app/dashboard/tournaments/TournamentCURD/TournamentWizard";
import KnockoutBoard from "@/app/dashboard/tournaments/TournamentCURD/stages/KnockoutTree/newknockout/KnockoutBoard";

import SegmentedControl from "../ui/SegmentedControl";
import { card } from "../ui/tokens";
import { useStageFixtures } from "./fixtures/useStageFixtures";
import { rowSignature } from "./fixtures/helpers";
import MatchList from "./fixtures/MatchList";
import MatchSheet from "./fixtures/MatchSheet";
import KnockoutRounds, { makeRoundLabel } from "./fixtures/KnockoutRounds";
import KoMatchSheet from "./fixtures/KoMatchSheet";

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

function StageFixturesPanel({
  payload,
  teams,
  index,
}: {
  payload: NewTournamentPayload;
  teams: TeamDraft[];
  index: number;
}) {
  const fx = useStageFixtures({ payload, teams, index });

  // Track the open match by identity (db_id first, then signature) so the
  // sheet always sees the freshest merged row after staged edits.
  const [editingKey, setEditingKey] = useState<{ dbId: number | null; sig: string } | null>(null);

  const editingMatch: DraftMatch | null = useMemo(() => {
    if (!editingKey) return null;
    const rows = fx.allRowsForStage;
    if (editingKey.dbId != null) {
      const byId = rows.find((r) => (r as any).db_id === editingKey.dbId);
      if (byId) return byId;
    }
    return rows.find((r) => rowSignature(r) === editingKey.sig) ?? null;
  }, [editingKey, fx.allRowsForStage]);

  const openMatch = (m: DraftMatch) =>
    setEditingKey({ dbId: (m as any).db_id ?? null, sig: rowSignature(m) });

  // applyPatch that also re-keys the open sheet: structural patches (matchday,
  // round/pos, teams) change rowSignature, which would orphan rows without db_id.
  const trackedApplyPatch = (target: DraftMatch, patch: Parameters<typeof fx.applyPatch>[1]) => {
    fx.applyPatch(target, patch);
    setEditingKey({
      dbId: (target as any).db_id ?? null,
      sig: rowSignature({ ...target, ...patch } as DraftMatch),
    });
  };

  const [showCanvas, setShowCanvas] = useState(false);

  if (fx.isKO) {
    const maxRound = fx.koRounds.length ? Math.max(...fx.koRounds.map((r) => r.round)) : 1;
    const roundLabel = makeRoundLabel(maxRound);
    const teamsMap = Object.fromEntries(
      fx.stageFilteredTeams.map((t) => [
        t.id,
        { name: fx.nameOf(t.id).name, logo: fx.nameOf(t.id).logo, seed: t.seed ?? null },
      ])
    );
    return (
      <>
        {showCanvas ? (
          <div className="space-y-3">
            <button
              onClick={() => setShowCanvas(false)}
              className="text-sm text-indigo-300 hover:text-indigo-200"
            >
              ← Πίσω στη λίστα γύρων
            </button>
            <div className="overflow-x-auto">
              <KnockoutBoard stageIdx={fx.effectiveStageIdx} teamsMap={teamsMap} />
            </div>
          </div>
        ) : (
          <KnockoutRounds
            fx={fx}
            onOpenMatch={openMatch}
            showCanvasToggle
            onToggleCanvas={() => setShowCanvas(true)}
          />
        )}
        <KoMatchSheet
          open={editingMatch != null}
          onClose={() => setEditingKey(null)}
          match={editingMatch}
          allRows={fx.allRowsForStage}
          stageIdx={fx.effectiveStageIdx}
          teams={fx.stageFilteredTeams}
          nameOf={fx.nameOf}
          teamOptions={fx.teamOptions}
          applyPatch={trackedApplyPatch}
          removeRow={fx.removeRow}
          roundLabel={roundLabel}
        />
      </>
    );
  }

  return (
    <>
      <MatchList fx={fx} onOpenMatch={openMatch} />
      <MatchSheet
        open={editingMatch != null}
        onClose={() => setEditingKey(null)}
        match={editingMatch}
        teams={fx.stageFilteredTeams}
        isKO={false}
        applyPatch={trackedApplyPatch}
        removeRow={fx.removeRow}
      />
    </>
  );
}
