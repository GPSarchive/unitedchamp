// app/components/DashboardPageComponents/TournamentCURD/preview/MatchPlanner.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { DraftMatch, TeamDraft } from "../TournamentWizard";
import type { NewTournamentPayload } from "@/app/lib/types";
import { generateDraftMatches } from "@/app/components/DashboardPageComponents/TournamentCURD/util/Generators";
import { genRoundRobin } from "@/app/components/DashboardPageComponents/TournamentCURD/util/functions/roundRobin";

type EditableDraftMatch = DraftMatch & { locked?: boolean; _localId?: number };

// Helper: tries to read a name from TeamDraft if present (some projects add it)
function pickLocalName(t: TeamDraft): string | null {
  return (t as any)?.name ? String((t as any).name) : null;
}

// Greek labels for stage kinds
function kindLabel(k?: string) {
  if (k === "groups") return "όμιλοι";
  if (k === "knockout") return "νοκ-άουτ";
  return k ?? "?";
}

// Choose initial stage
function initialStageIndex(payload: NewTournamentPayload, forced?: number | null) {
  if (typeof forced === "number") return forced;
  const nonKO = payload.stages.findIndex((s: any) => s.kind !== "knockout");
  if (nonKO >= 0) return nonKO;
  return payload.stages[0] ? 0 : -1;
}

export default function MatchPlanner({
  payload,
  teams,
  draftMatches,
  onChange,
  // lock planner to a specific stage (hides stage picker)
  forceStageIdx,
  // tighter spacing for embedding in StageCard
  compact,
}: {
  payload: NewTournamentPayload;
  teams: TeamDraft[];
  draftMatches: DraftMatch[];
  onChange: (next: DraftMatch[]) => void;
  forceStageIdx?: number;
  compact?: boolean;
}) {
  const [stageIdx, setStageIdx] = useState<number>(() => initialStageIndex(payload, forceStageIdx));
  const [groupIdx, setGroupIdx] = useState<number | null>(null);

  // Keep stageIdx synced with forced value
  useEffect(() => {
    if (typeof forceStageIdx === "number") {
      setStageIdx(forceStageIdx);
      setGroupIdx(null);
    }
  }, [forceStageIdx]);

  // --------------------------
  // Team names lookup
  // --------------------------
  const [teamMeta, setTeamMeta] = useState<Record<number, { name: string }>>(() => {
    const init: Record<number, { name: string }> = {};
    teams.forEach((t) => {
      const nm = pickLocalName(t);
      if (nm) init[t.id] = { name: nm };
    });
    return init;
  });

  // Load names from /api/teams if some IDs are unknown
  useEffect(() => {
    const ids = teams.map((t) => t.id);
    const unknown = ids.filter((id) => !teamMeta[id]);
    if (unknown.length === 0) return;

    (async () => {
      try {
        const tryIds = async () => {
          const url = new URL("/api/teams", window.location.origin);
          url.searchParams.set("ids", unknown.join(","));
          const res = await fetch(url.toString(), { credentials: "include" });
          if (!res.ok) throw new Error(String(res.status));
          const body = await res.json().catch(() => null);
          const list: Array<{ id: number; name: string }> = body?.teams ?? body ?? [];
          if (!Array.isArray(list) || list.length === 0) throw new Error("empty");
          return list;
        };

        const tryAll = async () => {
          const url = new URL("/api/teams", window.location.origin);
          const res = await fetch(url.toString(), { credentials: "include" });
          if (!res.ok) throw new Error(String(res.status));
          const body = await res.json().catch(() => null);
          const list: Array<{ id: number; name: string }> = body?.teams ?? body ?? [];
          return list.filter((r) => ids.includes(r.id));
        };

        let list: Array<{ id: number; name: string }>;
        try {
          list = await tryIds();
        } catch {
          list = await tryAll();
        }

        setTeamMeta((prev) => {
          const next = { ...prev };
          list.forEach((r) => {
            next[r.id] = { name: r.name };
          });
          return next;
        });
      } catch {
        // fallback: show Team #id
      }
    })();
  }, [teams, teamMeta]);

  const stage = payload.stages[stageIdx];
  const isGroups = stage?.kind === "groups";
  const isKO = stage?.kind === "knockout";
  const groups = isGroups ? stage?.groups ?? [] : [];
  const showStagePicker = typeof forceStageIdx !== "number";

  // Which team IDs belong to the currently selected group?
  const groupTeamIds = useMemo<number[]>(() => {
    if (!isGroups) return teams.map((t) => t.id);
    const gIdx = groupIdx ?? 0;
    return teams
      .filter((t) => t.groupsByStage?.[stageIdx] === gIdx)
      .map((t) => t.id);
  }, [teams, stageIdx, groupIdx, isGroups]);

  const teamLabel = (id?: number | null) => {
    if (!id) return "— Ομάδα —";
    const nm = teamMeta[id]?.name;
    const seed = teams.find((t) => t.id === id)?.seed;
    const base = nm ?? `Ομάδα #${id}`;
    return seed != null ? `${base} (S${seed})` : base;
  };

  // Options shown in selects:
  //  - groups: ONLY this group's teams
  //  - league/KO: all tournament teams
  const teamOptions = useMemo(() => {
    const ids = isGroups ? groupTeamIds : teams.map((t) => t.id);
    return ids
      .slice()
      .sort((a, b) => (teamMeta[a]?.name || "").localeCompare(teamMeta[b]?.name || ""))
      .map((id) => ({ id, label: teamLabel(id) }));
  }, [teams, teamMeta, isGroups, groupTeamIds]);

  // --------------------------
  // Rows selection
  // --------------------------
  const withLocalIds: EditableDraftMatch[] = useMemo(
    () => draftMatches.map((m, i) => ({ ...m, _localId: i })),
    [draftMatches]
  );

  const rows = useMemo(() => {
    return withLocalIds
      .filter((m) => {
        if (isGroups) return m.stageIdx === stageIdx && m.groupIdx === (groupIdx ?? 0);
        if (isKO) return m.stageIdx === stageIdx; // KO has no groupIdx
        return m.stageIdx === stageIdx && (m.groupIdx == null || m.groupIdx === null);
      })
      .sort((a, b) => {
        if (isKO) {
          return (a.round ?? 0) - (b.round ?? 0) || (a.bracket_pos ?? 0) - (b.bracket_pos ?? 0);
        }
        return (a.matchday ?? 0) - (b.matchday ?? 0) || (a.bracket_pos ?? 0) - (b.bracket_pos ?? 0);
      });
  }, [withLocalIds, stageIdx, isGroups, isKO, groupIdx]);

  // Helpful labels for stage / group (shown per-row)
  const stageName = (idx: number | undefined) => payload.stages[idx ?? -1]?.name ?? `Στάδιο #${(idx ?? 0) + 1}`;
  const stageKind = (idx: number | undefined) => kindLabel(payload.stages[idx ?? -1]?.kind);
  const groupName = (sIdx: number | undefined, gIdx: number | null | undefined) => {
    if (gIdx == null || gIdx < 0) return null;
    const g = payload.stages[sIdx ?? -1]?.groups?.[gIdx];
    return g?.name ?? `Όμιλος ${typeof gIdx === "number" ? gIdx + 1 : ""}`;
  };
  const stageBadge = (m: DraftMatch) => {
    const sLabel = stageName(m.stageIdx);
    const kLabel = stageKind(m.stageIdx);
    const gLabel = (payload.stages[m.stageIdx ?? -1]?.kind === "groups")
      ? groupName(m.stageIdx, m.groupIdx ?? null)
      : null;
    return gLabel ? `${sLabel} (${kLabel}) • ${gLabel}` : `${sLabel} (${kLabel})`;
  };

  // --------------------------
  // Mutators
  // --------------------------
  const setRow = (localId: number, patch: Partial<EditableDraftMatch>) => {
    const next = withLocalIds.map((m) => (m._localId === localId ? { ...m, ...patch } : m));
    onChange(next.map(({ _localId, ...rest }) => rest));
  };

  const removeRow = (localId: number) => {
    const next = withLocalIds.filter((m) => m._localId !== localId);
    onChange(next.map(({ _localId, ...rest }) => rest));
  };

  const addRow = () => {
    if (isKO) {
      const last = rows[rows.length - 1];
      const newRound = (last?.round ?? 0) || 1;
      const newBracket = (last?.bracket_pos ?? 0) + 1 || 1;
      const newRow: EditableDraftMatch = {
        stageIdx,
        groupIdx: null,
        matchday: null,
        round: newRound,
        bracket_pos: newBracket,
        team_a_id: null,
        team_b_id: null,
        match_date: null,
        locked: false,
      };
      onChange([...draftMatches, newRow]);
    } else {
      const md = (rows[rows.length - 1]?.matchday ?? 0) + 1;
      const newRow: EditableDraftMatch = {
        stageIdx,
        groupIdx: isGroups ? (groupIdx ?? 0) : null,
        matchday: md,
        team_a_id: null,
        team_b_id: null,
        round: null,
        bracket_pos: null,
        match_date: null,
        locked: false,
      };
      onChange([...draftMatches, newRow]);
    }
  };

  const swapTeams = (localId: number) => {
    const row = withLocalIds.find((m) => m._localId === localId);
    if (!row) return;
    setRow(localId, { team_a_id: row.team_b_id ?? null, team_b_id: row.team_a_id ?? null });
  };

  // Re-generate ONLY the current stage (or group) and keep locked rows
  const regenerateHere = () => {
    const fresh = generateDraftMatches({ payload, teams });

    const isTarget = (m: DraftMatch) => {
      if (isGroups) return m.stageIdx === stageIdx && m.groupIdx === (groupIdx ?? 0);
      if (isKO) return m.stageIdx === stageIdx;
      return m.stageIdx === stageIdx && (m.groupIdx == null || m.groupIdx === null);
    };

    const locked = withLocalIds.filter((m) => isTarget(m) && (m as EditableDraftMatch).locked);
    const freshSubset = fresh.filter(isTarget);

    const mergedSubset: DraftMatch[] = [
      ...locked.map(({ _localId, ...x }) => x),
      ...freshSubset.filter(
        (f) =>
          !locked.some(
            (l) =>
              l.team_a_id === f.team_a_id &&
              l.team_b_id === f.team_b_id &&
              (isKO ? l.round === f.round && l.bracket_pos === f.bracket_pos : l.matchday === f.matchday)
          )
      ),
    ];

    const others = withLocalIds.filter((m) => !isTarget(m)).map(({ _localId, ...x }) => x);

    onChange([...others, ...mergedSubset]);
  };

  // =========================
  // Auto-assign (Round Robin)
  // =========================
  const autoAssignGroupRR = () => {
    if (!isGroups) return;

    const hasLocked = rows.some((r) => (r as EditableDraftMatch).locked);
    if (hasLocked && !confirm("Υπάρχουν κλειδωμένοι αγώνες σε αυτόν τον όμιλο. Θέλετε να συνεχίσετε;")) {
      return;
    }

    if (groupTeamIds.length < 2) {
      alert("Απαιτούνται τουλάχιστον 2 ομάδες στον όμιλο για αυτόματη ανάθεση.");
      return;
    }

    const cfg: any = ((payload.stages[stageIdx] as any)?.config ?? {});
    const doubleRound: boolean = !!(cfg.double_round ?? cfg["διπλός_γύρος"]);
    const repeatsRaw = cfg.rounds_per_opponent ?? cfg["αγώνες_ανά_αντίπαλο"];
    const repeats: number = Number.isFinite(repeatsRaw)
      ? Math.max(1, Number(repeatsRaw))
      : doubleRound
      ? 2
      : 1;

    const rr = genRoundRobin({
      stageIdx,
      groupIdx: groupIdx ?? 0,
      teamIds: groupTeamIds.slice(),
      repeats,
      startDate: null,
      intervalDays: 0,
    });

    const targetRows = (rows.slice().sort((a, b) => (a.matchday ?? 0) - (b.matchday ?? 0)) as EditableDraftMatch[]);
    const rrRows = rr.slice().sort((a, b) => (a.matchday ?? 0) - (b.matchday ?? 0));

    const updates = new Map<number, { team_a_id: number | null; team_b_id: number | null }>();
    let rrIdx = 0;
    for (let i = 0; i < targetRows.length && rrIdx < rrRows.length; i++) {
      const tr = targetRows[i];
      if (tr.locked) continue;
      const sr = rrRows[rrIdx++];
      updates.set(tr._localId!, { team_a_id: sr.team_a_id ?? null, team_b_id: sr.team_b_id ?? null });
    }

    const next = withLocalIds
      .map((m) => (updates.has(m._localId!) ? { ...m, ...(updates.get(m._localId!) as any) } : m))
      .map(({ _localId, ...rest }) => rest);

    onChange(next);
  };

  // --------------------------
  // Render
  // --------------------------
  return (
    <section
      className={[
        "rounded-xl border border-cyan-400/20 bg-gradient-to-br from-slate-900/60 to-indigo-950/50",
        compact ? "p-3 space-y-2" : "p-4 space-y-3",
      ].join(" ")}
    >
      <header className={["flex gap-3", compact ? "flex-col" : "flex-col md:flex-row md:items-center md:justify-between"].join(" ")}>
        <div className="flex items-center gap-2">
          {showStagePicker && (
            <select
              value={stageIdx}
              onChange={(e) => {
                setStageIdx(Number(e.target.value));
                setGroupIdx(null);
              }}
              className="bg-slate-950 border border-cyan-400/20 rounded-md px-2 py-1 text-white"
            >
              {payload.stages.map((s: any, i: number) => (
                <option key={i} value={i}>
                  {s.name} ({kindLabel(s.kind)})
                </option>
              ))}
            </select>
          )}

          {isGroups && (
            <select
              value={groupIdx ?? 0}
              onChange={(e) => setGroupIdx(Number(e.target.value))}
              className="bg-slate-950 border border-cyan-400/20 rounded-md px-2 py-1 text-white"
            >
              {groups.map((g: any, i: number) => (
                <option key={g.name + i} value={i}>
                  {g.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className="px-3 py-1.5 rounded-md border border-cyan-400/30 text-cyan-200 hover:bg-cyan-500/10"
            onClick={regenerateHere}
            title="Επαναδημιουργία αυτού του σταδίου (ή ομίλου) κρατώντας τους κλειδωμένους αγώνες"
          >
            Επαναδημιουργία τρέχοντος
          </button>

          {isGroups && (
            <button
              className="px-3 py-1.5 rounded-md border border-emerald-400/30 text-emerald-200 hover:bg-emerald-500/10"
              onClick={autoAssignGroupRR}
              title="Αυτόματη ανάθεση ομάδων στους αγώνες του ομίλου (round-robin)"
            >
              Auto-assign (RR)
            </button>
          )}

          <button
            className="px-3 py-1.5 rounded-md border border-white/15 text-white hover:bg-white/10"
            onClick={addRow}
          >
            + Προσθήκη Αγώνα
          </button>
        </div>
      </header>

      {/* Context line: what we're looking at */}
      <div className="text-xs text-white/70">
        Προβολή: <span className="text-white/90 font-medium">{stage?.name}</span>{" "}
        <span className="text-white/60">({kindLabel(stage?.kind)})</span>
        {isGroups && typeof (groupIdx ?? 0) === "number" ? (
          <span className="ml-2">• Όμιλος: <span className="text-white/90">{groups[groupIdx ?? 0]?.name}</span></span>
        ) : null}
        <span className="ml-2">• Αγώνες: <span className="text-white/90">{rows.length}</span></span>
      </div>

      {rows.length === 0 ? (
        <p className="text-white/70">Δεν υπάρχουν αγώνες σε αυτή την επιλογή.</p>
      ) : (
        <div className="overflow-auto rounded-lg border border-white/10">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-900/70 text-white">
              <tr>
                <th className="px-2 py-1 text-left">Στάδιο / Όμιλος</th>
                {isKO ? (
                  <>
                    <th className="px-2 py-1 text-left">Γύρος</th>
                    <th className="px-2 py-1 text-left">Θέση Δέντρου</th>
                  </>
                ) : (
                  <th className="px-2 py-1 text-left">Αγωνιστική</th>
                )}
                <th className="px-2 py-1 text-left">Ομάδα Α</th>
                <th className="px-2 py-1 text-left">Ομάδα Β</th>
                <th className="px-2 py-1 text-left">Ημ/νία & Ώρα (UTC)</th>
                <th className="px-2 py-1 text-right">Ενέργειες</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr
                  key={`${stageIdx}-${isGroups ? groupIdx ?? 0 : "x"}-${(m as EditableDraftMatch)._localId}`}
                  className="odd:bg-zinc-950/60 even:bg-zinc-900/40"
                >
                  {/* Stage / Group label */}
                  <td className="px-2 py-1">
                    <span className="inline-flex items-center rounded-md bg-white/5 px-2 py-0.5 text-xs text-white/80 ring-1 ring-white/10">
                      {stageBadge(m)}
                    </span>
                  </td>

                  {isKO ? (
                    <>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          className="w-20 bg-slate-950 border border-white/15 rounded px-2 py-1 text-white"
                          value={(m as EditableDraftMatch).round ?? 1}
                          onChange={(e) =>
                            setRow((m as EditableDraftMatch)._localId!, { round: Number(e.target.value) || 1, matchday: null })
                          }
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          className="w-24 bg-slate-950 border border-white/15 rounded px-2 py-1 text-white"
                          value={(m as EditableDraftMatch).bracket_pos ?? 1}
                          onChange={(e) => setRow((m as EditableDraftMatch)._localId!, { bracket_pos: Number(e.target.value) || 1 })}
                        />
                      </td>
                    </>
                  ) : (
                    <td className="px-2 py-1">
                      <input
                        type="number"
                        className="w-16 bg-slate-950 border border-white/15 rounded px-2 py-1 text-white"
                        value={(m as EditableDraftMatch).matchday ?? 1}
                        onChange={(e) => setRow((m as EditableDraftMatch)._localId!, { matchday: Number(e.target.value) || 1 })}
                      />
                    </td>
                  )}

                  {/* Team A select (always enabled) */}
                  <td className="px-2 py-1">
                    <select
                      className="min-w-48 bg-slate-950 border border-white/15 rounded px-2 py-1 text-white"
                      value={m.team_a_id ?? ""}
                      onChange={(e) =>
                        setRow((m as EditableDraftMatch)._localId!, {
                          team_a_id: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                    >
                      <option value="">{teamLabel(null)}</option>
                      {teamOptions.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                      {m.team_a_id && !teamOptions.some((o) => o.id === m.team_a_id) && (
                        <option value={m.team_a_id}>{teamLabel(m.team_a_id)} (εκτός ομίλου)</option>
                      )}
                    </select>
                  </td>

                  {/* Team B select (always enabled) */}
                  <td className="px-2 py-1">
                    <select
                      className="min-w-48 bg-slate-950 border border-white/15 rounded px-2 py-1 text-white"
                      value={m.team_b_id ?? ""}
                      onChange={(e) =>
                        setRow((m as EditableDraftMatch)._localId!, {
                          team_b_id: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                    >
                      <option value="">{teamLabel(null)}</option>
                      {teamOptions.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                      {m.team_b_id && !teamOptions.some((o) => o.id === m.team_b_id) && (
                        <option value={m.team_b_id}>{teamLabel(m.team_b_id)} (εκτός ομίλου)</option>
                      )}
                    </select>
                  </td>

                  <td className="px-2 py-1">
                    <input
                      type="datetime-local"
                      className="bg-slate-950 border border-white/15 rounded px-2 py-1 text-white"
                      value={isoToLocalInput(m.match_date)}
                      onChange={(e) =>
                        setRow((m as EditableDraftMatch)._localId!, {
                          match_date: localInputToISO(e.target.value),
                        })
                      }
                    />
                  </td>

                  <td className="px-2 py-1">
                    <div className="flex items-center justify-end gap-2">
                      <label className="inline-flex items-center gap-1 text-xs text-white/80">
                        <input
                          type="checkbox"
                          checked={!!(m as EditableDraftMatch).locked}
                          onChange={(e) => setRow((m as EditableDraftMatch)._localId!, { locked: e.target.checked })}
                        />
                        Κλείδωμα
                      </label>
                      <button
                        className="px-2 py-1 rounded border border-white/15 hover:bg-white/10 text-xs"
                        onClick={() => swapTeams((m as EditableDraftMatch)._localId!)}
                      >
                        Αντιστροφή
                      </button>
                      <button
                        className="px-2 py-1 rounded border border-rose-400/30 text-rose-200 hover:bg-rose-500/10 text-xs"
                        onClick={() => removeRow((m as EditableDraftMatch)._localId!)}
                      >
                        Διαγραφή
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ---------- Date helpers (UTC-safe: interpret input as UTC, store exact time) ---------- */
function isoToLocalInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso); // ISO assumed UTC
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = d.getUTCFullYear();
  const m = pad(d.getUTCMonth() + 1);
  const day = pad(d.getUTCDate());
  const hh = pad(d.getUTCHours());
  const mm = pad(d.getUTCMinutes());
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

function localInputToISO(localStr?: string) {
  if (!localStr) return null;
  const m = localStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, yStr, moStr, dStr, hhStr, mmStr] = m;
  const y = Number(yStr);
  const mo = Number(moStr);
  const d = Number(dStr);
  const hh = Number(hhStr);
  const mm = Number(mmStr);
  // Build a UTC date so there is no timezone shift when calling toISOString()
  const utc = new Date(Date.UTC(y, mo - 1, d, hh, mm, 0, 0));
  return utc.toISOString();
}
