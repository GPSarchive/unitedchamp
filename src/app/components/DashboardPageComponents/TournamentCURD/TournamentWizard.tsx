// app/admin/tournoua/new/components/TournamentWizard.tsx
"use client";

import { useState, useTransition } from "react";
import { createTournamentAction } from "./actions";
import type { NewTournamentPayload, StageKind } from "@/app/lib/types";

type StageDraft = NewTournamentPayload["stages"][number];

const empty: NewTournamentPayload = {
  tournament: { name: "", slug: null, season: null, status: "scheduled", format: "league" },
  stages: [{ name: "Regular Season", kind: "league", ordering: 1 }],
  tournament_team_ids: [],
};

export default function TournamentWizard() {
  const [data, setData] = useState<NewTournamentPayload>(empty);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const addStage = () => {
    const next: StageDraft = {
      name: `Stage ${data.stages.length + 1}`,
      kind: "league",
      ordering: data.stages.length + 1,
    };
    setData((d) => ({ ...d, stages: [...d.stages, next] }));
  };

  const updateStage = (idx: number, patch: Partial<StageDraft>) => {
    const stages = data.stages.slice();
    stages[idx] = { ...stages[idx], ...patch };
    if (patch.kind && patch.kind !== "groups") stages[idx].groups = [];
    setData((d) => ({ ...d, stages }));
  };

  const addGroup = (idx: number) => {
    const stages = data.stages.slice();
    const g = { name: `Group ${(stages[idx].groups?.length ?? 0) + 1}` };
    stages[idx].groups = [...(stages[idx].groups ?? []), g];
    setData((d) => ({ ...d, stages }));
  };

  const removeGroup = (sidx: number, gidx: number) => {
    const stages = data.stages.slice();
    stages[sidx].groups = (stages[sidx].groups ?? []).filter((_, i) => i !== gidx);
    setData((d) => ({ ...d, stages }));
  };

  const submit = () => {
    setError(null);
    const fd = new FormData();
    fd.set("payload", JSON.stringify(data));
    startTransition(async () => {
      const res = await createTournamentAction(fd);
      if (res && !("ok" in res)) return; // redirected on success
      if (res && !res.ok) setError(res.error || "Unknown error");
    });
  };

  const inputCls =
    "bg-slate-900/80 border border-slate-700/60 rounded-md px-3 py-2 placeholder-slate-400 " +
    "focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400";

  const btnOutlineEmerald =
    "text-sm px-3 py-1 rounded-md border border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/10 transition-colors";

  const btnDangerOutline =
    "px-2 py-1 text-xs rounded-md border border-rose-500/40 text-rose-300 hover:bg-rose-500/10 transition-colors";

  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-6 space-y-8 text-slate-100 shadow-xl shadow-black/20">
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-emerald-300">Tournament</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <input className={inputCls}
            placeholder="Name"
            value={data.tournament.name}
            onChange={(e) => setData((d) => ({ ...d, tournament: { ...d.tournament, name: e.target.value } }))}
          />
          <input className={inputCls}
            placeholder="Slug (optional)"
            value={data.tournament.slug ?? ""}
            onChange={(e) => setData((d) => ({ ...d, tournament: { ...d.tournament, slug: e.target.value || null } }))}
          />
          <input className={inputCls}
            placeholder="Season (e.g. 2025)"
            value={data.tournament.season ?? ""}
            onChange={(e) => setData((d) => ({ ...d, tournament: { ...d.tournament, season: e.target.value || null } }))}
          />
          <select
            className={inputCls}
            value={data.tournament.status ?? "scheduled"}
            onChange={(e) => setData((d) => ({ ...d, tournament: { ...d.tournament, status: e.target.value as any } }))}
          >
            {["scheduled", "running", "completed", "archived"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            className={inputCls}
            value={data.tournament.format ?? "league"}
            onChange={(e) => setData((d) => ({ ...d, tournament: { ...d.tournament, format: e.target.value as any } }))}
          >
            {["league", "groups", "knockout", "mixed"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input
            className={inputCls}
            placeholder="Logo URL (optional)"
            value={data.tournament.logo ?? ""}
            onChange={(e) => setData((d) => ({ ...d, tournament: { ...d.tournament, logo: e.target.value || null } }))}
          />
        </div>
        <p className="text-xs text-slate-400">Tip: αφήσε το slug κενό για αυτόματο.</p>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-emerald-300">Stages</h2>
          <button type="button" onClick={addStage} className={btnOutlineEmerald}>
            + Add Stage
          </button>
        </div>

        <div className="space-y-4">
          {data.stages.map((s, idx) => (
            <div key={idx} className="rounded-lg border border-emerald-500/20 bg-slate-950/60 p-3">
              <div className="grid sm:grid-cols-4 gap-3">
                <input
                  className={inputCls}
                  placeholder="Stage name"
                  value={s.name}
                  onChange={(e) => updateStage(idx, { name: e.target.value })}
                />
                <select
                  className={inputCls}
                  value={s.kind}
                  onChange={(e) => updateStage(idx, { kind: e.target.value as StageKind })}
                >
                  <option value="league">league</option>
                  <option value="groups">groups</option>
                  <option value="knockout">knockout</option>
                </select>
                <input
                  className={inputCls}
                  placeholder="Ordering"
                  type="number"
                  value={s.ordering ?? idx + 1}
                  onChange={(e) => updateStage(idx, { ordering: Number(e.target.value) })}
                />
                <input
                  className={inputCls}
                  placeholder="Config JSON (optional)"
                  value={s.config ? JSON.stringify(s.config) : ""}
                  onChange={(e) => {
                    try {
                      updateStage(idx, { config: e.target.value ? JSON.parse(e.target.value) : undefined });
                    } catch {
                      /* ignore invalid while typing */
                    }
                  }}
                />
              </div>

              {s.kind === "groups" && (
                <div className="mt-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-emerald-200">Groups</h4>
                    <button type="button" onClick={() => addGroup(idx)} className={btnOutlineEmerald}>
                      + Add Group
                    </button>
                  </div>
                  <div className="mt-2 grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {(s.groups ?? []).map((g, gidx) => (
                      <div key={gidx} className="flex items-center gap-2">
                        <input
                          className={inputCls + " flex-1"}
                          value={g.name}
                          onChange={(e) => {
                            const groups = (s.groups ?? []).slice();
                            groups[gidx] = { name: e.target.value };
                            updateStage(idx, { groups });
                          }}
                        />
                        <button type="button" onClick={() => removeGroup(idx, gidx)} className={btnDangerOutline}>
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-emerald-300">Teams (optional)</h2>
        <p className="text-sm text-slate-400">
          Paste team IDs (comma-separated) to register them to this tournament.
        </p>
        <textarea
          className={inputCls + " h-24 w-full resize-y"}
          placeholder="e.g. 1,2,3,4"
          onChange={(e) => {
            const ids = e.target.value
              .split(",")
              .map((s) => Number(s.trim()))
              .filter((n) => Number.isFinite(n));
            setData((d) => ({ ...d, tournament_team_ids: ids }));
          }}
        />
      </section>

      {error && <p className="text-rose-400">{error}</p>}

      <button
        disabled={pending}
        onClick={submit}
        aria-busy={pending}
        className="px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 border border-emerald-500/50 text-white shadow-lg shadow-emerald-900/30 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        {pending ? "Creating…" : "Create Tournament"}
      </button>
    </div>
  );
}
