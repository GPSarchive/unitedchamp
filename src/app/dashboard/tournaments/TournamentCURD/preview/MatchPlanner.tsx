// app/dashboard/tournaments/TournamentCURD/preview/MatchPlanner.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { DraftMatch, TeamDraft } from "../TournamentWizard";
import type { NewTournamentPayload } from "@/app/lib/types";
import { generateDraftMatches } from "../util/Generators";
import { genRoundRobin } from "../util/functions/roundRobin";
import { genKnockoutAnyN } from "../util/functions/knockoutAnyN";
import { supabase } from "@/app/lib/supabase/supabaseClient";

// Keep DraftMatch as the single source of truth for match fields
type EditableDraftMatch = DraftMatch & {
  locked?: boolean;
  _localId?: number;
  db_id?: number | null; // 👈 allow null
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
  db_id?: number | null; // 👈 allow null
};

/** Build a stable signature for a match row so we can map DB-only fields back in
 * Works even if parent strips unknown fields from `DraftMatch`.
 */
function rowSignature(m: DraftMatch) {
  const parts = [
    m.stageIdx ?? "",
    // m.groupIdx — intentionally omitted
    m.matchday ?? "",
    m.round ?? "",
    m.bracket_pos ?? "",
    m.team_a_id ?? "",
    m.team_b_id ?? "",
    m.match_date ?? "",
  ];
  return parts.join("|");
}

/** Recompute KO local *_match_idx pointers for a given stage */
function reindexKOPointersForStage(stageIdx: number, rows: DraftMatch[]) {
  const sameStage = rows.filter((m) => m.stageIdx === stageIdx && (m.round ?? null) != null);

  const key = (r?: number | null, p?: number | null) => (r && p ? `${r}:${p}` : "");
  const idxOf = new Map<string, number>();

  sameStage
    .slice()
    .sort(
      (a, b) =>
        (a.round ?? 0) - (b.round ?? 0) ||
        (a.bracket_pos ?? 0) - (b.bracket_pos ?? 0)
    )
    .forEach((m, i) => {
      idxOf.set(key(m.round ?? null, m.bracket_pos ?? null), i);
    });

  sameStage.forEach((m) => {
    const hk = key(m.home_source_round ?? null, m.home_source_bracket_pos ?? null);
    const ak = key(m.away_source_round ?? null, m.away_source_bracket_pos ?? null);
    const hIdx = hk ? idxOf.get(hk) : undefined;
    const aIdx = ak ? idxOf.get(ak) : undefined;
    if (typeof hIdx === "number") (m as any).home_source_match_idx = hIdx;
    else delete (m as any).home_source_match_idx;
    if (typeof aIdx === "number") (m as any).away_source_match_idx = aIdx;
    else delete (m as any).away_source_match_idx;
  });

  return rows;
}

/** Strip UI-only fields before calling onChange */
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
  draftMatches,
  onChange,
  // lock planner to a specific stage (hides stage picker)
  forceStageIdx,
  // tighter spacing for embedding in StageCard
  compact,
  // allow parent to trigger seeding before regeneration (KO)
  onAutoAssignTeamSeeds,
}: {
  payload: NewTournamentPayload;
  teams: TeamDraft[];
  draftMatches: DraftMatch[];
  onChange: (next: DraftMatch[]) => void;
  forceStageIdx?: number;
  compact?: boolean;
  onAutoAssignTeamSeeds?: () => Promise<number[]> | number[];
}) {
  const [stageIdx, setStageIdx] = useState<number>(() => initialStageIndex(payload, forceStageIdx));
  const [groupIdx, setGroupIdx] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  // Local cache of DB-only fields keyed by row signature
  const [dbOverlayBySig, setDbOverlayBySig] = useState<Record<string, DbOverlay>>({});

  // Keep stageIdx synced with forced value
  useEffect(() => {
    if (typeof forceStageIdx === "number") {
      setStageIdx(forceStageIdx);
      setGroupIdx(null);
    }
  }, [forceStageIdx]);

  // --------------------------
  // Load saved matches from DB and also populate overlay cache.
  // We still push rows via onChange so match_date & structure update,
  // and we keep status/scores too (no stripping).
  // --------------------------
  useEffect(() => {
    const stageIdToIdx = new Map<number, number>();
    (payload.stages as any)?.forEach((s: any, i: number) => {
      if (typeof s?.id === "number") stageIdToIdx.set(s.id, i);
    });

    const haveStageIds = stageIdToIdx.size > 0;
    const shouldPrefillBase = (draftMatches?.length ?? 0) === 0; // only replace base if empty

    if (!haveStageIds) return;

    let cancelled = false;

    (async () => {
      try {
        const stageIds = Array.from(stageIdToIdx.keys());
        if (stageIds.length === 0) return;

        const { data, error } = await supabase
          .from("matches")
          .select(
            [
              "id",
              "stage_id",
              "group_id",
              "round",
              "bracket_pos",
              "matchday",
              "match_date",
              "team_a_id",
              "team_b_id",
              "team_a_score",
              "team_b_score",
              "status",
              "winner_team_id",
              "home_source_round",
              "home_source_bracket_pos",
              "away_source_round",
              "away_source_bracket_pos",
            ].join(",")
          )
          .in("stage_id", stageIds)
          .order("stage_id", { ascending: true })
          .order("round", { ascending: true, nullsFirst: true })
          .order("bracket_pos", { ascending: true, nullsFirst: true })
          .order("matchday", { ascending: true, nullsFirst: true })
          .order("id", { ascending: true });

        if (error) throw error;

        const incoming: EditableDraftMatch[] = (data ?? [])
          .map((m: any) => {
            const sIdx = stageIdToIdx.get(m.stage_id);
            if (typeof sIdx !== "number") return null;

            // Map DB group_id (FK) -> 0-based group index for this stage
            let gIdx: number | null = null;
            const s = (payload.stages as any)[sIdx];
            if (m.group_id != null && s?.groups?.length) {
              const gi = (s.groups as any).findIndex((g: any) => g?.id === m.group_id);
              gIdx = gi >= 0 ? gi : null;
            }

            const row: EditableDraftMatch = {
              db_id: m.id, // keep locally; will be stripped via toDraft() on parent updates
              stageIdx: sIdx,
              groupIdx: gIdx,
              round: m.round ?? null,
              bracket_pos: m.bracket_pos ?? null,
              matchday: m.matchday ?? null,
              match_date: m.match_date ?? null,
              team_a_id: m.team_a_id ?? null,
              team_b_id: m.team_b_id ?? null,
              // advanced:
              team_a_score: m.team_a_score ?? null,
              team_b_score: m.team_b_score ?? null,
              status: (m.status as "scheduled" | "finished" | null) ?? null,
              winner_team_id: m.winner_team_id ?? null,
              home_source_round: m.home_source_round ?? null,
              home_source_bracket_pos: m.home_source_bracket_pos ?? null,
              away_source_round: m.away_source_round ?? null,
              away_source_bracket_pos: m.away_source_bracket_pos ?? null,
              locked: false,
            };
            return row;
          })
          .filter(Boolean) as EditableDraftMatch[];

        if (cancelled) return;

        // Build overlay cache from incoming (also store db_id here)
        const overlay: Record<string, DbOverlay> = {};
        for (const r of incoming) {
          overlay[rowSignature(r)] = {
            db_id: r.db_id,
            status: r.status ?? null,
            team_a_score: r.team_a_score ?? null,
            team_b_score: r.team_b_score ?? null,
            winner_team_id: r.winner_team_id ?? null,
            home_source_round: r.home_source_round ?? null,
            home_source_bracket_pos: r.home_source_bracket_pos ?? null,
            away_source_round: r.away_source_round ?? null,
            away_source_bracket_pos: r.away_source_bracket_pos ?? null,
          };
        }
        setDbOverlayBySig(overlay);

        // If parent has no matches yet, hydrate with ALL fields (except UI-only+db_id)
        if (shouldPrefillBase && incoming.length > 0) {
          onChange(incoming.map(toDraft));
        }
      } catch {
        // Silent — if this fails we just keep current local state.
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload?.stages, onChange]); // intentionally not depending on draftMatches

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

  const stage = (payload.stages as any)[stageIdx];
  const isGroups = stage?.kind === "groups";
  const isLeague = stage?.kind === "league";
  const isKO = stage?.kind === "knockout";
  const stageCfg: any = (stage?.config ?? {}) as any;
  const isKOFromPrevious = isKO && Number.isFinite(stageCfg?.from_stage_idx as any);
  const koStageDbId: number | undefined = stage?.id;
  const groups = isGroups ? stage?.groups ?? [] : [];
  const showStagePicker = typeof forceStageIdx !== "number";

  // 🔎 New: figure out the source stage DB id (so the reseed button knows when to enable)
  const srcStageIdx = isKOFromPrevious ? Number(stageCfg?.from_stage_idx) : undefined;
  const srcStageDbId: number | undefined =
    typeof srcStageIdx === "number" ? (payload.stages as any)[srcStageIdx]?.id : undefined;

  const hasKOStageDbId = typeof koStageDbId === "number";
  const hasSrcStageDbId = typeof srcStageDbId === "number";
  console.log("KO reseed debug →", {
    busy,
    koStageDbId,
    hasKOStageDbId,
    srcStageIdx,
    srcStageDbId,
    hasSrcStageDbId,
  });

  // ✅ per-row lock state (unique by local id to avoid collisions)
  const [locksByPos, setLocksByPos] = useState<Record<string, boolean>>({});

  // Which team IDs belong to the currently selected group?
  const groupTeamIds = useMemo<number[]>(() => {
    if (!isGroups) return teams.map((t) => t.id);
    const gIdx = groupIdx ?? 0;
    return teams
      .filter((t) => (t as any).groupsByStage?.[stageIdx] === gIdx)
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
  // Rows & local "pending" edits
  // IMPORTANT: merge in DB overlay so status/scores/db_id always render even if parent strips them.
  // --------------------------
  const withLocalIds: EditableDraftMatch[] = useMemo(
    () =>
      draftMatches.map((m, i) => {
        const base: EditableDraftMatch = { ...m, _localId: i };
        const k = lockKeyStable(base);
        const locked = !!(k && locksByPos[k]);
        const mergedBase = { ...base, locked };

        const sig = rowSignature(mergedBase);
        const overlay = dbOverlayBySig[sig];
        return overlay ? { ...mergedBase, ...overlay } : mergedBase;
      }),
    [draftMatches, dbOverlayBySig, locksByPos]
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
  // Mutators
  // --------------------------
  const setRow = (localId: number, patch: Partial<EditableDraftMatch>) => {
    const next = withLocalIds.map((m) => (m._localId === localId ? { ...m, ...patch } : m));
    const draft = next.map(toDraft);
    const finalDraft = isKO ? reindexKOPointersForStage(stageIdx, draft) : draft;
    onChange(finalDraft);

    // Update overlay cache for DB-only fields so UI keeps showing them
    const changed = next.find((m) => m._localId === localId);
    if (changed) {
      const sig = rowSignature(changed);
      setDbOverlayBySig((prev) => ({
        ...prev,
        [sig]: {
          db_id: (changed as EditableDraftMatch).db_id,
          status: changed.status ?? null,
          team_a_score: changed.team_a_score ?? null,
          team_b_score: changed.team_b_score ?? null,
          winner_team_id: changed.winner_team_id ?? null,
          home_source_round: changed.home_source_round ?? null,
          home_source_bracket_pos: changed.home_source_bracket_pos ?? null,
          away_source_round: changed.away_source_round ?? null,
          away_source_bracket_pos: changed.away_source_bracket_pos ?? null,
        },
      }));
    }
  };

  const saveAllPendingInView = () => {
    if (pendingCount === 0) return;
    const next = withLocalIds.map((m) => {
      const pid = m._localId!;
      return pending[pid] ? { ...m, ...pending[pid] } : m;
    });
    const draft = next.map(toDraft);
    const finalDraft = isKO ? reindexKOPointersForStage(stageIdx, draft) : draft;
    onChange(finalDraft);

    // refresh overlay for all rows in view that had pending
    setDbOverlayBySig((prev) => {
      const n = { ...prev };
      for (const m of next) {
        const pid = m._localId!;
        if (!pending[pid]) continue;
        const sig = rowSignature(m);
        n[sig] = {
          db_id: (m as EditableDraftMatch).db_id,
          status: m.status ?? null,
          team_a_score: m.team_a_score ?? null,
          team_b_score: m.team_b_score ?? null,
          winner_team_id: m.winner_team_id ?? null,
          home_source_round: m.home_source_round ?? null,
          home_source_bracket_pos: m.home_source_bracket_pos ?? null,
          away_source_round: m.away_source_round ?? null,
          away_source_bracket_pos: m.away_source_bracket_pos ?? null,
        };
      }
      return n;
    });
    // clear only the ones we applied in this view
    setPending((prev) => {
      const n = { ...prev };
      pendingIdsInView.forEach((id) => delete n[id]);
      return n;
    });
  };

  const removeRow = (localId: number) => {
    const next = withLocalIds.filter((m) => m._localId !== localId);
    const draft = next.map(toDraft);
    const finalDraft = isKO ? reindexKOPointersForStage(stageIdx, draft) : draft;
    onChange(finalDraft);
    clearPendingFor(localId);
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
      const draft = [...draftMatches, toDraft(newRow)];
      const finalDraft = reindexKOPointersForStage(stageIdx, draft);
      onChange(finalDraft);
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
      onChange([...draftMatches, toDraft(newRow)]);
    }
  };

  const swapTeams = (localId: number) => {
    const row = withLocalIds.find((m) => m._localId === localId);
    if (!row) return;
    const a = getEff(row, "team_a_id");
    const b = getEff(row, "team_b_id");
    setPendingFor(localId, { team_a_id: b ?? null, team_b_id: a ?? null });
  };

  // --- NEW: per-row save that writes to DB when db_id exists ---
  const saveRow = async (localId: number) => {
    const patch = pending[localId];
    if (!patch) return;

    const row = withLocalIds.find((m) => m._localId === localId);
    if (!row) return;

    // If this row is already persisted, write only the changed fields to DB.
    if (row.db_id) {
      // Guard: optionally warn on finished
      const st = (row.status ?? inferStatus(row as any)) as "scheduled" | "finished";
      if (st === "finished") {
        const ok = confirm(
          "Ο αγώνας έχει κλείσει (finished). Θέλετε σίγουρα να αλλάξετε τα στοιχεία;"
        );
        if (!ok) return;
      }

      setBusy(true);
      try {
        const updatePayload: Record<string, any> = {};
        const candidateKeys: Array<keyof EditableDraftMatch> = [
          "match_date",
          "team_a_id",
          "team_b_id",
          "matchday",
          "round",
          "bracket_pos",
          "status",
          "team_a_score",
          "team_b_score",
          "winner_team_id",
          "home_source_round",
          "home_source_bracket_pos",
          "away_source_round",
          "away_source_bracket_pos",
        ];

        for (const k of candidateKeys) {
          if (k in patch) updatePayload[k] = (patch as any)[k];
        }

        if (Object.keys(updatePayload).length > 0) {
          const { error } = await supabase.from("matches").update(updatePayload).eq("id", row.db_id);
          if (error) throw error;
        }

        // Mirror to local state so UI stays in sync
        setRow(localId, patch);
        clearPendingFor(localId);
      } catch (err) {
        console.error(err);
        alert("Αποτυχία αποθήκευσης στη βάση. Δοκιμάστε ξανά.");
      } finally {
        setBusy(false);
      }
    } else {
      // Not persisted yet → keep current local behavior
      setRow(localId, patch);
      clearPendingFor(localId);
    }
  };

  // --------------------------
  // Helper: fetch standings (server)
  // --------------------------
  async function fetchStandings(
    stageId: number
  ): Promise<Array<{ group_id: number | null; team_id: number; rank: number }>> {
    const url = new URL(`/api/stages/${stageId}/standings`, window.location.origin);
    const res = await fetch(url.toString(), { credentials: "include" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json().catch(() => null);
    const rows: Array<{ group_id: number | null; team_id: number; rank: number }> =
      body?.rows ?? body?.standings ?? body ?? [];
    return Array.isArray(rows) ? rows : [];
  }

  // ✅ per-row lock key (stable in this UI by local id; fallback to signature)
  function lockKeyStable(m: EditableDraftMatch) {
    // If this row is persisted already, prefer the DB id.
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

  // --------------------------
  // KO Recalc helpers
  // --------------------------
  function buildKOFromGroupStandings(opts: {
    stageIdx: number;
    groupsCount: number;
    perGroupTop: number[][];
    semisCross: "A1-B2" | "A1-B1";
  }): DraftMatch[] {
    const { stageIdx, groupsCount: G, perGroupTop, semisCross } = opts;

    if (G === 2 && perGroupTop[0]?.length >= 2 && perGroupTop[1]?.length >= 2) {
      const [A1, A2] = perGroupTop[0];
      const [B1, B2] = perGroupTop[1];
      const semiPairs =
        semisCross === "A1-B2"
          ? [
              [A1 ?? null, B2 ?? null],
              [B1 ?? null, A2 ?? null],
            ]
          : [
              [A1 ?? null, B1 ?? null],
              [A2 ?? null, B2 ?? null],
            ];

      const out: DraftMatch[] = [];
      semiPairs.forEach((pair, i) => {
        out.push({
          stageIdx,
          round: 1,
          bracket_pos: i + 1,
          team_a_id: pair[0] ?? null,
          team_b_id: pair[1] ?? null,
          match_date: null,
        });
      });
      out.push({
        stageIdx,
        round: 2,
        bracket_pos: 1,
        home_source_round: 1,
        home_source_bracket_pos: 1,
        home_source_outcome: "W",
        away_source_round: 1,
        away_source_bracket_pos: 2,
        away_source_outcome: "W",
        match_date: null,
      });
      return out;
    }

    const layers: number[][] = [];
    const maxRank = Math.max(...perGroupTop.map((arr) => arr.length));
    for (let r = 0; r < maxRank; r++) {
      const layer: number[] = [];
      for (let g = 0; g < G; g++) {
        const teamId = perGroupTop[g]?.[r];
        if (teamId != null) layer.push(teamId);
      }
      if (layer.length) layers.push(layer);
    }
    const ordered = layers.flat(); // A1,B1,...,A2,B2,...

    const seeded = ordered.map((id, i) => ({ id, seed: i + 1 }));
    return genKnockoutAnyN(ordered, stageIdx, seeded).map((m) => ({ ...m, match_date: null }));
  }

  function buildKOFromLeagueStandings(opts: { stageIdx: number; topIds: number[] }): DraftMatch[] {
    const { stageIdx, topIds } = opts;
    const seeded = topIds.map((id, i) => ({ id, seed: i + 1 }));
    return genKnockoutAnyN(topIds, stageIdx, seeded).map((m) => ({ ...m, match_date: null }));
  }

  // ---- structural keys for diff/merge ----
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
  // Re-generate ONLY the current stage (or group) via diff/merge
  // -------------------------------------------------------
  const regenerateHere = async () => {
    const cfg = (((payload.stages as any)[stageIdx]?.config ?? {}) as any) || {};
    const isKOIntake = isKO && Number.isFinite(cfg.from_stage_idx as any);

    const isTarget = (m: DraftMatch) => {
      if (isGroups) return m.stageIdx === stageIdx && m.groupIdx === (groupIdx ?? 0);
      if (isKO) return m.stageIdx === stageIdx;
      return m.stageIdx === stageIdx && (m.groupIdx == null || m.groupIdx === null);
    };

    // 1) Build the "fresh" schedule subset for this scope (KO intake aware)
    let freshSubset: DraftMatch[] | null = null;

    if (isKOIntake) {
      const srcIdx = Number(cfg.from_stage_idx);
      const srcStage = (payload.stages as any)[srcIdx];
      const srcId: number | undefined = srcStage?.id;
      const semisCross: "A1-B2" | "A1-B1" = cfg.semis_cross === "A1-B1" ? "A1-B1" : "A1-B2";

      try {
        if (srcStage?.kind === "groups" && typeof srcId === "number") {
          const adv = Math.max(1, Number(cfg.advancers_per_group ?? 2));
          const standings = await fetchStandings(srcId);

          // Map DB group ids -> 0-based indexes for that source stage
          const groupsMeta = srcStage.groups ?? [];
          const groupsCount = groupsMeta.length || 1;
          const idToIdx = new Map<number, number>();
          groupsMeta.forEach((g: any, i: number) => {
            if (typeof g?.id === "number") idToIdx.set(g.id, i);
          });

          const perGroup: number[][] = Array.from({ length: groupsCount }, () => []);
          standings
            .slice()
            .sort((a, b) => (a.group_id ?? 0) - (b.group_id ?? 0) || a.rank - b.rank)
            .forEach((r) => {
              if (r.rank <= adv) {
                const gId = r.group_id ?? null;
                const gIdx = gId != null && idToIdx.has(gId) ? (idToIdx.get(gId) as number) : 0;
                perGroup[gIdx].push(r.team_id);
              }
            });

          freshSubset = buildKOFromGroupStandings({
            stageIdx,
            groupsCount,
            perGroupTop: perGroup,
            semisCross,
          });
        } else if (srcStage?.kind === "league" && typeof srcId === "number") {
          const total = Math.max(
            2,
            Number(cfg.advancers_total ?? cfg.standalone_bracket_size ?? 8)
          );
          const standings = await fetchStandings(srcId);
          const topIds = standings
            .slice()
            .sort((a, b) => a.rank - b.rank)
            .slice(0, total)
            .map((r) => r.team_id);

          freshSubset = buildKOFromLeagueStandings({ stageIdx, topIds });
        }
      } catch {
        // fall through to default generator
      }
    }

    if (!freshSubset) {
      if (isKO && onAutoAssignTeamSeeds) {
        try {
          await Promise.resolve(onAutoAssignTeamSeeds());
        } catch {}
      }
      const freshAll = generateDraftMatches({ payload, teams });
      freshSubset = freshAll.filter(isTarget);
    }

    // 2) Prepare old/new maps by structural key
    const oldTarget = withLocalIds.filter(isTarget).map(toDraft);
    const locked = withLocalIds.filter((m) => isTarget(m) && (m as EditableDraftMatch).locked);

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

    // 3) Merge: keep/update, insert, delete (but never touch locked keys)
    const lockedKeys = new Set<string>();
    if (isKO) {
      locked.forEach((l) => lockedKeys.add(makeKoKey(l)));
    } else {
      const ord = indexRrOrdinals(locked.map(toDraft));
      locked.map(toDraft).forEach((l) => lockedKeys.add(makeRrKey(l, ord.get(l) ?? 0)));
    }

    const keepAndUpdate: DraftMatch[] = [];
    const toInsert: DraftMatch[] = [];
    const toDelete: DraftMatch[] = [];

    // Inserts + updates
    for (const [k, newM] of newMap.entries()) {
      if (lockedKeys.has(k)) continue; // locked row wins
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

    // Deletions: whatever old keys remain (and not locked) are orphans
    for (const [k, orphan] of oldMap.entries()) {
      if (lockedKeys.has(k)) continue;
      toDelete.push(orphan);
    }

    // 4) Build next list:
    // - everything not in target scope stays as-is
    // - locked rows kept verbatim
    // - keep/update rows merged
    // - new rows inserted
    const others = withLocalIds.filter((m) => !isTarget(m)).map(toDraft);
    const lockedKept = locked.map(toDraft);

    const next = [...others, ...lockedKept, ...keepAndUpdate, ...toInsert];

    onChange(next);
    setPending({});
  };

  // =========================
  // Server reseed for derived KO
  // =========================
  const reseedKOFromServer = async () => {
    if (!isKOFromPrevious) return;

    // 🚫 Hard guard: if ids are missing, notify and do nothing (so it's obvious in the UI)
    if (!hasKOStageDbId || !hasSrcStageDbId) {
      alert(
        !hasKOStageDbId
          ? "Αποθήκευση πρώτα: Το KO στάδιο δεν έχει id στη ΒΔ. Κάντε Save και ξαναδοκιμάστε."
          : "Αποθήκευση πρώτα: Το στάδιο-πηγή (League/Groups) δεν έχει id στη ΒΔ. Κάντε Save και ξαναδοκιμάστε."
      );
      console.info("Reseed blocked — koStageDbId:", koStageDbId, "srcStageDbId:", srcStageDbId);
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`/api/stages/${koStageDbId}/reseed?reseed=1&force=1`, {
        method: "POST",
        credentials: "include",
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        // Fall back to local if server endpoint errors out
        await regenerateHere();
        return;
      }

      const fresh: DraftMatch[] = (body?.matches ?? []).map((r: any) => ({
        stageIdx,
        groupIdx: null,
        matchday: r.matchday ?? null,
        round: r.round ?? null,
        bracket_pos: r.bracket_pos ?? null,
        team_a_id: r.team_a_id ?? null,
        team_b_id: r.team_b_id ?? null,
        match_date: null,
        home_source_round: r.home_source_round ?? null,
        home_source_bracket_pos: r.home_source_bracket_pos ?? null,
        away_source_round: r.away_source_round ?? null,
        away_source_bracket_pos: r.away_source_bracket_pos ?? null,
      }));

      const others = withLocalIds.filter((m) => m.stageIdx !== stageIdx).map(toDraft);
      onChange([...others, ...fresh]);
      setPending({});
    } catch {
      await regenerateHere();
    } finally {
      setBusy(false);
    }
  };

  // =========================
  // Auto-assign (Round Robin) — Groups & League
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

      {/* New: inline hint if reseed would be disabled due to missing DB ids */}
      {isKOFromPrevious && (!hasKOStageDbId || !hasSrcStageDbId) && (
        <div className="rounded-md border border-amber-400/30 bg-amber-500/10 p-2 text-amber-200 text-xs">
          Για να γίνει «Επανασπορά από Αποτελέσματα», αποθηκεύστε το τουρνουά ώστε να πάρουν id τα στάδια
          {!hasKOStageDbId ? " (KO)" : ""}{!hasSrcStageDbId ? " (Πρωτάθλημα/Όμιλοι-πηγή)" : ""}.
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
              {(payload.stages as any).map((s: any, i: number) => (
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
          {!isKOFromPrevious && (
            <button
              className="px-3 py-1.5 rounded-md border border-cyan-400/30 text-cyan-200 hover:bg-cyan-500/10 disabled:opacity-50"
              onClick={() => void regenerateHere()}
              disabled={busy}
              title="Επαναδημιουργία αυτού του σταδίου (ή ομίλου) κρατώντας τους κλειδωμένους αγώνες"
            >
              Επαναδημιουργία τρέχοντος
            </button>
          )}

          {isKOFromPrevious && (
            <button
              className="px-3 py-1.5 rounded-md border border-amber-400/40 text-amber-200 hover:bg-amber-500/10 disabled:opacity-50"
              onClick={() => void reseedKOFromServer()}
              disabled={busy || !hasKOStageDbId || !hasSrcStageDbId}
              title={
                !hasKOStageDbId
                  ? "Αποθηκεύστε πρώτα: το KO στάδιο δεν έχει id στη ΒΔ."
                  : !hasSrcStageDbId
                  ? "Αποθηκεύστε πρώτα: το στάδιο-πηγή (League/Groups) δεν έχει id στη ΒΔ."
                  : "Ανανέωση του KO από τα πραγματικά αποτελέσματα/βαθμολογίες"
              }
            >
              🔄 Επανασπορά από Αποτελέσματα
            </button>
          )}

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
        Προβολή: <span className="text-white/90 font-medium">{stage?.name}</span>{" "}
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
                            value={(m as EditableDraftMatch).round ?? 1}
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
                              value={(m as EditableDraftMatch).bracket_pos ?? 1}
                              onChange={(e) =>
                                setPendingFor(lid, { bracket_pos: Number(e.target.value) || 1 })
                              }
                            />
                            {/* Inline KO pointer badges (read-only) */}
                            <div className="text-[10px] text-white/70 space-x-1">
                              {(m as EditableDraftMatch).home_source_round ? (
                                <span className="inline-flex items-center rounded bg-white/5 px-1.5 py-0.5 ring-1 ring-white/10">
                                  A: R{(m as EditableDraftMatch).home_source_round}-B
                                  {(m as EditableDraftMatch).home_source_bracket_pos}
                                </span>
                              ) : (
                                <span className="text-white/30">A: —</span>
                              )}
                              {(m as EditableDraftMatch).away_source_round ? (
                                <span className="inline-flex items-center rounded bg-white/5 px-1.5 py-0.5 ring-1 ring-white/10">
                                  B: R{(m as EditableDraftMatch).away_source_round}-B
                                  {(m as EditableDraftMatch).away_source_bracket_pos}
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
                          value={(m as EditableDraftMatch).matchday ?? 1}
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
                        value={(m as EditableDraftMatch).team_a_id ?? ""}
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
                        {(m as EditableDraftMatch).team_a_id &&
                          !teamOptions.some((o) => o.id === (m as EditableDraftMatch).team_a_id) && (
                            <option value={(m as EditableDraftMatch).team_a_id!}>
                              {teamLabel((m as EditableDraftMatch).team_a_id!)} (εκτός ομίλου)
                            </option>
                          )}
                      </select>
                    </td>

                    {/* Team B select */}
                    <td className="px-2 py-1">
                      <select
                        className="min-w-48 bg-slate-950 border border-white/15 rounded px-2 py-1 text-white"
                        value={(m as EditableDraftMatch).team_b_id ?? ""}
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
                        {(m as EditableDraftMatch).team_b_id &&
                          !teamOptions.some((o) => o.id === (m as EditableDraftMatch).team_b_id) && (
                            <option value={(m as EditableDraftMatch).team_b_id!}>
                              {teamLabel((m as EditableDraftMatch).team_b_id!)} (εκτός ομίλου)
                            </option>
                          )}
                      </select>
                    </td>

                    {/* Score cell */}
                    <td className="px-2 py-1">
                      {(() => {
                        const a = (m as EditableDraftMatch).team_a_score ?? null;
                        const b = (m as EditableDraftMatch).team_b_score ?? null;
                        const has = a != null || b != null;
                        return has ? `${a ?? 0} – ${b ?? 0}` : <span className="text-white/50">—</span>;
                      })()}
                    </td>

                    {/* Status cell */}
                    <td className="px-2 py-1">
                      {(() => {
                        const st =
                          (m as EditableDraftMatch).status ??
                          inferStatus({
                            status: (m as EditableDraftMatch).status,
                            team_a_score: (m as EditableDraftMatch).team_a_score,
                            team_b_score: (m as EditableDraftMatch).team_b_score,
                            winner_team_id: (m as EditableDraftMatch).winner_team_id,
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
                        value={isoToLocalInput((m as EditableDraftMatch).match_date)}
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
