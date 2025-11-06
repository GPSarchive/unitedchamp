"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { NewTournamentPayload } from "@/app/lib/types";
import TournamentBasicsForm from "./basics/TournamentBasicsForm";
import ValidationSummary from "./shared/ValidationSummary";
import StageList from "./stages/StageList";
import TeamPicker from "./teams/TeamPicker";
import ReviewAndSubmit from "./submit/ReviewAndSubmit";

// Store
import { useTournamentStore } from "@/app/dashboard/tournaments/TournamentCURD/submit/tournamentStore";
import { loadTournamentIntoStore } from "@/app/dashboard/tournaments/TournamentCURD/submit/loadSnapshotClient";

/* =========================================================
   Local types used across the builder
   ========================================================= */
export type TeamDraft = {
  id: number;
  seed?: number | null;
  name?: string;
  logo?: string | null;
  /** number-indexed groups mapping; values can be null */
  groupsByStage?: Record<number, number | null>;
};

/**
 * DraftMatch now supports BOTH draft-only fields and real DB-backed fields.
 * (Kept for types used elsewhere.)
 */
export type DraftMatch = {
  db_id?: number | null;
  updated_at?: string | null;
  stageIdx: number;
  groupIdx?: number | null;
  bracket_pos?: number | null;
  matchday?: number | null;
  match_date?: string | null;
  team_a_id?: number | null;
  team_b_id?: number | null;
  round?: number | null;
  status?: "scheduled" | "finished" | null;
  is_ko: boolean | null;  
  team_a_score?: number | null;
  team_b_score?: number | null;
  winner_team_id?: number | null;
  field?: string | null; // ✅ NEW
  home_source_match_idx?: number | null;
  away_source_match_idx?: number | null;
  home_source_outcome?: "W" | "L" | null;
  away_source_outcome?: "W" | "L" | null;
  home_source_round?: number | null;
  home_source_bracket_pos?: number | null;
  away_source_round?: number | null;
  away_source_bracket_pos?: number | null;
};



export type WizardMode = "create" | "edit";
export type WizardMeta = { id: number; slug: string | null; updated_at: string; created_at: string };

const empty: NewTournamentPayload = {
  tournament: {
    name: "",
    slug: null,
    logo: null,
    season: null,
    status: "scheduled",
    format: "mixed",
    start_date: null,
    end_date: null,
    winner_team_id: null,
  },
  stages: [],
  tournament_team_ids: [],
};

export default function TournamentWizard({
  mode = "create",
  meta = null,
  initialPayload = null,
  initialTeams = [],
  initialDraftMatches = [],
}: {
  mode?: WizardMode;
  meta?: WizardMeta | null;
  initialPayload?: NewTournamentPayload | null;
  initialTeams?: TeamDraft[];
  initialDraftMatches?: DraftMatch[];
}) {
  // --- core local state (teams + payload only) ------------------------------
  const [payload, setPayload] = useState<NewTournamentPayload>(initialPayload ?? empty);
  const [teams, setTeams] = useState<TeamDraft[]>(initialTeams ?? []);

  // Keep a ref to previous stages for diffing into the store
  const prevStagesRef = useRef<Array<any>>(payload.stages ?? []);

  // --- store hooks (matches live in the store) ------------------------------
  const storeDraftMatches = useTournamentStore((s) => s.draftMatches);
  const seedFromWizard = useTournamentStore((s) => s.seedFromWizard);
  const replaceAllDraftMatches = useTournamentStore((s) => s.replaceAllDraftMatches);

  const upsertStage = useTournamentStore((s) => s.upsertStage);
  const removeStage = useTournamentStore((s) => s.removeStage);
  const upsertGroup = useTournamentStore((s) => s.upsertGroup);
  const removeGroup = useTournamentStore((s) => s.removeGroup);

  // hydrate the store once from incoming props (payload + initial matches + teams)
  useEffect(() => {
    seedFromWizard(payload, teams, initialDraftMatches ?? []);
    // also mirror payload to the store for any components reading from there
    useTournamentStore.setState({ payload });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  // keep store payload in sync if user edits basics/stages here
  useEffect(() => {
    useTournamentStore.setState({ payload });
  }, [payload]);

  // ---- EDIT MODE: load full snapshot (standings, maps, etc.) into the store
  useEffect(() => {
    if (mode !== "edit" || !meta?.id) return;

    const ctrl = new AbortController();

    (async () => {
      try {
        // Fetch + hydrate via helper (includes standings)
        const snap: any = await loadTournamentIntoStore(meta.id, { signal: ctrl.signal });

        // Dev-only diagnostics
        if (process.env.NODE_ENV !== "production") {
          console.groupCollapsed(
            `%c[SNAPSHOT] tournament=%c${meta.id}%c hydrated`,
            "color:#88f", "color:#fff;font-weight:bold", "color:#888"
          );

          // From body
          const sCount = Array.isArray(snap?.standings) ? snap.standings.length : 0;
          const stageIds = Array.isArray(snap?.stages) ? snap.stages.map((s: any) => s.id) : [];
          console.info("standings.length (body):", sCount);
          console.info("stage ids (body):", stageIds.join(","));

          // From store after hydrate
          const st = useTournamentStore.getState();
          const storeCount = Array.isArray(st.entities?.standings) ? st.entities.standings.length : 0;
          console.info("store entities.standings.length:", storeCount);
          console.dir({
            stageIdByIndex: st.ids.stageIdByIndex,
            groupIdByStage: st.ids.groupIdByStage,
          });

          // Quick peek of first 10 standing rows
          if (storeCount > 0) {
            console.table(
              st.entities.standings.slice(0, 10).map((r) => ({
                stage_id: r.stage_id,
                group_id: r.group_id,
                team_id: r.team_id,
                played: r.played,
                points: r.points,
                rank: r.rank,
              }))
            );
          }
          console.groupEnd();
        }
      } catch (err) {
        console.error("[TournamentWizard] snapshot load failed:", err);
      }
    })();

    return () => ctrl.abort();
  }, [mode, meta?.id]);

  // --- derived: groups context ---------------------------------------------
  const groupStageIndices = useMemo(
    () => payload.stages.map((s, i) => (s.kind === "groups" ? i : -1)).filter((i) => i >= 0),
    [payload.stages]
  );

  const [assignStageIdx, setAssignStageIdx] = useState<number | undefined>(undefined);
  useEffect(() => {
    setAssignStageIdx((prev) => (prev != null && groupStageIndices.includes(prev) ? prev : groupStageIndices[0]));
  }, [groupStageIndices]);

  // --- validation summary (advisory; does not block saving) ----------------
  const errors = useMemo(() => {
    const out: string[] = [];
    if (!payload.tournament.name || !payload.tournament.name.trim()) {
      out.push("Συμπλήρωσε όνομα διοργάνωσης.");
    }
    if (teams.length < 2) {
      out.push("Πρόσθεσε τουλάχιστον 2 ομάδες.");
    }
    if (payload.stages.length === 0) {
      out.push("Χρειάζεσαι τουλάχιστον 1 στάδιο.");
    }
    payload.stages.forEach((s, i) => {
      if (s.kind === "groups") {
        const names = (s.groups ?? []).map((g: any) => String(g.name || "").trim()).filter(Boolean);
        if (names.length === 0) {
          out.push(`Το στάδιο «${s.name || `#${i + 1}`}» χρειάζεται τουλάχιστον 1 όμιλο.`);
        }
      }
    });
    return out;
  }, [payload.tournament.name, payload.stages, teams.length]);

  // --- helpers --------------------------------------------------------------

  // apply Stage & Group changes from the wizard props down into the store (best-effort diff)
  const syncStagesIntoStore = (prevStages: any[], nextStages: any[]) => {
    nextStages.forEach((s, i) => {
      upsertStage(i, { name: s.name, kind: s.kind, config: s.config ?? null });
      const groups: any[] = Array.isArray(s.groups) ? s.groups : [];
      groups.forEach((g, gi) => {
        upsertGroup(i, gi, { name: g?.name ?? `Group ${gi + 1}`, ordering: gi });
      });

      const prevGroupCount = Array.isArray(prevStages[i]?.groups) ? prevStages[i].groups.length : 0;
      for (let gi = prevGroupCount - 1; gi >= groups.length; gi--) {
        removeGroup(i, gi);
      }
    });

    for (let si = prevStages.length - 1; si >= nextStages.length; si--) {
      removeStage(si);
    }
  };

  // --- UI -------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Advisory validation panel */}
      {errors.length > 0 && <ValidationSummary errors={errors} />}

      {/* 1) Basics */}
      <TournamentBasicsForm
        value={payload.tournament}
        onChange={(t) => setPayload((p) => ({ ...p, tournament: t }))}
      />

      {/* 2) Setup: Teams + Stages */}
      <div className="space-y-6">
        {/* Teams & group assignment */}
        <div className="space-y-4">
          {groupStageIndices.length > 0 && (
            <div className="rounded-md border border-white/10 p-2 text-sm text-white/80">
              <label className="mr-2">Assign groups for stage:</label>
              <select
                className="bg-slate-950 border border-cyan-400/20 rounded-md px-2 py-1 text-white"
                value={assignStageIdx ?? ""}
                onChange={(e) => {
                  const val = e.target.value === "" ? undefined : Number(e.target.value);
                  setAssignStageIdx(val);
                }}
              >
                {groupStageIndices.map((i) => (
                  <option key={i} value={i}>
                    {(payload.stages[i]?.name || `Stage ${i + 1}`) + " (groups)"}
                  </option>
                ))}
              </select>
            </div>
          )}

          <TeamPicker
            teams={teams}
            groupsStageIndex={assignStageIdx}
            groupNames={
              typeof assignStageIdx === "number"
                ? (payload.stages as any)[assignStageIdx]?.groups?.map((g: any) => g.name) ?? []
                : []
            }
            onChange={(t) => {
              setTeams(t);
              setPayload((p) => ({ ...p, tournament_team_ids: t.map((x) => x.id) }));
            }}
          />
        </div>

        {/* Stages (keep local payload for UI; mirror edits to the store immediately) */}
        <div className="space-y-4">
          <StageList
            stages={payload.stages}
            onChange={(nextStages) => {
              const prevStages = prevStagesRef.current;
              setPayload((p) => ({ ...p, stages: nextStages }));
              syncStagesIntoStore(prevStages, nextStages);
              prevStagesRef.current = nextStages;
            }}
            teams={teams}
          />
        </div>
      </div>

      {/* 4) Save */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-cyan-200 font-semibold">Fixtures</h3>
          {/* Removed the Regenerate Fixtures Button */}
        </div>
      </div>

      {/* 5) Single Save button at the bottom (submit still receives matches; now from the store) */}
      <ReviewAndSubmit
        mode={mode}
        meta={meta ?? undefined}
        payload={payload}
        teams={teams}
        draftMatches={storeDraftMatches}
        onBack={() => {}}
      />
    </div>
  );
}
