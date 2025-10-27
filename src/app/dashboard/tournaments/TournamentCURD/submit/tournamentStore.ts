// app/dashboard/tournaments/TournamentCURD/submit/tournamentStore.ts
"use client";

import { create } from "zustand";
import type { NewTournamentPayload } from "@/app/lib/types";
import type {
  DraftMatch,
  TeamDraft,
} from "@/app/dashboard/tournaments/TournamentCURD/TournamentWizard";

/* =========================================================
   Minimal DB row types (client-side mirrors)
   ========================================================= */
type DbTournament = {
  id: number;
  name: string;
  slug: string;
  format: "league" | "groups" | "knockout" | "mixed";
  season?: string | null;
};
type DbStage = {
  id: number;
  tournament_id: number;
  name: string;
  kind: "league" | "groups" | "knockout";
  ordering: number;
  config?: any;
};
type DbGroup = { id: number; stage_id: number; name: string; ordering?: number | null };
type DbTeam = { id: number; name: string; logo?: string | null; am?: string | null };
type DbTournamentTeam = {
  id: number;
  tournament_id: number;
  team_id: number;
  stage_id?: number | null; // DB stage id if assigned to a stage
  group_id?: number | null; // DB group id if assigned to a group
  seed?: number | null;
};
type DbStageSlot = {
  stage_id: number;
  group_id: number; // index-based (0..n-1)
  slot_id: number;
  team_id?: number | null;
  source: "manual" | "intake";
  updated_at?: string; // concurrency (server checks if provided)
};
type DbIntakeMapping = {
  id?: number;
  target_stage_id: number;
  group_idx: number;
  slot_idx: number;
  from_stage_id: number;
  round: number;
  bracket_pos: number;
  outcome: "W" | "L";
};
type DbStanding = {
  stage_id: number;
  group_id: number | null; // ✅ leagues can have null here
  team_id: number;
  played: number; won: number; drawn: number; lost: number;
  gf: number; ga: number; gd: number; points: number; rank?: number | null;
};

type DbMatchRow = {
  id?: number | null;
  stage_id: number;
  group_id?: number | null;
  team_a_id?: number | null;
  team_b_id?: number | null;
  team_a_score?: number | null;
  team_b_score?: number | null;
  winner_team_id?: number | null;
  status?: "scheduled" | "finished";
  match_date?: string | null;
  matchday?: number | null;
  round?: number | null;
  bracket_pos?: number | null;
  // KO round/pos pointers
  home_source_round?: number | null;
  home_source_bracket_pos?: number | null;
  away_source_round?: number | null;
  away_source_bracket_pos?: number | null;
  updated_at?: string | null; // concurrency (server checks if provided)
};

/* A “bring everything” snapshot used to hydrate the store in one go */
export type FullTournamentSnapshot = {
  tournament: DbTournament;
  stages: DbStage[];
  groups: DbGroup[];
  teams: DbTeam[];
  tournamentTeams: DbTournamentTeam[];
  matches: (DbMatchRow & { updated_at?: string | null })[];
  stageSlots?: (DbStageSlot & { updated_at?: string })[];
  intakeMappings?: DbIntakeMapping[];
  standings?: DbStanding[];
};

/* =========================================================
   Types shared with MatchPlanner/BracketCanvas
   ========================================================= */

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
> & { db_id?: number | null; updated_at?: string | null };

type KOCoord = { round: number; bracket_pos: number };
type Frame = { x: number; y: number; w: number; h: number };
type LayoutByKoKey = Record<string, Frame>; // KO|{round}|{bracket_pos}

/* =========================================================
   Utilities
   ========================================================= */

let __tmpId = -1;
const nextTempId = () => __tmpId--; // negative client-only IDs

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
function makeKoKey(m: { round?: number | null; bracket_pos?: number | null }) {
  return `KO|${m.round ?? 0}|${m.bracket_pos ?? 0}`;
}
function sortKO(a: DraftMatch, b: DraftMatch) {
  return (a.round ?? 0) - (b.round ?? 0) || (a.bracket_pos ?? 0) - (b.bracket_pos ?? 0);
}
function wireKnockoutSourcesLocal(rows: DraftMatch[], stageIdx: number) {
  const same = rows
    .filter((m) => m.stageIdx === stageIdx && m.round != null && m.bracket_pos != null)
    .slice()
    .sort(sortKO);

  const key = (r?: number | null, p?: number | null) => (r && p ? `${r}:${p}` : "");
  const idxOf = new Map<string, number>();
  same.forEach((m, i) => idxOf.set(key(m.round ?? null, m.bracket_pos ?? null), i));

  same.forEach((m) => {
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

/* helpers to read/write stage/group order arrays */
function stageOrderArray(map: Record<number, number | undefined>) {
  return Object.keys(map)
    .map((k) => Number(k))
    .sort((a, b) => a - b)
    .map((idx) => map[idx]!)
    .filter((id) => id != null);
}

/* =========================================================
   NEW: Build group-index maps from actual DB matches (fallback)
   ========================================================= */
function buildGroupIndexFallbackFromMatches(
  dbMatches: { stage_id?: number | null; group_id?: number | null }[],
  stageIndexById: Record<number, number | undefined>
) {
  const groupIdByStage: Record<number, Record<number, number>> = {};
  const groupIndexByStageAndId: Record<number, Record<number, number>> = {};

  // Per stage_id, collect distinct group_ids in first-seen order
  const seen: Record<number, Map<number, number>> = {};
  for (const m of dbMatches) {
    const sid = m.stage_id ?? undefined;
    const gid = m.group_id ?? undefined;
    if (!sid || !gid) continue;
    const sMap = (seen[sid] ??= new Map());
    if (!sMap.has(gid)) sMap.set(gid, sMap.size);
  }

  Object.entries(seen).forEach(([stageIdStr, map]) => {
    const stageId = Number(stageIdStr);
    const sIdx = stageIndexById[stageId];
    if (typeof sIdx !== "number") return;
    groupIdByStage[sIdx] = {};
    groupIndexByStageAndId[stageId] = {};
    for (const [gid, idx] of map.entries()) {
      groupIdByStage[sIdx][idx] = gid;
      groupIndexByStageAndId[stageId][gid] = idx;
    }
  });

  return { groupIdByStage, groupIndexByStageAndId };
}

/* =========================================================
   Store shape
   ========================================================= */
export type TournamentState = {
  /* ---------- Entities/cache (everything available in the store) ---------- */
  entities: {
    tournament: DbTournament | null;
    stagesById: Record<number, DbStage>;
    groupsById: Record<number, DbGroup>;
    teamsById: Record<number, DbTeam>;
    tournamentTeams: DbTournamentTeam[]; // keep as array to preserve seed ordering
    stageSlots: DbStageSlot[];          // raw
    intakeMappings: DbIntakeMapping[];  // raw
    standings: DbStanding[];            // raw
  };

  /* ---------- Legacy/Editor working sets (kept for compatibility) ---------- */
  payload: NewTournamentPayload | null; // optional helper for builders
  draftMatches: DraftMatch[];           // editor truth
  dbOverlayBySig: Record<string, DbOverlay>;

  /* ---------- UI-only ---------- */
  ui: { knockoutLayout: Record<number, LayoutByKoKey> };

  /* ---------- ID maps & hydration helpers ---------- */
  ids: {
    tournamentId?: number;
    stageIdByIndex: Record<number, number | undefined>;
    groupIdByStage: Record<number, Record<number, number | undefined>>;// groupIdx → DB id
    stageIndexById: Record<number, number | undefined>; // reverse map
    groupIndexByStageAndId: Record<number, Record<number, number | undefined>>; // stageId -> (groupId -> idx)
  };

  /* ---------- Dirty tracking ---------- */
  dirty: {
    tournament: boolean;
    stages: boolean;
    groups: boolean;
    tournamentTeams: boolean;
    matches: Set<string>; // rowSignature of changed rows
    stageSlots: Set<string>; // `${stageId}|${groupIdx}|${slotId}`
    intakeMappings: boolean; // simple ‘something changed’ flag
    deletedStageIds: Set<number>;
    deletedGroupIds: Set<number>;
    deletedMatchIds: Set<number>; // NEW: DB ids to delete
  };

  busy: boolean;

  /* ---------- Snapshot cache (for reset) ---------- */
  lastSnapshot?: FullTournamentSnapshot;

  /* -------------------- Selectors -------------------- */
  selectStageRows: (stageIdx: number) => DraftMatch[];
  selectStageRowsMerged: (stageIdx: number) => (DraftMatch & DbOverlay & { db_id?: number | null })[];

  // Entity/utility selectors
  getStageId: (stageIdx: number) => number | undefined;
  getGroupId: (stageIdx: number, groupIdx: number | null) => number | null | undefined;
  getStageKind: (stageIdx: number) => "league" | "groups" | "knockout" | undefined;
  getTeamName: (id?: number | null) => string;
  listGroupsForStageIdx: (stageIdx: number) => DbGroup[];
  listTournamentTeams: () => DbTournamentTeam[];
  listParticipants: () => number[]; // distinct team ids in this tournament
  listGroupTeamIds: (stageIdx: number, groupIdx: number) => number[]; // resilient (tournamentTeams → slots fallback)
  listStageSlots: (stageIdx: number, groupIdx: number) => DbStageSlot[];
  listIntakeMappingsForTargetStageIdx: (stageIdx: number) => DbIntakeMapping[];

  /* -------------------- Actions -------------------- */
  hydrateFromSnapshot: (snap: FullTournamentSnapshot) => void; // preferred full import
  hydrateFromServer: (payload: NewTournamentPayload, dbMatches: DbMatchRow[]) => void; // legacy/compat
  resetUnsavedChanges: () => void;
  setStageSlotByIndex: (
    stageIdx: number,
    groupIdx: number,
    slotId: number,
    teamId: number | null,
    source?: "manual" | "intake"
  ) => void;
  
  // Wizard seeding helper  
  seedFromWizard: (canon: NewTournamentPayload, teams: TeamDraft[], drafts: DraftMatch[]) => void;

  // entity mutators + dirties
  updateTournament: (patch: Partial<Pick<DbTournament, "name" | "slug" | "format" | "season">>) => void;

  upsertStage: (
    stageIdx: number | undefined,
    patch: Partial<Omit<DbStage, "id" | "tournament_id" | "ordering">> & {
      name?: string;
      kind?: "league" | "groups" | "knockout";
      config?: any;
    }
  ) => void;
  removeStage: (stageIdx: number) => void;

  upsertGroup: (
    stageIdx: number,
    groupIdx: number | undefined,
    patch: Partial<Omit<DbGroup, "id" | "stage_id">> & { name?: string; ordering?: number | null }
  ) => void;
  removeGroup: (stageIdx: number, groupIdx: number) => void;

  setTournamentTeamSeed: (teamId: number, seed: number | null) => void;
  assignTeamToGroup: (teamId: number, stageId: number, groupId: number | null) => void;

  replaceAllDraftMatches: (next: DraftMatch[]) => void;
  updateMatches: (stageIdx: number, updater: (rows: DraftMatch[]) => DraftMatch[]) => void;
  removeMatch: (row: DraftMatch) => void; // NEW: track deletions

  setKOLink: (
    stageIdx: number,
    child: KOCoord,
    side: "home" | "away",
    parent: KOCoord | null,
    outcome?: "W" | "L"
  ) => void;

  setKOTeams: (stageIdx: number, where: KOCoord, teamAId: number | null, teamBId: number | null) => void;
  setKORoundPos: (stageIdx: number, from: KOCoord, to: KOCoord) => void;
  reindexKOPointers: (stageIdx: number) => void;

  setUIKnockoutLayout: (stageIdx: number, koKey: string, frame: Frame) => void;

  upsertIntakeMapping: (m: DbIntakeMapping) => void;
  removeIntakeMapping: (predicate: (m: DbIntakeMapping) => boolean) => void;

  // Persist everything dirty via /save-all
  saveAll: () => Promise<void>;
};

/* =========================================================
   Store implementation
   ========================================================= */
export const useTournamentStore = create<TournamentState>((set, get) => ({
  entities: {
    tournament: null,
    stagesById: {},
    groupsById: {},
    teamsById: {},
    tournamentTeams: [],
    stageSlots: [],
    intakeMappings: [],
    standings: [],
  },

  payload: null,
  draftMatches: [],
  dbOverlayBySig: {},

  ui: { knockoutLayout: {} },

  ids: {
    tournamentId: undefined,
    stageIdByIndex: {},
    groupIdByStage: {},
    stageIndexById: {},
    groupIndexByStageAndId: {},
  },

  dirty: {
    tournament: false,
    stages: false,
    groups: false,
    tournamentTeams: false,
    matches: new Set<string>(),
    stageSlots: new Set<string>(),
    intakeMappings: false,
    deletedStageIds: new Set<number>(),
    deletedGroupIds: new Set<number>(),
    deletedMatchIds: new Set<number>(), // NEW
  },

  busy: false,

  /* -------------------- Selectors -------------------- */

  selectStageRows: (stageIdx) => {
    const rows = get().draftMatches.filter((m) => m.stageIdx === stageIdx);
    const kind = get().getStageKind(stageIdx);
    const isKO = kind === "knockout";
    return rows
      .slice()
      .sort((a, b) =>
        isKO ? sortKO(a, b) : (a.matchday ?? 0) - (b.matchday ?? 0) || (a.bracket_pos ?? 0) - (b.bracket_pos ?? 0)
      );
  },

  selectStageRowsMerged: (stageIdx) => {
    const rows = get().selectStageRows(stageIdx);
    const overlay = get().dbOverlayBySig;
    return rows.map((r) => {
      const ov = overlay[rowSignature(r)];
      if (!ov) return r as any;
      // Only carry DB/result fields
      const { db_id, updated_at, status, team_a_score, team_b_score, winner_team_id } = ov as any;
      return { ...r, db_id, updated_at, status, team_a_score, team_b_score, winner_team_id } as any;
    });
  },

  getStageId: (stageIdx) => get().ids.stageIdByIndex[stageIdx],
  getGroupId: (stageIdx, groupIdx) =>
    groupIdx == null ? null : get().ids.groupIdByStage[stageIdx]?.[groupIdx],
  getStageKind: (stageIdx) => {
    const stageId = get().ids.stageIdByIndex[stageIdx];
    if (!stageId) return undefined;
    return get().entities.stagesById[stageId]?.kind;
  },
  getTeamName: (id) => {
    if (!id) return "TBD";
    const t = get().entities.teamsById[id];
    return t?.name ?? `Team #${id}`;
  },
  listGroupsForStageIdx: (stageIdx) => {
    const stageId = get().ids.stageIdByIndex[stageIdx];
    if (!stageId) return [];
    const groups = Object.values(get().entities.groupsById).filter((g) => g.stage_id === stageId);
    return groups.sort((a, b) => (a.ordering ?? 0) - (b.ordering ?? 0) || a.name.localeCompare(b.name));
  },
  listTournamentTeams: () => get().entities.tournamentTeams.slice(),
  listParticipants: () => {
    const ids = new Set<number>();
    get().entities.tournamentTeams.forEach((tt) => ids.add(tt.team_id));
    if (ids.size > 0) return Array.from(ids);
    get().entities.stageSlots.forEach((s) => { if (s.team_id) ids.add(s.team_id); });
    if (ids.size > 0) return Array.from(ids);
    get().draftMatches.forEach((m) => {
      if (m.team_a_id) ids.add(m.team_a_id);
      if (m.team_b_id) ids.add(m.team_b_id);
    });
    return Array.from(ids);
  },
  listGroupTeamIds: (stageIdx, groupIdx) => {
        const stageId = get().ids.stageIdByIndex[stageIdx];
        if (!stageId && stageId !== 0) return [];
        const dbGroupId = get().ids.groupIdByStage[stageIdx]?.[groupIdx];
    
        const fromTT = get().entities.tournamentTeams
          .filter(tt => tt.stage_id === stageId && (dbGroupId ? tt.group_id === dbGroupId : tt.group_id == null))
          .map(tt => tt.team_id);
        if (fromTT.length > 0) return Array.from(new Set(fromTT));
    
        const fromSlots = get().entities.stageSlots
          .filter(s => s.stage_id === stageId && s.group_id === groupIdx && s.team_id != null)
          .map(s => s.team_id!) as number[];
        if (fromSlots.length > 0) return Array.from(new Set(fromSlots));
    
        return get().listParticipants();
      },
  listStageSlots: (stageIdx, groupIdx) => {
    const stageId = get().ids.stageIdByIndex[stageIdx];
    if (!stageId) return [];
    return get()
      .entities
      .stageSlots
      .filter((s) => s.stage_id === stageId && s.group_id === groupIdx)
      .slice()
      .sort((a, b) => a.slot_id - b.slot_id);
  },
  listIntakeMappingsForTargetStageIdx: (stageIdx) => {
    const stageId = get().ids.stageIdByIndex[stageIdx];
    if (!stageId) return [];
    return get().entities.intakeMappings.filter((m) => m.target_stage_id === stageId);
  },

  /* -------------------- Hydration -------------------- */

  hydrateFromSnapshot: (snap) => {
    // Build index maps
    const stageIdByIndex: Record<number, number> = {};
    const stageIndexById: Record<number, number> = {};
    let groupIdByStage: Record<number, Record<number, number>> = {};
    let groupIndexByStageAndId: Record<number, Record<number, number>> = {};

    const sortedStages = snap.stages.slice().sort((a, b) => (a.ordering ?? 0) - (b.ordering ?? 0));
    sortedStages.forEach((s, i) => {
      stageIdByIndex[i] = s.id;
      stageIndexById[s.id] = i;
    });

    const groupsByStageId: Record<number, DbGroup[]> = {};
    snap.groups.forEach((g) => {
      (groupsByStageId[g.stage_id] ??= []).push(g);
    });
    Object.entries(groupsByStageId).forEach(([sid, arr]) => {
      arr.sort((a, b) => (a.ordering ?? 0) - (b.ordering ?? 0) || a.name.localeCompare(b.name));
      const sIdx = stageIndexById[Number(sid)] ?? -1;
      groupIdByStage[sIdx] = {};
      groupIndexByStageAndId[Number(sid)] = {};
      arr.forEach((g, gi) => {
        groupIdByStage[sIdx][gi] = g.id;
        groupIndexByStageAndId[Number(sid)][g.id] = gi;
      });
    });

    // Fallback: if no groups present in snapshot (or incomplete), derive from matches
    const built = buildGroupIndexFallbackFromMatches(
      snap.matches ?? [],
      stageIndexById as Record<number, number>
    );
    Object.entries(built.groupIdByStage).forEach(([sIdxStr, m]) => {
      const sIdx = Number(sIdxStr);
      const dst = (groupIdByStage[sIdx] ??= {});
      Object.entries(m).forEach(([giStr, gid]) => {
        const gi = Number(giStr);
        if (dst[gi] == null) dst[gi] = gid;
      });
    });
    Object.entries(built.groupIndexByStageAndId).forEach(([sidStr, m]) => {
      const sid = Number(sidStr);
      const dst = (groupIndexByStageAndId[sid] ??= {});
      Object.entries(m).forEach(([gidStr, gi]) => {
        const gid = Number(gidStr);
        if (dst[gid] == null) dst[gid] = gi;
      });
    });

    const stagesById: Record<number, DbStage> = {};
    const groupsById: Record<number, DbGroup> = {};
    const teamsById: Record<number, DbTeam> = {};
    snap.stages.forEach((s) => (stagesById[s.id] = s));
    snap.groups.forEach((g) => (groupsById[g.id] = g));
    snap.teams.forEach((t) => (teamsById[t.id] = t));

    // Convert DB matches → DraftMatch + overlay (keep updated_at)
    const draftMatches: DraftMatch[] = [];
    const overlay: Record<string, DbOverlay> = {};
    for (const m of snap.matches) {
      const sIdx = stageIndexById[m.stage_id];
      if (sIdx == null) continue;
      let groupIdx: number | null = null;
      if (m.group_id != null) {
        const gi = groupIndexByStageAndId[m.stage_id]?.[m.group_id];
        if (typeof gi === "number") groupIdx = gi;
      }

      const uiRow: DraftMatch = {
        stageIdx: sIdx,
        groupIdx,
        round: m.round ?? null,
        bracket_pos: m.bracket_pos ?? null,
        matchday: m.matchday ?? (m.round == null ? null : null),
        match_date: m.match_date ?? null,
        team_a_id: m.team_a_id ?? null,
        team_b_id: m.team_b_id ?? null,
        home_source_round: m.home_source_round ?? null,
        home_source_bracket_pos: m.home_source_bracket_pos ?? null,
        away_source_round: m.away_source_round ?? null,
        away_source_bracket_pos: m.away_source_bracket_pos ?? null,
      };
      const sig = rowSignature(uiRow);
      overlay[sig] = {
        db_id: m.id ?? null,
        updated_at: m.updated_at ?? null,
        status: (m.status as any) ?? null,
        team_a_score: m.team_a_score ?? null,
        team_b_score: m.team_b_score ?? null,
        winner_team_id: m.winner_team_id ?? null,
        home_source_round: m.home_source_round ?? null,
        home_source_bracket_pos: m.home_source_bracket_pos ?? null,
        away_source_round: m.away_source_round ?? null,
        away_source_bracket_pos: m.away_source_bracket_pos ?? null,
      };
      draftMatches.push(uiRow);
    }

    set({
      entities: {
        tournament: snap.tournament,
        stagesById,
        groupsById,
        teamsById,
        tournamentTeams: snap.tournamentTeams.slice(),
        stageSlots: (snap.stageSlots?.slice() ?? []),
        intakeMappings: snap.intakeMappings?.slice() ?? [],
        standings: snap.standings?.slice() ?? [],
      },
      payload: null,
      draftMatches,
      dbOverlayBySig: overlay,
      ids: {
        tournamentId: snap.tournament.id,
        stageIdByIndex,
        stageIndexById,
        groupIdByStage,
        groupIndexByStageAndId,
      },
      dirty: {
        tournament: false,
        stages: false,
        groups: false,
        tournamentTeams: false,
        matches: new Set(),
        stageSlots: new Set(),
        intakeMappings: false,
        deletedStageIds: new Set(),
        deletedGroupIds: new Set(),
        deletedMatchIds: new Set(),
      },
      lastSnapshot: JSON.parse(JSON.stringify(snap)),
    });
  },

  // Backward-compat hydration (payload + matches)
  hydrateFromServer: (payload, dbMatches) => {
    const stageIdByIndex: Record<number, number | undefined> = {};
    const groupIdByStage: Record<number, Record<number, number | undefined>> = {};
    const stageIndexById: Record<number, number | undefined> = {};
    const groupIndexByStageAndId: Record<number, Record<number, number | undefined>> = {};

    // --- Build stage map from payload
    (payload.stages as any)?.forEach((s: any, i: number) => {
      if (typeof s?.id === "number") {
        stageIdByIndex[i] = s.id;
        stageIndexById[s.id] = i;
      }
      if (Array.isArray(s?.groups)) {
        groupIdByStage[i] = {};
        groupIndexByStageAndId[s.id ?? -1] = {};
        s.groups.forEach((g: any, gi: number) => {
          if (typeof g?.id === "number") {
            groupIdByStage[i][gi] = g.id;
            groupIndexByStageAndId[s.id ?? -1][g.id] = gi;
          }
        });
      }
    });

    // --- NEW: derive fallback group maps from actual DB matches and merge
    const built = buildGroupIndexFallbackFromMatches(
      dbMatches ?? [],
      stageIndexById as Record<number, number>
    );

    Object.entries(built.groupIdByStage).forEach(([sIdxStr, m]) => {
      const sIdx = Number(sIdxStr);
      const dst = (groupIdByStage[sIdx] ??= {});
      Object.entries(m).forEach(([giStr, gid]) => {
        const gi = Number(giStr);
        if (dst[gi] == null) dst[gi] = gid;
      });
    });

    Object.entries(built.groupIndexByStageAndId).forEach(([sidStr, m]) => {
      const sid = Number(sidStr);
      const dst = (groupIndexByStageAndId[sid] ??= {});
      Object.entries(m).forEach(([gidStr, gi]) => {
        const gid = Number(gidStr);
        if (dst[gid] == null) dst[gid] = gi;
      });
    });

    // Convert DB matches → DraftMatch + overlay
    const draftMatches: DraftMatch[] = [];
    const overlay: Record<string, DbOverlay> = {};
    (dbMatches ?? []).forEach((m) => {
      const sIdx = stageIndexById[m.stage_id ?? -1];
      if (!Number.isFinite(sIdx)) return;

      let groupIdx: number | null = null;
      if (m.group_id != null) {
        const gi = groupIndexByStageAndId[m.stage_id ?? -1]?.[m.group_id];
        if (typeof gi === "number") groupIdx = gi;
      }

      const uiRow: DraftMatch = {
        stageIdx: sIdx as number,
        groupIdx,
        round: m.round ?? null,
        bracket_pos: m.bracket_pos ?? null,
        matchday: m.matchday ?? (m.round == null ? null : null),
        match_date: m.match_date ?? null,
        team_a_id: m.team_a_id ?? null,
        team_b_id: m.team_b_id ?? null,
        home_source_round: m.home_source_round ?? null,
        home_source_bracket_pos: m.home_source_bracket_pos ?? null,
        away_source_round: m.away_source_round ?? null,
        away_source_bracket_pos: m.away_source_bracket_pos ?? null,
      };
      const sig = rowSignature(uiRow);
      overlay[sig] = {
        db_id: m.id ?? null,
        updated_at: (m as any).updated_at ?? null,
        status: (m.status as any) ?? null,
        team_a_score: m.team_a_score ?? null,
        team_b_score: m.team_b_score ?? null,
        winner_team_id: m.winner_team_id ?? null,
        home_source_round: m.home_source_round ?? null,
        home_source_bracket_pos: m.home_source_bracket_pos ?? null,
        away_source_round: m.away_source_round ?? null,
        away_source_bracket_pos: m.away_source_bracket_pos ?? null,
      };
      draftMatches.push(uiRow);
    });

    set((st) => ({
      ...st,
      payload,
      draftMatches,
      dbOverlayBySig: overlay,
      ids: {
        ...st.ids,
        tournamentId: (payload as any)?.tournament?.id,
        stageIdByIndex,
        stageIndexById,
        groupIdByStage,
        groupIndexByStageAndId,
      },
      dirty: {
        tournament: false,
        stages: false,
        groups: false,
        tournamentTeams: false,
        matches: new Set(),
        stageSlots: new Set(),
        intakeMappings: false,
        deletedStageIds: new Set(),
        deletedGroupIds: new Set(),
        deletedMatchIds: new Set(),
      },
    }));
  },

  resetUnsavedChanges: () => {
    const snap = get().lastSnapshot;
    if (snap) get().hydrateFromSnapshot(JSON.parse(JSON.stringify(snap)));
  },

  /* -------------------- Wizard seeding -------------------- */

  seedFromWizard: (canon, teams, drafts) => {
    const st = get();

    // 1) teams → entities
    const teamsById = { ...st.entities.teamsById };
    for (const t of teams ?? []) {
      if (t.id != null && !teamsById[t.id]) {
        teamsById[t.id] = { id: t.id, name: t.name ?? `Team #${t.id}`, logo: (t as any).logo ?? null, am: null };
      }
    }

    // 2) draft matches
    const nextDrafts = drafts.slice();
    const dirtyMatches = new Set<string>();
    const overlay = { ...st.dbOverlayBySig };

    nextDrafts.forEach((m) => {
      const sig = rowSignature(m);
      dirtyMatches.add(sig);
      const prev = overlay[sig] ?? {};
      overlay[sig] = {
        db_id: prev.db_id ?? null,
        updated_at: prev.updated_at ?? null,
        status: prev.status ?? "scheduled",
        team_a_score: prev.team_a_score ?? null,
        team_b_score: prev.team_b_score ?? null,
        winner_team_id: prev.winner_team_id ?? null,
        home_source_round: m.home_source_round ?? prev.home_source_round ?? null,
        home_source_bracket_pos: m.home_source_bracket_pos ?? prev.home_source_bracket_pos ?? null,
        away_source_round: m.away_source_round ?? prev.away_source_round ?? null,
        away_source_bracket_pos: m.away_source_bracket_pos ?? prev.away_source_bracket_pos ?? null,
      };
    });

    set({
      entities: { ...st.entities, teamsById },
      draftMatches: nextDrafts,
      dbOverlayBySig: overlay,
      dirty: { ...st.dirty, matches: dirtyMatches },
      payload: canon,
    });
  },

  /* -------------------- Entity mutators (+dirties) -------------------- */

  updateTournament: (patch) => {
    set((st) => ({
      entities: { ...st.entities, tournament: { ...(st.entities.tournament as any), ...patch } },
      dirty: { ...st.dirty, tournament: true },
    }));
  },

  upsertStage: (stageIdx, patch) => {
    const st = get();
    const order = stageOrderArray(st.ids.stageIdByIndex);
    const tournament_id = st.ids.tournamentId!;
    if (stageIdx == null || stageIdx < 0 || stageIdx > order.length) stageIdx = order.length;

    // existing?
    const existingId = st.ids.stageIdByIndex[stageIdx];
    if (existingId != null) {
      // patch existing
      const prev = st.entities.stagesById[existingId];
      const next: DbStage = {
        ...prev,
        name: patch.name ?? prev.name,
        kind: (patch.kind as any) ?? prev.kind,
        config: patch.config ?? prev.config,
        ordering: prev.ordering, // will be reindexed below
      };
      set((curr) => ({
        entities: { ...curr.entities, stagesById: { ...curr.entities.stagesById, [existingId]: next } },
        dirty: { ...curr.dirty, stages: true },
      }));
    } else {
      // create new with temp id
      const id = nextTempId();
      const next: DbStage = {
        id,
        tournament_id,
        name: patch.name ?? `Stage ${stageIdx + 1}`,
        kind: (patch.kind as any) ?? "league",
        config: patch.config ?? null,
        ordering: stageIdx,
      };

      // insert into order
      const newOrder = order.slice();
      newOrder.splice(stageIdx, 0, id);

      // rebuild maps + ordering on each stage
      const stagesById = { ...st.entities.stagesById, [id]: next };
      const stageIdByIndex: Record<number, number> = {};
      const stageIndexById: Record<number, number> = {};
      newOrder.forEach((sid, i) => {
        stageIdByIndex[i] = sid;
        stageIndexById[sid] = i;
        stagesById[sid] = { ...stagesById[sid], ordering: i };
      });

      set({
        entities: { ...st.entities, stagesById },
        ids: { ...st.ids, stageIdByIndex, stageIndexById },
        dirty: { ...st.dirty, stages: true },
      });
    }
  },

  removeStage: (stageIdx) => {
    const st = get();
    const order = stageOrderArray(st.ids.stageIdByIndex);
    if (stageIdx < 0 || stageIdx >= order.length) return;
    const removeId = st.ids.stageIdByIndex[stageIdx]!;
    const isPersisted = removeId > 0;

    // drop stage
    const stagesById = { ...st.entities.stagesById };
    delete stagesById[removeId];

    // drop groups under that stage
    const groupsById = { ...st.entities.groupsById };
    const removedGroupIds: number[] = [];
    Object.values(groupsById).forEach((g) => {
      if (g.stage_id === removeId) removedGroupIds.push(g.id);
    });
    removedGroupIds.forEach((gid) => delete groupsById[gid]);

    // rebuild stage order maps
    const newOrder = order.slice();
    newOrder.splice(stageIdx, 1);
    const stageIdByIndex: Record<number, number> = {};
    const stageIndexById: Record<number, number> = {};
    newOrder.forEach((sid, i) => {
      stageIdByIndex[i] = sid;
      stageIndexById[sid] = i;
      stagesById[sid] = { ...stagesById[sid], ordering: i };
    });

    // rebuild group maps for indices
    const groupIdByStage = { ...st.ids.groupIdByStage };
    delete groupIdByStage[stageIdx];
    // shift subsequent indices down by 1
    const shifted: Record<number, Record<number, number | undefined>> = {};
    Object.keys(groupIdByStage).forEach((k) => {
      const idx = Number(k);
      if (idx < stageIdx) shifted[idx] = groupIdByStage[idx];
      else if (idx > stageIdx) shifted[idx - 1] = groupIdByStage[idx];
    });

    // scrub matches/overlays for this stage
    const draftMatches = st.draftMatches.filter((m) => m.stageIdx !== stageIdx).map((m) => ({
      ...m,
      stageIdx: m.stageIdx! > stageIdx ? (m.stageIdx! - 1) : m.stageIdx,
    }));
    const overlay: Record<string, DbOverlay> = {};
    draftMatches.forEach((m) => {
      const sig = rowSignature(m);
      const prev = st.dbOverlayBySig[sig];
      if (prev) overlay[sig] = prev;
    });

    set((curr) => ({
      entities: {
        ...curr.entities,
        stagesById,
        groupsById,
      },
      ids: {
        ...curr.ids,
        stageIdByIndex,
        stageIndexById,
        groupIdByStage: shifted,
      },
      draftMatches,
      dbOverlayBySig: overlay,
      dirty: {
        ...curr.dirty,
        stages: true,
        groups: removedGroupIds.length ? true : curr.dirty.groups,
        matches: new Set<string>([...curr.dirty.matches]),
        deletedStageIds: isPersisted ? new Set([...curr.dirty.deletedStageIds, removeId]) : curr.dirty.deletedStageIds,
        deletedGroupIds: new Set([
          ...curr.dirty.deletedGroupIds,
          ...removedGroupIds.filter((x) => x > 0),
        ]),
      },
    }));
  },

  upsertGroup: (stageIdx, groupIdx, patch) => {
    const st = get();
    const stageId = st.ids.stageIdByIndex[stageIdx];
    if (stageId == null) return;

    const groupsForStage = Object.values(st.entities.groupsById)
      .filter((g) => g.stage_id === stageId)
      .sort((a, b) => (a.ordering ?? 0) - (b.ordering ?? 0));

    // existing?
    if (groupIdx != null && groupIdx >= 0 && groupIdx < groupsForStage.length) {
      const gid = groupsForStage[groupIdx].id;
      const prev = st.entities.groupsById[gid];
      const next: DbGroup = {
        ...prev,
        name: patch.name ?? prev.name,
        ordering: patch.ordering ?? prev.ordering ?? groupIdx,
      };
      set((curr) => ({
        entities: { ...curr.entities, groupsById: { ...curr.entities.groupsById, [gid]: next } },
        dirty: { ...curr.dirty, groups: true },
      }));
      return;
    }

    // create
    const id = nextTempId();
    const next: DbGroup = {
      id,
      stage_id: stageId,
      name: patch.name ?? `Group ${groupIdx != null ? groupIdx + 1 : groupsForStage.length + 1}`,
      ordering: patch.ordering ?? (groupIdx ?? groupsForStage.length),
    };

    const groupsById = { ...st.entities.groupsById, [id]: next };

    // update index maps for this stage
    const groupMap = { ...(st.ids.groupIdByStage[stageIdx] ?? {}) };
    const insertAt = groupIdx ?? Object.keys(groupMap).length;
    const arr = Object.keys(groupMap)
      .map((k) => Number(k))
      .sort((a, b) => a - b)
      .map((i) => groupMap[i]!);
    arr.splice(insertAt, 0, id);

    const newMap: Record<number, number> = {};
    arr.forEach((gid2, i) => (newMap[i] = gid2));

    const groupIdByStage = { ...st.ids.groupIdByStage, [stageIdx]: newMap };
    const groupIndexByStageAndId = { ...st.ids.groupIndexByStageAndId };
    groupIndexByStageAndId[stageId] = groupIndexByStageAndId[stageId] ?? {};
    arr.forEach((gid2, i) => (groupIndexByStageAndId[stageId][gid2] = i));

    set({
      entities: { ...st.entities, groupsById },
      ids: { ...st.ids, groupIdByStage, groupIndexByStageAndId },
      dirty: { ...st.dirty, groups: true },
    });
  },

  removeGroup: (stageIdx, groupIdx) => {
    const st = get();
    const stageId = st.ids.stageIdByIndex[stageIdx];
    if (stageId == null) return;

    const groupMap = { ...(st.ids.groupIdByStage[stageIdx] ?? {}) };
    const gid = groupMap[groupIdx];
    if (gid == null) return;
    const isPersisted = gid > 0;

    // remove group entity
    const groupsById = { ...st.entities.groupsById };
    delete groupsById[gid];

    // rebuild map
    const arr = Object.keys(groupMap)
      .map((k) => Number(k))
      .sort((a, b) => a - b)
      .map((i) => groupMap[i]!)
      .filter((x, i) => i !== groupIdx);

    const newMap: Record<number, number> = {};
    arr.forEach((id, i) => (newMap[i] = id));

    const groupIdByStage = { ...st.ids.groupIdByStage, [stageIdx]: newMap };

    // rebuild reverse
    const groupIndexByStageAndId = { ...st.ids.groupIndexByStageAndId };
    groupIndexByStageAndId[stageId] = groupIndexByStageAndId[stageId] ?? {};
    Object.keys(groupIndexByStageAndId[stageId]).forEach((k) => {
      if (Number(k) === gid) delete groupIndexByStageAndId[stageId][gid];
    });
    arr.forEach((id, i) => (groupIndexByStageAndId[stageId][id] = i));

    // remove matches for this group
    const draftMatches = st.draftMatches.filter(
      (m) => !(m.stageIdx === stageIdx && m.groupIdx === groupIdx)
    ).map((m) =>
      m.stageIdx === stageIdx && typeof m.groupIdx === "number" && m.groupIdx > groupIdx
        ? { ...m, groupIdx: (m.groupIdx as number) - 1 }
        : m
    );

    const overlay: Record<string, DbOverlay> = {};
    draftMatches.forEach((m) => {
      const sig = rowSignature(m);
      const prev = st.dbOverlayBySig[sig];
      if (prev) overlay[sig] = prev;
    });

    set((curr) => ({
      entities: { ...curr.entities, groupsById },
      ids: { ...curr.ids, groupIdByStage, groupIndexByStageAndId },
      draftMatches,
      dbOverlayBySig: overlay,
      dirty: {
        ...curr.dirty,
        groups: true,
        matches: new Set([...curr.dirty.matches]),
        deletedGroupIds: isPersisted
          ? new Set([...curr.dirty.deletedGroupIds, gid])
          : curr.dirty.deletedGroupIds,
      },
    }));
  },

  setTournamentTeamSeed: (teamId, seed) => {
    set((st) => {
      const tid = st.ids.tournamentId!;
      const arr = st.entities.tournamentTeams.slice();
      const idx = arr.findIndex((tt) => tt.tournament_id === tid && tt.team_id === teamId);
      if (idx >= 0) arr[idx] = { ...arr[idx], seed };
      else arr.push({ id: nextTempId(), tournament_id: tid, team_id: teamId, seed: seed ?? null });
      return { entities: { ...st.entities, tournamentTeams: arr }, dirty: { ...st.dirty, tournamentTeams: true } };
    });
  },

  assignTeamToGroup: (teamId, stageId, groupId) => {
    set((st) => {
      const tid = st.ids.tournamentId!;
      const arr = st.entities.tournamentTeams.slice();
      const idx = arr.findIndex((tt) => tt.tournament_id === tid && tt.team_id === teamId);
      if (idx >= 0) arr[idx] = { ...arr[idx], stage_id: stageId, group_id: groupId };
      else arr.push({ id: nextTempId(), tournament_id: tid, team_id: teamId, stage_id: stageId, group_id: groupId });
      return { entities: { ...st.entities, tournamentTeams: arr }, dirty: { ...st.dirty, tournamentTeams: true } };
    });
  },

  /* -------------------- Matches (editor) -------------------- */

  replaceAllDraftMatches: (next) => {
    set((st) => {
      const nextArr = next.slice();
      const dirty = new Set(st.dirty.matches);
      nextArr.forEach((m) => dirty.add(rowSignature(m)));
      return { draftMatches: nextArr, dirty: { ...st.dirty, matches: dirty } };
    });
  },

  updateMatches: (stageIdx, updater) => {
    set((st) => {
      const before = st.draftMatches;
      const sameStage = before.filter((m) => m.stageIdx === stageIdx);
      const others = before.filter((m) => m.stageIdx !== stageIdx);

      const updated = updater(sameStage.slice());
      wireKnockoutSourcesLocal(updated, stageIdx);

      const dirty = new Set(st.dirty.matches);
      updated.forEach((m) => dirty.add(rowSignature(m)));

      return { draftMatches: [...others, ...updated], dirty: { ...st.dirty, matches: dirty } };
    });
  },

  // NEW: remove a single match (track deletion by DB id if present)
  removeMatch: (row) => set((curr) => {
    const sig = rowSignature(row);
    const ov = curr.dbOverlayBySig[sig];
    const dbId = ov?.db_id ?? null;
    console.log('[delete-debug] Removing match:', { sig, dbId, row }); // Log before removal
  
    const nextMatches = curr.draftMatches.filter(m => rowSignature(m) !== sig);
    const nextOverlay = { ...curr.dbOverlayBySig };
    delete nextOverlay[sig];
    const nextDirty = new Set(curr.dirty.matches);
    nextDirty.delete(sig);
  
    const nextDeleted = new Set([...(curr.dirty.deletedMatchIds ?? [])]);
    if (typeof dbId === 'number' && dbId > 0) {
      nextDeleted.add(dbId);
      console.log('[delete-debug] Added to deletedMatchIds:', dbId); // Confirm addition
    }
  
    return {
      draftMatches: nextMatches,
      dbOverlayBySig: nextOverlay,
      dirty: {
        ...curr.dirty,
        matches: nextDirty,
        deletedMatchIds: nextDeleted,
      },
    };
  }),

  setKOLink: (stageIdx, child, side, parent, outcome = "W") => {
    get().updateMatches(stageIdx, (rows) => {
      const next = rows.slice();
      const idx = next.findIndex(
        (r) => r.round === child.round && r.bracket_pos === child.bracket_pos
      );
      if (idx < 0) return next;
      const row = { ...next[idx] };
      if (parent) {
        if (side === "home") {
          row.home_source_round = parent.round;
          row.home_source_bracket_pos = parent.bracket_pos;
          (row as any).home_source_outcome = outcome;
          row.team_a_id = null;
        } else {
          row.away_source_round = parent.round;
          row.away_source_bracket_pos = parent.bracket_pos;
          (row as any).away_source_outcome = outcome;
          row.team_b_id = null;
        }
      } else {
        if (side === "home") {
          row.home_source_round = null;
          row.home_source_bracket_pos = null;
          (row as any).home_source_outcome = undefined;
        } else {
          row.away_source_round = null;
          row.away_source_bracket_pos = null;
          (row as any).away_source_outcome = undefined;
        }
      }
      next[idx] = row;
      return next;
    });
  },

  setKOTeams: (stageIdx, where, teamAId, teamBId) => {
    get().updateMatches(stageIdx, (rows) => {
      const next = rows.slice();
      const idx = next.findIndex(
        (r) => r.round === where.round && r.bracket_pos === where.bracket_pos
      );
      if (idx < 0) return next;
      const row = { ...next[idx] };
      const hasParents =
        (row.home_source_round && row.home_source_bracket_pos) ||
        (row.away_source_round && row.away_source_bracket_pos);
      if (!hasParents) {
        row.team_a_id = teamAId ?? null;
        row.team_b_id = teamBId ?? null;
      }
      next[idx] = row;
      return next;
    });
  },

  setKORoundPos: (stageIdx, from, to) => {
    get().updateMatches(stageIdx, (rows) => {
      const next = rows.slice();
      const i = next.findIndex((r) => r.round === from.round && r.bracket_pos === from.bracket_pos);
      if (i < 0) return next;
      const j = next.findIndex((r) => r.round === to.round && r.bracket_pos === to.bracket_pos);
      if (j >= 0) {
        const a = { ...next[i] };
        const b = { ...next[j] };
        const [r1, p1] = [a.round, a.bracket_pos];
        a.round = b.round; a.bracket_pos = b.bracket_pos;
        b.round = r1;      b.bracket_pos = p1;
        next[i] = b; next[j] = a;
      } else {
        const row = { ...next[i] };
        row.round = to.round; row.bracket_pos = to.bracket_pos;
        next[i] = row;
      }
      return next;
    });
  },

  reindexKOPointers: (stageIdx) => {
    set((st) => ({ draftMatches: wireKnockoutSourcesLocal(st.draftMatches.slice(), stageIdx) }));
  },

  setUIKnockoutLayout: (stageIdx, koKey, frame) => {
    set((st) => ({
      ui: {
        ...st.ui,
        knockoutLayout: {
          ...st.ui.knockoutLayout,
          [stageIdx]: {
            ...(st.ui.knockoutLayout[stageIdx] ?? {}),
            [koKey]: frame,
          },
        },
      },
    }));
  },

  /* -------------------- Intake & slots -------------------- */

  setStageSlotByIndex: (
    stageIdx: number,
    groupIdx: number,
    slotId: number,
    teamId: number | null,
    source: "manual" | "intake" = "manual",
  ) => {
    const stage_id = get().ids.stageIdByIndex[stageIdx];
    if (stage_id == null) return;

    set((st) => {
      const slots = st.entities.stageSlots.slice();
      const idx = slots.findIndex(
        (s) => s.stage_id === stage_id && s.group_id === groupIdx && s.slot_id === slotId
      );

      const prevUpdatedAt = idx >= 0 ? slots[idx].updated_at : undefined;

      const nextRow: DbStageSlot = {
        stage_id,
        group_id: groupIdx,
        slot_id: slotId,
        team_id: teamId ?? null,
        source,                    // <- correctly typed "manual" | "intake"
        updated_at: prevUpdatedAt, // keep timestamp for guarded update
      };

      if (idx >= 0) slots[idx] = nextRow;
      else slots.push(nextRow);

      const key = `${stage_id}|${groupIdx}|${slotId}`;
      const dirty = new Set(st.dirty.stageSlots);
      dirty.add(key);

      return {
        entities: { ...st.entities, stageSlots: slots },
        dirty: { ...st.dirty, stageSlots: dirty },
      };
    });
  },

  upsertIntakeMapping: (m) => {
    set((st) => {
      const arr = st.entities.intakeMappings.slice();
      const idx = arr.findIndex(
        (x) =>
          x.target_stage_id === m.target_stage_id &&
          x.group_idx === m.group_idx &&
          x.slot_idx === m.slot_idx
      );
      if (idx >= 0) arr[idx] = { ...arr[idx], ...m };
      else arr.push({ ...m });
      return { entities: { ...st.entities, intakeMappings: arr }, dirty: { ...st.dirty, intakeMappings: true } };
    });
  },

  removeIntakeMapping: (predicate) => {
    set((st) => ({
      entities: { ...st.entities, intakeMappings: st.entities.intakeMappings.filter((m) => !predicate(m)) },
      dirty: { ...st.dirty, intakeMappings: true },
    }));
  },

  /* -------------------- Persist (now with tournament/stages/groups/TT) -------------------- */

  saveAll: async () => {
    const doPost = async (tid: number, payload: any) => {
      const res = await fetch(`/api/tournaments/${tid}/save-all`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify(payload),
      });
  
      if (res.status === 409) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Some items are stale (409). Reload or force overwrite.");
      }
  
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `Save failed (${res.status})`);
      }
  
      return (await res.json()) as {
        tournament?: DbTournament;
        stages?: DbStage[];
        deletedStageIds?: number[];
        groups?: DbGroup[];
        deletedGroupIds?: number[];
        tournamentTeams?: DbTournamentTeam[];
        stageSlots?: DbStageSlot[];
        intakeMappings?: DbIntakeMapping[];
        matches?: (DbMatchRow & { updated_at?: string | null })[];
      };
    };
  
    const st0 = get();
    const tid = st0.ids.tournamentId;
    if (!tid) return;
  
    // Fast exit if nothing is dirty at all
    const nothingPhase1 =
      !st0.dirty.tournament && !st0.dirty.stages && st0.dirty.deletedStageIds.size === 0;
    const nothingPhase2 =
      !st0.dirty.groups && st0.dirty.deletedGroupIds.size === 0;
    const nothingPhase3 = !st0.dirty.tournamentTeams;
    const nothingPhase4 =
      st0.dirty.matches.size === 0 &&
      st0.dirty.stageSlots.size === 0 &&
      !st0.dirty.intakeMappings &&
      st0.dirty.deletedMatchIds.size === 0; // include deletions
  
    if (nothingPhase1 && nothingPhase2 && nothingPhase3 && nothingPhase4) return;
  
    set({ busy: true });
    try {
      /* -------- PHASE 1: tournament + stages (and stage deletions) -------- */
      const before_stageIndexById = { ...(get().ids.stageIndexById as any) } as Record<number, number | undefined>;
      let payload1: any = {};
      const st1 = get();
  
      if (st1.dirty.tournament) {
        const t = st1.entities.tournament!;
        payload1.tournament = {
          patch: {
            name: t.name,
            slug: t.slug,
            season: t.season ?? null,
            format: t.format,
          },
        };
      }
  
      if (st1.dirty.stages || st1.dirty.deletedStageIds.size) {
        const order = stageOrderArray(st1.ids.stageIdByIndex);
        const upsert = order.map((sid, i) => {
          const s = st1.entities.stagesById[sid];
          const row: any = {
            ...(sid > 0 ? { id: sid } : {}),
            name: s.name,
            kind: s.kind,
            ordering: i,
            config: s.config ?? null,
          };
          return row;
        });
        const deleteIds =
          st1.dirty.deletedStageIds.size > 0
            ? Array.from(st1.dirty.deletedStageIds).filter((x) => x > 0)
            : [];
  
        payload1 = {
          ...payload1,
          ...(upsert.length || deleteIds.length
            ? { stages: { ...(upsert.length ? { upsert } : {}), ...(deleteIds.length ? { deleteIds } : {}) } }
            : {}),
        };
      }
  
      if (payload1.tournament || payload1.stages) {
        const resp1 = await doPost(tid, payload1);
  
        // reconcile tournament
        if (resp1.tournament) {
          set((curr) => ({
            entities: { ...curr.entities, tournament: resp1.tournament! },
          }));
        }
  
        // reconcile stages + index maps
        if (resp1.stages) {
          const stagesArr = resp1.stages.slice().sort((a, b) => (a.ordering ?? 0) - (b.ordering ?? 0));
          const stagesById: Record<number, DbStage> = {};
          const stageIdByIndex: Record<number, number> = {};
          const stageIndexById: Record<number, number> = {};
          stagesArr.forEach((s, i) => {
            stagesById[s.id] = s;
            stageIdByIndex[i] = s.id;
            stageIndexById[s.id] = i;
          });
  
          set((curr) => ({
            entities: { ...curr.entities, stagesById },
            ids: { ...curr.ids, stageIdByIndex, stageIndexById },
            dirty: { ...curr.dirty, tournament: false, stages: false, deletedStageIds: new Set() },
          }));
  
          // After stage IDs change, translate temp stage IDs used anywhere (e.g. tournamentTeams)
          // Build stage temp→db map from BEFORE indices → AFTER ordered ids
          const after_stageIdByIndex = get().ids.stageIdByIndex as Record<number, number>;
          const stageIdMap: Record<number, number> = {};
          Object.entries(before_stageIndexById).forEach(([oldIdStr, idx]) => {
            const oldId = Number(oldIdStr);
            if (typeof idx === "number") {
              const newId = after_stageIdByIndex[idx];
              if (newId) stageIdMap[oldId] = newId;
            }
          });
  
          // Rewrite tournamentTeams.stage_id for any negative (temp) ids
          set((curr) => {
            const tt = curr.entities.tournamentTeams.slice().map((row) => {
              const sid = row.stage_id ?? null;
              if (sid != null && stageIdMap[sid!]) {
                return { ...row, stage_id: stageIdMap[sid!] };
              }
              return row;
            });
            return { entities: { ...curr.entities, tournamentTeams: tt } };
          });
        }
      }
  
      /* -------- PHASE 2: groups (and group deletions) -------- */
      const before_groupIndexByStageAndId = JSON.parse(
        JSON.stringify(get().ids.groupIndexByStageAndId)
      ) as Record<number, Record<number, number | undefined>>;
  
      let payload2: any = {};
      const st2 = get();
  
      if (st2.dirty.groups || st2.dirty.deletedGroupIds.size) {
        // Build upsert from current group maps (index → id)
        const upsert: any[] = [];
        const deleteIds =
          st2.dirty.deletedGroupIds.size > 0
            ? Array.from(st2.dirty.deletedGroupIds).filter((x) => x > 0)
            : [];
  
        Object.keys(st2.ids.groupIdByStage)
          .map((k) => Number(k))
          .sort((a, b) => a - b)
          .forEach((stageIdx) => {
            const stageId = st2.ids.stageIdByIndex[stageIdx]!;
            const groupMap = st2.ids.groupIdByStage[stageIdx] ?? {};
            const orderedGroupIds = Object.keys(groupMap)
              .map((k) => Number(k))
              .sort((a, b) => a - b)
              .map((gi) => groupMap[gi]!);
  
            orderedGroupIds.forEach((gid, i) => {
              const g = st2.entities.groupsById[gid];
              if (!g) return;
              const row: any = {
                ...(gid > 0 ? { id: gid } : {}),
                stage_id: stageId,
                name: g.name,
                ordering: i,
              };
              upsert.push(row);
            });
          });
  
        if (upsert.length || deleteIds.length) {
          payload2.groups = {
            ...(upsert.length ? { upsert } : {}),
            ...(deleteIds.length ? { deleteIds } : {}),
          };
        }
      }
  
      if (payload2.groups) {
        const resp2 = await doPost(tid, payload2);
  
        if (resp2.groups) {
          // Rebuild groupsById and index maps from authoritative groups
          const groupsById: Record<number, DbGroup> = {};
          (resp2.groups as DbGroup[]).forEach((g: DbGroup) => {
            groupsById[g.id] = g;
          });
  
          const stageIndexByIdAfter = get().ids.stageIndexById as Record<number, number>;
          const groupIdByStage: Record<number, Record<number, number>> = {};
          const groupIndexByStageAndId: Record<number, Record<number, number>> = {};
  
          // group rows grouped by stage, sorted by ordering
          const byStage: Record<number, DbGroup[]> = {};
          Object.values(groupsById).forEach((g: DbGroup) => {
            (byStage[g.stage_id] ??= []).push(g);
          });
  
          Object.entries(byStage).forEach(([stageIdStr, arr]) => {
            const stageId = Number(stageIdStr);
            arr.sort(
              (a, b) => (a.ordering ?? 0) - (b.ordering ?? 0) || a.name.localeCompare(b.name)
            );
            const sIdx = stageIndexByIdAfter[stageId] ?? -1;
            const mapIdxToId: Record<number, number> = {};
            const rev: Record<number, number> = {};
            arr.forEach((g, gi) => {
              mapIdxToId[gi] = g.id;
              rev[g.id] = gi;
            });
            if (sIdx >= 0) groupIdByStage[sIdx] = mapIdxToId;
            groupIndexByStageAndId[stageId] = rev;
          });
  
          set((curr) => ({
            entities: { ...curr.entities, groupsById },
            ids: { ...curr.ids, groupIdByStage, groupIndexByStageAndId },
            dirty: { ...curr.dirty, groups: false, deletedGroupIds: new Set() },
          }));
  
          // Build mapping oldGroupId -> newGroupId per stage using BEFORE indices → AFTER ids
          const after_groupIdByStage = get().ids.groupIdByStage as Record<number, Record<number, number>>;
          const stageIndexByIdBefore = before_stageIndexById; // still available
  
          const groupIdMapByOldStage: Record<number, Record<number, number>> = {};
          Object.entries(before_groupIndexByStageAndId).forEach(([stageOldIdStr, groupOldMap]) => {
            const stageOldId = Number(stageOldIdStr);
            const idx = stageIndexByIdBefore[stageOldId];
            if (typeof idx !== "number") return;
            const newGroupIdsForIdx = after_groupIdByStage[idx] ?? {};
            const inner: Record<number, number> = {};
            Object.entries(groupOldMap).forEach(([groupOldIdStr, groupIdx]) => {
              const oldGid = Number(groupOldIdStr);
              if (typeof groupIdx === "number") {
                const newGid = newGroupIdsForIdx[groupIdx];
                if (newGid) inner[oldGid] = newGid;
              }
            });
            groupIdMapByOldStage[stageOldId] = inner;
          });
  
          // Translate tournamentTeams.group_id for any negative (temp) ids, using old-stage id to resolve index
          set((curr) => {
            const tt = curr.entities.tournamentTeams.slice().map((row) => {
              let { stage_id, group_id } = row;
  
              if (group_id != null && group_id < 0) {
                const mapA = groupIdMapByOldStage[stage_id as number];
                if (mapA && mapA[group_id]) {
                  group_id = mapA[group_id];
                } else if (stage_id && stage_id > 0) {
                  const giBefore = before_groupIndexByStageAndId[stage_id]?.[group_id];
                  if (typeof giBefore === "number") {
                    const sIdx = (get().ids.stageIndexById as any)[stage_id];
                    const newId = sIdx != null ? (get().ids.groupIdByStage as any)[sIdx]?.[giBefore] : undefined;
                    if (newId) group_id = newId;
                  }
                }
              }
              return { ...row, stage_id, group_id };
            });
            return { entities: { ...curr.entities, tournamentTeams: tt } };
          });
        }
      }
  
      /* -------- PHASE 3: tournamentTeams -------- */
      const st3 = get();
      if (st3.dirty.tournamentTeams) {
        const upsert = st3.entities.tournamentTeams.map((tt) => {
          const row: any = {
            ...(tt.id > 0 ? { id: tt.id } : {}),
            tournament_id: st3.ids.tournamentId,
            team_id: tt.team_id,
            stage_id: tt.stage_id ?? null,
            group_id: tt.group_id ?? null,
            seed: tt.seed ?? null,
          };
          return row;
        });
  
        const resp3 = await doPost(tid, { tournamentTeams: { upsert } });
  
        if (resp3.tournamentTeams) {
          set((curr) => ({
            entities: { ...curr.entities, tournamentTeams: resp3.tournamentTeams! },
            dirty: { ...curr.dirty, tournamentTeams: false },
          }));
        }
      }
  
      /* -------- PHASE 4: matches / stageSlots / intakeMappings -------- */
      const st4 = get();
      const payload4: any = {};
  
      // stage slots
      if (st4.dirty.stageSlots.size) {
        const changedKeys = new Set(st4.dirty.stageSlots);
        const rows = st4.entities.stageSlots.filter((s) =>
          changedKeys.has(`${s.stage_id}|${s.group_id}|${s.slot_id}`)
        );
        payload4.stageSlots = {
          upsert: rows.map((r) => ({
            stage_id: r.stage_id,
            group_id: r.group_id,
            slot_id: r.slot_id,
            team_id: r.team_id ?? null,
            source: r.source ?? "manual",
            updated_at: r.updated_at,
          })),
        };
      }
  
      // intake mappings
      if (st4.dirty.intakeMappings) {
        payload4.intakeMappings = {
          replace: st4.entities.intakeMappings.slice(),
        };
      }
  
      // matches deletions (ALWAYS include if present)
      const delIds = Array.from(st4.dirty.deletedMatchIds ?? []);
      if (delIds.length) {
        payload4.matches = { ...(payload4.matches || {}), deleteIds: delIds };
      }
  
      // matches upserts (only dirty signatures)
      if (st4.dirty.matches.size) {
        const upserts: DbMatchRow[] = [];
        const dirtySigs = new Set(st4.dirty.matches);
  
        for (const r of st4.draftMatches) {
          const sig = rowSignature(r);
          if (!dirtySigs.has(sig)) continue;
  
          const ov = st4.dbOverlayBySig[sig] || {};
          const stageId = st4.ids.stageIdByIndex[r.stageIdx ?? -1];
          if (typeof stageId !== "number") continue;
  
          const groupId =
            r.groupIdx != null
              ? st4.ids.groupIdByStage[r.stageIdx ?? -1]?.[r.groupIdx] ?? null
              : null;
  
          upserts.push({
            id: (ov as any).db_id ?? null,
            stage_id: stageId,
            group_id: groupId ?? null,
            team_a_id: r.team_a_id ?? null,
            team_b_id: r.team_b_id ?? null,
            team_a_score: (ov as any).team_a_score ?? null,
            team_b_score: (ov as any).team_b_score ?? null,
            winner_team_id: (ov as any).winner_team_id ?? null,
            status: (ov as any).status ?? "scheduled",
            match_date: r.match_date ?? null,
            matchday: r.matchday ?? null,
            round: r.round ?? null,
            bracket_pos: r.bracket_pos ?? null,
            home_source_round: r.home_source_round ?? null,
            home_source_bracket_pos: r.home_source_bracket_pos ?? null,
            away_source_round: r.away_source_round ?? null,
            away_source_bracket_pos: r.away_source_bracket_pos ?? null,
            updated_at: (ov as any).updated_at ?? null,
          });
        }
  
        if (upserts.length) {
          payload4.matches = { ...(payload4.matches || {}), upsert: upserts };
        }
      }
  
      if (payload4.stageSlots || payload4.intakeMappings || payload4.matches) {
        const resp4 = await doPost(tid, payload4);
        console.log('[save-debug] Sending payload4 to server:', JSON.stringify(payload4, null, 2));
        // StageSlots reconcile
        if (resp4.stageSlots) {
          const affectedStages = new Set(resp4.stageSlots.map((s) => s.stage_id));
          set((curr) => {
            const kept = curr.entities.stageSlots.filter((s) => !affectedStages.has(s.stage_id));
            return {
              entities: { ...curr.entities, stageSlots: [...kept, ...resp4.stageSlots!] },
            };
          });
        }
  
        // IntakeMappings reconcile
        if (resp4.intakeMappings) {
          set((curr) => ({
            entities: { ...curr.entities, intakeMappings: resp4.intakeMappings! },
          }));
        }
  
        // Matches reconcile (overlay)
        if (resp4.matches) {
          const st2 = get();
          const overlay = { ...st2.dbOverlayBySig };
          for (const m of resp4.matches) {
            const stageIdx = (st2.ids.stageIndexById as any)[m.stage_id] ?? -1;
            const groupIdx =
              m.group_id != null
                ? (st2.ids.groupIndexByStageAndId as any)[m.stage_id]?.[m.group_id] ?? null
                : null;
  
            const uiSig = rowSignature({
              stageIdx,
              groupIdx,
              round: m.round ?? null,
              bracket_pos: m.bracket_pos ?? null,
              matchday: m.matchday ?? null,
              match_date: m.match_date ?? null,
              team_a_id: m.team_a_id ?? null,
              team_b_id: m.team_b_id ?? null,
              home_source_round: m.home_source_round ?? null,
              home_source_bracket_pos: m.home_source_bracket_pos ?? null,
              away_source_round: m.away_source_round ?? null,
              away_source_bracket_pos: m.away_source_bracket_pos ?? null,
            } as DraftMatch);
  
            const prev = overlay[uiSig] ?? {};
            overlay[uiSig] = {
              ...prev,
              db_id: m.id ?? null,
              updated_at: m.updated_at ?? null,
              status: (m.status as any) ?? prev.status,
              team_a_score: m.team_a_score ?? prev.team_a_score ?? null,
              team_b_score: m.team_b_score ?? prev.team_b_score ?? null,
              winner_team_id: m.winner_team_id ?? prev.winner_team_id ?? null,
              home_source_round: m.home_source_round ?? prev.home_source_round ?? null,
              home_source_bracket_pos: m.home_source_bracket_pos ?? prev.home_source_bracket_pos ?? null,
              away_source_round: m.away_source_round ?? prev.away_source_round ?? null,
              away_source_bracket_pos: m.away_source_bracket_pos ?? prev.away_source_bracket_pos ?? null,
            };
          }
          set({ dbOverlayBySig: overlay });
        }
  
        // clear phase-4 dirties
        set((curr) => ({
          dirty: {
            ...curr.dirty,
            matches: new Set(),
            stageSlots: new Set(),
            intakeMappings: false,
            deletedMatchIds: new Set(), // clear deletions after success
          },
        }));
      }
    } finally {
      set({ busy: false });
    }
  }}));
    
/* =========================================================
   Convenience hooks (unchanged in API surface; fixed KO check)
   ========================================================= */
export function useStageKO(stageIdx: number) {
  const rows = useTournamentStore((s) => s.selectStageRows(stageIdx));
  const isKO = (() => {
    const st = useTournamentStore.getState();
    const sid = st.ids.stageIdByIndex[stageIdx];
    return !!(sid && st.entities.stagesById[sid]?.kind === "knockout");
  })();
  return isKO ? rows.slice().sort(sortKO) : [];
}

export function useKOLayout(stageIdx: number, where: KOCoord) {
  const key = makeKoKey(where);
  const frame = useTournamentStore((s) => s.ui.knockoutLayout[stageIdx]?.[key]);
  const setFrame = (f: Frame) => useTournamentStore.getState().setUIKnockoutLayout(stageIdx, key, f);
  return [frame, setFrame] as const;
}

export function mergeOverlay(row: DraftMatch) {
  const ov = useTournamentStore.getState().dbOverlayBySig[rowSignature(row)];
  return ov ? ({ ...row, ...ov } as DraftMatch & DbOverlay) : row;
}
