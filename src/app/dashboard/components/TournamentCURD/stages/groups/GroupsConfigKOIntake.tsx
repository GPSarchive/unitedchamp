"use client";

import type {
  NewTournamentPayload,
  StageConfig,
  IntakeMapping,
} from "@/app/lib/types";

export default function GroupsConfigKOIntake({
  cfg,
  setCfg,
  groupsArr,
  koMatchesLite,
  allStages,
  stageIndex,
}: {
  cfg: StageConfig;
  setCfg: (patch: Partial<StageConfig>) => void;
  groupsArr: Array<{ name: string }>;
  koMatchesLite: Array<{ round: number; bracket_pos: number }>;
  allStages: NewTournamentPayload["stages"];
  stageIndex: number;
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

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  /** Normalize slot_idx within each group to 0..k-1 (no holes, stable-ish order). */
  function normalizeIntakeRows(
    rows: IntakeMapping[],
    groupsCount: number
  ): IntakeMapping[] {
    const buckets: IntakeMapping[][] = Array.from(
      { length: Math.max(1, groupsCount) },
      () => []
    );
    rows.forEach((r) => {
      const gi = Math.max(0, Math.min(groupsCount - 1, r.group_idx ?? 0));
      buckets[gi].push({ ...r, group_idx: gi });
    });

    const out: IntakeMapping[] = [];
    buckets.forEach((arr) => {
      // stable-ish: by slot, then round, then bracket_pos, then outcome (W before L)
      arr.sort(
        (a, b) =>
          (a.slot_idx ?? 0) - (b.slot_idx ?? 0) ||
          (a.round ?? 0) - (b.round ?? 0) ||
          (a.bracket_pos ?? 0) - (b.bracket_pos ?? 0) ||
          ((a.outcome === "W" ? 0 : 1) - (b.outcome === "W" ? 0 : 1))
      );
      arr.forEach((r, i) => out.push({ ...r, slot_idx: i }));
    });
    return out;
  }

  const addIntakeRow = () => {
    const current: IntakeMapping[] = (cfg.groups_intake ?? []).slice();
    const next: IntakeMapping = {
      group_idx: 0,
      slot_idx: 0, // will be normalized
      round: koMatchesLite[0]?.round ?? 1,
      bracket_pos: koMatchesLite[0]?.bracket_pos ?? 1,
      outcome: "W",
    };
    const normalized = normalizeIntakeRows(
      [...current, next],
      groupsArr.length
    );
    setCfg({ groups_intake: normalized });
  };

  const updateIntakeRow = (idx: number, patch: Partial<IntakeMapping>) => {
    const current = (cfg.groups_intake ?? []).slice();
    current[idx] = { ...current[idx], ...patch } as IntakeMapping;
    const normalized = normalizeIntakeRows(current, groupsArr.length);
    setCfg({ groups_intake: normalized });
  };

  const removeIntakeRow = (idx: number) => {
    const current = (cfg.groups_intake ?? []).slice();
    current.splice(idx, 1);
    const normalized = normalizeIntakeRows(current, groupsArr.length);
    setCfg({ groups_intake: normalized.length ? normalized : undefined });
  };

  /** Existing helper: split first KO column → Winners->Group A, Losers->Group B. */
  const autofillWinnersA_LosersB = () => {
    if (groupsArr.length < 1 || koMatchesLite.length === 0) return;

    const minR = Math.min(...koMatchesLite.map((m) => m.round));
    const firstCol = koMatchesLite.filter((m) => m.round === minR);

    const winnersA: IntakeMapping[] = firstCol.map((m, i) => ({
      group_idx: 0,
      slot_idx: i, // normalized later
      round: m.round,
      bracket_pos: m.bracket_pos,
      outcome: "W",
    }));

    const losersB: IntakeMapping[] =
      groupsArr.length >= 2
        ? firstCol.map((m, i) => ({
            group_idx: 1,
            slot_idx: i,
            round: m.round,
            bracket_pos: m.bracket_pos,
            outcome: "L",
          }))
        : [];

    const normalized = normalizeIntakeRows(
      [...winnersA, ...losersB],
      groupsArr.length
    );
    setCfg({ groups_intake: normalized });
  };

  /** NEW: split first KO column winners across ALL groups in snake order. */
  const autofillWinnersAcrossGroups = () => {
    if (groupsArr.length < 1 || koMatchesLite.length === 0) return;

    const G = groupsArr.length;
    const minR = Math.min(...koMatchesLite.map((m) => m.round));
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
      slot_idx: i, // normalized per-group
      round: m.round,
      bracket_pos: m.bracket_pos,
      outcome: "W",
    }));

    const normalized = normalizeIntakeRows(winners, G);
    setCfg({ groups_intake: normalized });
  };

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------
  return (
    <fieldset className="rounded-md border border-cyan-400/15 p-3 space-y-4">
      <legend className="px-1 text-cyan-200 text-sm">
        Όμιλοι — Ρυθμίσεις & Εισαγωγή από Knockout
      </legend>

      {/* Regular groups options */}
      <div className="grid sm:grid-cols-4 gap-3">
        <div>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!effDoubleRound}
              onChange={(e) => setCfg({ διπλός_γύρος: e.target.checked, double_round: e.target.checked })}
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
                setCfg({ τυχαία_σειρά: e.target.checked, shuffle: e.target.checked })
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
                          group_idx: Math.max(0, Number(e.target.value) || 0),
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

                  {/* Slot */}
                  <div>
                    <label className="block text-xs text-white/60 mb-1">
                      Θέση (slot)
                    </label>
                    <input
                      type="number"
                      min={0}
                      className="w-full bg-slate-950 border border-white/15 rounded-md px-2 py-1 text-white"
                      value={row.slot_idx}
                      onChange={(e) =>
                        updateIntakeRow(ri, {
                          slot_idx: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                    />
                    <div className="text-[10px] text-white/50 mt-1">
                      0 = πρώτη θέση στον όμιλο
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
                      {Array.from(
                        new Set(koMatchesLite.map((m) => m.round))
                      )
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
