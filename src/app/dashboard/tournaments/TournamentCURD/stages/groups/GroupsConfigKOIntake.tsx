// app/dashboard/tournaments/TournamentCURD/stages/groups/GroupsConfigKOIntake.tsx
"use client";

import type {
  NewTournamentPayload,
  StageConfig,
  IntakeMapping,
} from "@/app/lib/types";
import { computeGroupsSignature } from "@/app/dashboard/tournaments/TournamentCURD/util/groupsSignature";
import {
  normalizeIntakeRows,
  validateKoIntake,
} from "@/app/dashboard/tournaments/TournamentCURD/util/functions/groupsIntake";

export default function GroupsConfigKOIntake({
  cfg,
  setCfg,
  groupsArr,
  koMatchesLite,
  allStages,
  stageIndex,
  hasStageMatches = false, // optional: if this stage already has saved matches
}: {
  cfg: StageConfig;
  setCfg: (patch: Partial<StageConfig>) => void;
  groupsArr: Array<{ name: string }>;
  koMatchesLite: Array<{ round: number; bracket_pos: number }>;
  allStages: NewTournamentPayload["stages"];
  stageIndex: number;
  hasStageMatches?: boolean;
}) {
  // -------- Effective group settings (Greek <-> EN mirrors supported) --------
  const effDoubleRound = (cfg as any).διπλός_γύρος ?? cfg.double_round ?? false;
  const effShuffle = (cfg as any).τυχαία_σειρά ?? cfg.shuffle ?? false;
  const effRoundsPerOpp =
    (cfg as any).αγώνες_ανά_αντίπαλο ??
    cfg.rounds_per_opponent ??
    (effDoubleRound ? 2 : 1);
  const effLimitMD =
    (cfg as any).μέγιστες_αγωνιστικές ?? cfg.limit_matchdays ?? undefined;

  const groupsIntakeSourceValue = Number.isFinite(
    (cfg as any).from_knockout_stage_idx as any
  )
    ? String((cfg as any).from_knockout_stage_idx)
    : "";

  // ---------- Structure guard (persisted signature) ----------
  const currentSig = computeGroupsSignature(groupsArr);
  const storedSig = (cfg as any).groups_signature as string | undefined;
  const hasIntake = (cfg.groups_intake?.length ?? 0) > 0;

  // Show banner only if: signature changed AND there is something at stake
  const structureLooksDirty =
    storedSig != null &&
    storedSig !== currentSig &&
    (hasStageMatches || hasIntake);

  // ---------- Intake validation ----------
  const rows = (cfg.groups_intake ?? []) as IntakeMapping[];
  const { errors: intakeErrors, warnings: intakeWarnings } = validateKoIntake(
    rows,
    koMatchesLite,
    groupsArr.length
  );

  // --------------------------------------------------------------------------
  // Handlers
  // --------------------------------------------------------------------------

  const addIntakeRow = () => {
    const current: IntakeMapping[] = (cfg.groups_intake ?? []).slice();
    const next: IntakeMapping = {
      group_idx: 0,
      slot_idx: 1, // 1-based; will be normalized
      round: koMatchesLite[0]?.round ?? 1,
      bracket_pos: koMatchesLite[0]?.bracket_pos ?? 1,
      outcome: "W",
    };
    const { rows: normalized, changed } = normalizeIntakeRows(
      [...current, next],
      groupsArr.length
    );
    setCfg({
      groups_intake: normalized,
      // surface a tiny “normalization happened” flag to let parent show a toast if desired
      groups_intake_normalized_at: changed ? Date.now() : (cfg as any).groups_intake_normalized_at,
    } as any);
  };

  const updateIntakeRow = (idx: number, patch: Partial<IntakeMapping>) => {
    const current = (cfg.groups_intake ?? []).slice();
    current[idx] = { ...current[idx], ...patch } as IntakeMapping;
    const { rows: normalized, changed } = normalizeIntakeRows(current, groupsArr.length);
    setCfg({
      groups_intake: normalized,
      groups_intake_normalized_at: changed ? Date.now() : (cfg as any).groups_intake_normalized_at,
    } as any);
  };

  const removeIntakeRow = (idx: number) => {
    const current = (cfg.groups_intake ?? []).slice();
    current.splice(idx, 1);
    const { rows: normalized, changed } = normalizeIntakeRows(current, groupsArr.length);
    setCfg({
      groups_intake: normalized.length ? normalized : undefined,
      groups_intake_normalized_at: changed ? Date.now() : (cfg as any).groups_intake_normalized_at,
    } as any);
  };

  /** Existing helper: split first KO column → Winners->Group A, Losers->Group B. */
  const autofillWinnersA_LosersB = () => {
    if (groupsArr.length < 1 || koMatchesLite.length === 0) return;

    const minR = Math.min(...(koMatchesLite.map((m) => m.round) as number[]));
    const firstCol = koMatchesLite.filter((m) => m.round === minR);

    const winnersA: IntakeMapping[] = firstCol.map((m, i) => ({
      group_idx: 0,
      slot_idx: i + 1, // 1-based
      round: m.round,
      bracket_pos: m.bracket_pos,
      outcome: "W",
    }));

    const losersB: IntakeMapping[] =
      groupsArr.length >= 2
        ? firstCol.map((m, i) => ({
            group_idx: 1,
            slot_idx: i + 1, // 1-based
            round: m.round,
            bracket_pos: m.bracket_pos,
            outcome: "L",
          }))
        : [];

    const { rows: normalized, changed } = normalizeIntakeRows(
      [...winnersA, ...losersB],
      groupsArr.length
    );
    setCfg({
      groups_intake: normalized,
      groups_intake_normalized_at: changed ? Date.now() : (cfg as any).groups_intake_normalized_at,
    } as any);
  };

  /** Split first KO column winners across ALL groups in snake order. */
  const autofillWinnersAcrossGroups = () => {
    if (groupsArr.length < 1 || koMatchesLite.length === 0) return;

    const G = groupsArr.length;
    const minR = Math.min(...(koMatchesLite.map((m) => m.round) as number[]));
    const firstCol = koMatchesLite.filter((m) => m.round === minR);

    // Snake pattern: 0..G-1, then G-1..0, repeat
    const snakeGroupIdx = (i: number) => {
      if (G === 1) return 0;
      const span = 2 * G - 2;
      const r = i % span;
      return r < G ? r : 2 * G - 2 - r;
    };

    const winners: IntakeMapping[] = firstCol.map((m, i) => ({
      group_idx: snakeGroupIdx(i),
      slot_idx: i + 1, // 1-based
      round: m.round,
      bracket_pos: m.bracket_pos,
      outcome: "W",
    }));

    const { rows: normalized, changed } = normalizeIntakeRows(winners, G);
    setCfg({
      groups_intake: normalized,
      groups_intake_normalized_at: changed ? Date.now() : (cfg as any).groups_intake_normalized_at,
    } as any);
  };

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------
  return (
    <fieldset className="rounded-md border border-cyan-400/15 p-3 space-y-4">
      <legend className="px-1 text-cyan-200 text-sm">
        Όμιλοι — Ρυθμίσεις & Εισαγωγή από Knockout
      </legend>

      {/* 🔶 Structure-changed warning (persisted) */}
      {structureLooksDirty && (
        <div className="rounded-md border border-amber-400/30 bg-amber-500/10 p-2 text-amber-200 text-xs flex items-center justify-between gap-2">
          <div>
            Έχει αλλάξει η δομή ομίλων (σειρά/ονόματα/πλήθος) σε σχέση με την
            αποθηκευμένη βάση. Ενδέχεται να χρειαστεί επαναδημιουργία αγώνων του
            σταδίου και/ή ανανέωση χαρτογραφήσεων KO → Όμιλοι.
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              className="px-2 py-1 rounded-md border border-cyan-400/40 text-cyan-100 hover:bg-cyan-500/10"
              onClick={autofillWinnersA_LosersB}
              title="Γρήγορο ασφαλές βήμα αν χρησιμοποιείτε την πρώτη στήλη του KO"
            >
              Re-Autofill
            </button>
            <button
              className="px-2 py-1 rounded-md border border-white/20 text-white hover:bg-white/10"
              onClick={() => setCfg({ groups_signature: currentSig as any })}
              title="Αφού ελέγξετε/αναδημιουργήσετε τα παιχνίδια, επιβεβαιώστε για να φύγει η προειδοποίηση"
            >
              Επιβεβαίωση αλλαγών
            </button>
          </div>
        </div>
      )}

      {/* 🔴 Intake errors */}
      {intakeErrors.length > 0 && (
        <div className="rounded-md border border-rose-400/30 bg-rose-500/10 p-2 text-rose-200 text-xs">
          <div className="font-medium mb-1">KO → Όμιλοι: Σφάλματα</div>
          <ul className="list-disc pl-5 space-y-0.5">
            {intakeErrors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 🟡 Intake warnings (incl. auto-normalizations) */}
      {intakeWarnings.length > 0 && (
        <div className="rounded-md border border-amber-400/30 bg-amber-500/10 p-2 text-amber-200 text-xs">
          <div className="font-medium mb-1">KO → Όμιλοι: Προειδοποιήσεις</div>
          <ul className="list-disc pl-5 space-y-0.5">
            {intakeWarnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Regular groups options */}
      <div className="grid sm:grid-cols-4 gap-3">
        <div>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!effDoubleRound}
              onChange={(e) =>
                setCfg({
                  διπλός_γύρος: e.target.checked,
                  double_round: e.target.checked,
                })
              }
            />
            <span className="text-white/90 text-sm">Διπλός Γύρος</span>
          </label>
          <p className="text-xs text-white/60">
            Αν ενεργοποιηθεί, κάθε ζευγάρι θα παίξει δύο φορές.
          </p>
        </div>

        <div>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!effShuffle}
              onChange={(e) =>
                setCfg({
                  τυχαία_σειρά: e.target.checked,
                  shuffle: e.target.checked,
                })
              }
            />
            <span className="text-white/90 text-sm">Τυχαία Σειρά</span>
          </label>
          <p className="text-xs text-white/60">
            Ανακατεύει τις ομάδες πριν τη δημιουργία προγράμματος.
          </p>
        </div>

        <div>
          <label className="block text-white/90 text-sm mb-1">
            Αγώνες ανά αντίπαλο
          </label>
          <input
            type="number"
            min={1}
            className="w-28 bg-slate-950 border border-cyan-400/20 rounded-md px-3 py-2 text-white"
            value={effRoundsPerOpp}
            onChange={(e) => {
              const v = Math.max(1, Number(e.target.value) || 1);
              setCfg({
                αγώνες_ανά_αντίπαλο: v,
                rounds_per_opponent: v,
                διπλός_γύρος: v >= 2,
                double_round: v >= 2,
              });
            }}
          />
          <p className="text-xs text-white/60">
            1 = έναν γύρο, 2 = διπλό γύρο, κ.ο.κ.
          </p>
        </div>

        <div>
          <label className="block text-white/90 text-sm mb-1">
            Μέγιστες Αγωνιστικές (προαιρετικό)
          </label>
          <input
            type="number"
            min={1}
            className="w-28 bg-slate-950 border border-cyan-400/20 rounded-md px-3 py-2 text-white"
            value={effLimitMD ?? ""}
            onChange={(e) => {
              const raw = e.target.value.trim();
              const v = raw === "" ? undefined : Math.max(1, Number(raw) || 1);
              setCfg({ μέγιστες_αγωνιστικές: v as any, limit_matchdays: v as any });
            }}
            placeholder="—"
          />
          <p className="text-xs text-white/60">
            Αν τεθεί, περιορίζει τον αριθμό αγωνιστικών.
          </p>
        </div>
      </div>

      {/* Intake source selector */}
      <div>
        <label className="block text-white/90 text-sm mb-1">
          Εισαγωγή από Knockout (πηγή)
        </label>
        <select
          className="w-full bg-slate-950 border border-white/15 rounded-md px-2 py-1 text-white"
          value={groupsIntakeSourceValue}
          onChange={(e) => {
            const v = e.target.value;
            if (!v) {
              setCfg({
                from_knockout_stage_idx: undefined,
                groups_intake: undefined,
              });
            } else {
              setCfg({ from_knockout_stage_idx: Math.max(0, Number(v) || 0) });
            }
          }}
        >
          <option value="">— Καμία εισαγωγή —</option>
          {allStages.map((s, i) =>
            (s as any)?.kind === "knockout" && i < stageIndex ? (
              <option key={i} value={i}>
                #{i} — {(s as any)?.name || "Knockout"}
              </option>
            ) : null
          )}
        </select>
        <p className="mt-1 text-xs text-white/60">
          Αν οριστεί, οι θέσεις ομίλων μπορούν να γεμίσουν από νικητές/ηττημένους
          του επιλεγμένου knockout.
        </p>
      </div>

      {/* KO → Groups mappings editor */}
      {Number.isFinite((cfg as any).from_knockout_stage_idx as any) ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-white/90 font-medium">Χαρτογράφηση Θέσεων</div>
            <div className="flex items-center gap-2">
              <button
                className="px-2 py-1 text-sm rounded-md border border-white/15 text-white/80 hover:text-white hover:border-white/30"
                onClick={addIntakeRow}
              >
                + προσθήκη
              </button>

              <button
                className="px-2 py-1 text-sm rounded-md border border-cyan-400/25 text-cyan-100 hover:border-cyan-400/40"
                onClick={autofillWinnersA_LosersB}
                disabled={groupsArr.length < 1 || koMatchesLite.length === 0}
                title={
                  koMatchesLite.length === 0
                    ? "Δεν βρέθηκαν αγώνες στο knockout"
                    : "Νικητές → A (και Ηττημένοι → B αν υπάρχει)"
                }
              >
                Autofill: Νικητές → A, Ηττημένοι → B
              </button>

              <button
                className="px-2 py-1 text-sm rounded-md border border-emerald-400/25 text-emerald-100 hover:border-emerald-400/40"
                onClick={autofillWinnersAcrossGroups}
                disabled={groupsArr.length < 1 || koMatchesLite.length === 0}
                title={
                  koMatchesLite.length === 0
                    ? "Δεν βρέθηκαν αγώνες στο knockout"
                    : "Μοιράζει μόνο τους Νικητές σε όλους τους ομίλους (snake)"
                }
              >
                Autofill: Split Winners → All Groups
              </button>
            </div>
          </div>

          {(cfg.groups_intake ?? []).length === 0 ? (
            <div className="text-white/60 text-sm">
              Δεν υπάρχουν χαρτογραφήσεις. Πατήστε «+ προσθήκη» ή «Autofill».
            </div>
          ) : (
            <>
              {/* editor rows */}
              <div className="space-y-2">
                {(cfg.groups_intake ?? []).map((row, ri) => (
                  <div
                    key={`row-${ri}`}
                    className="grid grid-cols-1 md:grid-cols-6 gap-2 rounded-md border border-white/10 bg-white/[0.03] p-2"
                  >
                    {/* Group */}
                    <div>
                      <label className="block text-xs text-white/60 mb-1">
                        Όμιλος
                      </label>
                      <select
                        className="w-full bg-slate-950 border border-white/15 rounded-md px-2 py-1 text-white"
                        value={row.group_idx}
                        onChange={(e) =>
                          updateIntakeRow(ri, {
                            group_idx: Math.max(0, Math.min(groupsArr.length - 1, Number(e.target.value) || 0)),
                          })
                        }
                      >
                        {groupsArr.map((g, gi) => (
                          <option key={gi} value={gi}>
                            #{gi + 1} — {g.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Slot (1-based) */}
                    <div>
                      <label className="block text-xs text-white/60 mb-1">
                        Θέση (slot)
                      </label>
                      <input
                        type="number"
                        min={1}
                        className="w-full bg-slate-950 border border-white/15 rounded-md px-2 py-1 text-white"
                        value={row.slot_idx}
                        onChange={(e) =>
                          updateIntakeRow(ri, {
                            slot_idx: Math.max(1, Number(e.target.value) || 1),
                          })
                        }
                      />
                      <div className="text-[10px] text-white/50 mt-1">
                        1 = πρώτη θέση στον όμιλο
                      </div>
                    </div>

                    {/* Outcome */}
                    <div>
                      <label className="block text-xs text-white/60 mb-1">
                        Αποτέλεσμα
                      </label>
                      <select
                        className="w-full bg-slate-950 border border-white/15 rounded-md px-2 py-1 text-white"
                        value={row.outcome}
                        onChange={(e) =>
                          updateIntakeRow(ri, {
                            outcome: (e.target.value as "W" | "L") || "W",
                          })
                        }
                      >
                        <option value="W">Νικητής</option>
                        <option value="L">Ηττημένος</option>
                      </select>
                    </div>

                    {/* KO round */}
                    <div>
                      <label className="block text-xs text-white/60 mb-1">
                        KO Γύρος
                      </label>
                      <select
                        className="w-full bg-slate-950 border border-white/15 rounded-md px-2 py-1 text-white"
                        value={row.round}
                        onChange={(e) =>
                          updateIntakeRow(ri, {
                            round: Math.max(1, Number(e.target.value) || 1),
                          })
                        }
                      >
                        {Array.from(new Set(koMatchesLite.map((m) => m.round)))
                          .sort((a, b) => a - b)
                          .map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                      </select>
                    </div>

                    {/* KO bracket pos */}
                    <div>
                      <label className="block text-xs text-white/60 mb-1">
                        KO Θέση Δέντρου
                      </label>
                      <select
                        className="w-full bg-slate-950 border border-white/15 rounded-md px-2 py-1 text-white"
                        value={row.bracket_pos}
                        onChange={(e) =>
                          updateIntakeRow(ri, {
                            bracket_pos: Math.max(1, Number(e.target.value) || 1),
                          })
                        }
                      >
                        {koMatchesLite
                          .filter((m) => m.round === row.round)
                          .map((m) => m.bracket_pos)
                          .sort((a, b) => a - b)
                          .map((bp) => (
                            <option key={bp} value={bp}>
                              {bp}
                            </option>
                          ))}
                      </select>
                    </div>

                    {/* Remove */}
                    <div className="flex items-end justify-end">
                      <button
                        className="w-full md:w-auto px-2 py-1 text-sm rounded-md border border-rose-400/30 text-rose-200 hover:bg-rose-500/10"
                        onClick={() => removeIntakeRow(ri)}
                        title="Διαγραφή"
                      >
                        Διαγραφή
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="text-white/60 text-sm">
          Δεν έχει οριστεί πηγή knockout για εισαγωγή θέσεων.
        </div>
      )}
    </fieldset>
  );
}
