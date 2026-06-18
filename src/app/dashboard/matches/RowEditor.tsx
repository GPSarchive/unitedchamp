"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Check, X, Trophy, CalendarClock, Flag, Users2, Repeat2 } from "lucide-react";
import type { Id, TeamLite, MatchRow } from "@/app/lib/types";
import { formatMatchDateTime } from "@/app/lib/datetime";
import { supabase } from "@/app/lib/supabase/supabaseClient";

// Only two statuses
const STATUSES: MatchRow["status"][] = ["scheduled", "finished"];

// ---- Datetime helpers ----
function isoToDTString(iso: string | null): string {
  // For <input type="datetime-local"> — MUST be YYYY-MM-DDTHH:mm
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(
    d.getUTCHours()
  )}:${pad(d.getUTCMinutes())}`;
}
function dtStringToIso(value: string | null): string | null {
  if (!value) return null;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d, hh, mm] = m;
  return new Date(Date.UTC(+y, +mo - 1, +d, +hh, +mm, 0)).toISOString();
}

// Read-only labels
function isoToLabelUTC(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(
    d.getUTCHours()
  )}:${pad(d.getUTCMinutes())} UTC`;
}
function isoToLabelLocal(iso: string | null): string {
  if (!iso) return "—";
  return (
    formatMatchDateTime(iso, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }) || "—"
  );
}

function teamLabel(t: TeamLite | null, fallbackId?: Id) {
  return t ? `${t.name} (#${t.id})` : `#${fallbackId ?? ""}`;
}

// Optional extra metadata your rows might carry (not required)
type MatchRowWithStage = MatchRow & {
  matchday?: number | null;
  round?: number | null;
  bracket_pos?: number | null;
  stage_name?: string | null;
  group_idx?: number | null;
  // two-legged KO
  leg?: number | null;
  tie_leg1_match_id?: Id | null;
  penalty_a?: number | null;
  penalty_b?: number | null;
};

// Utility-first atoms (subtle, high-contrast on black backgrounds)
const Badge = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center gap-2 rounded-md px-2 py-1 border border-white/10 bg-zinc-950 text-white/80">
    {children}
  </span>
);

const Section = ({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-white/60">
      {icon}
      <span>{title}</span>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
  </div>
);

// ✅ This is the ONLY export from this file
export default function RowEditor({
  initial,
  teams,
  onCancel,
  onSaved,
  tournamentName,
  stageText,
  /** If false (e.g., Knockout), a finished match MUST have a winner even if scores are equal. */
  allowDraws = true,
}: {
  initial: Partial<MatchRowWithStage> & { id?: Id };
  teams: TeamLite[];
  onCancel: () => void;
  onSaved: () => void;
  tournamentName?: string | null;
  stageText?: string | null;
  allowDraws?: boolean;
}) {
  const [form, setForm] = useState<Partial<MatchRowWithStage>>(() => ({
    id: initial.id,
    match_date: isoToDTString(initial.match_date ?? null), // populate input from saved ISO
    status: (initial.status as MatchRow["status"]) ?? "scheduled",
    team_a_id: initial.team_a_id ?? (teams[0]?.id ?? 0),
    team_b_id: initial.team_b_id ?? (teams[1]?.id ?? 0),
    team_a_score: initial.team_a_score ?? 0,
    team_b_score: initial.team_b_score ?? 0,
    winner_team_id: initial.winner_team_id ?? null,
    penalty_a: initial.penalty_a ?? null,
    penalty_b: initial.penalty_b ?? null,
  }));
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(initial.id);

  // ----- Two-legged KO context -----
  const leg = initial.leg ?? null;
  const isLeg1 = leg === 1;
  const isLeg2Decider = leg === 2 && initial.tie_leg1_match_id != null;

  // For a leg-2 decider, load leg 1's scores so we can show/validate the aggregate.
  const [leg1, setLeg1] = useState<
    { team_a_id: Id | null; team_b_id: Id | null; team_a_score: number | null; team_b_score: number | null } | null
  >(null);
  useEffect(() => {
    let alive = true;
    if (!isLeg2Decider || initial.tie_leg1_match_id == null) {
      setLeg1(null);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("matches")
        .select("team_a_id, team_b_id, team_a_score, team_b_score")
        .eq("id", initial.tie_leg1_match_id)
        .maybeSingle();
      if (alive) setLeg1((data as any) ?? null);
    })();
    return () => {
      alive = false;
    };
  }, [isLeg2Decider, initial.tie_leg1_match_id]);

  // Aggregate per team id (teams swap home/away between legs).
  const scoreFor = (
    row: { team_a_id: Id | null; team_b_id: Id | null; team_a_score: number | null; team_b_score: number | null } | null,
    teamId: Id | null | undefined
  ) => {
    if (!row || teamId == null) return 0;
    if (row.team_a_id === teamId) return row.team_a_score ?? 0;
    if (row.team_b_id === teamId) return row.team_b_score ?? 0;
    return 0;
  };

  function set<K extends keyof MatchRow>(k: K, v: MatchRow[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const derivedStageText = useMemo(() => {
    if (stageText) return stageText;
    const parts: string[] = [];
    if (initial.stage_name) parts.push(initial.stage_name);
    if (typeof initial.group_idx === "number") parts.push(`Group ${String.fromCharCode(65 + initial.group_idx)}`);
    if (typeof initial.matchday === "number") parts.push(`MD ${initial.matchday}`);
    if (typeof initial.round === "number") parts.push(`R${initial.round}`);
    if (typeof initial.bracket_pos === "number") parts.push(`Pos ${initial.bracket_pos}`);
    return parts.length ? parts.join(" • ") : null;
  }, [stageText, initial.stage_name, initial.group_idx, initial.matchday, initial.round, initial.bracket_pos]);

  const isFinished = form.status === "finished";
  const aScore = form.team_a_score ?? 0;
  const bScore = form.team_b_score ?? 0;
  const scoresEqual = aScore === bScore;

  // A two-legged row never decides a winner via the manual winner dropdown:
  // leg 1 carries none; leg 2's winner is derived server-side from the aggregate
  // (+penalties). Treat both as "draws allowed" for the winner UI.
  const twoLegged = isLeg1 || isLeg2Decider;
  const isDraw = isFinished && (allowDraws || twoLegged) && scoresEqual;

  // Aggregate (leg-2 decider only): sum each team's scores across both legs.
  const aggA = isLeg2Decider ? scoreFor({ team_a_id: form.team_a_id ?? null, team_b_id: form.team_b_id ?? null, team_a_score: aScore, team_b_score: bScore }, form.team_a_id) + scoreFor(leg1, form.team_a_id) : null;
  const aggB = isLeg2Decider ? scoreFor({ team_a_id: form.team_a_id ?? null, team_b_id: form.team_b_id ?? null, team_a_score: aScore, team_b_score: bScore }, form.team_b_id) + scoreFor(leg1, form.team_b_id) : null;
  const aggregateLevel = isLeg2Decider && aggA != null && aggB != null && aggA === aggB;
  const penA = form.penalty_a ?? null;
  const penB = form.penalty_b ?? null;

  // Auto-clear winner for draws (finished + equal + draws allowed)
  useEffect(() => {
    if (isDraw && form.winner_team_id != null) {
      setForm((f) => ({ ...f, winner_team_id: null }));
    }
  }, [isDraw, form.winner_team_id]);

  const validationError = useMemo(() => {
    if (!form.team_a_id || !form.team_b_id) return "Select both teams";
    if (form.team_a_id === form.team_b_id) return "Team A and Team B must differ";
    if (aScore < 0 || bScore < 0) return "Scores cannot be negative";

    if (isFinished) {
      // Two-legged leg 1: any result is fine, no winner needed.
      if (isLeg1) return null;

      // Two-legged leg 2 (decider): winner comes from aggregate; require pens only when level.
      if (isLeg2Decider) {
        if (!leg1 || leg1.team_a_score == null || leg1.team_b_score == null)
          return "Finish leg 1 before finishing leg 2.";
        if (aggregateLevel) {
          if (penA == null || penB == null) return "Aggregate is level — enter the penalty result.";
          if (penA < 0 || penB < 0) return "Penalty scores cannot be negative.";
          if (penA === penB) return "Penalty shootout cannot end level.";
        }
        return null;
      }

      if (allowDraws && scoresEqual) {
        // Draw is valid → winner must be empty
        if (form.winner_team_id != null) return "Winner must be empty for a draw.";
      } else {
        // Not a draw case → require winner
        if (!form.winner_team_id) return "Winner is required when status is 'finished'.";
        if (![form.team_a_id, form.team_b_id].includes(form.winner_team_id))
          return "Winner must be Team A or Team B";
      }
    }
    return null;
  }, [form.team_a_id, form.team_b_id, aScore, bScore, isFinished, scoresEqual, allowDraws, form.winner_team_id, isLeg1, isLeg2Decider, leg1, aggregateLevel, penA, penB]);

  // Show what will be saved if date/time was changed
  const pendingSaveUtc = useMemo(() => {
    const nextIso = dtStringToIso((form.match_date as string | null) ?? null);
    if (!nextIso) return null;
    const currentIso = initial.match_date ?? null;
    return nextIso !== currentIso ? isoToLabelUTC(nextIso) : null;
  }, [form.match_date, initial.match_date]);

  async function save() {
    if (validationError) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        match_date: dtStringToIso((form.match_date as string | null) ?? null),
        status: form.status,
        team_a_id: form.team_a_id,
        team_b_id: form.team_b_id,
        team_a_score: form.team_a_score,
        team_b_score: form.team_b_score,
        // For draws, persist winner as null even when finished.
        // Two-legged rows let the server derive the winner (aggregate/pens).
        winner_team_id: twoLegged ? null : isFinished ? (isDraw ? null : form.winner_team_id) : null,
      };

      // Penalties only matter on a leg-2 decider when the aggregate is level.
      if (isLeg2Decider) {
        payload.penalty_a = aggregateLevel ? form.penalty_a ?? null : null;
        payload.penalty_b = aggregateLevel ? form.penalty_b ?? null : null;
      }

      const res = await fetch(isEdit ? `/api/matches/${form.id}` : `/api/matches`, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      onSaved();
    } catch (e: any) {
      alert(e.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  const teamA = teams.find((t) => t.id === form.team_a_id) ?? null;
  const teamB = teams.find((t) => t.id === form.team_b_id) ?? null;

  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* Neutral, high-contrast surface against a black page background */}
      <div className="rounded-lg border border-white/10 bg-zinc-950/90">
        <div className="p-4 sm:p-6 space-y-6">
          {/* Read-only badges */}
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge>
              <Trophy className="h-3.5 w-3.5 opacity-80" />
              <span className="opacity-80">Tournament:</span>
              <span className="text-white/95 font-medium">{tournamentName ?? "—"}</span>
            </Badge>
            <Badge>
              <Flag className="h-3.5 w-3.5 opacity-80" />
              <span className="opacity-80">Stage:</span>
              <span className="text-white/95 font-medium">{derivedStageText ?? "—"}</span>
            </Badge>
            <Badge>
              <Users2 className="h-3.5 w-3.5 opacity-80" />
              <span className="opacity-80">Draws:</span>
              <span className={`font-medium ${allowDraws || twoLegged ? "text-emerald-200" : "text-rose-200"}`}>
                {allowDraws || twoLegged ? "Allowed" : "Not allowed"}
              </span>
            </Badge>
            {leg != null && (
              <Badge>
                <Repeat2 className="h-3.5 w-3.5 opacity-80" />
                <span className="opacity-80">Leg:</span>
                <span className="text-white/95 font-medium">
                  {leg}{isLeg2Decider ? " (decider)" : ""}
                </span>
              </Badge>
            )}
          </div>

          {/* SCOREBOARD */}
          <div className="rounded-md border border-white/10 bg-zinc-950 p-4">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-3">
              {/* Team A */}
              <div className="flex items-center gap-3">
                <select
                  aria-label="Team A"
                  value={form.team_a_id}
                  onChange={(e) => set("team_a_id", Number(e.target.value) as Id)}
                  className="max-w-xs w-full px-3 py-2 min-h-[44px] rounded-md bg-zinc-900 text-white border border-white/10 focus:outline-none focus:ring-2 focus:ring-white/20"
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{teamLabel(t)}</option>
                  ))}
                </select>
              </div>

              {/* Score */}
              <div className="flex items-center gap-2 justify-center">
                <input
                  aria-label="Team A score"
                  type="number"
                  min={0}
                  value={form.team_a_score}
                  onChange={(e) => set("team_a_score", Number(e.target.value))}
                  className="w-16 h-11 text-center text-lg font-semibold px-2 rounded-md bg-zinc-900 text-white border border-white/10 focus:outline-none focus:ring-2 focus:ring-white/20"
                />
                <span className="text-white/70 font-semibold">—</span>
                <input
                  aria-label="Team B score"
                  type="number"
                  min={0}
                  value={form.team_b_score}
                  onChange={(e) => set("team_b_score", Number(e.target.value))}
                  className="w-16 h-11 text-center text-lg font-semibold px-2 rounded-md bg-zinc-900 text-white border border-white/10 focus:outline-none focus:ring-2 focus:ring-white/20"
                />
              </div>

              {/* Team B */}
              <div className="flex items-center gap-3 sm:justify-end">
                <select
                  aria-label="Team B"
                  value={form.team_b_id}
                  onChange={(e) => set("team_b_id", Number(e.target.value) as Id)}
                  className="max-w-xs w-full px-3 py-2 min-h-[44px] rounded-md bg-zinc-900 text-white border border-white/10 focus:outline-none focus:ring-2 focus:ring-white/20"
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{teamLabel(t)}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* TWO-LEGGED KO: aggregate + penalties (leg-2 decider only) */}
          {isLeg2Decider && (
            <div className="rounded-md border border-cyan-400/20 bg-cyan-400/5 p-4 space-y-3">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-cyan-200/80">
                <Repeat2 className="h-4 w-4" />
                <span>Two-legged tie — decider (leg 2)</span>
              </div>

              {!leg1 ? (
                <p className="text-xs text-amber-300">Loading leg 1…</p>
              ) : leg1.team_a_score == null || leg1.team_b_score == null ? (
                <p className="text-xs text-rose-300">
                  Leg 1 is not finished yet. Finish leg 1 before deciding this tie.
                </p>
              ) : (
                <>
                  <div className="text-sm text-white/85">
                    Aggregate:{" "}
                    <span className="font-semibold text-white">
                      {teamLabel(teams.find((t) => t.id === form.team_a_id) ?? null, form.team_a_id as Id)} {aggA}
                    </span>
                    <span className="mx-1 opacity-60">—</span>
                    <span className="font-semibold text-white">
                      {aggB} {teamLabel(teams.find((t) => t.id === form.team_b_id) ?? null, form.team_b_id as Id)}
                    </span>
                  </div>

                  {aggregateLevel ? (
                    <div className="space-y-2">
                      <p className="text-xs text-cyan-200">
                        Aggregate is level — enter the penalty shootout result.
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-white/70 w-20 truncate">Pens (A)</span>
                        <input
                          aria-label="Penalty A"
                          type="number"
                          min={0}
                          value={form.penalty_a ?? ""}
                          onChange={(e) =>
                            set("penalty_a" as any, e.target.value === "" ? null : Number(e.target.value))
                          }
                          className="w-16 h-10 text-center px-2 rounded-md bg-zinc-900 text-white border border-white/10 focus:outline-none focus:ring-2 focus:ring-white/20"
                        />
                        <span className="text-white/60">—</span>
                        <input
                          aria-label="Penalty B"
                          type="number"
                          min={0}
                          value={form.penalty_b ?? ""}
                          onChange={(e) =>
                            set("penalty_b" as any, e.target.value === "" ? null : Number(e.target.value))
                          }
                          className="w-16 h-10 text-center px-2 rounded-md bg-zinc-900 text-white border border-white/10 focus:outline-none focus:ring-2 focus:ring-white/20"
                        />
                        <span className="text-xs text-white/60">Pens (B)</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-emerald-300">
                      Winner on aggregate:{" "}
                      {teamLabel(
                        teams.find((t) => t.id === ((aggA ?? 0) > (aggB ?? 0) ? form.team_a_id : form.team_b_id)) ?? null,
                        (((aggA ?? 0) > (aggB ?? 0)) ? form.team_a_id : form.team_b_id) as Id
                      )}
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {isLeg1 && (
            <p className="text-xs text-cyan-200/80">
              This is leg 1 of a two-legged tie — record the score; the winner is decided after leg 2.
            </p>
          )}

          {/* STATUS + TIME */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Section title="Match timing" icon={<CalendarClock className="h-4 w-4" />}> 
              <label className="flex flex-col gap-1">
                <span className="text-xs text-white/70">Match date & time (UTC)</span>
                <input
                  type="datetime-local"
                  value={(form.match_date as string) ?? ""}
                  onChange={(e) => set("match_date", (e.target.value || null) as MatchRow["match_date"])}
                  className="px-3 py-2 min-h-[44px] rounded-md bg-zinc-900 text-white border border-white/10 focus:outline-none focus:ring-2 focus:ring-white/20"
                />
              </label>

              <div className="flex flex-wrap gap-2 text-xs text-white/80 sm:col-span-2">
                <span className="inline-flex items-center gap-1 rounded px-2 py-1 bg-zinc-900 ring-1 ring-white/10">
                  Saved (UTC): <span className="text-white font-medium">{isoToLabelUTC(initial.match_date ?? null)}</span>
                </span>
                <span className="inline-flex items-center gap-1 rounded px-2 py-1 bg-zinc-900 ring-1 ring-white/10">
                  Your local: <span className="text-white font-medium">{isoToLabelLocal(initial.match_date ?? null)}</span>
                </span>
                {pendingSaveUtc && (
                  <span className="inline-flex items-center gap-1 rounded px-2 py-1 bg-emerald-900/20 ring-1 ring-emerald-400/30 text-emerald-200">
                    Will save as: <span className="text-emerald-100 font-medium">{pendingSaveUtc}</span>
                  </span>
                )}
              </div>
            </Section>
            <Section title="Match details" icon={<Users2 className="h-4 w-4" />}>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-white/70">Field/Venue</span>
              <input
                type="text"
                value={(form as any).field ?? ""}
                onChange={(e) => set("field" as any, e.target.value || null)}
                placeholder="e.g., Stadium A, Field 1"
                className="px-3 py-2 min-h-[44px] rounded-md bg-zinc-900 text-white border border-white/10 focus:outline-none focus:ring-2 focus:ring-white/20 placeholder:text-white/30"
              />
            </label>     
            </Section>
            <Section title="Status" icon={<Flag className="h-4 w-4" />}>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-white/70">Status</span>
                <select
                  value={form.status}
                  onChange={(e) => set("status", e.target.value as MatchRow["status"])}
                  className="px-3 py-2 min-h-[44px] rounded-md bg-zinc-900 text-white border border-white/10 focus:outline-none focus:ring-2 focus:ring-white/20"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 lg:col-span-2">
                <span className="text-xs text-white/70">
                  Winner {twoLegged ? "(decided automatically from the tie)" : allowDraws ? "(required when finished and not a draw)" : "(required when finished)"}
                </span>
                <select
                  value={form.winner_team_id ?? ""}
                  onChange={(e) => set("winner_team_id", e.target.value === "" ? null : (Number(e.target.value) as Id))}
                  className="px-3 py-2 min-h-[44px] rounded-md bg-zinc-900 text-white border border-white/10 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-white/20"
                  disabled={isDraw || twoLegged}
                >
                  <option value="">— none —</option>
                  {[form.team_a_id, form.team_b_id]
                    .filter(Boolean)
                    .map((id) => {
                      const t = teams.find((x) => x.id === id) ?? null;
                      return (
                        <option key={id} value={id}>{teamLabel(t, id as Id)}</option>
                      );
                    })}
                </select>
                {twoLegged && (
                  <span className="mt-1 text-xs text-cyan-200">
                    {isLeg1
                      ? "Leg 1 carries no winner — the tie is decided after leg 2."
                      : "Winner is derived from the aggregate (then penalties) when you save."}
                  </span>
                )}
                {!twoLegged && isFinished && allowDraws && scoresEqual && (
                  <span className="mt-1 text-xs text-emerald-300">Scores are equal and draws are allowed — winner will be saved as empty.</span>
                )}
                {!twoLegged && isFinished && !allowDraws && scoresEqual && !form.winner_team_id && (
                  <span className="mt-1 text-xs text-rose-300">Draws are not allowed for this stage — pick a winner.</span>
                )}
              </label>
            </Section>

            <Section title="Teams (quick edit)" icon={<Users2 className="h-4 w-4" />}>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-white/70">Team A</span>
                <select
                  value={form.team_a_id}
                  onChange={(e) => set("team_a_id", Number(e.target.value) as Id)}
                  className="px-3 py-2 min-h-[44px] rounded-md bg-zinc-900 text-white border border-white/10 focus:outline-none focus:ring-2 focus:ring-white/20"
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{teamLabel(t)}</option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs text-white/70">Team B</span>
                <select
                  value={form.team_b_id}
                  onChange={(e) => set("team_b_id", Number(e.target.value) as Id)}
                  className="px-3 py-2 min-h-[44px] rounded-md bg-zinc-900 text-white border border-white/10 focus:outline-none focus:ring-2 focus:ring-white/20"
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{teamLabel(t)}</option>
                  ))}
                </select>
              </label>

              <div className="sm:col-span-2 grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-white/70">Team A score</span>
                  <input
                    type="number"
                    min={0}
                    value={form.team_a_score}
                    onChange={(e) => set("team_a_score", Number(e.target.value))}
                    className="w-24 h-11 text-center px-2 rounded-md bg-zinc-900 text-white border border-white/10 focus:outline-none focus:ring-2 focus:ring-white/20"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-white/70">Team B score</span>
                  <input
                    type="number"
                    min={0}
                    value={form.team_b_score}
                    onChange={(e) => set("team_b_score", Number(e.target.value))}
                    className="w-24 h-11 text-center px-2 rounded-md bg-zinc-900 text-white border border-white/10 focus:outline-none focus:ring-2 focus:ring-white/20"
                  />
                </label>
              </div>
            </Section>
          </div>

          {/* validation */}
          {validationError && <p className="text-rose-300 text-sm">{validationError}</p>}

          {/* ACTIONS */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
            {/* live summary */}
            <div className="hidden sm:block text-xs text-white/70">
              <span className="font-medium text-white/80">Preview:</span>{" "}
              <span className="text-white">{teamLabel(teamA, form.team_a_id as Id)}</span>
              <span className="mx-1 opacity-70">vs</span>
              <span className="text-white">{teamLabel(teamB, form.team_b_id as Id)}</span>
              <span className="mx-1 opacity-70">—</span>
              <span className="text-white">{aScore} : {bScore}</span>
              {isFinished && (
                <>
                  <span className="mx-1 opacity-70">•</span>
                  <span className="text-white">{isDraw ? "Draw" : `Winner: ${teamLabel(teams.find(t => t.id === form.winner_team_id) ?? null, form.winner_team_id as Id)}`}</span>
                </>
              )}
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-md border border-white/10 text-white bg-zinc-900 hover:bg-zinc-800 w-full sm:w-auto"
              >
                <X className="h-4 w-4" /> Cancel
              </button>
              <button
                type="button"
                disabled={!!validationError || saving}
                onClick={save}
                className="inline-flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-md border border-white/10 text-white bg-emerald-700/40 hover:bg-emerald-700/60 disabled:opacity-50 w-full sm:w-auto"
              >
                <Check className="h-4 w-4" /> {saving ? "Saving…" : isEdit ? "Save" : "Create"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
