import { useTransition, useState } from "react";
import type { NewTournamentPayload } from "@/app/lib/types";
import type { TeamDraft, DraftMatch } from "../TournamentWizard";
import { createTournamentAction } from "../actions";
import { useTournamentStore } from "../submit/tournamentStore";
import { loadTournamentIntoStore } from "./loadSnapshotClient";

/* ----------------------------------------------------------------
   Helpers: kinds + names (unchanged)
----------------------------------------------------------------- */
type StageKind = "league" | "groups" | "knockout";
const kindOf = (s: NewTournamentPayload["stages"][number]): StageKind =>
  ((s as any)?.kind ?? "league") as StageKind;
const nameOf = (payload: NewTournamentPayload, i: number) =>
  payload.stages[i]?.name ?? `#${i + 1}`;

/* ----------------------------------------------------------------
   Coercion helper (unchanged)
----------------------------------------------------------------- */
const asIdx = (v: any): number | undefined => {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

/* ----------------------------------------------------------------
   Canonicalize refs by ID → index (unchanged)
----------------------------------------------------------------- */
function canonicalizeStageRefsById(
  payload: NewTournamentPayload
): { canon: NewTournamentPayload; warnings: string[] } {
  const idToIdx = new Map<number, number>();
  const warnings: string[] = [];

  payload.stages.forEach((s, i) => {
    const sid = (s as any)?.id;
    if (typeof sid === "number") idToIdx.set(sid, i);
  });

  const clone: NewTournamentPayload = JSON.parse(JSON.stringify(payload));

  clone.stages.forEach((s, i) => {
    const cfg = ((s as any).config ?? {}) as any;

    if (cfg.from_stage_id != null) {
      if (idToIdx.has(cfg.from_stage_id)) {
        cfg.from_stage_idx = idToIdx.get(cfg.from_stage_id);
      } else {
        warnings.push(
          `Stage “${nameOf(payload, i)}” ( #${i + 1} ): from_stage_id=${cfg.from_stage_id} not found (link cleared).`
        );
        delete cfg.from_stage_idx;
      }
    }

    if (cfg.from_knockout_stage_id != null) {
      if (idToIdx.has(cfg.from_knockout_stage_id)) {
        cfg.from_knockout_stage_idx = idToIdx.get(cfg.from_knockout_stage_id);
      } else {
        warnings.push(
          `Stage “${nameOf(payload, i)}” ( #${i + 1} ): from_knockout_stage_id=${cfg.from_knockout_stage_id} not found (link cleared).`
        );
        delete cfg.from_knockout_stage_idx;
      }
    }

    (s as any).config = cfg;
  });

  return { canon: clone, warnings };
}

/* ----------------------------------------------------------------
   Validate 1 (unchanged)
----------------------------------------------------------------- */
function validateStageOrderingAndRefs(payload: NewTournamentPayload): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  payload.stages.forEach((stage, i) => {
    const cfg = ((stage as any).config ?? {}) as any;

    // KO <- (League|Groups)
    {
      const src = asIdx(cfg.from_stage_idx);
      if (kindOf(stage) === "knockout" && src !== undefined) {
        if (src < 0 || src >= payload.stages.length) {
          errors.push(`Stage “${nameOf(payload, i)}” ( #${i + 1} ): from_stage_idx=${src} is out of range.`);
        } else {
          if (src >= i) {
            errors.push(
              `Stage “${nameOf(payload, i)}” ( #${i + 1} ) references a future stage “${nameOf(
                payload,
                src
              )}” ( #${src + 1} ). KO can only source from earlier stages.`
            );
          }
          const k = kindOf(payload.stages[src]);
          if (!(k === "league" || k === "groups")) {
            errors.push(
              `Stage “${nameOf(payload, i)}” ( #${i + 1} ): KO must source from a League or Groups stage; got “${k}” at “${nameOf(
                payload,
                src
              )}” ( #${src + 1} ).`
            );
          }
          if (src === i) {
            errors.push(`Stage “${nameOf(payload, i)}” ( #${i + 1} ) references itself (from_stage_idx=${src}).`);
          }
        }
      }
    }

    // Groups <- KO
    {
      const src = asIdx(cfg.from_knockout_stage_idx);
      if (kindOf(stage) === "groups" && src !== undefined) {
        if (src < 0 || src >= payload.stages.length) {
          errors.push(
            `Stage “${nameOf(payload, i)}” ( #${i + 1} ): from_knockout_stage_idx=${src} is out of range.`
          );
        } else {
          if (src >= i) {
            errors.push(
              `Stage “${nameOf(payload, i)}” ( #${i + 1} ) references a future stage “${nameOf(
                payload,
                src
              )}” ( #${src + 1} ). Groups can only intake from an earlier KO.`
            );
          }
          const k = kindOf(payload.stages[src]);
          if (k !== "knockout") {
            errors.push(
              `Stage “${nameOf(payload, i)}” ( #${i + 1} ): groups intake must source from a Knockout stage; got “${k}” at “${nameOf(
                payload,
                src
              )}” ( #${src + 1} ).`
            );
          }
          if (src === i) {
            errors.push(
              `Stage “${nameOf(payload, i)}” ( #${i + 1} ) references itself (from_knockout_stage_idx=${src}).`
            );
          }
        }
      }
    }
  });

  return { errors, warnings };
}

/* ----------------------------------------------------------------
   Validate 2 (unchanged)
----------------------------------------------------------------- */
function validateStagesGraph(payload: NewTournamentPayload): { errors: string[] } {
  const N = payload.stages.length;
  const adj: number[][] = Array.from({ length: N }, () => []);
  const errors: string[] = [];

  payload.stages.forEach((stage, i) => {
    const cfg = ((stage as any).config ?? {}) as any;

    {
      const src = asIdx(cfg.from_stage_idx);
      if (kindOf(stage) === "knockout" && src !== undefined && src >= 0 && src < N) {
        adj[src].push(i);
      }
    }

    {
      const src = asIdx(cfg.from_knockout_stage_idx);
      if (kindOf(stage) === "groups" && src !== undefined && src >= 0 && src < N) {
        adj[src].push(i);
      }
    }
  });

  const VISITING = 1;
  const DONE = 2;
  const state = new Array<number>(N).fill(0);
  const stack: number[] = [];

  const dfs = (u: number): boolean => {
    state[u] = VISITING;
    stack.push(u);
    for (const v of adj[u]) {
      if (state[v] === 0) {
        if (dfs(v)) return true;
      } else if (state[v] === VISITING) {
        const j = stack.indexOf(v);
        const cyc = stack.slice(j).concat(v);
        const label = cyc.map((idx) => `“${nameOf(payload, idx)}” ( #${idx + 1} )`).join(" → ");
        errors.push(`Circular dependency detected: ${label}`);
        return true;
      }
    }
    stack.pop();
    state[u] = DONE;
    return false;
  };

  for (let i = 0; i < N; i++) {
    if (state[i] === 0) {
      if (dfs(i)) break;
    }
  }

  return { errors };
}

/* ----------------------------------------------------------------
   Stable selectors (fixes Next/Zustand getServerSnapshot warning)
----------------------------------------------------------------- */
const selectBusy = (s: any) => s.busy as boolean;
const selectSaveAll = (s: any) => s.saveAll as () => Promise<void>;
const selectSeedFromWizard = (s: any) =>
  s.seedFromWizard as
    | ((payload: NewTournamentPayload, teams: TeamDraft[], draftMatches: DraftMatch[]) => void)
    | undefined;
const selectAnyDirty = (s: any) => {
  const d: {
    tournament?: boolean;
    stages?: boolean;
    groups?: boolean;
    tournamentTeams?: boolean;
    intakeMappings?: boolean;
    matches?: Set<any>;
    stageSlots?: Set<any>;
    deletedMatchIds?: Set<number>;
    deletedGroupIds?: Set<number>;
    deletedStageIds?: Set<number>;
  } = s.dirty ?? {};

  return Boolean(
    d.tournament ||
      d.stages ||
      d.groups ||
      d.tournamentTeams ||
      d.intakeMappings ||
      d.matches?.size ||
      d.stageSlots?.size ||
      d.deletedMatchIds?.size ||
      d.deletedGroupIds?.size ||
      d.deletedStageIds?.size
  );
}

/* ----------------------------------------------------------------
   Component
----------------------------------------------------------------- */

type CreateTournamentOk1 = { ok: true; id: number };
type CreateTournamentOk2 = { ok: true; tournamentId: number };
type CreateTournamentOk3 = { ok: true; tournament: { id: number } };
type CreateTournamentErr = { ok: false; error?: any };
type CreateTournamentResult = CreateTournamentOk1 | CreateTournamentOk2 | CreateTournamentOk3 | CreateTournamentErr;

export default function ReviewAndSubmit({
  mode = "create",
  meta,
  payload,
  teams,
  draftMatches,
  onBack,
}: {
  mode?: "create" | "edit";
  meta?: { id: number; slug: string | null; updated_at: string; created_at: string };
  payload: NewTournamentPayload;
  teams: TeamDraft[];
  draftMatches: DraftMatch[];
  onBack: () => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [warningsUi, setWarningsUi] = useState<string[]>([]);

  // ✅ use stable, module-scoped selectors
  const busy = useTournamentStore(selectBusy);
  const saveAll = useTournamentStore(selectSaveAll);
  const seedFromWizard = useTournamentStore(selectSeedFromWizard);
  const anyDirty = useTournamentStore(selectAnyDirty);

  const submit = () => {
    setError(null);
    setWarningsUi([]);

    // Logging when submit is triggered
    console.log("[ReviewAndSubmit][submit] - Submit triggered");

    // Skip no-op saves in edit mode
    if (mode === "edit" && !anyDirty) {
      console.log("[ReviewAndSubmit][submit] - No changes detected, skipping submit");
      return;
    }

    // 1) Canonicalize id→idx + validations
    const { canon, warnings } = canonicalizeStageRefsById(payload);
    const orderCheck = validateStageOrderingAndRefs(canon);
    const graphCheck = validateStagesGraph(canon);

    const allErrors = [...orderCheck.errors, ...graphCheck.errors];
    const allWarnings = [...warnings, ...orderCheck.warnings];

    // Log any warnings and errors
    if (allWarnings.length) {
      console.log("[ReviewAndSubmit][submit] - Warnings:", allWarnings);
      setWarningsUi(allWarnings);
    }
    if (allErrors.length) {
      console.log("[ReviewAndSubmit][submit] - Errors:", allErrors);
      setError(allErrors.join("\n"));
      return;
    }

    start(async () => {
      try {
        // Logging the start of the creation or saving process
        if (mode === "create") {
          console.log("[ReviewAndSubmit][submit] - Creating new tournament...");
          const raw = (await createTournamentAction(
            (() => {
              const fd = new FormData();
              fd.set("payload", JSON.stringify(canon));
              fd.set("teams", JSON.stringify(teams ?? []));
              fd.set("draftMatches", JSON.stringify(draftMatches ?? []));
              return fd;
            })()
          )) as unknown as CreateTournamentResult;

          if (!raw || (raw as any).ok === false) {
            setError(raw && "error" in (raw as any)
              ? (raw as any).error || "Failed to create tournament."
              : "Failed to create tournament.");
            console.error("[ReviewAndSubmit][submit] - Failed to create tournament", raw);
            return;
          }

          const newId =
            "id" in (raw as any) && typeof (raw as any).id === "number"
              ? (raw as any).id
              : undefined;

          if (typeof newId !== "number") {
            setError("Create returned no ID. Please ensure createTournamentAction returns { ok:true, id:number }.");
            console.error("[ReviewAndSubmit][submit] - Create returned no ID");
            return;
          }

          // 2) Hydrate the store from DB (so stage/group IDs are real)
          console.log("[ReviewAndSubmit][submit] - Hydrating store from DB...");
          await loadTournamentIntoStore(newId);

          // 3) NOW seed wizard state into the store (marking things dirty)
          seedFromWizard?.(canon, teams, draftMatches);

          // 4) Persist via the store-driven saveAll flow
          console.log("[ReviewAndSubmit][submit] - Saving tournament state...");
          await saveAll();

          // 5) Rehydrate after success
          console.log("[ReviewAndSubmit][submit] - Rehydrating store after save...");
          await loadTournamentIntoStore(newId);
          return;
        }

        // =============== EDIT MODE ===============
        console.log("[ReviewAndSubmit][submit] - Editing existing tournament...");

        // Ensure that meta is defined before accessing its properties
        if (!meta) {
          console.error("[ReviewAndSubmit][submit] - Meta is undefined, cannot proceed");
          return;
        }

        // Similar flow for edit mode...
        await loadTournamentIntoStore(meta.id);
        seedFromWizard?.(canon, teams, draftMatches);
        await saveAll();
        if (meta?.id) await loadTournamentIntoStore(meta.id);

        return;
      } catch (e: any) {
        setError(e?.message || "Unexpected error");
        console.error("[ReviewAndSubmit][submit] - Error during submit:", e);
      }
    });
  };

  return (
    <div className="rounded-xl border border-cyan-400/20 bg-gradient-to-br from-slate-900/60 to-indigo-950/50 p-4 space-y-4">
      <h3 className="text-xl font-semibold text-cyan-200">Review</h3>
      <ul className="list-disc pl-5 text-sm text-white/85">
        <li>Name: {payload.tournament.name}</li>
        <li>Format: {payload.tournament.format}</li>
        <li>Stages: {payload.stages.length}</li>
        <li>Teams: {teams.length}</li>
        <li>Preview/Live matches in state: {draftMatches.length}</li>
      </ul>

      {warningsUi.length > 0 && (
        <pre className="whitespace-pre-wrap text-amber-300/90 text-sm bg-amber-500/10 border border-amber-400/20 rounded-md p-2">
          ⚠ Warnings:
          {"\n"}
          {warningsUi.join("\n")}
        </pre>
      )}

      {error && (
        <pre className="whitespace-pre-wrap text-rose-300 text-sm bg-rose-500/10 border border-rose-400/20 rounded-md p-2">
          ⚠ {error}
        </pre>
      )}

      <div className="flex gap-2">
        <button
          onClick={onBack}
          className="px-3 py-2 rounded-md border border-white/10 bg-slate-900/40 text-white/90 hover:bg-cyan-500/5 hover:border-cyan-400/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
        >
          Back
        </button>

        <button
          onClick={submit}
          disabled={pending || busy}
          aria-busy={pending || busy}
          className="px-3 py-2 rounded-md border border-emerald-400/40 text-emerald-200 bg-emerald-600/20 hover:bg-emerald-600/30 disabled:opacity-60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
          title={!anyDirty && mode === "edit" ? "No changes to save" : undefined}
        >
          {pending || busy
            ? mode === "edit"
              ? "Saving…"
              : "Creating…"
            : mode === "edit"
            ? "Save Changes"
            : "Create & Save All"}
        </button>
      </div>
    </div>
  );
}
