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

  const sourceStageIdx = Number.isFinite(cfg.from_stage_idx as any)
    ? Number(cfg.from_stage_idx)
    : null;
  const sourceStage = sourceStageIdx !== null ? (allStages[sourceStageIdx] as any) : null;

  const isFromLeague = sourceStage?.kind === "league";
  const isFromGroups = sourceStage?.kind === "groups";

  // ✅ Use advancers_total for League→KO
  const advancersCount = cfg.advancers_total ?? 4;

  return (
    <fieldset className="rounded-md border border-cyan-400/15 p-3 space-y-4">
      <legend className="px-1 text-cyan-200 text-sm">
        Knockout — Προέλευση
      </legend>

      {/* Source league selector */}
      <div>
        <label className="block text-white/90 text-sm mb-1">Προέλευση</label>
        <select
          className="bg-slate-950 border border-cyan-400/20 rounded-md px-3 py-2 text-white"
          value={koSourceSelectValue}
          onChange={(e) => {
            const v = e.target.value;
            if (!v) {
              setCfg({
                from_stage_idx: undefined,
                advancers_total: undefined,
                advancers_per_group: undefined,
                semis_cross: undefined,
              });
            } else {
              setCfg({ from_stage_idx: Math.max(0, Number(v) || 0) });
            }
          }}
        >
          <option value="">Αυτόνομο (μόνο seeds)</option>
          {allStages.map((s, i) => {
            const stage = s as any;
            if (i >= stageIndex) return null; // Can't reference future stages
            if (stage?.kind === "league") {
              return (
                <option key={i} value={i}>
                  #{i} — {stage?.name || "Πρωτάθλημα"} (League)
                </option>
              );
            }
            if (stage?.kind === "groups") {
              return (
                <option key={i} value={i}>
                  #{i} — {stage?.name || "Όμιλοι"} (Groups)
                </option>
              );
            }
            return null;
          })}
        </select>
        <p className="mt-1 text-xs text-white/60">
          Επιλέξτε «Αυτόνομο» για ανεξάρτητο νοκ-άουτ από seeds, ή προηγούμενο
          στάδιο Πρωταθλήματος ή Όμιλων.
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

      {/* Advancers if Groups selected */}
      {isFromGroups ? (
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-white/90 text-sm mb-1">Προκρινόμενοι ανά όμιλο</label>
            <input
              type="number"
              min={1}
              className="w-28 bg-slate-950 border border-cyan-400/20 rounded-md px-3 py-2 text-white"
              value={cfg.advancers_per_group ?? 2}
              onChange={(e) =>
                setCfg({
                  advancers_per_group: Math.max(1, Number(e.target.value) || 1),
                })
              }
            />
            <p className="mt-1 text-xs text-white/60">
              Τιμή 2 ⇒ ημιτελικοί (4 ομάδες) και τελικός.
            </p>
          </div>

          <div>
            <label className="block text-white/90 text-sm mb-1">Διασταύρωση Ημιτελικών</label>
            <select
              className="bg-slate-950 border border-cyan-400/20 rounded-md px-3 py-2 text-white"
              value={(cfg.semis_cross ?? "A1-B2") as string}
              onChange={(e) =>
                setCfg({ semis_cross: e.target.value as "A1-B2" | "A1-B1" })
              }
            >
              <option value="A1-B2">A1 vs B2 &amp; B1 vs A2 (κλασικό)</option>
              <option value="A1-B1">A1 vs B1 &amp; A2 vs B2</option>
            </select>
            <p className="mt-1 text-xs text-white/60">Κανόνας διασταύρωσης ημιτελικών.</p>
          </div>

          <div className="rounded-md border border-white/10 bg-white/5 p-2">
            <p className="text-xs text-white/70">
              Οι προκρινόμενοι υπολογίζονται από την τελική κατάταξη των ομίλων.
            </p>
          </div>
        </div>
      ) : null}
    </fieldset>
  );
}
