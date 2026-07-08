"use client";

import { useState } from "react";
import { Plus, RefreshCw, Search } from "lucide-react";
import type { DraftMatch } from "@/app/dashboard/tournaments/TournamentCURD/TournamentWizard";
import ConfirmDialog from "@/app/dashboard/tournaments/TournamentCURD/stages/ConfirmDialog";

import Button from "../../ui/Button";
import SegmentedControl from "../../ui/SegmentedControl";
import { field as fieldCls } from "../../ui/tokens";
import MatchCard from "./MatchCard";
import { rowSignature } from "./helpers";
import type { useStageFixtures } from "./useStageFixtures";

type Fixtures = ReturnType<typeof useStageFixtures>;

/** League/groups fixtures as a mobile card list grouped by matchday. */
export default function MatchList({
  fx,
  onOpenMatch,
}: {
  fx: Fixtures;
  onOpenMatch: (m: DraftMatch) => void;
}) {
  const [query, setQuery] = useState("");
  const [confirmRegen, setConfirmRegen] = useState(false);

  const {
    isGroups,
    storeGroups,
    groupIdx,
    setGroupIdx,
    useAllGroups,
    matchdayGroups,
    nameOf,
    addRow,
    regenerateStage,
  } = fx;

  const q = query.trim().toLowerCase();
  const filteredGroups = q
    ? matchdayGroups
        .map(({ matchday, rows }) => ({
          matchday,
          rows: rows.filter((m) => {
            const a = nameOf(m.team_a_id ?? null).name.toLowerCase();
            const b = nameOf(m.team_b_id ?? null).name.toLowerCase();
            return a.includes(q) || b.includes(q);
          }),
        }))
        .filter((g) => g.rows.length > 0)
    : matchdayGroups;

  const groupNameByIdx = new Map(storeGroups.map((g) => [g.idx, g.name]));

  return (
    <div className="space-y-4">
      {/* Group filter */}
      {isGroups && storeGroups.length > 0 && (
        <SegmentedControl
          segments={[
            { id: "-1", label: "Όλοι οι όμιλοι" },
            ...storeGroups.map((g) => ({ id: String(g.idx), label: g.name })),
          ]}
          activeId={String(useAllGroups ? -1 : groupIdx)}
          onSelect={(id) => setGroupIdx(Number(id))}
        />
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-48">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
          <input
            type="search"
            className={`${fieldCls} pl-9`}
            placeholder="Αναζήτηση ομάδας…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Button variant="ghost" onClick={() => setConfirmRegen(true)} title="Αναδημιουργία αγώνων σταδίου">
          <RefreshCw size={15} />
          <span className="hidden sm:inline">Αναδημιουργία</span>
        </Button>
        <Button variant="primary" onClick={addRow}>
          <Plus size={15} />
          Αγώνας
        </Button>
      </div>

      {/* Matchday sections */}
      {filteredGroups.length === 0 ? (
        <p className="rounded-xl border border-white/8 bg-[#0d0f14] p-6 text-center text-sm text-zinc-500">
          {q
            ? "Κανένας αγώνας δεν ταιριάζει στην αναζήτηση."
            : "Δεν υπάρχουν αγώνες σε αυτό το στάδιο — δοκίμασε «Αναδημιουργία» ή «+ Αγώνας»."}
        </p>
      ) : (
        filteredGroups.map(({ matchday, rows }) => (
          <section key={matchday}>
            <h3 className="sticky top-14 z-10 -mx-1 mb-2 bg-black/90 px-1 py-1.5 text-xs font-bold uppercase tracking-wider text-zinc-500 backdrop-blur">
              Αγωνιστική {matchday || "—"}
              <span className="ml-2 font-normal normal-case text-zinc-600">{rows.length} αγώνες</span>
            </h3>
            <div className="space-y-2">
              {rows.map((m, i) => (
                <MatchCard
                  key={`${rowSignature(m)}|${i}`}
                  match={m}
                  nameOf={nameOf}
                  onOpen={() => onOpenMatch(m)}
                  subtitle={
                    useAllGroups && m.groupIdx != null
                      ? groupNameByIdx.get(m.groupIdx) ?? `Όμιλος ${m.groupIdx + 1}`
                      : null
                  }
                />
              ))}
            </div>
          </section>
        ))
      )}

      {confirmRegen && (
        <ConfirmDialog
          open={confirmRegen}
          title="Αναδημιουργία αγώνων;"
          message="Οι αγώνες του σταδίου θα ξαναδημιουργηθούν. Σκορ και IDs διατηρούνται όπου τα ζευγάρια ταιριάζουν."
          confirmLabel="Αναδημιουργία"
          cancelLabel="Άκυρο"
          onConfirm={() => {
            setConfirmRegen(false);
            regenerateStage();
          }}
          onCancel={() => setConfirmRegen(false)}
        />
      )}
    </div>
  );
}
