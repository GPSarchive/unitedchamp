"use client";

import { useEffect, useMemo, useState } from "react";
import type { DraftMatch, TeamDraft } from "../TournamentWizard";
import type { NewTournamentPayload } from "@/app/lib/types";
import { generateDraftMatches } from "../util/Generators";
import { genRoundRobin } from "../util/functions/roundRobin";

// ✅ store
import { useTournamentStore } from "@/app/dashboard/tournaments/TournamentCURD/submit/tournamentStore";

/* ----------------------------- Types & helpers ----------------------------- */

// Keep DraftMatch as the single source of truth for match fields
type EditableDraftMatch = DraftMatch & {
  locked?: boolean;
  _localId?: number;
  db_id?: number | null; // rendered via overlay merge
};

type DbOverlay = Pick<
  DraftMatch,
  | "status"
  | "team_a_score"
  | "team_b_score"
  | "winner_team_id"
  | "home_source_round"
  | "home_source_bracket_pos"
  | "away_source_round"
  | "away_source_bracket_pos"
> & {
  db_id?: number | null; // stored in overlay
};

type StageOption = { i: number; name: string; kind: "league" | "groups" | "knockout" | "mixed" | string };

/** Build a stable signature for a match row (MUST match the store’s) */
function rowSignature(m: DraftMatch) {
  const parts = [
    m.stageIdx ?? "",
    m.groupIdx ?? "",
    m.matchday ?? "",
    m.round ?? "",
    m.bracket_pos ?? "",
    m.team_a_id ?? "",
    m.team_b_id ?? "",
    m.match_date ?? "",
  ];
  return parts.join("|");
}

/** Strip UI-only fields (when we need DraftMatch purity) */
function toDraft(m: EditableDraftMatch): DraftMatch {
  const { _localId, locked, db_id, ...rest } = m;
  return rest as DraftMatch;
}

// Helper: tries to read a name from TeamDraft if present (some projects add it)
function pickLocalName(t: TeamDraft): string | null {
  return (t as any)?.name ? String((t as any).name) : null;
}

// Greek labels for stage kinds
function kindLabel(k?: string) {
  if (k === "groups") return "όμιλοι";
  if (k === "knockout") return "νοκ-άουτ";
  if (k === "league") return "πρωτάθλημα";
  return k ?? "?";
}

// Choose initial stage
function initialStageIndex(payload: NewTournamentPayload, forced?: number | null) {
  if (typeof forced === "number") return forced;
  const nonKO = (payload.stages as any).findIndex((s: any) => s.kind !== "knockout");
  if (nonKO >= 0) return nonKO;
  return (payload.stages as any)[0] ? 0 : -1;
}

/** Infer status from available fields when status is missing */
function inferStatus(row: {
  status?: "scheduled" | "finished" | null;
  team_a_score?: number | null;
  team_b_score?: number | null;
  winner_team_id?: number | null;
}): "scheduled" | "finished" {
  if (row?.status === "finished") return "finished";
  const scored =
    (typeof row.team_a_score === "number" && row.team_a_score >= 0) ||
    (typeof row.team_b_score === "number" && row.team_b_score >= 0);
  if (scored || row?.winner_team_id != null) return "finished";
  return "scheduled";
}

export default function MatchPlanner({
  payload,
  teams,
  // no draftMatches/onChange — we use the store
  forceStageIdx,
  compact,
  onAutoAssignTeamSeeds,
}: {
  payload: NewTournamentPayload;
  teams: TeamDraft[];
  forceStageIdx?: number;
  compact?: boolean;
  onAutoAssignTeamSeeds?: () => Promise<number[]> | number[];
}) {
  const [stageIdx, setStageIdx] = useState<number>(() => initialStageIndex(payload, forceStageIdx));
  const [groupIdx, setGroupIdx] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  // 🔗 store (all selectors are stable — no per-render function creation)
  const draftMatches = useTournamentStore((s) => s.draftMatches);
  const overlay = useTournamentStore((s) => s.dbOverlayBySig);
  const updateMatches = useTournamentStore((s) => s.updateMatches);

  // Keep stageIdx synced with forced value
  useEffect(() => {
    if (typeof forceStageIdx === "number") {
      setStageIdx(forceStageIdx);
      setGroupIdx(null);
    }
  }, [forceStageIdx]);

  // --------------------------
  // Team names lookup (local + auto-hydration)
  // --------------------------
  const [teamMeta, setTeamMeta] = useState<Record<number, { name: string }>>(() => {
    const init: Record<number, { name: string }> = {};
    teams.forEach((t) => {
      const nm = pickLocalName(t);
      if (nm) init[t.id] = { name: nm };
    });
    return init;
  });

  // (1) Merge in any names that arrive/change via props (e.g., TeamPicker or server-hydrated lists)
  useEffect(() => {
    const add: Record<number, { name: string }> = {};
    teams.forEach((t) => {
      const nm = pickLocalName(t);
      if (nm && !teamMeta[t.id]) add[t.id] = { name: nm };
    });
    if (Object.keys(add).length) setTeamMeta((p) => ({ ...p, ...add }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams]);

  // Build simple labels with seeds (if provided in TeamDraft)
  const teamLabel = (id?: number | null) => {
    if (!id) return "— Ομάδα —";
    const nm = teamMeta[id]?.name;
    const seed = teams.find((t) => t.id === id)?.seed;
    const base = nm ?? `Ομάδα #${id}`;
    return seed != null ? `${base} (S${seed})` : base;
  };

  // Stage meta from payload (we’re not deriving from store here to keep things stable)
  const stage = (payload.stages as any)[stageIdx];
  const isGroups = stage?.kind === "groups";
  const isLeague = stage?.kind === "league";
  const isKO = stage?.kind === "knockout";
  const groups = isGroups ? stage?.groups ?? [] : [];
  const showStagePicker = typeof forceStageIdx !== "number";

  // ✅ per-row lock state (unique per structural key or db_id)
  const [locksByPos, setLocksByPos] = useState<Record<string, boolean>>({});

  // Which team IDs belong to the currently selected group?
  const groupTeamIds = useMemo<number[]>(() => {
    if (!isGroups) return teams.map((t) => t.id);
    const gIdx = groupIdx ?? 0;
    return teams
      .filter((t) => (t as any).groupsByStage?.[stageIdx] === gIdx)
      .map((t) => t.id);
  }, [teams, stageIdx, groupIdx, isGroups]);

  // Options shown in selects:
  //  - groups: ONLY this group's teams
  //  - league/KO: all tournament teams
  const teamOptions = useMemo(() => {
    const ids = isGroups ? groupTeamIds : teams.map((t) => t.id);
    const byName = (id: number) => teamMeta[id]?.name || "";
    return ids
      .slice()
      .sort((a, b) => byName(a).localeCompare(byName(b)))
      .map((id) => ({ id, label: teamLabel(id) }));
  }, [teams, teamMeta, isGroups, groupTeamIds]);

  // --------------------------
  // Merge overlay for rendering and assign local ids
  // --------------------------
  const withLocalIds: EditableDraftMatch[] = useMemo(
    () =>
      draftMatches.map((m, i) => {
        const base: EditableDraftMatch = { ...m, _localId: i, locked: false };
        const sig = rowSignature(base);
        const ov = overlay[sig] as DbOverlay | undefined;
        return ov ? ({ ...base, ...ov } as EditableDraftMatch) : base;
      }),
    [draftMatches, overlay]
  );

  const rows = useMemo(() => {
    return withLocalIds
      .filter((m) => {
        if (isGroups) return m.stageIdx === stageIdx && m.groupIdx === (groupIdx ?? 0);
        if (isKO) return m.stageIdx === stageIdx; // KO has no groupIdx
        // league
        return m.stageIdx === stageIdx && (m.groupIdx == null || m.groupIdx === null);
      })
      .sort((a, b) => {
        if (isKO) {
          return (a.round ?? 0) - (b.round ?? 0) || (a.bracket_pos ?? 0) - (b.bracket_pos ?? 0);
        }
        return (a.matchday ?? 0) - (b.matchday ?? 0) || (a.bracket_pos ?? 0) - (b.bracket_pos ?? 0);
      });
  }, [withLocalIds, stageIdx, isGroups, isLeague, isKO, groupIdx]);

  // (2) Auto-hydrate ANY missing names for ids visible now (rows + selectable options)
  useEffect(() => {
    const need = new Set<number>();

    // From current rows
    rows.forEach((r) => {
      const a = (r as EditableDraftMatch).team_a_id ?? null;
      const b = (r as EditableDraftMatch).team_b_id ?? null;
      if (a && !teamMeta[a]) need.add(a);
      if (b && !teamMeta[b]) need.add(b);
    });

    // From selectable ids in current view
    const selectableIds = isGroups ? groupTeamIds : teams.map((t) => t.id);
    selectableIds.forEach((id) => {
      if (id && !teamMeta[id]) need.add(id);
    });

    const ids = Array.from(need);
    if (ids.length === 0) return;

    let aborted = false;
    (async () => {
      try {
        const params = new URLSearchParams({ ids: ids.join(",") });
        const res = await fetch(`/api/teams?${params.toString()}`, { credentials: "include" });
        const body = await res.json().catch(() => null);
        if (!res.ok || !body) return;

        // Accept several common shapes: {teams:[...]}, {data:[...]}, or a raw array
        const list: any[] = body?.teams ?? body?.data ?? body ?? [];
        const map: Record<number, { name: string }> = {};
        list.forEach((t: any) => {
          const id = Number(t?.id);
          if (!Number.isFinite(id)) return;
          const name = String(t?.name ?? t?.team_name ?? t?.title ?? `Ομάδα #${id}`);
          map[id] = { name };
        });

        if (!aborted && Object.keys(map).length) {
          setTeamMeta((prev) => ({ ...prev, ...map }));
        }
      } catch {
        // silent fail; labels will fallback to Ομάδα #ID
      }
    })();

    return () => {
      aborted = true;
    };
  }, [rows, isGroups, groupTeamIds, teams, teamMeta]);

  // Helpful labels for stage / group (shown per-row)
  const stageName = (idx: number | undefined) =>
    (payload.stages as any)[idx ?? -1]?.name ?? `Στάδιο #${(idx ?? 0) + 1}`;
  const stageKind = (idx: number | undefined) => kindLabel((payload.stages as any)[idx ?? -1]?.kind);
  const groupName = (sIdx: number | undefined, gIdx: number | null | undefined) => {
    if (gIdx == null || gIdx < 0) return null;
    const g = (payload.stages as any)[sIdx ?? -1]?.groups?.[gIdx];
    return g?.name ?? `Όμιλος ${typeof gIdx === "number" ? gIdx + 1 : ""}`;
  };
  const stageBadge = (m: DraftMatch) => {
    const sLabel = stageName(m.stageIdx);
    const kLabel = stageKind(m.stageIdx);
    const gLabel =
      (payload.stages as any)[m.stageIdx ?? -1]?.kind === "groups"
        ? groupName(m.stageIdx, m.groupIdx ?? null)
        : null;
    return gLabel ? `${sLabel} (${kLabel}) • ${gLabel}` : `${sLabel} (${kLabel})`;
  };

  // --- per-row pending edits (dirty buffer) ---
  const [pending, setPending] = useState<Record<number, Partial<EditableDraftMatch>>>({});

  const setPendingFor = (localId: number, patch: Partial<EditableDraftMatch>) =>
    setPending((p) => ({ ...p, [localId]: { ...(p[localId] ?? {}), ...patch } }));

  const clearPendingFor = (localId: number) =>
    setPending((p) => {
      const n = { ...p };
      delete n[localId];
      return n;
    });

  const getEff = <K extends keyof EditableDraftMatch>(
    row: EditableDraftMatch,
    key: K
  ): EditableDraftMatch[K] => {
    const pid = row._localId!;
    return (pending[pid]?.[key] as any) ?? (row[key] as any);
  };

  const hasPending = (localId: number) => !!pending[localId];

  const pendingIdsInView = useMemo(
    () => rows.map((r) => (r as EditableDraftMatch)._localId!).filter((id) => !!pending[id]),
    [rows, pending]
  );
  const pendingCount = pendingIdsInView.length;

  // --------------------------
  // Mutators (store-only)
  // --------------------------
  function isKOStage() {
    const s = (payload.stages as any)[stageIdx];
    return s?.kind === "knockout";
  }

  /** Apply a change to a single row into the store (no network) */
  const setRow = (localId: number, patch: Partial<EditableDraftMatch>) => {
    const target = withLocalIds.find((m) => m._localId === localId);
    if (!target) return;

    updateMatches(stageIdx, (rows) => {
      const next = rows.slice();
      const beforeSig = rowSignature(target);
      const idx = next.findIndex((r) => rowSignature(r) === beforeSig);

      const merged: DraftMatch = {
        ...(idx >= 0 ? next[idx] : {}),
        ...toDraft({ ...(target as any), ...patch }),
      } as DraftMatch;

      if (idx >= 0) next[idx] = merged;
      else next.push(merged);

      return next; // KO pointers are reindexed inside the store's update helper
    });

    clearPendingFor(localId);
  };

  const saveAllPendingInView = () => {
    if (pendingCount === 0) return;

    updateMatches(stageIdx, (rows) => {
      const next = rows.slice();

      for (const m of withLocalIds) {
        const pid = m._localId!;
        const patch = pending[pid];
        if (!patch) continue;

        const beforeSig = rowSignature(m);
        const idx = next.findIndex((r) => rowSignature(r) === beforeSig);
        const merged = toDraft({ ...(m as any), ...patch });

        if (idx >= 0) next[idx] = merged;
        else next.push(merged);
      }

      return next;
    });

    // clear only the ones in view
    setPending((prev) => {
      const n = { ...prev };
      pendingIdsInView.forEach((id) => delete n[id]);
      return n;
    });
  };

  const removeRow = (localId: number) => {
    const target = withLocalIds.find((m) => m._localId === localId);
    if (!target) return;

    updateMatches(stageIdx, (rows) => {
      const next = rows.filter((r) => rowSignature(r) !== rowSignature(target));
      return next;
    });

    clearPendingFor(localId);
  };

  const addRow = () => {
    if (isKOStage()) {
      const last = rows[rows.length - 1];
      const newRound = (last?.round ?? 0) || 1;
      const newBracket = (last?.bracket_pos ?? 0) + 1 || 1;
      const newRow: DraftMatch = {
        stageIdx,
        groupIdx: null,
        matchday: null,
        round: newRound,
        bracket_pos: newBracket,
        team_a_id: null,
        team_b_id: null,
        match_date: null,
      };
      updateMatches(stageIdx, (rows) => [...rows, newRow]);
    } else {
      const md = (rows[rows.length - 1]?.matchday ?? 0) + 1;
      const newRow: DraftMatch = {
        stageIdx,
        groupIdx: isGroups ? (groupIdx ?? 0) : null,
        matchday: md,
        team_a_id: null,
        team_b_id: null,
        round: null,
        bracket_pos: null,
        match_date: null,
      };
      updateMatches(stageIdx, (rows) => [...rows, newRow]);
    }
  };

  const swapTeams = (localId: number) => {
    const row = withLocalIds.find((m) => m._localId === localId);
    if (!row) return;
    const a = getEff(row, "team_a_id");
    const b = getEff(row, "team_b_id");
    setPendingFor(localId, { team_a_id: (b as number | null) ?? null, team_b_id: (a as number | null) ?? null });
  };

  // Per-row save now only applies pending → store
  const saveRow = async (localId: number) => {
    const patch = pending[localId];
    if (!patch) return;
    setRow(localId, patch);
  };

  // ---- KO/League builders (local-only helpers, no network) ----
  const pairKey = (a?: number | null, b?: number | null) => {
    const x = a ?? 0,
      y = b ?? 0;
    return x < y ? `${x}-${y}` : `${y}-${x}`;
  };

  function makeKoKey(m: DraftMatch) {
    return `KO|${m.round ?? 0}|${m.bracket_pos ?? 0}`;
  }

  /** Deterministic key for RR (groups/league): groupIdx + matchday + ordinal */
  function makeRrKey(m: DraftMatch, ordinal: number) {
    const g = m.groupIdx ?? -1;
    const md = m.matchday ?? 0;
    return `RR|${g}|${md}|${ordinal}`;
  }

  /** Build stable RR ordinals (per groupIdx,matchday) so old/new align */
  function indexRrOrdinals(rows: DraftMatch[]): Map<DraftMatch, number> {
    const map = new Map<DraftMatch, number>();
    const buckets = new Map<string, DraftMatch[]>();
    for (const r of rows) {
      const g = r.groupIdx ?? -1;
      const md = r.matchday ?? 0;
      const key = `${g}|${md}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(r);
    }
    for (const [, arr] of buckets) {
      arr.sort(
        (a, b) =>
          pairKey(a.team_a_id, a.team_b_id).localeCompare(pairKey(b.team_a_id, b.team_b_id)) ||
          (a.bracket_pos ?? 0) - (b.bracket_pos ?? 0)
      );
      arr.forEach((r, i) => map.set(r, i));
    }
    return map;
  }

  function sameTeams(oldM: DraftMatch, newM: DraftMatch) {
    const po = pairKey(oldM.team_a_id, oldM.team_b_id);
    const pn = pairKey(newM.team_a_id, newM.team_b_id);
    return po === pn && po !== "0-0";
  }

  // -------------------------------------------------------
  // Re-generate ONLY the current stage (or group) via diff/merge — store-only
  // -------------------------------------------------------
  const regenerateHere = async () => {
    const isTarget = (m: DraftMatch) => {
      if (isGroups) return m.stageIdx === stageIdx && m.groupIdx === (groupIdx ?? 0);
      if (isKO) return m.stageIdx === stageIdx;
      return m.stageIdx === stageIdx && (m.groupIdx == null || m.groupIdx === null);
    };

    // Generate fresh subset locally (no server calls)
    if (isKO && onAutoAssignTeamSeeds) {
      try {
        await Promise.resolve(onAutoAssignTeamSeeds());
      } catch {}
    }
    const freshAll = generateDraftMatches({ payload, teams });
    const freshSubset = freshAll.filter(isTarget);

    // Old/current target
    const oldTarget = withLocalIds.filter(isTarget).map(toDraft);
    const locked = withLocalIds.filter((m) => isTarget(m) && (m as EditableDraftMatch).locked);

    // Map by structural key
    const oldMap = new Map<string, DraftMatch>();
    const newMap = new Map<string, DraftMatch>();

    if (isKO) {
      oldTarget.forEach((m) => oldMap.set(makeKoKey(m), m));
      freshSubset.forEach((m) => newMap.set(makeKoKey(m), m));
    } else {
      const oldOrd = indexRrOrdinals(oldTarget);
      const newOrd = indexRrOrdinals(freshSubset);
      oldTarget.forEach((m) => oldMap.set(makeRrKey(m, oldOrd.get(m) ?? 0), m));
      freshSubset.forEach((m) => newMap.set(makeRrKey(m, newOrd.get(m) ?? 0), m));
    }

    // Locked keys that must be preserved
    const lockedKeys = new Set<string>();
    if (isKO) {
      locked.map(toDraft).forEach((l) => lockedKeys.add(makeKoKey(l)));
    } else {
      const ord = indexRrOrdinals(locked.map(toDraft));
      locked.map(toDraft).forEach((l) => lockedKeys.add(makeRrKey(l, ord.get(l) ?? 0)));
    }

    const keepAndUpdate: DraftMatch[] = [];
    const toInsert: DraftMatch[] = [];

    // Inserts + updates
    for (const [k, newM] of newMap.entries()) {
      if (lockedKeys.has(k)) continue; // locked wins
      const oldM = oldMap.get(k);
      if (!oldM) {
        toInsert.push(newM);
        continue;
      }
      const merged: DraftMatch = {
        ...newM,
        // carry user-edited fields when still sensible
        match_date: oldM.match_date ?? newM.match_date ?? null,
        team_a_id: oldM.team_a_id ?? newM.team_a_id ?? null,
        team_b_id: oldM.team_b_id ?? newM.team_b_id ?? null,
        status: (oldM.status as any) ?? (newM.status as any),
        team_a_score: sameTeams(oldM, newM) ? (oldM.team_a_score ?? null) : null,
        team_b_score: sameTeams(oldM, newM) ? (oldM.team_b_score ?? null) : null,
        winner_team_id: sameTeams(oldM, newM) ? (oldM.winner_team_id ?? null) : null,
        home_source_round: newM.home_source_round ?? oldM.home_source_round ?? null,
        home_source_bracket_pos: newM.home_source_bracket_pos ?? oldM.home_source_bracket_pos ?? null,
        away_source_round: newM.away_source_round ?? oldM.away_source_round ?? null,
        away_source_bracket_pos: newM.away_source_bracket_pos ?? oldM.away_source_bracket_pos ?? null,
      };
      keepAndUpdate.push(merged);
      oldMap.delete(k);
    }

    // Build next list:
    // - everything not in target scope stays as-is
    // - locked rows kept verbatim
    // - keep/update rows merged
    // - new rows inserted
    const others = withLocalIds.filter((m) => !isTarget(m)).map(toDraft);
    const lockedKept = locked.map(toDraft);

    updateMatches(stageIdx, (_rows) => {
      const next = [...others, ...lockedKept, ...keepAndUpdate, ...toInsert];
      return next;
    });

    setPending({});
  };

  // =========================
  // Auto-assign (Round Robin) — Groups & League (store-only)
  // =========================
  const autoAssignRR = () => {
    if (!(isGroups || isLeague)) return;

    const hasLocked = rows.some((r) => (r as EditableDraftMatch).locked);
    if (hasLocked) {
      const msg = isGroups
        ? "Υπάρχουν κλειδωμένοι αγώνες σε αυτόν τον όμιλο. Θέλετε να συνεχίσετε;"
        : "Υπάρχουν κλειδωμένοι αγώνες σε αυτό το πρωτάθλημα. Θέλετε να συνεχίσετε;";
      if (!confirm(msg)) return;
    }

    const teamPool = isGroups ? groupTeamIds : teams.map((t) => t.id);
    if (teamPool.length < 2) {
      alert(
        isGroups ? "Απαιτούνται τουλάχιστον 2 ομάδες στον όμιλο." : "Απαιτούνται τουλάχιστον 2 ομάδες στο πρωτάθλημα."
      );
      return;
    }

    const cfg: any = (((payload.stages as any)[stageIdx] as any)?.config ?? {});
    const doubleRound: boolean = !!(cfg.double_round ?? cfg["διπλός_γύρος"]);
    const repeatsRaw = cfg.rounds_per_opponent ?? cfg["αγώνες_ανά_αντίπαλο"];
    const repeats: number = Number.isFinite(repeatsRaw)
      ? Math.max(1, Number(repeatsRaw))
      : doubleRound
      ? 2
      : 1;

    const rr = genRoundRobin({
      stageIdx,
      groupIdx: isGroups ? (groupIdx ?? 0) : null,
      teamIds: teamPool.slice(),
      repeats,
      startDate: null,
      intervalDays: 0,
    });

    const targetRows = rows
      .slice()
      .sort((a, b) => (a.matchday ?? 0) - (b.matchday ?? 0)) as EditableDraftMatch[];
    const rrRows = rr.slice().sort((a, b) => (a.matchday ?? 0) - (b.matchday ?? 0));

    const updates = new Map<number, { team_a_id: number | null; team_b_id: number | null }>();
    let rrIdx = 0;
    for (let i = 0; i < targetRows.length && rrIdx < rrRows.length; i++) {
      const tr = targetRows[i];
      if (tr.locked) continue;
      const sr = rrRows[rrIdx++];
      updates.set(tr._localId!, { team_a_id: sr.team_a_id ?? null, team_b_id: sr.team_b_id ?? null });
    }

    const nextPending: Record<number, Partial<EditableDraftMatch>> = { ...pending };
    updates.forEach((patch, id) => {
      nextPending[id] = { ...(nextPending[id] ?? {}), ...patch };
    });
    setPending(nextPending);
  };

  // --------------------------
  // Lock key helper
  // --------------------------
  function lockKeyStable(m: EditableDraftMatch) {
    // If persisted already, prefer DB id (from overlay merge)
    if (m.db_id) return `DB:${m.db_id}`;

    // KO rows have a stable, structural identity: round + bracket_pos.
    if (m.round != null && m.bracket_pos != null) {
      return `KO:S${m.stageIdx}:R${m.round}:B${m.bracket_pos}`;
    }

    // League/Groups rows: lock by (stage, group, matchday, team A, team B) when both teams are picked.
    const g = m.groupIdx ?? -1;
    const md = m.matchday ?? -1;
    const a = m.team_a_id ?? 0;
    const b = m.team_b_id ?? 0;
    if (a && b && md > 0) return `LG:S${m.stageIdx}:G${g}:MD${md}:A${a}:B${b}`;

    // Not stable yet → do not allow locking.
    return null;
  }

  // Stage select options (typed) — avoids implicit any
  const stageOptions: StageOption[] = useMemo(() => {
    // Prefer store order if available
    const st = useTournamentStore.getState();
    const idxToId = st.ids.stageIdByIndex;
    const idxs = Object.keys(idxToId).map(Number).sort((a, b) => a - b);
    if (idxs.length > 0) {
      return idxs.map((i) => {
        const sid = idxToId[i]!;
        const sObj = st.entities.stagesById[sid];
        return { i, name: sObj?.name ?? `Στάδιο #${i + 1}`, kind: (sObj?.kind as any) ?? "league" };
      });
    }
    // Fallback to payload
    return (payload.stages as any).map((s: any, i: number) => ({
      i,
      name: s?.name ?? `Στάδιο #${i + 1}`,
      kind: (s?.kind as any) ?? "league",
    }));
  }, [payload.stages]);

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
      {/* Sticky note about pending edits in this view */}
      {pendingCount > 0 && (
        <div className="rounded-md border border-amber-400/30 bg-amber-500/10 p-2 text-amber-200 text-xs flex items-center justify-between">
          <span>
            Υπάρχουν {pendingCount} εκκρεμείς αλλαγές σε εμφανιζόμενους αγώνες.
            Οι εκκρεμείς αλλαγές ΔΕΝ αποθηκεύονται αν πατήσετε «Save changes» στο τέλος.
          </span>
          <div className="flex items-center gap-2">
            <button
              className="px-2 py-1 rounded border border-amber-400/50 hover:bg-amber-500/10"
              onClick={saveAllPendingInView}
            >
              Αποθήκευση όλων
            </button>
          </div>
        </div>
      )}

      <header
        className={[
          "flex gap-3",
          compact ? "flex-col" : "flex-col md:flex-row md:items-center md:justify-between",
        ].join(" ")}
      >
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
              {stageOptions.map((s: StageOption) => (
                <option key={s.i} value={s.i}>
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
                <option key={g?.id ?? i} value={i}>
                  {g?.name ?? `Όμιλος ${i + 1}`}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className="px-3 py-1.5 rounded-md border border-cyan-400/30 text-cyan-200 hover:bg-cyan-500/10 disabled:opacity-50"
            onClick={() => void regenerateHere()}
            disabled={busy}
            title="Επαναδημιουργία αυτού του σταδίου (ή ομίλου) κρατώντας τους κλειδωμένους αγώνες"
          >
            Επαναδημιουργία τρέχοντος
          </button>

          {(isGroups || isLeague) && (
            <button
              className="px-3 py-1.5 rounded-md border border-emerald-400/30 text-emerald-200 hover:bg-emerald-500/10"
              onClick={autoAssignRR}
              title="Αυτόματη ανάθεση ομάδων (round-robin) – τοποθετεί αλλαγές ως εκκρεμείς"
            >
              Auto-assign (RR)
            </button>
          )}

          <button
            className="px-3 py-1.5 rounded-md border border-white/15 text-white hover:bg-white/10"
            onClick={addRow}
            disabled={busy}
          >
            + Προσθήκη Αγώνα
          </button>
        </div>
      </header>

      {/* Context line */}
      <div className="text-xs text-white/70">
        Προβολή: <span className="text-white/90 font-medium">{stage?.name ?? `Στάδιο #${stageIdx + 1}`}</span>{" "}
        <span className="text-white/60">({kindLabel(stage?.kind)})</span>
        {isGroups && typeof (groupIdx ?? 0) === "number" ? (
          <span className="ml-2">
            • Όμιλος: <span className="text-white/90">{groups[groupIdx ?? 0]?.name}</span>
          </span>
        ) : null}
        <span className="ml-2">
          • Αγώνες: <span className="text-white/90">{rows.length}</span>
        </span>
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
                {/* Score + Status */}
                <th className="px-2 py-1 text-left">Σκορ</th>
                <th className="px-2 py-1 text-left">Κατάσταση</th>
                <th className="px-2 py-1 text-left">Ημ/νία & Ώρα (UTC)</th>
                <th className="px-2 py-1 text-right">Ενέργειες</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => {
                const lid = (m as EditableDraftMatch)._localId!;
                const isDirty = hasPending(lid);

                // Selected team ids (respect pending)
                const selA = getEff(m as EditableDraftMatch, "team_a_id") as number | null;
                const selB = getEff(m as EditableDraftMatch, "team_b_id") as number | null;

                const hsr = getEff(m as EditableDraftMatch, "home_source_round") as number | null;
                const hsb = getEff(m as EditableDraftMatch, "home_source_bracket_pos") as number | null;
                const asr = getEff(m as EditableDraftMatch, "away_source_round") as number | null;
                const asb = getEff(m as EditableDraftMatch, "away_source_bracket_pos") as number | null;

                return (
                  <tr
                    key={`${stageIdx}-${isGroups ? groupIdx ?? 0 : "x"}-${lid}`}
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
                        <td className="px-2 py-1 align-top">
                          <input
                            type="number"
                            className="w-20 bg-slate-950 border border-white/15 rounded px-2 py-1 text-white"
                            value={(getEff(m as EditableDraftMatch, "round") as number | null) ?? 1}
                            onChange={(e) =>
                              setPendingFor(lid, {
                                round: Number(e.target.value) || 1,
                                matchday: null,
                              })
                            }
                          />
                        </td>
                        <td className="px-2 py-1">
                          <div className="flex flex-col gap-1">
                            <input
                              type="number"
                              className="w-24 bg-slate-950 border border-white/15 rounded px-2 py-1 text-white"
                              value={(getEff(m as EditableDraftMatch, "bracket_pos") as number | null) ?? 1}
                              onChange={(e) =>
                                setPendingFor(lid, { bracket_pos: Number(e.target.value) || 1 })
                              }
                            />
                            {/* Inline KO pointer badges (read-only, reflect pending) */}
                            <div className="text-[10px] text-white/70 space-x-1">
                              {hsr ? (
                                <span className="inline-flex items-center rounded bg-white/5 px-1.5 py-0.5 ring-1 ring-white/10">
                                  A: R{hsr}-B{hsb ?? "?"}
                                </span>
                              ) : (
                                <span className="text-white/30">A: —</span>
                              )}
                              {asr ? (
                                <span className="inline-flex items-center rounded bg-white/5 px-1.5 py-0.5 ring-1 ring-white/10">
                                  B: R{asr}-B{asb ?? "?"}
                                </span>
                              ) : (
                                <span className="text-white/30">B: —</span>
                              )}
                            </div>
                          </div>
                        </td>
                      </>
                    ) : (
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          className="w-16 bg-slate-950 border border-white/15 rounded px-2 py-1 text-white"
                          value={(getEff(m as EditableDraftMatch, "matchday") as number | null) ?? 1}
                          onChange={(e) =>
                            setPendingFor(lid, { matchday: Number(e.target.value) || 1 })
                          }
                        />
                      </td>
                    )}

                    {/* Team A select */}
                    <td className="px-2 py-1">
                      <select
                        className="min-w-48 bg-slate-950 border border-white/15 rounded px-2 py-1 text-white"
                        value={selA ?? ""}
                        onChange={(e) =>
                          setPendingFor(lid, {
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
                        {selA && !teamOptions.some((o) => o.id === selA) && (
                          <option value={selA}>{teamLabel(selA)} (εκτός ομίλου)</option>
                        )}
                      </select>
                    </td>

                    {/* Team B select */}
                    <td className="px-2 py-1">
                      <select
                        className="min-w-48 bg-slate-950 border border-white/15 rounded px-2 py-1 text-white"
                        value={selB ?? ""}
                        onChange={(e) =>
                          setPendingFor(lid, {
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
                        {selB && !teamOptions.some((o) => o.id === selB) && (
                          <option value={selB}>{teamLabel(selB)} (εκτός ομίλου)</option>
                        )}
                      </select>
                    </td>

                    {/* Score cell */}
                    <td className="px-2 py-1">
                      {(() => {
                        const a = (getEff(m as EditableDraftMatch, "team_a_score") as number | null) ?? null;
                        const b = (getEff(m as EditableDraftMatch, "team_b_score") as number | null) ?? null;
                        const has = a != null || b != null;
                        return has ? `${a ?? 0} – ${b ?? 0}` : <span className="text-white/50">—</span>;
                      })()}
                    </td>

                    {/* Status cell */}
                    <td className="px-2 py-1">
                      {(() => {
                        const st =
                          (getEff(m as EditableDraftMatch, "status") as "scheduled" | "finished" | null | undefined) ??
                          inferStatus({
                            status: getEff(m as EditableDraftMatch, "status") as any,
                            team_a_score: getEff(m as EditableDraftMatch, "team_a_score") as any,
                            team_b_score: getEff(m as EditableDraftMatch, "team_b_score") as any,
                            winner_team_id: getEff(m as EditableDraftMatch, "winner_team_id") as any,
                          });
                        return (
                          <span
                            className={[
                              "inline-flex items-center rounded px-2 py-0.5 text-xs",
                              st === "finished"
                                ? "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/30"
                                : "bg-zinc-500/10 text-zinc-300 ring-1 ring-white/10",
                            ].join(" ")}
                          >
                            {st}
                          </span>
                        );
                      })()}
                    </td>

                    {/* Date */}
                    <td className="px-2 py-1">
                      <input
                        type="datetime-local"
                        className="bg-slate-950 border border-white/15 rounded px-2 py-1 text-white"
                        value={isoToLocalInput(getEff(m as EditableDraftMatch, "match_date") as string | null)}
                        onChange={(e) =>
                          setPendingFor(lid, {
                            match_date: localInputToISO(e.target.value),
                          })
                        }
                      />
                    </td>

                    {/* Actions */}
                    <td className="px-2 py-1">
                      <div className="flex items-center justify-end gap-2">
                        <label className="inline-flex items-center gap-1 text-xs text-white/80">
                          {(() => {
                            const k = lockKeyStable(m as EditableDraftMatch);
                            return (
                              <input
                                type="checkbox"
                                disabled={!k}
                                checked={!!(m as EditableDraftMatch).locked}
                                onChange={(e) => {
                                  if (!k) return;
                                  setLocksByPos((prev) => ({ ...prev, [k]: e.target.checked }));
                                }}
                              />
                            );
                          })()}
                          Κλείδωμα
                        </label>

                        <button
                          className={`px-2 py-1 rounded border text-xs ${
                            isDirty
                              ? "border-emerald-400/40 text-emerald-200 hover:bg-emerald-500/10"
                              : "border-white/10 text-white/60 cursor-not-allowed"
                          }`}
                          disabled={!isDirty || busy}
                          onClick={() => void saveRow(lid)}
                          title={isDirty ? "Αποθήκευση αλλαγών για αυτόν τον αγώνα" : "Καμία αλλαγή"}
                        >
                          Αποθήκευση
                        </button>

                        <button
                          className="px-2 py-1 rounded border border-white/15 hover:bg-white/10 text-xs disabled:opacity-50"
                          onClick={() => swapTeams(lid)}
                          disabled={busy}
                          title="Αντιστροφή ομάδων (σε εκκρεμότητα αν υπάρχουν αλλαγές)"
                        >
                          Αντιστροφή
                        </button>

                        <AdvancedRowMenu
                          row={m as EditableDraftMatch}
                          getEff={getEff}
                          setPendingFor={setPendingFor}
                          teamOptions={teamOptions}
                        />

                        <button
                          className="px-2 py-1 rounded border border-rose-400/30 text-rose-200 hover:bg-rose-500/10 text-xs disabled:opacity-50"
                          onClick={() => removeRow(lid)}
                          disabled={busy}
                        >
                          Διαγραφή
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ---------- Advanced per-row editor (dropdown) ---------- */
function AdvancedRowMenu({
  row,
  getEff,
  setPendingFor,
  teamOptions,
}: {
  row: EditableDraftMatch;
  getEff: <K extends keyof EditableDraftMatch>(r: EditableDraftMatch, k: K) => EditableDraftMatch[K];
  setPendingFor: (id: number, patch: Partial<EditableDraftMatch>) => void;
  teamOptions: Array<{ id: number; label: string }>;
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
                setPendingFor(lid, {
                  team_a_score: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />

            <label className="text-xs text-white/70">Σκορ B</label>
            <input
              type="number"
              min={0}
              className="bg-slate-950 border border-white/15 rounded px-2 py-1 text-white"
              value={(getEff(row, "team_b_score") as number | null) ?? ""}
              onChange={(e) =>
                setPendingFor(lid, {
                  team_b_score: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />

            <label className="text-xs text-white/70">Νικητής</label>
            <select
              className="bg-slate-950 border border-white/15 rounded px-2 py-1 text-white"
              value={(getEff(row, "winner_team_id") as number | null) ?? ""}
              onChange={(e) =>
                setPendingFor(lid, {
                  winner_team_id: e.target.value ? Number(e.target.value) : null,
                })
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
  const utc = new Date(Date.UTC(y, mo - 1, d, hh, mm, 0, 0));
  return utc.toISOString();
}
