
// ===============================
// File: app/components/DashboardPageComponents/TournamentCURD/preview/MatchPlanner/AdvancedRowMenu.tsx
// ===============================
"use client";

import { useState } from "react";
import { inferStatus } from "./utils";
import type { EditableDraftMatch, TeamOption } from "./types";

export default function AdvancedRowMenu({
  row,
  getEff,
  setPendingFor,
  teamOptions,
}: {
  row: EditableDraftMatch;
  getEff: <K extends keyof EditableDraftMatch>(r: EditableDraftMatch, k: K) => EditableDraftMatch[K];
  setPendingFor: (id: number, patch: Partial<EditableDraftMatch>) => void;
  teamOptions: TeamOption[];
}) {
  const lid = row._localId!;
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        className="px-2 py-1 rounded border border-white/15 hover:bg-white/10 text-xs"
        onClick={() => setOpen((v) => !v)}
        title="Περισσότερα"
      >
        •••
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-lg bg-slate-950/95 ring-1 ring-white/10 p-3 space-y-2">
          <div className="text-xs text-white/60 mb-1">Προχωρημένες Ρυθμίσεις</div>

          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-white/70">Κατάσταση</label>
            <select
              className="bg-slate-950 border border-white/15 rounded px-2 py-1 text-white"
              value={
                (getEff(row, "status") as "scheduled" | "finished" | null | undefined) ??
                inferStatus({
                  status: getEff(row, "status") as any,
                  team_a_score: getEff(row, "team_a_score") as any,
                  team_b_score: getEff(row, "team_b_score") as any,
                  winner_team_id: getEff(row, "winner_team_id") as any,
                })
              }
              onChange={(e) => setPendingFor(lid, { status: e.target.value as any })}
            >
              <option value="scheduled">scheduled</option>
              <option value="finished">finished</option>
            </select>

            <label className="text-xs text-white/70">Σκορ A</label>
            <input
              type="number"
              min={0}
              className="bg-slate-950 border border-white/15 rounded px-2 py-1 text-white"
              value={(getEff(row, "team_a_score") as number | null) ?? ""}
              onChange={(e) =>
                setPendingFor(lid, { team_a_score: e.target.value === "" ? null : Number(e.target.value) })
              }
            />

            <label className="text-xs text-white/70">Σκορ B</label>
            <input
              type="number"
              min={0}
              className="bg-slate-950 border border-white/15 rounded px-2 py-1 text-white"
              value={(getEff(row, "team_b_score") as number | null) ?? ""}
              onChange={(e) =>
                setPendingFor(lid, { team_b_score: e.target.value === "" ? null : Number(e.target.value) })
              }
            />

            <label className="text-xs text-white/70">Νικητής</label>
            <select
              className="bg-slate-950 border border-white/15 rounded px-2 py-1 text-white"
              value={(getEff(row, "winner_team_id") as number | null) ?? ""}
              onChange={(e) =>
                setPendingFor(lid, { winner_team_id: e.target.value ? Number(e.target.value) : null })
              }
            >
              <option value="">—</option>
              {teamOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>

            <div className="col-span-2 h-px bg-white/10 my-1" />

            <label className="text-xs text-white/70 col-span-2">KO pointers (σταθεροί δείκτες):</label>

            <input
              type="number"
              placeholder="home_source_round"
              className="bg-slate-950 border border-white/15 rounded px-2 py-1 text-white"
              value={(getEff(row, "home_source_round") as number | null) ?? ""}
              onChange={(e) =>
                setPendingFor(lid, {
                  home_source_round: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
            <input
              type="number"
              placeholder="home_source_bracket_pos"
              className="bg-slate-950 border border-white/15 rounded px-2 py-1 text-white"
              value={(getEff(row, "home_source_bracket_pos") as number | null) ?? ""}
              onChange={(e) =>
                setPendingFor(lid, {
                  home_source_bracket_pos: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
            <input
              type="number"
              placeholder="away_source_round"
              className="bg-slate-950 border border-white/15 rounded px-2 py-1 text-white"
              value={(getEff(row, "away_source_round") as number | null) ?? ""}
              onChange={(e) =>
                setPendingFor(lid, {
                  away_source_round: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
            <input
              type="number"
              placeholder="away_source_bracket_pos"
              className="bg-slate-950 border border-white/15 rounded px-2 py-1 text-white"
              value={(getEff(row, "away_source_bracket_pos") as number | null) ?? ""}
              onChange={(e) =>
                setPendingFor(lid, {
                  away_source_bracket_pos: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </div>

          <div className="flex justify-end">
            <button
              className="px-2 py-1 rounded border border-white/15 hover:bg-white/10 text-xs"
              onClick={() => setOpen(false)}
            >
              Κλείσιμο
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
