"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Check, X, Trophy, CalendarClock, Flag, Users2 } from "lucide-react";
import type { Id, TeamLite, MatchRow } from "@/app/lib/types";

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
  return new Date(iso).toLocaleString();
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
};

// Small visual atoms
const Badge = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center gap-2 rounded-full px-2.5 py-1 ring-1 ring-white/10 bg-white/5 text-white/80">
    {children}
  </span>
);

const Section = ({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-white/70">
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
  const [form, setForm] = useState<Partial<MatchRow>>(() => ({
    id: initial.id,
    match_date: isoToDTString(initial.match_date ?? null), // populate input from saved ISO
    status: (initial.status as MatchRow["status"]) ?? "scheduled",
    team_a_id: initial.team_a_id ?? (teams[0]?.id ?? 0),
    team_b_id: initial.team_b_id ?? (teams[1]?.id ?? 0),
    team_a_score: initial.team_a_score ?? 0,
    team_b_score: initial.team_b_score ?? 0,
    winner_team_id: initial.winner_team_id ?? null,
  }));
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(initial.id);

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
  const isDraw = isFinished && allowDraws && scoresEqual;

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
  }, [form.team_a_id, form.team_b_id, aScore, bScore, isFinished, scoresEqual, allowDraws, form.winner_team_id]);

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
      const payload = {
        match_date: dtStringToIso((form.match_date as string | null) ?? null),
        status: form.status,
        team_a_id: form.team_a_id,
        team_b_id: form.team_b_id,
        team_a_score: form.team_a_score,
        team_b_score: form.team_b_score,
        // For draws, persist winner as null even when finished
        winner_team_id: isFinished ? (isDraw ? null : form.winner_team_id) : null,
      };

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
      {/* Stylish container */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(60%_120%_at_0%_0%,rgba(16,185,129,0.12),transparent_60%),radial-gradient(60%_120%_at_100%_0%,rgba(59,130,246,0.12),transparent_60%)] backdrop-blur-sm">
        {/* top stripe */}
        <div className="absolute inset-x-0 -top-8 h-24 bg-gradient-to-r from-emerald-500/20 via-emerald-400/10 to-cyan-500/20 blur-2xl pointer-events-none" />

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
              <span className={`font-medium ${allowDraws ? "text-emerald-200" : "text-rose-200"}`}>
                {allowDraws ? "Allowed" : "Not allowed"}
              </span>
            </Badge>
          </div>

          {/* SCOREBOARD */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-3">
              {/* Team A */}
              <div className="flex items-center gap-3">
                <select
                  aria-label="Team A"
                  value={form.team_a_id}
                  onChange={(e) => set("team_a_id", Number(e.target.value) as Id)}
                  className="max-w-xs w-full px-3 py-2 min-h-[44px] rounded-lg bg-zinc-950/60 text-white border border-white/10 ring-emerald-400/30 focus:outline-none focus:ring-2"
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {teamLabel(t)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Score */}
              <div className="flex items-center gap-2">
                <input
                  aria-label="Team A score"
                  type="number"
                  min={0}
                  value={form.team_a_score}
                  onChange={(e) => set("team_a_score", Number(e.target.value))}
                  className="w-16 h-11 text-center text-lg sm:text-xl font-semibold px-2 py-1.5 rounded-lg bg-zinc-950/60 text-white border border-white/10 focus:outline-none focus:ring-2 ring-emerald-400/30"
                />
                <span className="text-white/70 font-semibold">—</span>
                <input
                  aria-label="Team B score"
                  type="number"
                  min={0}
                  value={form.team_b_score}
                  onChange={(e) => set("team_b_score", Number(e.target.value))}
                  className="w-16 h-11 text-center text-lg sm:text-xl font-semibold px-2 py-1.5 rounded-lg bg-zinc-950/60 text-white border border-white/10 focus:outline-none focus:ring-2 ring-emerald-400/30"
                />
              </div>

              {/* Team B */}
              <div className="flex items-center gap-3 justify-end">
                <select
                  aria-label="Team B"
                  value={form.team_b_id}
                  onChange={(e) => set("team_b_id", Number(e.target.value) as Id)}
                  className="max-w-xs w-full px-3 py-2 min-h-[44px] rounded-lg bg-zinc-950/60 text-white border border-white/10 ring-emerald-400/30 focus:outline-none focus:ring-2"
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {teamLabel(t)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* STATUS + TIME */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Section title="Match timing" icon={<CalendarClock className="h-4 w-4" />}> 
              <label className="flex flex-col gap-1">
                <span className="text-xs text-white/70">Match date & time (UTC)</span>
                <input
                  type="datetime-local"
                  value={(form.match_date as string) ?? ""}
                  onChange={(e) => set("match_date", (e.target.value || null) as MatchRow["match_date"])}
                  className="px-3 py-2 min-h-[44px] rounded-lg bg-zinc-950/60 text-white border border-white/10 ring-emerald-400/30 focus:outline-none focus:ring-2"
                />
              </label>

              <div className="flex flex-wrap gap-2 text-xs text-white/80 sm:col-span-2">
                <span className="inline-flex items-center gap-1 rounded px-2 py-1 bg-white/5 ring-1 ring-white/10">
                  Saved (UTC): <span className="text-white/95 font-medium">{isoToLabelUTC(initial.match_date ?? null)}</span>
                </span>
                <span className="inline-flex items-center gap-1 rounded px-2 py-1 bg-white/5 ring-1 ring-white/10">
                  Your local: <span className="text-white/95 font-medium">{isoToLabelLocal(initial.match_date ?? null)}</span>
                </span>
                {pendingSaveUtc && (
                  <span className="inline-flex items-center gap-1 rounded px-2 py-1 bg-emerald-500/10 ring-1 ring-emerald-400/30 text-emerald-200">
                    Will save as: <span className="text-emerald-100 font-medium">{pendingSaveUtc}</span>
                  </span>
                )}
              </div>
            </Section>

            <Section title="Status" icon={<Flag className="h-4 w-4" />}>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-white/70">Status</span>
                <select
                  value={form.status}
                  onChange={(e) => set("status", e.target.value as MatchRow["status"])}
                  className="px-3 py-2 min-h-[44px] rounded-lg bg-zinc-950/60 text-white border border-white/10 focus:outline-none focus:ring-2 ring-emerald-400/30"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 lg:col-span-2">
                <span className="text-xs text-white/70">
                  Winner {allowDraws ? "(required when finished and not a draw)" : "(required when finished)"}
                </span>
                <select
                  value={form.winner_team_id ?? ""}
                  onChange={(e) => set("winner_team_id", e.target.value === "" ? null : (Number(e.target.value) as Id))}
                  className="px-3 py-2 min-h-[44px] rounded-lg bg-zinc-950/60 text-white border border-white/10 disabled:opacity-60 focus:outline-none focus:ring-2 ring-emerald-400/30"
                  disabled={isDraw}
                >
                  <option value="">— none —</option>
                  {[form.team_a_id, form.team_b_id]
                    .filter(Boolean)
                    .map((id) => {
                      const t = teams.find((x) => x.id === id) ?? null;
                      return (
                        <option key={id} value={id}>
                          {teamLabel(t, id as Id)}
                        </option>
                      );
                    })}
                </select>
                {isFinished && allowDraws && scoresEqual && (
                  <span className="mt-1 text-xs text-emerald-300">Scores are equal and draws are allowed — winner will be saved as empty.</span>
                )}
                {isFinished && !allowDraws && scoresEqual && !form.winner_team_id && (
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
                  className="px-3 py-2 min-h-[44px] rounded-lg bg-zinc-950/60 text-white border border-white/10 focus:outline-none focus:ring-2 ring-emerald-400/30"
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {teamLabel(t)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs text-white/70">Team B</span>
                <select
                  value={form.team_b_id}
                  onChange={(e) => set("team_b_id", Number(e.target.value) as Id)}
                  className="px-3 py-2 min-h-[44px] rounded-lg bg-zinc-950/60 text-white border border-white/10 focus:outline-none focus:ring-2 ring-emerald-400/30"
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {teamLabel(t)}
                    </option>
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
                    className="w-24 h-11 text-center px-2 py-2 rounded-lg bg-zinc-950/60 text-white border border-white/10 focus:outline-none focus:ring-2 ring-emerald-400/30"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-white/70">Team B score</span>
                  <input
                    type="number"
                    min={0}
                    value={form.team_b_score}
                    onChange={(e) => set("team_b_score", Number(e.target.value))}
                    className="w-24 h-11 text-center px-2 py-2 rounded-lg bg-zinc-950/60 text-white border border-white/10 focus:outline-none focus:ring-2 ring-emerald-400/30"
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
              <span className="text-white/90">{teamLabel(teamA, form.team_a_id as Id)}</span>
              <span className="mx-1 opacity-70">vs</span>
              <span className="text-white/90">{teamLabel(teamB, form.team_b_id as Id)}</span>
              <span className="mx-1 opacity-70">—</span>
              <span className="text-white/90">{aScore} : {bScore}</span>
              {isFinished && (
                <>
                  <span className="mx-1 opacity-70">•</span>
                  <span className="text-white/90">{isDraw ? "Draw" : `Winner: ${teamLabel(teams.find(t => t.id === form.winner_team_id) ?? null, form.winner_team_id as Id)}`}</span>
                </>
              )}
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-lg border border-white/15 text-white bg-zinc-900 hover:bg-zinc-800 active:scale-[0.99] transition w-full sm:w-auto flex-1 sm:flex-none"
              >
                <X className="h-4 w-4" /> Cancel
              </button>
              <button
                type="button"
                disabled={!!validationError || saving}
                onClick={save}
                className="inline-flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-lg border border-emerald-400/40 text-white bg-emerald-700/40 hover:bg-emerald-700/60 disabled:opacity-50 active:scale-[0.99] transition shadow-[0_0_0_2px_rgba(16,185,129,.05)] w-full sm:w-auto flex-1 sm:flex-none"
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
