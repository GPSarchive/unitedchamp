// app/dashboard/tournaments/TournamentCURD/submit/ReviewAndSubmit.tsx
"use client";

import { useTransition, useState } from "react";
import type { NewTournamentPayload } from "@/app/lib/types";
import type { TeamDraft, DraftMatch } from "../TournamentWizard";
import { createTournamentAction, updateTournamentAction } from "../actions";

/* ----------------------------------------------------------------
   Helpers: kinds + names
----------------------------------------------------------------- */
type StageKind = "league" | "groups" | "knockout";
const kindOf = (s: NewTournamentPayload["stages"][number]): StageKind =>
  ((s as any)?.kind ?? "league") as StageKind;
const nameOf = (payload: NewTournamentPayload, i: number) =>
  payload.stages[i]?.name ?? `#${i + 1}`;

/* ----------------------------------------------------------------
   Coercion helper (defensive): accept "2" as 2, ignore NaN
----------------------------------------------------------------- */
const asIdx = (v: any): number | undefined => {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

/* ----------------------------------------------------------------
   Canonicalize refs by ID → index (post-reorder safety)
   - Also collect warnings if *_stage_id points to nowhere
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

    // KO fed from League/Groups
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

    // Groups fed from KO
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
   Validate 1: ordering & kind compatibility (no future refs)
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
   Validate 2: cycles (DAG check over stage dependencies)
   - Edge added for each dependency: src -> i
----------------------------------------------------------------- */
function validateStagesGraph(payload: NewTournamentPayload): { errors: string[] } {
  const N = payload.stages.length;
  const adj: number[][] = Array.from({ length: N }, () => []);
  const errors: string[] = [];

  // Build edges
  payload.stages.forEach((stage, i) => {
    const cfg = ((stage as any).config ?? {}) as any;

    // KO depends on League/Groups
    {
      const src = asIdx(cfg.from_stage_idx);
      if (kindOf(stage) === "knockout" && src !== undefined && src >= 0 && src < N) {
        adj[src].push(i);
      }
    }

    // Groups depend on KO
    {
      const src = asIdx(cfg.from_knockout_stage_idx);
      if (kindOf(stage) === "groups" && src !== undefined && src >= 0 && src < N) {
        adj[src].push(i);
      }
    }
  });

  // DFS cycle detection (collect first cycle; can extend to collect all if desired)
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
        // found a cycle; reconstruct the path
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
   Component
----------------------------------------------------------------- */
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

  const submit = () => {
    setError(null);
    setWarningsUi([]);

    // 1) Canonicalize by ID → idx, so refs survive reorder (and collect warnings)
    const { canon, warnings } = canonicalizeStageRefsById(payload);

    // 2) Validate ordering & kinds (no “future stage” refs, no self refs, right source kinds)
    const orderCheck = validateStageOrderingAndRefs(canon);
    // 3) Validate cycles (DAG)
    const graphCheck = validateStagesGraph(canon);

    const allErrors = [...orderCheck.errors, ...graphCheck.errors];
    const allWarnings = [...warnings, ...orderCheck.warnings];

    if (allWarnings.length) setWarningsUi(allWarnings);
    if (allErrors.length) {
      setError(allErrors.join("\n"));
      return; // hard stop
    }

    const fd = new FormData();
    fd.set("payload", JSON.stringify(canon ?? {}));
    fd.set("teams", JSON.stringify(teams ?? []));
    fd.set("draftMatches", JSON.stringify(draftMatches ?? []));

    start(async () => {
      try {
        let res: any;
        if (mode === "edit" && meta?.id) {
          fd.set("tournament_id", String(meta.id));
          res = await updateTournamentAction(fd);
        } else {
          res = await createTournamentAction(fd);
        }
        if (res && res.ok === false) setError(res.error || "Unknown error");
      } catch (e: any) {
        setError(e?.message || "Unexpected error");
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
          disabled={pending}
          aria-busy={pending}
          className="px-3 py-2 rounded-md border border-emerald-400/40 text-emerald-200 bg-emerald-600/20 hover:bg-emerald-600/30 disabled:opacity-60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
        >
          {pending ? (mode === "edit" ? "Saving…" : "Creating…") : mode === "edit" ? "Save Changes" : "Create Tournament"}
        </button>
      </div>
    </div>
  );
}
