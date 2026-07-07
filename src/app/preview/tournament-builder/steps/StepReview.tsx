"use client";

import { useMemo } from "react";
import type { NewTournamentPayload } from "@/app/lib/types";
import type {
  TeamDraft,
  DraftMatch,
  WizardMode,
  WizardMeta,
} from "@/app/dashboard/tournaments/TournamentCURD/TournamentWizard";
import { useTournamentStore } from "@/app/dashboard/tournaments/TournamentCURD/submit/tournamentStore";
import ValidationSummary from "@/app/dashboard/tournaments/TournamentCURD/shared/ValidationSummary";
import ReviewAndSubmit from "@/app/dashboard/tournaments/TournamentCURD/submit/ReviewAndSubmit";

import Badge from "../ui/Badge";
import { card } from "../ui/tokens";

const KIND_LABEL: Record<string, string> = {
  league: "Πρωτάθλημα",
  groups: "Όμιλοι",
  knockout: "Knockout",
};

// One primitive selector per value — an object-returning selector re-creates
// its result every call and sends useSyncExternalStore into an infinite loop.
const selDirtyMatches = (s: any) => s.dirty?.matches?.size ?? 0;
const selDeletedMatches = (s: any) => s.dirty?.deletedMatchIds?.size ?? 0;
const selDirtyTournament = (s: any) => !!s.dirty?.tournament;
const selDirtyStages = (s: any) => !!s.dirty?.stages;
const selDirtyGroups = (s: any) => !!s.dirty?.groups;
const selDirtyTeams = (s: any) => !!s.dirty?.tournamentTeams;
const selDirtyIntake = (s: any) => !!s.dirty?.intakeMappings;

export default function StepReview({
  mode,
  meta,
  payload,
  teams,
  draftMatches,
  errors,
  onBack,
}: {
  mode: WizardMode;
  meta?: WizardMeta;
  payload: NewTournamentPayload;
  teams: TeamDraft[];
  draftMatches: DraftMatch[];
  errors: string[];
  onBack: () => void;
}) {
  const dirty = {
    matches: useTournamentStore(selDirtyMatches),
    deletedMatches: useTournamentStore(selDeletedMatches),
    tournament: useTournamentStore(selDirtyTournament),
    stages: useTournamentStore(selDirtyStages),
    groups: useTournamentStore(selDirtyGroups),
    teams: useTournamentStore(selDirtyTeams),
    intake: useTournamentStore(selDirtyIntake),
  };

  const matchesPerStage = useMemo(() => {
    const map = new Map<number, number>();
    draftMatches.forEach((m) => {
      const si = (m.stageIdx ?? -1) as number;
      if (si >= 0) map.set(si, (map.get(si) ?? 0) + 1);
    });
    return map;
  }, [draftMatches]);

  const dirtyChips: string[] = [];
  if (dirty.matches > 0) dirtyChips.push(`${dirty.matches} αλλαγές σε αγώνες`);
  if (dirty.deletedMatches > 0) dirtyChips.push(`${dirty.deletedMatches} διαγραφές αγώνων`);
  if (dirty.tournament) dirtyChips.push("στοιχεία διοργάνωσης");
  if (dirty.stages) dirtyChips.push("στάδια");
  if (dirty.groups) dirtyChips.push("όμιλοι");
  if (dirty.teams) dirtyChips.push("ομάδες");
  if (dirty.intake) dirtyChips.push("intake");

  return (
    <div className="space-y-4">
      {errors.length > 0 && <ValidationSummary errors={errors} />}

      {/* Summary */}
      <div className={`${card} space-y-4 p-4`}>
        <div>
          <h3 className="text-base font-bold text-white">
            {payload.tournament.name || "Χωρίς όνομα"}
          </h3>
          <p className="mt-0.5 text-xs text-zinc-500">
            {payload.tournament.season ? `${payload.tournament.season} · ` : ""}
            {payload.tournament.format} · {payload.tournament.status}
          </p>
        </div>

        {/* Teams strip */}
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Ομάδες · {teams.length}
          </p>
          <div className="flex -space-x-2 overflow-hidden">
            {teams.slice(0, 12).map((t) =>
              t.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={t.id}
                  src={t.logo}
                  alt={t.name ?? `#${t.id}`}
                  title={t.name ?? `#${t.id}`}
                  className="h-8 w-8 rounded-full bg-zinc-800 object-contain ring-2 ring-[#0d0f14]"
                />
              ) : (
                <span
                  key={t.id}
                  title={t.name ?? `#${t.id}`}
                  className="grid h-8 w-8 place-items-center rounded-full bg-zinc-800 text-[9px] font-bold text-zinc-400 ring-2 ring-[#0d0f14]"
                >
                  {(t.name ?? String(t.id)).slice(0, 2).toUpperCase()}
                </span>
              )
            )}
            {teams.length > 12 && (
              <span className="grid h-8 w-8 place-items-center rounded-full bg-zinc-800 text-[10px] font-bold text-zinc-300 ring-2 ring-[#0d0f14]">
                +{teams.length - 12}
              </span>
            )}
          </div>
        </div>

        {/* Stages */}
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Στάδια · {payload.stages.length}
          </p>
          <ul className="space-y-1.5">
            {payload.stages.map((s: any, i) => (
              <li key={s?.id ?? i} className="flex items-center gap-2 text-sm text-zinc-300">
                <span className="text-xs text-zinc-600">{i + 1}.</span>
                <span className="min-w-0 flex-1 truncate">{s.name || `Στάδιο ${i + 1}`}</span>
                <Badge tone={s.kind === "knockout" ? "amber" : s.kind === "groups" ? "indigo" : "neutral"}>
                  {KIND_LABEL[s.kind] ?? s.kind}
                </Badge>
                <Badge>{matchesPerStage.get(i) ?? 0} αγ.</Badge>
              </li>
            ))}
          </ul>
        </div>

        {/* Pending changes */}
        {mode === "edit" && (
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Εκκρεμείς αλλαγές
            </p>
            {dirtyChips.length === 0 ? (
              <p className="text-sm text-zinc-500">Καμία — όλα αποθηκευμένα.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {dirtyChips.map((c) => (
                  <Badge key={c} tone="indigo">
                    {c}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Existing save flow, unchanged (validation + create/save-all sequence) */}
      <ReviewAndSubmit
        mode={mode}
        meta={meta}
        payload={payload}
        teams={teams}
        draftMatches={draftMatches}
        onBack={onBack}
      />
    </div>
  );
}
