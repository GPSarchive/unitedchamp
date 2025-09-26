"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Check, X } from "lucide-react";
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

  return (
    <div className="w-full p-4 rounded-xl border border-white/15 bg-black/50 space-y-4">
      {/* Read-only badges */}
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="inline-flex items-center gap-2 rounded-full px-2 py-1 ring-1 ring-white/10 bg-white/5 text-white/80">
          <span className="opacity-80">Tournament:</span>
          <span className="text-white/95 font-medium">{tournamentName ?? "—"}</span>
        </span>
        <span className="inline-flex items-center gap-2 rounded-full px-2 py-1 ring-1 ring-white/10 bg-white/5 text-white/80">
          <span className="opacity-80">Stage:</span>
          <span className="text-white/95 font-medium">{derivedStageText ?? "—"}</span>
        </span>
        <span className="inline-flex items-center gap-2 rounded-full px-2 py-1 ring-1 ring-white/10 bg-white/5 text-white/80">
          <span className="opacity-80">Draws:</span>
          <span className={`font-medium ${allowDraws ? "text-emerald-200" : "text-rose-200"}`}>
            {allowDraws ? "Allowed" : "Not allowed"}
          </span>
        </span>
      </div>

      {/* NEW: show current saved time + local preview + pending save preview */}
      <div className="flex flex-wrap gap-2 text-xs text-white/80">
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-white/80">Match date & time (UTC)</span>
          <input
            type="datetime-local"
            value={(form.match_date as string) ?? ""}
            onChange={(e) => set("match_date", (e.target.value || null) as MatchRow["match_date"])}
            className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-white/80">Status</span>
          <select
            value={form.status}
            onChange={(e) => set("status", e.target.value as MatchRow["status"])}
            className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-white/80">Team A</span>
          <select
            value={form.team_a_id}
            onChange={(e) => set("team_a_id", Number(e.target.value) as Id)}
            className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10"
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {teamLabel(t)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-white/80">Team B</span>
          <select
            value={form.team_b_id}
            onChange={(e) => set("team_b_id", Number(e.target.value) as Id)}
            className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10"
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {teamLabel(t)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-white/80">Team A score</span>
          <input
            type="number"
            min={0}
            value={form.team_a_score}
            onChange={(e) => set("team_a_score", Number(e.target.value))}
            className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-white/80">Team B score</span>
          <input
            type="number"
            min={0}
            value={form.team_b_score}
            onChange={(e) => set("team_b_score", Number(e.target.value))}
            className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10"
          />
        </label>

        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="text-sm text-white/80">
            Winner{" "}
            {allowDraws
              ? "(required when finished and not a draw)"
              : "(required when finished)"}
          </span>
          <select
            value={form.winner_team_id ?? ""}
            onChange={(e) => set("winner_team_id", e.target.value === "" ? null : (Number(e.target.value) as Id))}
            className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10 disabled:opacity-60"
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
            <span className="mt-1 text-xs text-emerald-300">
              Scores are equal and draws are allowed — winner will be saved as empty.
            </span>
          )}
          {isFinished && !allowDraws && scoresEqual && !form.winner_team_id && (
            <span className="mt-1 text-xs text-rose-300">
              Draws are not allowed for this stage — pick a winner.
            </span>
          )}
        </label>
      </div>

      {validationError && <p className="text-red-400 text-sm">{validationError}</p>}

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-white/15 text-white bg-zinc-900 hover:bg-zinc-800"
        >
          <X className="h-4 w-4" /> Cancel
        </button>
        <button
          type="button"
          disabled={!!validationError || saving}
          onClick={save}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-emerald-400/40 text-white bg-emerald-700/30 hover:bg-emerald-700/50 disabled:opacity-50"
        >
          <Check className="h-4 w-4" /> {saving ? "Saving…" : isEdit ? "Save" : "Create"}
        </button>
      </div>
    </div>
  );
}
