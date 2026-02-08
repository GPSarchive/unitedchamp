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
  // BUT skip in edit mode - the snapshot load below will handle it
  useEffect(() => {
    if (mode === "edit") return; // ✅ Skip initial seed in edit mode to prevent double hydration
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

  // --- team-to-group assignment (per-stage, driven from each StageCard) -----
  const handleTeamGroupChange = (teamId: number, stageIdx: number, groupIdx: number | null) => {
    setTeams((prev) =>
      prev.map((t) =>
        t.id === teamId
          ? {
              ...t,
              groupsByStage: {
                ...(t.groupsByStage ?? {}),
                [stageIdx]: groupIdx,
              },
            }
          : t
      )
    );
  };

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
  const steps = [
    { num: 1, label: "Tournament Details", desc: "Name, format & branding" },
    { num: 2, label: "Teams", desc: `${teams.length} team${teams.length !== 1 ? "s" : ""} selected` },
    { num: 3, label: "Stages & Fixtures", desc: `${payload.stages.length} stage${payload.stages.length !== 1 ? "s" : ""} configured` },
    { num: 4, label: "Review & Save", desc: "Finalize your tournament" },
  ];

  return (
    <div className="space-y-8">
      {/* Wizard step indicator */}
      <nav className="flex items-center justify-between gap-2 px-1">
        {steps.map((step, i) => (
          <div key={step.num} className="flex items-center gap-2 flex-1 min-w-0">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold
                  ${i === 0
                    ? "bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-500/25"
                    : "bg-white/[0.06] text-white/50 border border-white/[0.08]"
                  }`}
              >
                {step.num}
              </div>
              <div className="min-w-0 hidden sm:block">
                <div className="text-sm font-medium text-white/90 truncate">{step.label}</div>
                <div className="text-[11px] text-white/40 truncate">{step.desc}</div>
              </div>
            </div>
            {i < steps.length - 1 && (
              <div className="flex-1 h-px bg-gradient-to-r from-white/[0.08] to-transparent mx-2 hidden md:block" />
            )}
          </div>
        ))}
      </nav>

      {/* Advisory validation panel */}
      {errors.length > 0 && <ValidationSummary errors={errors} />}

      {/* Step 1: Tournament Details */}
      <section>
        <SectionHeader num={1} title="Tournament Details" subtitle="Set up your tournament identity and format" />
        <TournamentBasicsForm
          value={payload.tournament}
          onChange={(t) => setPayload((p) => ({ ...p, tournament: t }))}
        />
      </section>

      {/* Step 2: Teams */}
      <section>
        <SectionHeader num={2} title="Teams" subtitle="Choose the teams that will compete in this tournament" />
        <TeamPicker
          teams={teams}
          onChange={(t) => {
            setTeams(t);
            setPayload((p) => ({ ...p, tournament_team_ids: t.map((x) => x.id) }));
          }}
        />
      </section>

      {/* Step 3: Stages & Fixtures */}
      <section>
        <SectionHeader num={3} title="Stages & Fixtures" subtitle="Define the stages, groups, and knockout brackets" />
        <StageList
          stages={payload.stages}
          onChange={(nextStages) => {
            const prevStages = prevStagesRef.current;
            setPayload((p) => ({ ...p, stages: nextStages }));
            syncStagesIntoStore(prevStages, nextStages);
            prevStagesRef.current = nextStages;
          }}
          teams={teams}
          onTeamGroupChange={handleTeamGroupChange}
        />
      </section>

      {/* Step 4: Review & Save */}
      <section>
        <SectionHeader num={4} title="Review & Save" subtitle="Check everything and publish your tournament" />
        <ReviewAndSubmit
          mode={mode}
          meta={meta ?? undefined}
          payload={payload}
          teams={teams}
          draftMatches={storeDraftMatches}
          onBack={() => {}}
        />
      </section>
    </div>
  );
}

/* ---- Shared section header ---- */
function SectionHeader({ num, title, subtitle }: { num: number; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-4 mb-4">
      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-600/20 border border-violet-400/20 flex items-center justify-center text-sm font-bold text-violet-300">
        {num}
      </div>
      <div>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <p className="text-sm text-white/40">{subtitle}</p>
      </div>
    </div>
  );
}
