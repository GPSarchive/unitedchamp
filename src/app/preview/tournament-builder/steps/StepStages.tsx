"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronRight, Plus, Trash2 } from "lucide-react";
import type { NewTournamentPayload } from "@/app/lib/types";
import type { TeamDraft } from "@/app/dashboard/tournaments/TournamentCURD/TournamentWizard";
import { useTournamentStore } from "@/app/dashboard/tournaments/TournamentCURD/submit/tournamentStore";
import { computeGroupsSignature } from "@/app/dashboard/tournaments/TournamentCURD/util/groupsSignature";
import ConfirmDialog from "@/app/dashboard/tournaments/TournamentCURD/stages/ConfirmDialog";

import Button from "../ui/Button";
import Badge from "../ui/Badge";
import { card } from "../ui/tokens";
import { useTeamCatalog } from "../hooks/useTeamCatalog";
import StageSheet from "./stages/StageSheet";

type Stages = NewTournamentPayload["stages"];
type Stage = Stages[number];

const KIND_LABEL: Record<string, string> = {
  league: "Πρωτάθλημα",
  groups: "Όμιλοι",
  knockout: "Knockout",
};

/**
 * Stage cards + per-stage config sheet. The add/update/remove logic mirrors
 * stages/StageList.tsx exactly (including its direct store side effects), so
 * saveAll sees the same state as the live builder.
 */
export default function StepStages({
  stages,
  onChange,
  teams,
  onTeamGroupChange,
}: {
  stages: Stages;
  onChange: (stages: Stages) => void;
  teams: TeamDraft[];
  onTeamGroupChange?: (teamId: number, stageIdx: number, groupIdx: number | null) => void;
}) {
  const storeUpsertStage = useTournamentStore((s) => s.upsertStage);
  const storeRemoveStage = useTournamentStore((s) => s.removeStage);
  const storeListGroupsForStageIdx = useTournamentStore((s) => s.listGroupsForStageIdx);
  const storeRemoveGroup = useTournamentStore((s) => s.removeGroup);
  const draftMatches = useTournamentStore((s) => s.draftMatches);

  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [deleteIdx, setDeleteIdx] = useState<number | null>(null);

  // Catalog for team names in edit mode (initial TeamDrafts lack name/logo)
  const { byId: catalogById } = useTeamCatalog(false);

  const matchCountPerIdx = useMemo(() => {
    const map = new Map<number, number>();
    draftMatches.forEach((m) => {
      const si = (m.stageIdx ?? -1) as number;
      if (si >= 0) map.set(si, (map.get(si) ?? 0) + 1);
    });
    return map;
  }, [draftMatches]);

  // ---- ops copied from StageList.tsx ----
  const add = () => {
    const nextStage = {
      name: `Stage ${stages.length + 1}`,
      kind: "league",
      ordering: stages.length + 1,
      is_ko: false,
      config: {
        interval_days: 7,
        rounds_per_opponent: 1,
        double_round: false,
        shuffle: false,
      },
      groups: [],
    } as any;
    nextStage.is_ko = nextStage.kind === "knockout";

    storeUpsertStage(stages.length, {
      name: nextStage.name,
      kind: nextStage.kind as any,
      config: nextStage.config,
    });

    onChange([...stages, nextStage]);
    setOpenIdx(stages.length);
  };

  const update = (idx: number, patch: Partial<Stage>) => {
    const { name, kind, is_ko, config } = patch as any;
    const updatedIsKo = kind === "knockout" ? true : is_ko ?? false;

    if (name != null || kind != null || updatedIsKo != null || config != null) {
      storeUpsertStage(idx, {
        ...(name != null ? { name } : {}),
        ...(kind != null ? { kind: kind as any } : {}),
        ...(updatedIsKo != null ? { is_ko: updatedIsKo } : {}),
        ...(config != null ? { config } : {}),
      });
    }

    if ((patch as any).kind && (patch as any).kind !== "groups") {
      const existing = storeListGroupsForStageIdx(idx);
      for (let gi = existing.length - 1; gi >= 0; gi--) {
        storeRemoveGroup(idx, gi);
      }
    }

    const next = stages.slice();
    next[idx] = { id: (stages as any)[idx]?.id, ...next[idx], ...patch } as any;
    if ((patch as any).kind && (patch as any).kind !== "groups") {
      (next[idx] as any).groups = [];
    }
    onChange(next);
  };

  const remove = (idx: number) => {
    storeRemoveStage(idx);
    onChange(stages.filter((_, i) => i !== idx));
  };

  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= stages.length) return;
    const next = stages.slice();
    [next[idx], next[j]] = [next[j], next[idx]];
    next.forEach((s: any, i) => (s.ordering = i + 1));
    onChange(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold tracking-tight text-white">Στάδια</h2>
        <Button variant="primary" onClick={add}>
          <Plus size={15} />
          Στάδιο
        </Button>
      </div>

      {stages.length === 0 ? (
        <div className={`${card} p-6 text-center text-sm text-zinc-500`}>
          Κανένα στάδιο ακόμη — πρόσθεσε το πρώτο (π.χ. «Κανονική Περίοδος»).
        </div>
      ) : (
        <ul className="space-y-2">
          {stages.map((s: any, i) => (
            <StageCardItem
              key={s?.id ?? `tmp-${i}`}
              stage={s}
              index={i}
              total={stages.length}
              matchCount={matchCountPerIdx.get(i) ?? 0}
              onOpen={() => setOpenIdx(i)}
              onMoveUp={() => move(i, -1)}
              onMoveDown={() => move(i, +1)}
              onDelete={() => setDeleteIdx(i)}
              update={update}
            />
          ))}
        </ul>
      )}

      {openIdx != null && stages[openIdx] && (
        <StageSheet
          open
          onClose={() => setOpenIdx(null)}
          stage={stages[openIdx] as any}
          index={openIdx}
          allStages={stages}
          teams={teams}
          catalogById={catalogById}
          onChange={(patch) => update(openIdx, patch)}
          onTeamGroupChange={onTeamGroupChange}
        />
      )}

      {deleteIdx != null && (
        <ConfirmDialog
          open
          title="Διαγραφή σταδίου;"
          message={`Το στάδιο «${(stages[deleteIdx] as any)?.name ?? `#${deleteIdx + 1}`}» και οι αγώνες του θα αφαιρεθούν. Αυτό δεν μπορεί να αναιρεθεί.`}
          confirmLabel="Διαγραφή"
          cancelLabel="Άκυρο"
          onConfirm={() => {
            remove(deleteIdx);
            setDeleteIdx(null);
            if (openIdx === deleteIdx) setOpenIdx(null);
          }}
          onCancel={() => setDeleteIdx(null)}
        />
      )}
    </div>
  );
}

function StageCardItem({
  stage,
  index,
  total,
  matchCount,
  onOpen,
  onMoveUp,
  onMoveDown,
  onDelete,
  update,
}: {
  stage: any;
  index: number;
  total: number;
  matchCount: number;
  onOpen: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  update: (idx: number, patch: Partial<Stage>) => void;
}) {
  const cfg = (stage.config ?? {}) as any;
  const groupCount = Array.isArray(stage.groups) ? stage.groups.length : 0;

  // Keep cfg.groups_signature in sync (mirrors StageCard's always-mounted effect)
  useEffect(() => {
    if (stage.kind !== "groups") return;
    const sig = computeGroupsSignature((stage.groups ?? []) as Array<{ name: string }>);
    if (cfg.groups_signature !== sig) {
      update(index, { config: { ...cfg, groups_signature: sig } } as any);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage.kind, JSON.stringify(stage.groups?.map((g: any) => g?.name) ?? [])]);

  return (
    <li className={`${card} overflow-hidden`}>
      <div className="flex items-center">
        <button onClick={onOpen} className="flex min-h-16 min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left hover:bg-white/4 transition-colors">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-zinc-800 text-xs font-bold text-zinc-400">
            {index + 1}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-white">
              {stage.name || `Στάδιο ${index + 1}`}
            </span>
            <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <Badge tone={stage.kind === "knockout" ? "amber" : stage.kind === "groups" ? "indigo" : "neutral"}>
                {KIND_LABEL[stage.kind] ?? stage.kind}
              </Badge>
              {groupCount > 0 && <Badge>{groupCount} όμιλοι</Badge>}
              <Badge>{matchCount} αγώνες</Badge>
            </span>
          </span>
          <ChevronRight size={16} className="shrink-0 text-zinc-600" />
        </button>
        <div className="flex shrink-0 flex-col border-l border-white/5">
          <button
            onClick={onMoveUp}
            disabled={index === 0}
            aria-label="Μετακίνηση πάνω"
            className="grid h-8 w-10 place-items-center text-zinc-500 hover:text-white disabled:opacity-30 transition-colors"
          >
            <ArrowUp size={14} />
          </button>
          <button
            onClick={onDelete}
            aria-label="Διαγραφή σταδίου"
            className="grid h-8 w-10 place-items-center text-rose-500/70 hover:text-rose-400 transition-colors"
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={onMoveDown}
            disabled={index === total - 1}
            aria-label="Μετακίνηση κάτω"
            className="grid h-8 w-10 place-items-center text-zinc-500 hover:text-white disabled:opacity-30 transition-colors"
          >
            <ArrowDown size={14} />
          </button>
        </div>
      </div>
    </li>
  );
}
