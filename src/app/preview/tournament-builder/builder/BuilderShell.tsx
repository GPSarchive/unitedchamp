"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { NewTournamentPayload } from "@/app/lib/types";
import type {
  TeamDraft,
  DraftMatch,
  WizardMode,
  WizardMeta,
} from "@/app/dashboard/tournaments/TournamentCURD/TournamentWizard";
import { useTournamentStore } from "@/app/dashboard/tournaments/TournamentCURD/submit/tournamentStore";

import { STEPS, isStepId, type StepId } from "./steps";
import { useBuilderState } from "./useBuilderState";
import StepBar, { type StepBadges } from "../ui/StepBar";
import Button from "../ui/Button";

import StepBasics from "../steps/StepBasics";
import StepTeams from "../steps/StepTeams";
import StepStages from "../steps/StepStages";
import StepFixtures from "../steps/StepFixtures";
import StepReview from "../steps/StepReview";

const selectAnyDirtyCount = (s: any) => {
  const d = s.dirty ?? {};
  return (
    (d.matches?.size ?? 0) +
    (d.deletedMatchIds?.size ?? 0) +
    (d.deletedGroupIds?.size ?? 0) +
    (d.deletedStageIds?.size ?? 0) +
    (d.tournament ? 1 : 0) +
    (d.stages ? 1 : 0) +
    (d.groups ? 1 : 0) +
    (d.tournamentTeams ? 1 : 0) +
    (d.intakeMappings ? 1 : 0)
  );
};

export default function BuilderShell({
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
  const router = useRouter();
  const searchParams = useSearchParams();

  const {
    payload,
    setPayload,
    teams,
    storeDraftMatches,
    errors,
    onStagesChange,
    onTeamsChange,
    handleTeamGroupChange,
  } = useBuilderState({ mode, meta, initialPayload, initialTeams, initialDraftMatches });

  // ---- step navigation (URL-backed) ----
  const urlStep = searchParams.get("step");
  const [step, setStep] = useState<StepId>(isStepId(urlStep) ? urlStep : "basics");

  const goToStep = (id: StepId) => {
    setStep(id);
    const params = new URLSearchParams(searchParams.toString());
    params.set("step", id);
    router.replace(`?${params.toString()}`, { scroll: false });
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  };

  // keep in sync if the user navigates back/forward
  useEffect(() => {
    if (isStepId(urlStep) && urlStep !== step) setStep(urlStep);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlStep]);

  const stepIdx = STEPS.findIndex((s) => s.id === step);
  const prevStep = stepIdx > 0 ? STEPS[stepIdx - 1] : null;
  const nextStep = stepIdx < STEPS.length - 1 ? STEPS[stepIdx + 1] : null;

  // ---- badges (advisory errors per step + dirty on review) ----
  const dirtyCount = useTournamentStore(selectAnyDirtyCount);
  const badges = useMemo<StepBadges>(() => {
    const b: StepBadges = {};
    const nameErr = errors.some((e) => e.includes("όνομα"));
    const teamsErr = errors.some((e) => e.includes("ομάδες") && e.includes("τουλάχιστον 2"));
    const stagesErr = errors.some((e) => e.includes("στάδιο") || e.includes("όμιλο"));
    if (nameErr) b.basics = { tone: "error" };
    if (teamsErr) b.teams = { tone: "error" };
    if (stagesErr) b.stages = { tone: "error" };
    if (dirtyCount > 0) b.review = { tone: "dirty", count: dirtyCount };
    return b;
  }, [errors, dirtyCount]);

  // ---- post-create redirect: fire when saveAll's busy flag falls and an id exists ----
  const tournamentId = useTournamentStore((s) => s.ids.tournamentId);
  const busy = useTournamentStore((s) => s.busy);
  const prevBusyRef = useRef(false);
  useEffect(() => {
    if (mode === "create" && prevBusyRef.current && !busy && tournamentId != null) {
      router.replace(`/preview/tournament-builder/${tournamentId}?step=review`);
    }
    prevBusyRef.current = busy;
  }, [busy, tournamentId, mode, router]);

  const title =
    mode === "edit"
      ? payload.tournament.name || `Διοργάνωση #${meta?.id ?? ""}`
      : "Νέα διοργάνωση";

  return (
    <div className="min-h-dvh bg-black text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-black/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <a
            href="/preview/tournament-builder"
            className="text-zinc-400 hover:text-white text-sm shrink-0"
          >
            ←
          </a>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold tracking-tight">{title}</h1>
            <p className="text-[11px] text-zinc-500">
              Builder 2.0 · {mode === "edit" ? "Επεξεργασία" : "Δημιουργία"} ·{" "}
              {STEPS[stepIdx]?.label} ({stepIdx + 1}/{STEPS.length})
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-8 px-4 py-6">
        <StepBar steps={STEPS} activeId={step} onSelect={goToStep} badges={badges} />

        <main className="min-w-0 flex-1 pb-28 lg:pb-8">
          {step === "basics" && (
            <StepBasics
              tournament={payload.tournament}
              onChange={(t) => setPayload((p) => ({ ...p, tournament: t }))}
            />
          )}
          {step === "teams" && <StepTeams teams={teams} onChange={onTeamsChange} />}
          {step === "stages" && (
            <StepStages
              stages={payload.stages}
              onChange={onStagesChange}
              teams={teams}
              onTeamGroupChange={handleTeamGroupChange}
            />
          )}
          {step === "fixtures" && (
            <StepFixtures payload={payload} teams={teams} />
          )}
          {step === "review" && (
            <StepReview
              mode={mode}
              meta={meta ?? undefined}
              payload={payload}
              teams={teams}
              draftMatches={storeDraftMatches}
              errors={errors}
              onBack={() => goToStep("fixtures")}
            />
          )}

          {/* Step footer nav */}
          <div className="mt-8 flex items-center justify-between gap-3">
            {prevStep ? (
              <Button variant="ghost" onClick={() => goToStep(prevStep.id)}>
                ← {prevStep.label}
              </Button>
            ) : (
              <span />
            )}
            {nextStep ? (
              <Button variant="primary" onClick={() => goToStep(nextStep.id)}>
                {nextStep.label} →
              </Button>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}
