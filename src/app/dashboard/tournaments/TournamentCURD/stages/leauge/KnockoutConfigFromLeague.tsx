//app/dashboard/tournaments/TournamentCURD/stages/leauge/KnockoutConfigFromLeague.tsx
"use client";

import type { NewTournamentPayload } from "@/app/lib/types";
import type { StageConfig } from "@/app/lib/types";

export default function KnockoutConfigFromLeague({
  cfg,
  setCfg,
  allStages,
  stageIndex,
}: {
  cfg: StageConfig;
  setCfg: (patch: Partial<StageConfig>) => void;
  allStages: NewTournamentPayload["stages"];
  stageIndex: number;
}) {
  const koSourceSelectValue = Number.isFinite(cfg.from_stage_idx as any)
    ? String(cfg.from_stage_idx)
    : "";

  const isFromLeague =
    Number.isFinite(cfg.from_stage_idx as any) &&
    (allStages[Number(cfg.from_stage_idx)] as any)?.kind === "league";

  // ✅ Use advancers_total for League→KO
  const advancersCount = cfg.advancers_total ?? 4;

  return (
    <fieldset className="rounded-md border border-cyan-400/15 p-3 space-y-4">
      <legend className="px-1 text-cyan-200 text-sm">
        Knockout — Προέλευση από Πρωτάθλημα
      </legend>

      {/* Source league selector */}
      <div>
        <label className="block text-white/90 text-sm mb-1">Προέλευση</label>
        <select
          className="bg-slate-950 border border-cyan-400/20 rounded-md px-3 py-2 text-white"
          value={koSourceSelectValue}
          onChange={(e) => {
            const v = e.target.value;
            if (!v) setCfg({ from_stage_idx: undefined });
            else setCfg({ from_stage_idx: Math.max(0, Number(v) || 0) });
          }}
        >
          <option value="">Αυτόνομο (μόνο seeds)</option>
          {allStages.map((s, i) =>
            (s as any)?.kind === "league" && i < stageIndex ? (
              <option key={i} value={i}>
                #{i} — {(s as any)?.name || "Πρωτάθλημα"}
              </option>
            ) : null
          )}
        </select>
        <p className="mt-1 text-xs text-white/60">
          Επιλέξτε «Αυτόνομο» για ανεξάρτητο νοκ-άουτ από seeds, ή προηγούμενο
          στάδιο Πρωταθλήματος.
        </p>
      </div>

      {/* Advancers if League selected */}
      {isFromLeague ? (
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-white/90 text-sm mb-1">
              Προκρινόμενοι από το Πρωτάθλημα (σύνολο)
            </label>
            <input
              type="number"
              min={2}
              className="w-28 bg-slate-950 border border-cyan-400/20 rounded-md px-3 py-2 text-white"
              value={advancersCount}
              onChange={(e) =>
                setCfg({
                  advancers_total: Math.max(2, Number(e.target.value) || 2),
                })
              }
            />
            <p className="mt-1 text-xs text-white/60">
              Επιλέξτε πόσες κορυφαίες ομάδες της <strong>τελικής βαθμολογίας</strong> προκρίνονται.
            </p>
          </div>
          <div className="rounded-md border border-white/10 bg-white/5 p-2">
            <p className="text-xs text-white/70">
              Οι ομάδες επιλέγονται με βάση την <strong>τελική κατάταξη</strong> του πρωταθλήματος (όχι seed).
            </p>
          </div>
        </div>
      ) : null}
    </fieldset>
  );
}
