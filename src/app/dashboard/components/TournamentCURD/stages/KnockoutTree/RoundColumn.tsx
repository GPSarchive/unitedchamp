"use client";

import type { Labels, BracketMatch as Match, TeamsMap } from "@/app/lib/types";
import MatchRow from "./MatchRow";
import EditablePairCard from "./EditablePairCard";
import type { Option } from "./types";
import { ByeStub } from "./ByeStub";

type EffTeams = {
  a: number | null;
  b: number | null;
  aDerived?: boolean;
  bDerived?: boolean;
};

export function RoundColumn({
  round,
  list,
  roundIdx,
  label,
  setNodeRef,
  transforms,
  minCardHeight,
  isStubId,
  teamsMap,
  L,
  onMatchClick,
  editable,
  onAssignSlot,
  onSwapPair,
  makeOptions,
  hadBye,
  smartTeams, // NEW
}: {
  round: number;
  list: Match[];
  roundIdx: number;
  label: string;

  setNodeRef: (id: number) => (el: HTMLDivElement | null) => void;
  transforms: Map<number, number>;
  minCardHeight: number;
  isStubId: (id: number) => boolean;

  teamsMap: TeamsMap;
  L: Labels;

  onMatchClick?: (m: Match) => void;
  editable: boolean;
  onAssignSlot?: (matchId: number, slot: "A" | "B", teamId: number | null) => void;
  onSwapPair?: (matchId: number) => void;
  makeOptions: (currentTeamId: number | null) => Option[];
  hadBye: (roundIdx: number, teamId: number | null) => boolean;

  /** UI-only progression */
  smartTeams: Map<number, EffTeams>;
}) {
  return (
    <div className="relative z-[1] flex flex-col gap-6 py-2 overflow-visible">
      <div className="px-1 text-sm tracking-wide uppercase text-white/60">{label}</div>

      {list.map((m) => {
        const stub = isStubId(m.id);
        const ty = transforms.get(m.id) ?? 0;

        if (stub) {
          return <ByeStub key={m.id} id={m.id} setNodeRef={setNodeRef} translateY={ty} />;
        }

        // Detect if either slot is fed by a parent pointer of any shape
        const hasHomePtr =
          !!(m as any).home_source_match_id ||
          Number.isFinite((m as any).home_source_round) ||
          Number.isFinite((m as any).home_source_match_idx);
        const hasAwayPtr =
          !!(m as any).away_source_match_id ||
          Number.isFinite((m as any).away_source_round) ||
          Number.isFinite((m as any).away_source_match_idx);

        const disableA = !!hasHomePtr;
        const disableB = !!hasAwayPtr;

        // allow editing in R1 or for matches with NO explicit parents (BYE / TBD)
        const isEditableCard =
          editable && !!onAssignSlot && (roundIdx === 0 || (!hasHomePtr && !hasAwayPtr));

        // Effective teams (DB first; otherwise UI-derived)
        const eff = smartTeams.get(m.id);
        const aId = (m.team_a_id ?? null) ?? eff?.a ?? null;
        const bId = (m.team_b_id ?? null) ?? eff?.b ?? null;
        const aDerived = !m.team_a_id && !!eff?.aDerived;
        const bDerived = !m.team_b_id && !!eff?.bDerived;

        return (
          <div
            key={m.id}
            ref={setNodeRef(m.id)}
            onClick={!isEditableCard && onMatchClick ? () => onMatchClick(m) : undefined}
            className="group relative rounded-xl border border-white/10 bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-slate-800/60 hover:border-white/25 hover:shadow-lg hover:shadow-emerald-500/10 transition-colors p-3 will-change-transform"
            style={{ minHeight: minCardHeight, transform: `translateY(${ty}px)` }}
          >
            {isEditableCard ? (
              <EditablePairCard
                match={m}
                teamsMap={teamsMap}
                L={L}
                onAssign={onAssignSlot!}
                onSwap={onSwapPair}
                makeOptions={makeOptions}
                disableA={disableA}
                disableB={disableB}
              />
            ) : (
              <>
                <MatchRow
                  id={aId}
                  derived={aDerived}
                  score={m.status === "finished" ? m.team_a_score : null}
                  teamsMap={teamsMap}
                  tbdText={L.tbd}
                  byeBadge={hadBye(roundIdx, aId) ? L.bye : null}
                />
                <div className="h-1" />
                <MatchRow
                  id={bId}
                  derived={bDerived}
                  score={m.status === "finished" ? m.team_b_score : null}
                  teamsMap={teamsMap}
                  tbdText={L.tbd}
                  byeBadge={hadBye(roundIdx, bId) ? L.bye : null}
                />
              </>
            )}
          </div>
        );
      })}

      {list.length === 0 && <div className="text-white/50 text-sm italic">—</div>}
    </div>
  );
}
