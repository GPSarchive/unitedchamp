"use client";

import type { NewTournamentPayload } from "@/app/lib/types";
import { StageConfig } from "@/app/lib/types";

export default function KnockoutConfigFromGroups({
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
  // Keep only “fed from Groups” concerns in this component.
  const semisCrossValue: "A1-B2" | "A1-B1" = (cfg.semis_cross ?? "A1-B2") as any;
  const koSourceSelectValue = Number.isFinite(cfg.from_stage_idx as any)
    ? String(cfg.from_stage_idx)
    : "";

  // Build list of prior “groups” stages only (cannot feed from future stages)
  const groupSourceOptions = allStages
    .map((s, i) => ({ s: s as any, i }))
    .filter(({ s, i }) => s?.kind === "groups" && i < stageIndex);

  const hasSource = Number.isFinite(cfg.from_stage_idx as any);

  return (
    <fieldset className="rounded-md border border-cyan-400/15 p-3 space-y-4">
      <legend className="px-1 text-cyan-200 text-sm">
        Knockout — Προέλευση από Όμιλους (Groups)
      </legend>

      {/* Source groups stage */}
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
          <option value="">— Επιλέξτε προηγούμενο στάδιο Όμιλων —</option>
          {groupSourceOptions.map(({ s, i }) => (
            <option key={i} value={i}>
              #{i} — {s?.name || "Όμιλοι"}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-white/60">
          Το Knockout θα γεμίσει από την τελική κατάταξη του επιλεγμένου σταδίου Όμιλων.
        </p>
      </div>

      {/* Per-group advancers & semis cross only when a groups source is selected */}
      {hasSource ? (
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
              value={semisCrossValue}
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
              Οι προκρινόμενοι υπολογίζονται από την τελική κατάταξη των ομίλων. Η
              πραγματική γέφυρα στο Knockout γίνεται από το ενιαίο state (κατά την
              «Επαναδημιουργία/Επανασπορά»).
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-md border border-white/10 bg-white/5 p-2">
          <p className="text-xs text-white/70">
            Επιλέξτε προηγούμενο στάδιο Όμιλων. Για αυτόνομο Knockout με seeds,
            χρησιμοποιήστε το άλλο panel (KO από Πρωτάθλημα/Αυτόνομο).
          </p>
        </div>
      )}
    </fieldset>
  );
}
