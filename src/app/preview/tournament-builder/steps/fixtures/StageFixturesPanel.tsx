"use client";

import { useMemo, useState } from "react";
import type { NewTournamentPayload } from "@/app/lib/types";
import type {
  TeamDraft,
  DraftMatch,
} from "@/app/dashboard/tournaments/TournamentCURD/TournamentWizard";
import KnockoutBoard from "@/app/dashboard/tournaments/TournamentCURD/stages/KnockoutTree/newknockout/KnockoutBoard";

import { useStageFixtures } from "./useStageFixtures";
import { rowSignature } from "./helpers";
import MatchList from "./MatchList";
import MatchSheet from "./MatchSheet";
import KnockoutRounds, { makeRoundLabel } from "./KnockoutRounds";
import KoMatchSheet from "./KoMatchSheet";

/**
 * Full match management for ONE stage (league/groups card list with group
 * filter, or KO round list), incl. the edit sheets. Used by the Fixtures step
 * and embedded in StageSheet so matches are manageable from the Stages step.
 */
export default function StageFixturesPanel({
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
