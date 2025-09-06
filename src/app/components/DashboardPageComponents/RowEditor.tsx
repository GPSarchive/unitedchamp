"use client";

import React, { useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import type { Id, TeamLite, MatchRow } from "@/app/lib/types";

const STATUSES: MatchRow["status"][] = ["scheduled", "live", "finished", "canceled"];

// ===== Small datetime + label helpers (duplicated here for isolation) =====
function isoToDTString(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = d.getUTCFullYear();
  const m = pad(d.getUTCMonth() + 1);
  const day = pad(d.getUTCDate());
  const hh = pad(d.getUTCHours());
  const mm = pad(d.getUTCMinutes());
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

function dtStringToIso(value: string | null): string | null {
  if (!value) return null;
  const parts = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!parts) return null;
  const [, yStr, mStr, dStr, hhStr, mmStr] = parts;
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  const hh = Number(hhStr);
  const mm = Number(mmStr);
  const utcDate = new Date(Date.UTC(y, m - 1, d, hh, mm, 0));
  return utcDate.toISOString();
}

function teamLabel(t: TeamLite | null, fallbackId?: Id) {
  return t ? `${t.name} (#${t.id})` : `#${fallbackId ?? ""}`;
}

export default function RowEditor({
  initial,
  teams,
  onCancel,
  onSaved,
}: {
  initial: Partial<MatchRow> & { id?: Id };
  teams: TeamLite[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<MatchRow>>(() => ({
    id: initial.id,
    match_date: isoToDTString(initial.match_date ?? null),
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

  const validationError = useMemo(() => {
    if (!form.team_a_id || !form.team_b_id) return "Select both teams";
    if (form.team_a_id === form.team_b_id) return "Team A and Team B must differ";
    if ((form.team_a_score ?? 0) < 0 || (form.team_b_score ?? 0) < 0) return "Scores cannot be negative";
    if (form.status === "finished") {
      if (!form.winner_team_id) return "Winner is required when status is 'finished'";
      if (![form.team_a_id, form.team_b_id].includes(form.winner_team_id))
        return "Winner must be Team A or Team B";
    }
    return null;
  }, [form]);

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
        winner_team_id: form.status === "finished" ? form.winner_team_id : null,
      };

      const res = await fetch(isEdit ? `/api/matches/${form.id}` : `/api/matches`, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include", // send session cookies/JWT
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
    <div className="p-4 rounded-xl border border-white/15 bg-black/50 space-y-4">
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
          <span className="text-sm text-white/80">Winner (required when finished)</span>
          <select
            value={form.winner_team_id ?? ""}
            onChange={(e) => set("winner_team_id", e.target.value === "" ? null : (Number(e.target.value) as Id))}
            className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10"
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
