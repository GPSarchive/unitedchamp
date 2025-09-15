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
  const semisCrossValue: "A1-B2" | "A1-B1" = (cfg.semis_cross ?? "A1-B2") as any;
  const koSourceSelectValue = Number.isFinite(cfg.from_stage_idx as any) ? String(cfg.from_stage_idx) : "";

  return (
    <fieldset className="rounded-md border border-cyan-400/15 p-3 space-y-4">
      <legend className="px-1 text-cyan-200 text-sm">Knockout — Προέλευση Συμμετεχόντων</legend>

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
          {allStages.map((s, i) => ((s as any)?.kind === "groups" && i < stageIndex ? (
            <option key={i} value={i}>#{i} — {(s as any)?.name || "Όμιλοι"}</option>
          ) : null))}
        </select>
        <p className="mt-1 text-xs text-white/60">Επιλέξτε «Αυτόνομο» για ανεξάρτητο νοκ-άουτ από seeds, ή προηγούμενο στάδιο Ομίλων.</p>
      </div>

      {Number.isFinite(cfg.from_stage_idx as any) ? (
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-white/90 text-sm mb-1">Προκρινόμενοι ανά όμιλο</label>
            <input
              type="number"
              min={1}
              className="w-28 bg-slate-950 border border-cyan-400/20 rounded-md px-3 py-2 text-white"
              value={cfg.advancers_per_group ?? 2}
              onChange={(e) => setCfg({ advancers_per_group: Math.max(1, Number(e.target.value) || 1) })}
            />
            <p className="mt-1 text-xs text-white/60">Τιμή 2 ⇒ ημιτελικοί (4 ομάδες) και τελικός.</p>
          </div>
          <div>
            <label className="block text-white/90 text-sm mb-1">Διασταύρωση Ημιτελικών</label>
            <select
              className="bg-slate-950 border border-cyan-400/20 rounded-md px-3 py-2 text-white"
              value={semisCrossValue}
              onChange={(e) => setCfg({ semis_cross: e.target.value as "A1-B2" | "A1-B1" })}
            >
              <option value="A1-B2">A1 vs B2 & B1 vs A2 (κλασικό)</option>
              <option value="A1-B1">A1 vs B1 & A2 vs B2</option>
            </select>
            <p className="mt-1 text-xs text-white/60">Κανόνας διασταύρωσης ημιτελικών.</p>
          </div>
          <div className="rounded-md border border-white/10 bg-white/5 p-2">
            <p className="text-xs text-white/70">Οι προκρινόμενοι επιλέγονται προσωρινά με βάση το <strong>seed</strong>.</p>
          </div>
        </div>
      ) : (
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-white/90 text-sm mb-1">Μέγεθος Πλέι-οφ</label>
            <select
              className="bg-slate-950 border border-cyan-400/20 rounded-md px-3 py-2 text-white"
              value={cfg.standalone_bracket_size ?? ""}
              onChange={(e) => setCfg({ standalone_bracket_size: e.target.value ? Math.max(2, Number(e.target.value) || 0) : undefined })}
            >
              <option value="">Αυτόματο (όλες οι ομάδες)</option>
              <option value={4}>4</option>
              <option value={8}>8</option>
              <option value={16}>16</option>
              <option value={32}>32</option>
            </select>
            <p className="mt-1 text-xs text-white/60">Αν δεν είναι δύναμη του 2, δημιουργούνται byes με βάση τα seeds.</p>
          </div>
          <div className="rounded-md border border-white/10 bg-white/5 p-2 sm:col-span-2">
            <p className="text-xs text-white/70">Το αυτόνομο νοκ-άουτ γεμίζει με τις κορυφαίες ομάδες κατά <strong>seed</strong>.</p>
          </div>
        </div>
      )}
    </fieldset>
  );
}