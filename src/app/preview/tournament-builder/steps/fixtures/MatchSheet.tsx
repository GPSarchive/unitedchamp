"use client";

import { useState } from "react";
import type { DraftMatch } from "@/app/dashboard/tournaments/TournamentCURD/TournamentWizard";
import type { TeamDraft } from "@/app/dashboard/tournaments/TournamentCURD/TournamentWizard";
import MatchControlPanel from "@/app/dashboard/tournaments/TournamentCURD/preview/MatchControlPanel";
import ConfirmDialog from "@/app/dashboard/tournaments/TournamentCURD/stages/ConfirmDialog";

import Sheet from "../../ui/Sheet";
import Button from "../../ui/Button";
import Field from "../../ui/Field";
import { field as fieldCls } from "../../ui/tokens";
import type { MatchPatch } from "./useStageFixtures";

/**
 * Bottom sheet for editing a single match. Mounts the existing
 * MatchControlPanel unchanged (teams/date/field staged for saveAll;
 * scores/player-stats saved immediately via server actions), plus a small
 * structure section (matchday, delete) handled via applyPatch/removeRow.
 */
export default function MatchSheet({
  open,
  onClose,
  match,
  teams,
  isKO,
  applyPatch,
  removeRow,
}: {
  open: boolean;
  onClose: () => void;
  match: DraftMatch | null;
  teams: TeamDraft[];
  isKO: boolean;
  applyPatch: (target: DraftMatch, patch: MatchPatch) => void;
  removeRow: (m: DraftMatch) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!match) return null;

  return (
    <Sheet open={open} onClose={onClose} title="Αγώνας" wide>
      <div className="space-y-4">
        {!isKO && (
          <div className="flex items-end gap-3">
            <Field label="Αγωνιστική" className="w-32">
              <input
                type="number"
                min={1}
                className={fieldCls}
                value={match.matchday ?? 1}
                onChange={(e) => {
                  const md = Number(e.target.value);
                  if (Number.isFinite(md) && md >= 1) applyPatch(match, { matchday: md });
                }}
              />
            </Field>
            <Button variant="danger" className="ml-auto" onClick={() => setConfirmDelete(true)}>
              Διαγραφή αγώνα
            </Button>
          </div>
        )}
        {isKO && (
          <div className="flex justify-end">
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>
              Διαγραφή αγώνα
            </Button>
          </div>
        )}

        <MatchControlPanel match={match} teams={teams} onClose={onClose} />
      </div>

      {confirmDelete && (
        <ConfirmDialog
          open={confirmDelete}
          title="Διαγραφή αγώνα;"
          message="Ο αγώνας θα διαγραφεί κατά την αποθήκευση. Αυτό δεν μπορεί να αναιρεθεί."
          onConfirm={() => {
            setConfirmDelete(false);
            removeRow(match);
            onClose();
          }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </Sheet>
  );
}
