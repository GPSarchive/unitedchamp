// app/dashboard/tournaments/TournamentCURD/TournamentWizard.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { generateDraftMatches } from "./util/Generators";
import type { NewTournamentPayload } from "@/app/lib/types";
import TournamentBasicsForm from "./basics/TournamentBasicsForm";
import ValidationSummary from "./shared/ValidationSummary";
import StageList from "./stages/StageList";
import TeamPicker from "./teams/TeamPicker";
import ReviewAndSubmit from "./submit/ReviewAndSubmit";

// Store
import { useTournamentStore } from "@/app/dashboard/tournaments/TournamentCURD/submit/tournamentStore";
import { loadTournamentIntoStore } from "@/app/dashboard/tournaments/TournamentCURD/submit/loadSnapshotClient";

// Align with StageCard’s stricter type for UI rendering
import type { StageDraft as StageCardDraft } from "./stages/StageCard";

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

type GroupDraft = { name?: string | null } & Record<string, unknown>;
type StageDraft = {
  name?: string | null;
  kind?: "league" | "groups" | "knockout";
  config?: unknown;
  groups?: GroupDraft[];
} & Record<string, unknown>;

/**
 * DraftMatch supports draft-only and DB-backed fields.
 */
export type DraftMatch = {
  db_id?: number | null;
  stageIdx: number;
  groupIdx?: number | null;
  bracket_pos?: number | null;
  matchday?: number | null;
  match_date?: string | null;
  team_a_id?: number | null;
  team_b_id?: number | null;
  round?: number | null;

  status?: "scheduled" | "finished" | null;
  team_a_score?: number | null;
  team_b_score?: number | null;
  winner_team_id?: number | null;

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
  const prevStagesRef = useRef<StageDraft[]>((payload.stages as unknown as StageDraft[]) ?? []);

  // --- store hooks (matches live in the store) ------------------------------
  const storeDraftMatches = useTournamentStore((s) => s.draftMatches);
  const seedFromWizard = useTournamentStore((s) => s.seedFromWizard);
  const replaceAllDraftMatches = useTournamentStore((s) => s.replaceAllDraftMatches);

  const upsertStage = useTournamentStore((s) => s.upsertStage);
  const removeStage = useTournamentStore((s) => s.removeStage);
  const upsertGroup = useTournamentStore((s) => s.upsertGroup);
  const removeGroup = useTournamentStore((s) => s.removeGroup);

  // hydrate the store once from incoming props (payload + initial matches + teams)
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return; // StrictMode guard
    seededRef.current = true;

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
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (mode !== "edit" || !meta?.id || hydratedRef.current) return;
    hydratedRef.current = true;

    const ctrl = new AbortController();

    (async () => {
      try {
        // Fetch + hydrate via helper (includes standings)
        const snap: unknown = await loadTournamentIntoStore(meta.id, { signal: ctrl.signal });

        // Dev-only diagnostics
        if (process.env.NODE_ENV !== "production") {
          console.groupCollapsed(
            `%c[SNAPSHOT] tournament=%c${meta.id}%c hydrated`,
            "color:#88f",
            "color:#fff;font-weight:bold",
            "color:#888"
          );

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
              st.entities.standings.slice(0, 10).map((r: any) => ({
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
    () =>
      payload.stages
        .map((s: any, i: number) => ((s as any).kind === "groups" ? i : -1))
        .filter((i: number) => i >= 0),
    [payload.stages]
  );

  const [assignStageIdx, setAssignStageIdx] = useState<number | undefined>(undefined);
  useEffect(() => {
    setAssignStageIdx((prev) => (prev != null && groupStageIndices.includes(prev) ? prev : groupStageIndices[0]));
  }, [groupStageIndices]);

  // --- validation summary (advisory; does not block saving) ----------------
  const errors = useMemo<string[]>(() => {
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
    (payload.stages as unknown as StageDraft[]).forEach((s, i) => {
      if (s.kind === "groups") {
        const names = (s.groups ?? []).map((g) => String(g.name || "").trim()).filter(Boolean);
        if (names.length === 0) {
          out.push(`Το στάδιο «${s.name || `#${i + 1}`}» χρειάζεται τουλάχιστον 1 όμιλο.`);
        }
      }
    });
    return out;
  }, [payload.tournament.name, payload.stages, teams.length]);

  // --- helpers --------------------------------------------------------------

  // apply Stage & Group changes from the wizard props down into the store (best-effort diff)
  const syncStagesIntoStore = (prevStages: StageDraft[], nextStages: StageDraft[]) => {
    // upsert/update stages in order
    nextStages.forEach((s, i) => {
      upsertStage(i, {
        name: s.name ?? undefined, // fix: store expects string | undefined
        kind: s.kind as any,
        config: s.config ?? null,
      });

      const groups: GroupDraft[] = Array.isArray(s.groups) ? s.groups : [];
      // upsert/update groups for this stage
      groups.forEach((g, gi) => {
        upsertGroup(i, gi, { name: g?.name ?? `Group ${gi + 1}`, ordering: gi });
      });

      // remove any trailing groups that existed before but not now
      const prevGroupCount = Array.isArray(prevStages[i]?.groups) ? (prevStages[i].groups as GroupDraft[]).length : 0;
      for (let gi = prevGroupCount - 1; gi >= groups.length; gi--) {
        removeGroup(i, gi);
      }
    });

    // remove trailing stages that no longer exist
    for (let si = prevStages.length - 1; si >= nextStages.length; si--) {
      removeStage(si);
    }
  };

  // Regenerate fixtures from generators keeping DB/live fields where possible
  const regenerateKeepingDB = () => {
    const fresh = generateDraftMatches({ payload, teams });

    const key = (m: DraftMatch) =>
      [
        m.stageIdx,
        m.groupIdx ?? "",
        m.round ?? "",
        m.bracket_pos ?? "",
        m.matchday ?? "",
        m.home_source_round ?? "",
        m.home_source_bracket_pos ?? "",
        m.away_source_round ?? "",
        m.away_source_bracket_pos ?? "",
      ].join("|");

    const oldByKey = new Map<string, DraftMatch>(storeDraftMatches.map((m: DraftMatch) => [key(m), m]));
    const merged: DraftMatch[] = fresh.map((f) => {
      const old = oldByKey.get(key(f));
      return old
        ? {
            ...f,
            db_id: old.db_id ?? null,
            status: old.status ?? null,
            team_a_score: old.team_a_score ?? null,
            team_b_score: old.team_b_score ?? null,
            winner_team_id: old.winner_team_id ?? null,
          }
        : f;
    });

    replaceAllDraftMatches(merged);
  };

  // --- normalize stages for UI (strict StageCardDraft) ----------------------
  const stagesForUI = useMemo<StageCardDraft[]>(
    () =>
      (payload.stages as any[]).map((s, i) => ({
        id: s?.id,
        name: s?.name ?? `Stage ${i + 1}`,
        kind: (s?.kind ?? "league") as "league" | "groups" | "knockout",
        ordering: (s as any)?.ordering ?? i + 1,
        config: s?.config ?? {},
        groups: Array.isArray((s as any)?.groups)
          ? ((s as any).groups as any[]).map((g: any, gi: number) => ({
              id: g?.id,
              name: g?.name ?? `Όμιλος ${gi + 1}`,
            }))
          : [],
      })),
    [payload.stages]
  );

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
            stages={stagesForUI}
            onChange={(nextStages) => {
              const prevStages = prevStagesRef.current;
              // 1) update local payload
              setPayload((p) => ({ ...p, stages: nextStages as unknown as NewTournamentPayload["stages"] }));
              // 2) reflect edits into the store (best-effort diff)
              syncStagesIntoStore(prevStages, nextStages as unknown as StageDraft[]);
              // 3) remember for next diff
              prevStagesRef.current = nextStages as unknown as StageDraft[];
            }}
            teams={teams}
          />
        </div>
      </div>

      {/* 4) Regenerate & Save */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-cyan-200 font-semibold">Fixtures</h3>
          <button
            type="button"
            onClick={regenerateKeepingDB}
            className="ml-auto px-3 py-2 rounded-md border border-cyan-400/30 text-cyan-200 hover:bg-cyan-500/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
          >
            Regenerate fixtures
          </button>
        </div>
      </div>

      {/* 5) Single Save button at the bottom */}
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
