// app/components/DashboardPageComponents/TournamentCURD/preview/StagePreview.tsx
"use client";

import { useMemo } from "react";
import ModernKnockoutTree from "@/app/tournoua/[slug]/components/teams/ModernKnockoutTree";
import type { NewTournamentPayload, TeamsMap, BracketMatch } from "@/app/lib/types";
import type { TeamDraft, DraftMatch } from "../TournamentWizard";
import GroupIntakeBoard from "./GroupIntakeBoard";

/* -------------------------------------------------------
   StagePreview
   ------------------------------------------------------- */
export default function StagePreview({
  payload,
  teams,
  draftMatches,
  stageIdx,
  onDraftChange,
  onAutoAssignTeamSeeds,
}: {
  payload: NewTournamentPayload;
  teams: TeamDraft[];
  draftMatches: DraftMatch[];
  stageIdx: number;
  onDraftChange: (next: DraftMatch[]) => void;
  /** Return team IDs ordered by ascending seed (1..N) */
  onAutoAssignTeamSeeds?: () => Promise<number[]> | number[];
}) {
  const stage = payload.stages[stageIdx] as any;
  const kind: "groups" | "league" | "knockout" = stage.kind;

  // Teams map (id -> {name, seed}) used by KO tree & labels
  const teamsMap: TeamsMap = useMemo(() => {
    const m: TeamsMap = {} as any;
    teams.forEach((t) => {
      const nm = (t as any)?.name ? String((t as any).name) : `#${t.id}`;
      (m as any)[t.id] = { name: nm, seed: t.seed ?? null, logo: (t as any)?.logo ?? null };
    });
    return m;
  }, [teams]);

  const labelFor = (id: number | null | undefined) =>
    id != null && teamsMap[id] ? teamsMap[id].name : "TBD";

  return (
    <section className="rounded-xl border border-cyan-400/25 bg-slate-900/40 p-4 space-y-3">
      <header className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-white/90 font-semibold">
          {stage.name} <span className="text-white/55 text-sm">({kindLabel(kind)})</span>
        </div>
        <StageFlowChips payload={payload} stageIdx={stageIdx} />
      </header>

      {kind === "knockout" ? (
        <KnockoutPreview
          payload={payload}
          teamsMap={teamsMap}
          draftMatches={draftMatches}
          stageIdx={stageIdx}
          labelFor={labelFor}
          onDraftChange={onDraftChange}
          onAutoAssignTeamSeeds={onAutoAssignTeamSeeds}
        />
      ) : (
        <GroupsOrLeaguePreview
          payload={payload}
          teams={teams}
          draftMatches={draftMatches}
          stageIdx={stageIdx}
          labelFor={labelFor}
        />
      )}
    </section>
  );
}

/* -------------------------------------------------------
   Kind labels (EL/EN friendly if you later wire i18n)
   ------------------------------------------------------- */
const kindLabel = (k: string | undefined) =>
  k === "groups"
    ? "Όμιλοι"
    : k === "knockout"
    ? "Knockout"
    : k === "league"
    ? "Πρωτάθλημα"
    : String(k ?? "Στάδιο");

/* -------------------------------------------------------
   Chips row that shows intake → and output →
   ------------------------------------------------------- */
function StageFlowChips({ payload, stageIdx }: { payload: NewTournamentPayload; stageIdx: number }) {
  const stage = payload.stages[stageIdx] as any;
  const cfg = (stage?.config ?? {}) as any;

  // who feeds into me?
  const intake = (() => {
    if (stage.kind === "knockout") {
      if (Number.isFinite(cfg.from_stage_idx)) {
        const src = payload.stages[cfg.from_stage_idx!] as any;
        return `Από ${src?.name ?? `Στάδιο #${(cfg.from_stage_idx ?? 0) + 1}`}`;
      }
      return cfg.standalone_bracket_size ? `Αυτόνομο από seeds (${cfg.standalone_bracket_size})` : null;
    }
    if (stage.kind === "groups") {
      if (Number.isFinite(cfg.from_knockout_stage_idx)) {
        const src = payload.stages[cfg.from_knockout_stage_idx!] as any;
        return `Από ${src?.name ?? `Στάδιο #${(cfg.from_knockout_stage_idx ?? 0) + 1}`}`;
      }
    }
    return null;
  })();

  // who do I feed into?
  const output = (() => {
    // find a KO stage that references me
    const ko = payload.stages.find(
      (s: any) => s?.kind === "knockout" && (s?.config?.from_stage_idx ?? -1) === stageIdx
    ) as any;
    if (ko) {
      const adv = ko?.config?.advancers_per_group ?? 2;
      const cross = ko?.config?.semis_cross ?? "A1-B2";
      return `→ KO: ${ko.name} • ${adv}/όμιλο • ${cross}`;
    }
    return null;
  })();

  if (!intake && !output) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {intake ? (
        <span className="inline-flex items-center gap-1 rounded-md bg-white/5 ring-1 ring-white/10 px-2 py-0.5 text-xs text-white/80">
          <span className="opacity-70">Είσοδος:</span> {intake}
        </span>
      ) : null}
      {output ? (
        <span className="inline-flex items-center gap-1 rounded-md bg-white/5 ring-1 ring-white/10 px-2 py-0.5 text-xs text-white/80">
          <span className="opacity-70">Έξοδος:</span> {output}
        </span>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------
   KO stage preview (tree + compact schedule)
   ------------------------------------------------------- */
function KnockoutPreview({
  payload,
  teamsMap,
  draftMatches,
  stageIdx,
  labelFor,
  onDraftChange,
  onAutoAssignTeamSeeds,
}: {
  payload: NewTournamentPayload;
  teamsMap: TeamsMap;
  draftMatches: DraftMatch[];
  stageIdx: number;
  labelFor: (id: number | null | undefined) => string;
  onDraftChange: (next: DraftMatch[]) => void;
  onAutoAssignTeamSeeds?: () => Promise<number[]> | number[];
}) {
  // Keep original indices for write-back
  const entries = draftMatches
    .map((m, idx) => ({ m, idx }))
    .filter((e) => e.m.stageIdx === stageIdx);

  const matches: BracketMatch[] = useMemo(
    () =>
      entries.map((e, i) => ({
        id: i + 1,
        round: e.m.round ?? null,
        bracket_pos: e.m.bracket_pos ?? null,
        team_a_id: e.m.team_a_id ?? null,
        team_b_id: e.m.team_b_id ?? null,
        team_a_score: null,
        team_b_score: null,
        status: "scheduled",
        home_source_match_id:
          e.m.home_source_match_idx != null ? e.m.home_source_match_idx + 1 : null,
        away_source_match_id:
          e.m.away_source_match_idx != null ? e.m.away_source_match_idx + 1 : null,
      })),
    [entries]
  );

  const viewIdToOrigIdx = (viewId: number): number | null => {
    const e = entries[viewId - 1];
    return e ? e.idx : null;
  };

  return (
    <div className="space-y-3">
      <ModernKnockoutTree
        title={payload.stages[stageIdx]?.name ?? "Knockout"}
        matches={matches}
        teamsMap={teamsMap}
        editable={false}
        onAssignSlot={(viewId, slot, teamId) => {
          // slot is "A" | "B" in this component API
          const origIdx = viewIdToOrigIdx(viewId);
          if (origIdx == null) return;
          const next = draftMatches.slice();
          next[origIdx] = {
            ...next[origIdx],
            team_a_id: slot === "A" ? teamId : next[origIdx].team_a_id,
            team_b_id: slot === "B" ? teamId : next[origIdx].team_b_id,
          };
          onDraftChange(next);
        }}
        onSwapPair={(viewId: number) => {
          // swap A<->B within the SAME match
          const idx = viewIdToOrigIdx(viewId);
          if (idx == null) return;
          const next = draftMatches.slice();
          const row = next[idx];
          next[idx] = { ...row, team_a_id: row.team_b_id ?? null, team_b_id: row.team_a_id ?? null };
          onDraftChange(next);
        }}
        onBulkAssignFirstRound={(
          rows: Array<{ matchId: number; team_a_id: number | null; team_b_id: number | null }>
        ) => {
          const next = draftMatches.slice();
          rows.forEach((r) => {
            const idx = viewIdToOrigIdx(r.matchId);
            if (idx == null) return;
            next[idx] = { ...next[idx], team_a_id: r.team_a_id, team_b_id: r.team_b_id };
          });
          onDraftChange(next);
        }}
        onClearFirstRound={() => {
          const next = draftMatches.map((m) =>
            m.stageIdx === stageIdx && (m.round ?? 0) === 1
              ? { ...m, team_a_id: null, team_b_id: null }
              : m
          );
          onDraftChange(next);
        }}
        onAutoAssignTeamSeeds={onAutoAssignTeamSeeds}
        maxAutoFit={8}
        lang="el"
      />

      {/* Compact list under the tree */}
      <div className="rounded-lg border border-cyan-400/15 bg-black/30 p-3">
        <div className="text-white/90 font-semibold mb-2">Πρόγραμμα Knockout</div>
        <ul className="space-y-1 text-sm">
          {draftMatches
            .filter((m) => m.stageIdx === stageIdx)
            .sort(
              (a, b) =>
                (a.round ?? 0) - (b.round ?? 0) ||
                (a.bracket_pos ?? 0) - (b.bracket_pos ?? 0)
            )
            .map((m, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="text-white/70">R{m.round ?? "?"} • B{m.bracket_pos ?? "?"}</span>
                <span className="text-white/90">
                  {labelFor(m.team_a_id)} <span className="text-white/50">vs</span>{" "}
                  {labelFor(m.team_b_id)}
                </span>
                {m.match_date && (
                  <span className="text-xs text-white/60">• {fmtDateTime(m.match_date)}</span>
                )}
              </li>
            ))}
        </ul>
      </div>
    </div>
  );
}

/* -------------------------------------------------------
   Groups/League preview (fixtures list + optional KO→Groups intake)
   ------------------------------------------------------- */
function GroupsOrLeaguePreview({
  payload,
  teams,
  draftMatches,
  stageIdx,
  labelFor,
}: {
  payload: NewTournamentPayload;
  teams: TeamDraft[];
  draftMatches: DraftMatch[];
  stageIdx: number;
  labelFor: (id: number | null | undefined) => string;
}) {
  const stage = payload.stages[stageIdx] as any;
  const isGroups = stage.kind === "groups";
  const cfg = (stage?.config ?? {}) as any;

  // --- KO → Groups intake board (optional if configured) ---
  const hasKOIntake =
    Number.isFinite(cfg.from_knockout_stage_idx) && (cfg.groups_intake?.length ?? 0) > 0;

  // Build lite KO matches list from draftMatches (DON'T read stage.matches)
  const koSrcIdx = Number.isFinite(cfg.from_knockout_stage_idx)
    ? Number(cfg.from_knockout_stage_idx)
    : null;
  const koMatchesLite =
    koSrcIdx != null
      ? draftMatches
          .filter((m) => m.stageIdx === koSrcIdx)
          .map((m, i) => ({
            id: i + 1,
            round: m.round ?? 0,
            bracket_pos: m.bracket_pos ?? 0,
          }))
      : [];

  // --- Fixtures list (groups or single league) ---
  const rows = draftMatches
    .filter((m) => m.stageIdx === stageIdx && (isGroups ? true : m.groupIdx == null))
    .sort(
      (a, b) =>
        (a.matchday ?? 0) - (b.matchday ?? 0) ||
        (a.bracket_pos ?? 0) - (b.bracket_pos ?? 0)
    );

  const matchdays = Array.from(new Set(rows.map((r) => r.matchday ?? 0))).sort((a, b) => a - b);

  return (
    <div className="space-y-3">
      {hasKOIntake ? (
        <fieldset className="rounded-md border border-cyan-400/15 p-3 space-y-3">
          <legend className="px-1 text-cyan-200 text-sm">Knockout → Όμιλοι (Intake)</legend>
          <p className="text-white/70 text-sm">
            Οι παρακάτω θέσεις θα συμπληρωθούν από νικητές/ηττημένους του knockout σταδίου #
            {cfg.from_knockout_stage_idx}.
          </p>
          <GroupIntakeBoard
            groups={(stage.groups ?? []).map((g: any) => ({ name: g?.name ?? "Όμιλος" }))}
            koMatches={koMatchesLite as any}
            intake={cfg.groups_intake as any}
          />
        </fieldset>
      ) : null}

      <div className="rounded-lg border border-cyan-400/15 bg-black/30 p-3">
        <div className="text-white/90 font-semibold mb-2">Πρόγραμμα Αγώνων</div>
        {rows.length === 0 ? (
          <div className="text-white/60 text-sm">Δεν έχουν δημιουργηθεί αγώνες για αυτό το στάδιο.</div>
        ) : (
          <div className="space-y-2">
            {matchdays.map((md) => {
              const dayRows = rows.filter((r) => r.matchday === md);
              const mdDateISO = (() => {
                const list = dayRows.map((x) => x.match_date).filter(Boolean) as string[];
                if (list.length === 0) return null;
                return list
                  .slice()
                  .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0];
              })();

              return (
                <div key={`md-${md}`}>
                  <div className="text-xs text-white/60 mb-1">
                    MD {md}
                    {mdDateISO ? <span className="ml-2">• {fmtDateTime(mdDateISO)}</span> : null}
                  </div>
                  <ul className="space-y-1">
                    {dayRows.map((r, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between rounded-md bg-white/5 ring-1 ring-white/10 px-2 py-1"
                      >
                        <span className="text-white/90">
                          {labelFor(r.team_a_id)} <span className="text-white/50">vs</span>{" "}
                          {labelFor(r.team_b_id)}
                        </span>
                        <span className="text-xs text-white/60">
                          {r.match_date ? fmtDateTime(r.match_date) : "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------
   Tiny util: date formatting like your WizardPreview
   ------------------------------------------------------- */
const fmtDateTime = (iso?: string | null) => {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("el-GR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  } catch {
    return iso ?? "";
  }
};
