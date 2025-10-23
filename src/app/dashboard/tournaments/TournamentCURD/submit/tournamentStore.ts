
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
  stage_id?: number | null;
  group_id?: number | null;
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
  group_id: number | null;
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
  home_source_round?: number | null;
  home_source_bracket_pos?: number | null;
  away_source_round?: number | null;
  away_source_bracket_pos?: number | null;
  home_source_outcome?: "W" | "L" | null;
  away_source_outcome?: "W" | "L" | null;
  updated_at?: string | null; // concurrency (server checks if provided)
};

/* Adds explicit row type used when merging overlays with draft rows */
export type MatchRow = {
  db_id?: number | null;
  stageIdx: number;
  groupIdx?: number | null;
  matchday?: number | null;
  round?: number | null;
  bracket_pos?: number | null;
  match_date?: string | null;
  team_a_id?: number | null;
  team_b_id?: number | null;
  status?: "scheduled" | "finished" | null;
  team_a_score?: number | null;
  team_b_score?: number | null;
  winner_team_id?: number | null;
  updated_at?: string | null;
  home_source_round?: number | null;
  home_source_bracket_pos?: number | null;
  away_source_round?: number | null;
  away_source_bracket_pos?: number | null;
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
> & {
  db_id?: number | null;
  updated_at?: string | null;
  home_source_outcome?: "W" | "L" | null;
  away_source_outcome?: "W" | "L" | null;
};

type KOCoord = { round: number; bracket_pos: number };
type Frame = { x: number; y: number; w: number; h: number };
type LayoutByKoKey = Record<string, Frame>; // KO|{round}|{bracket_pos}

/* =========================================================
   Utilities
   ========================================================= */

let __tmpId = -1;
const nextTempId = (): number => __tmpId--; // negative client-only IDs

// Legacy UI signature (includes date)
function rowSignature(m: DraftMatch): string {
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

// Stable key for overlay/dirty (ignores match_date)
function _pairKey(a?: number | null, b?: number | null): string {
  const x = a ?? 0, y = b ?? 0;
  return x < y ? `${x}-${y}` : `${y}-${x}`;
}
function rowSignatureStable(m: DraftMatch): string {
  if (m.round != null && m.bracket_pos != null) {
    return `KO|S${m.stageIdx ?? -1}|R${m.round}|B${m.bracket_pos}`;
  }
  const g = m.groupIdx ?? -1;
  const md = m.matchday ?? 0;
  const pair = _pairKey(m.team_a_id, m.team_b_id);
  return `RR|S${m.stageIdx ?? -1}|G${g}|MD${md}|${pair}`;
}

// Structural prefix (no teams/date). Used to find persisted row id for deletes.
function rowStructuralPrefix(m: DraftMatch): string {
  if (m.round != null && m.bracket_pos != null) {
    return `KO|S${m.stageIdx ?? -1}|R${m.round}|B${m.bracket_pos}`;
  }
  const g = m.groupIdx ?? -1;
  const md = m.matchday ?? 0;
  const pair = _pairKey(m.team_a_id, m.team_b_id);  // Add this!
  return `RR|S${m.stageIdx ?? -1}|G${g}|MD${md}|${pair}`;
}

/* ---------- DB-stable signatures (by stage_id/group_id) ---------- */
function rowSignatureDB(m: DraftMatch, st = useTournamentStore.getState()): string {
  const stage_id = st.ids.stageIdByIndex[m.stageIdx ?? -1];
  if (m.round != null && m.bracket_pos != null) {
    return `KO_DB|S${stage_id}|R${m.round}|B${m.bracket_pos}`;
  }
  const group_id =
    m.groupIdx != null ? st.ids.groupIdByStage[m.stageIdx ?? -1]?.[m.groupIdx] ?? "n" : "n";
  const md = m.matchday ?? 0;
  const pair = _pairKey(m.team_a_id, m.team_b_id);
  return `RR_DB|S${stage_id}|G${group_id}|MD${md}|${pair}`;
}
function rowStructuralPrefixDB(m: DraftMatch, st = useTournamentStore.getState()): string {
  const stage_id = st.ids.stageIdByIndex[m.stageIdx ?? -1];
  if (m.round != null && m.bracket_pos != null) {
    return `KO_DB|S${stage_id}|R${m.round}|B${m.bracket_pos}`;
  }
  const group_id =
    m.groupIdx != null ? st.ids.groupIdByStage[m.stageIdx ?? -1]?.[m.groupIdx] ?? "n" : "n";
  const md = m.matchday ?? 0;
  return `RR_DB|S${stage_id}|G${group_id}|MD${md}|`;
}
function findOverlayByPrefix(overlay: Record<string, any>, prefix: string) {
  const entry = Object.entries(overlay).find(([k]) => k.startsWith(prefix));
  return entry?.[1];
}

// Fallback finder for legacy keys that differ only by match_date
function findOverlayLoose(overlay: Record<string, any>, legacySig: string) {
  if (overlay[legacySig]) return overlay[legacySig];
  const cut = legacySig.lastIndexOf("|");
  if (cut > 0) {
    const prefix = legacySig.slice(0, cut + 1);
    const entry = Object.entries(overlay).find(([k]) => k.startsWith(prefix));
    if (entry) return entry[1];
  }
  return undefined;
}

function makeKoKey(m: { round?: number | null; bracket_pos?: number | null }): string {
  return `KO|${m.round ?? 0}|${m.bracket_pos ?? 0}`;
}
function sortKO(a: DraftMatch, b: DraftMatch): number {
  return (a.round ?? 0) - (b.round ?? 0) || (a.bracket_pos ?? 0) - (b.bracket_pos ?? 0);
}
function wireKnockoutSourcesLocal(rows: DraftMatch[], stageIdx: number): DraftMatch[] {
  const same = rows
    .filter((m) => m.stageIdx === stageIdx && m.round != null && m.bracket_pos != null)
    .slice()
    .sort(sortKO);

  const key = (r?: number | null, p?: number | null) => (r && p ? `${r}:${p}` : "");
  const idxOf = new Map<string, number>();
  same.forEach((m: DraftMatch, i: number) => idxOf.set(key(m.round ?? null, m.bracket_pos ?? null), i));

  same.forEach((m: DraftMatch) => {
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
function stageOrderArray(map: Record<number, number | undefined>): number[] {
  return Object.keys(map)
    .map((k) => Number(k))
    .sort((a: number, b: number) => a - b)
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

  const seen: Record<number, Map<number, number>> = {};
  for (const m of dbMatches) {
    const sid = m.stage_id ?? undefined;
    const gid = m.group_id ?? undefined;
    if (!sid || !gid) continue;
    const sMap = (seen[sid] ??= new Map());
    if (!sMap.has(gid)) sMap.set(gid, sMap.size);
  }

  Object.entries(seen).forEach(([stageIdStr, map]: [string, Map<number, number>]) => {
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
  entities: {
    tournament: DbTournament | null;
    stagesById: Record<number, DbStage>;
    groupsById: Record<number, DbGroup>;
    teamsById: Record<number, DbTeam>;
    tournamentTeams: DbTournamentTeam[];
    stageSlots: DbStageSlot[];
    intakeMappings: DbIntakeMapping[];
    standings: DbStanding[];
  };

  payload: NewTournamentPayload | null;
  draftMatches: DraftMatch[];
  dbOverlayBySig: Record<string, DbOverlay>;

  ui: { knockoutLayout: Record<number, LayoutByKoKey> };

  ids: {
    tournamentId?: number;
    stageIdByIndex: Record<number, number | undefined>;
    groupIdByStage: Record<number, Record<number, number | undefined>>;
    stageIndexById: Record<number, number | undefined>;
    groupIndexByStageAndId: Record<number, Record<number, number | undefined>>;
  };

  dirty: {
    tournament: boolean;
    stages: boolean;
    groups: boolean;
    tournamentTeams: boolean;
    matches: Set<string>;
    stageSlots: Set<string>;
    intakeMappings: boolean;
    deletedStageIds: Set<number>;
    deletedGroupIds: Set<number>;
    deletedMatchIds: Set<number>;
  };

  busy: boolean;

  lastSnapshot?: FullTournamentSnapshot;

  selectStageRows: (stageIdx: number) => DraftMatch[];
  selectStageRowsMerged: (stageIdx: number) => (DraftMatch & Partial<MatchRow> & DbOverlay)[];

  getStageId: (stageIdx: number) => number | undefined;
  getGroupId: (stageIdx: number, groupIdx: number | null) => number | null | undefined;
  getStageKind: (stageIdx: number) => "league" | "groups" | "knockout" | undefined;
  getTeamName: (id?: number | null) => string;
  listGroupsForStageIdx: (stageIdx: number) => DbGroup[];
  listTournamentTeams: () => DbTournamentTeam[];
  listParticipants: () => number[];
  listGroupTeamIds: (stageIdx: number, groupIdx: number) => number[];
  listStageSlots: (stageIdx: number, groupIdx: number) => DbStageSlot[];
  listIntakeMappingsForTargetStageIdx: (stageIdx: number) => DbIntakeMapping[];

  hydrateFromSnapshot: (snap: FullTournamentSnapshot) => void;
  hydrateFromServer: (payload: NewTournamentPayload, dbMatches: DbMatchRow[]) => void;
  resetUnsavedChanges: () => void;
  setStageSlotByIndex: (
    stageIdx: number,
    groupIdx: number,
    slotId: number,
    teamId: number | null,
    source?: "manual" | "intake"
  ) => void;

  seedFromWizard: (canon: NewTournamentPayload, teams: TeamDraft[], drafts: DraftMatch[]) => void;

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
  removeMatch: (row: DraftMatch) => void;

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

  saveAll: () => Promise<void>;
};

/* =========================================================
   Store implementation
   ========================================================= */

const DEBUG_SAVEALL = true;
const makeRid = (): string => `S4-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 6)}`;

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
    deletedMatchIds: new Set<number>(),
  },

  busy: false,

  /* -------------------- Selectors -------------------- */

  selectStageRows: (stageIdx: number): DraftMatch[] => {
    const rows = get().draftMatches.filter((m: DraftMatch) => m.stageIdx === stageIdx);
    const kind = get().getStageKind(stageIdx);
    const isKO = kind === "knockout";
    return rows
      .slice()
      .sort((a: DraftMatch, b: DraftMatch) =>
        isKO ? sortKO(a, b) : (a.matchday ?? 0) - (b.matchday ?? 0) || (a.bracket_pos ?? 0) - (b.bracket_pos ?? 0)
      );
  },

  selectStageRowsMerged: (stageIdx: number): (DraftMatch & Partial<MatchRow> & DbOverlay)[] => {
    const rows = get().selectStageRows(stageIdx);
    const overlay = get().dbOverlayBySig;
    return rows.map((r: DraftMatch): DraftMatch & Partial<MatchRow> & DbOverlay => {
      const ov =
        (overlay[rowSignatureStable(r)] as Partial<MatchRow> | undefined) ||
        (overlay[rowSignatureDB(r)] as Partial<MatchRow> | undefined) ||
        (overlay[rowSignature(r)] as Partial<MatchRow> | undefined) ||
        (findOverlayLoose(overlay as any, rowSignature(r)) as Partial<MatchRow> | undefined);
      return ov ? ({ ...r, ...ov } as DraftMatch & Partial<MatchRow> & DbOverlay) : (r as DraftMatch & Partial<MatchRow>);
    });
  },

  getStageId: (stageIdx: number) => get().ids.stageIdByIndex[stageIdx],
  getGroupId: (stageIdx: number, groupIdx: number | null) =>
    groupIdx == null ? null : get().ids.groupIdByStage[stageIdx]?.[groupIdx],
  getStageKind: (stageIdx: number) => {
    const stageId = get().ids.stageIdByIndex[stageIdx];
    if (!stageId) return undefined;
    return get().entities.stagesById[stageId]?.kind;
  },
  getTeamName: (id?: number | null) => {
    if (!id) return "TBD";
    const t = get().entities.teamsById[id];
    return t?.name ?? `Team #${id}`;
  },
  listGroupsForStageIdx: (stageIdx: number) => {
    const stageId = get().ids.stageIdByIndex[stageIdx];
    if (!stageId) return [];
    const groups = Object.values(get().entities.groupsById).filter((g: DbGroup) => g.stage_id === stageId);
    return groups.sort(
      (a: DbGroup, b: DbGroup) =>
        (a.ordering ?? 0) - (b.ordering ?? 0) || a.name.localeCompare(b.name)
    );
  },
  listTournamentTeams: () => get().entities.tournamentTeams.slice(),
  listParticipants: () => {
    const ids = new Set<number>();
    get().entities.tournamentTeams.forEach((tt: DbTournamentTeam) => ids.add(tt.team_id));
    if (ids.size > 0) return Array.from(ids);
    get().entities.stageSlots.forEach((s: DbStageSlot) => { if (s.team_id) ids.add(s.team_id); });
    if (ids.size > 0) return Array.from(ids);
    get().draftMatches.forEach((m: DraftMatch) => {
      if (m.team_a_id) ids.add(m.team_a_id);
      if (m.team_b_id) ids.add(m.team_b_id);
    });
    return Array.from(ids);
  },
  listGroupTeamIds: (stageIdx: number, groupIdx: number) => {
    const stageId = get().ids.stageIdByIndex[stageIdx];
    if (!stageId && stageId !== 0) return [];
    const dbGroupId = get().ids.groupIdByStage[stageIdx]?.[groupIdx];

    const fromTT = get().entities.tournamentTeams
      .filter((tt: DbTournamentTeam) => tt.stage_id === stageId && (dbGroupId ? tt.group_id === dbGroupId : tt.group_id == null))
      .map((tt: DbTournamentTeam) => tt.team_id);
    if (fromTT.length > 0) return Array.from(new Set(fromTT));

    const fromSlots = get().entities.stageSlots
      .filter((s: DbStageSlot) => s.stage_id === stageId && s.group_id === groupIdx && s.team_id != null)
      .map((s: DbStageSlot) => s.team_id!) as number[];
    if (fromSlots.length > 0) return Array.from(new Set(fromSlots));

    return get().listParticipants();
  },
  listStageSlots: (stageIdx: number, groupIdx: number) => {
    const stageId = get().ids.stageIdByIndex[stageIdx];
    if (!stageId) return [];
    return get()
      .entities
      .stageSlots
      .filter((s: DbStageSlot) => s.stage_id === stageId && s.group_id === groupIdx)
      .slice()
      .sort((a: DbStageSlot, b: DbStageSlot) => a.slot_id - b.slot_id);
  },
  listIntakeMappingsForTargetStageIdx: (stageIdx: number) => {
    const stageId = get().ids.stageIdByIndex[stageIdx];
    if (!stageId) return [];
    return get().entities.intakeMappings.filter((m: DbIntakeMapping) => m.target_stage_id === stageId);
  },

  /* -------------------- Hydration -------------------- */

  hydrateFromSnapshot: (snap: FullTournamentSnapshot) => {
    const stageIdByIndex: Record<number, number> = {};
    const stageIndexById: Record<number, number> = {};
    let groupIdByStage: Record<number, Record<number, number>> = {};
    let groupIndexByStageAndId: Record<number, Record<number, number>> = {};

    const sortedStages = snap.stages.slice().sort((a: DbStage, b: DbStage) => (a.ordering ?? 0) - (b.ordering ?? 0));
    sortedStages.forEach((s: DbStage, i: number) => {
      stageIdByIndex[i] = s.id;
      stageIndexById[s.id] = i;
    });

    const groupsByStageId: Record<number, DbGroup[]> = {};
    snap.groups.forEach((g: DbGroup) => {
      (groupsByStageId[g.stage_id] ??= []).push(g);
    });
    Object.entries(groupsByStageId).forEach(([sid, arr]: [string, DbGroup[]]) => {
      (arr as DbGroup[]).sort((a: DbGroup, b: DbGroup) => (a.ordering ?? 0) - (b.ordering ?? 0) || a.name.localeCompare(b.name));
      const sIdx = stageIndexById[Number(sid)] ?? -1;
      groupIdByStage[sIdx] = {};
      groupIndexByStageAndId[Number(sid)] = {};
      (arr as DbGroup[]).forEach((g: DbGroup, gi: number) => {
        groupIdByStage[sIdx][gi] = g.id;
        groupIndexByStageAndId[Number(sid)][g.id] = gi;
      });
    });

    const built = buildGroupIndexFallbackFromMatches(
      snap.matches ?? [],
      stageIndexById as Record<number, number>
    );
    Object.entries(built.groupIdByStage).forEach(([sIdxStr, m]: [string, Record<number, number>]) => {
      const sIdx = Number(sIdxStr);
      const dst = (groupIdByStage[sIdx] ??= {});
      Object.entries(m).forEach(([giStr, gid]: [string, number]) => {
        const gi = Number(giStr);
        if (dst[gi] == null) dst[gi] = gid;
      });
    });
    Object.entries(built.groupIndexByStageAndId).forEach(([sidStr, m]: [string, Record<number, number>]) => {
      const sid = Number(sidStr);
      const dst = (groupIndexByStageAndId[sid] ??= {});
      Object.entries(m).forEach(([gidStr, gi]: [string, number]) => {
        const gid = Number(gidStr);
        if (dst[gid] == null) dst[gid] = gi;
      });
    });

    const stagesById: Record<number, DbStage> = {};
    const groupsById: Record<number, DbGroup> = {};
    const teamsById: Record<number, DbTeam> = {};
    snap.stages.forEach((s: DbStage) => (stagesById[s.id] = s));
    snap.groups.forEach((g: DbGroup) => (groupsById[g.id] = g));
    snap.teams.forEach((t: DbTeam) => (teamsById[t.id] = t));

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
      const base: DbOverlay = {
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
        home_source_outcome: m.home_source_outcome ?? null,
        away_source_outcome: m.away_source_outcome ?? null,
      };
      overlay[rowSignatureStable(uiRow)] = base;
      overlay[rowSignatureDB(uiRow)] = base;
      overlay[rowSignature(uiRow)] = base;

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

  hydrateFromServer: (payload: NewTournamentPayload, dbMatches: DbMatchRow[]) => {
    const stageIdByIndex: Record<number, number | undefined> = {};
    const groupIdByStage: Record<number, Record<number, number | undefined>> = {};
    const stageIndexById: Record<number, number | undefined> = {};
    const groupIndexByStageAndId: Record<number, Record<number, number | undefined>> = {};

    (payload.stages ?? []).forEach((s: any, i: number) => {
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

    const built = buildGroupIndexFallbackFromMatches(
      dbMatches ?? [],
      stageIndexById as Record<number, number>
    );

    Object.entries(built.groupIdByStage).forEach(([sIdxStr, m]: [string, Record<number, number>]) => {
      const sIdx = Number(sIdxStr);
      const dst = (groupIdByStage[sIdx] ??= {});
      Object.entries(m).forEach(([giStr, gid]: [string, number]) => {
        const gi = Number(giStr);
        if (dst[gi] == null) dst[gi] = gid;
      });
    });

    Object.entries(built.groupIndexByStageAndId).forEach(([sidStr, m]: [string, Record<number, number>]) => {
      const sid = Number(sidStr);
      const dst = (groupIndexByStageAndId[sid] ??= {});
      Object.entries(m).forEach(([gidStr, gi]: [string, number]) => {
        const gid = Number(gidStr);
        if (dst[gid] == null) dst[gid] = gi;
      });
    });

    const draftMatches: DraftMatch[] = [];
    const overlay: Record<string, DbOverlay> = {};
    (dbMatches ?? []).forEach((m: DbMatchRow) => {
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
      const base: DbOverlay = {
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
        home_source_outcome: m.home_source_outcome ?? null,
        away_source_outcome: m.away_source_outcome ?? null,
      };
      overlay[rowSignatureStable(uiRow)] = base;
      overlay[rowSignatureDB(uiRow)] = base;
      overlay[rowSignature(uiRow)] = base;

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

  seedFromWizard: (canon: NewTournamentPayload, teams: TeamDraft[], drafts: DraftMatch[]) => {
    const st = get();

    const teamsById = { ...st.entities.teamsById };
    for (const t of teams ?? []) {
      if (t.id != null && !teamsById[t.id]) {
        teamsById[t.id] = { id: t.id, name: t.name ?? `Team #${t.id}`, logo: (t as any).logo ?? null, am: null };
      }
    }

    const nextDrafts = drafts.slice();
    const dirtyMatches = new Set<string>(st.dirty.matches);
    const overlay = { ...st.dbOverlayBySig };

    nextDrafts.forEach((m: DraftMatch) => {
      const kStable = rowSignatureStable(m);
      const kLegacy = rowSignature(m);
      dirtyMatches.add(kStable);
      const prev = overlay[kStable] ?? overlay[kLegacy] ?? {};
      const merged: DbOverlay = {
        db_id: (prev as any).db_id ?? null,
        updated_at: (prev as any).updated_at ?? null,
        status: (prev as any).status ?? "scheduled",
        team_a_score: (prev as any).team_a_score ?? null,
        team_b_score: (prev as any).team_b_score ?? null,
        winner_team_id: (prev as any).winner_team_id ?? null,
        home_source_round: m.home_source_round ?? (prev as any).home_source_round ?? null,
        home_source_bracket_pos: m.home_source_bracket_pos ?? (prev as any).home_source_bracket_pos ?? null,
        away_source_round: m.away_source_round ?? (prev as any).away_source_round ?? null,
        away_source_bracket_pos: m.away_source_bracket_pos ?? (prev as any).away_source_bracket_pos ?? null,
        home_source_outcome: (m as any).home_source_outcome ?? (prev as any).home_source_outcome ?? null,
        away_source_outcome: (m as any).away_source_outcome ?? (prev as any).away_source_outcome ?? null,
      };
      overlay[kStable] = merged;
      overlay[kLegacy] = merged;
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

    const existingId = st.ids.stageIdByIndex[stageIdx];
    if (existingId != null) {
      const prev = st.entities.stagesById[existingId];
      const next: DbStage = {
        ...prev,
        name: patch.name ?? prev.name,
        kind: (patch.kind as any) ?? prev.kind,
        config: patch.config ?? prev.config,
        ordering: prev.ordering,
      };
      set((curr) => ({
        entities: { ...curr.entities, stagesById: { ...curr.entities.stagesById, [existingId]: next } },
        dirty: { ...curr.dirty, stages: true },
      }));
    } else {
      const id = nextTempId();
      const next: DbStage = {
        id,
        tournament_id,
        name: patch.name ?? `Stage ${stageIdx + 1}`,
        kind: (patch.kind as any) ?? "league",
        config: patch.config ?? null,
        ordering: stageIdx,
      };

      const newOrder = order.slice();
      newOrder.splice(stageIdx, 0, id);

      const stagesById = { ...st.entities.stagesById, [id]: next };
      const stageIdByIndex: Record<number, number> = {};
      const stageIndexById: Record<number, number> = {};
      newOrder.forEach((sid: number, i: number) => {
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

    const stagesById = { ...st.entities.stagesById };
    delete stagesById[removeId];

    const groupsById = { ...st.entities.groupsById };
    const removedGroupIds: number[] = [];
    Object.values(groupsById).forEach((g: DbGroup) => {
      if (g.stage_id === removeId) removedGroupIds.push(g.id);
    });
    removedGroupIds.forEach((gid) => delete groupsById[gid]);

    const newOrder = order.slice();
    newOrder.splice(stageIdx, 1);
    const stageIdByIndex: Record<number, number> = {};
    const stageIndexById: Record<number, number> = {};
    newOrder.forEach((sid: number, i: number) => {
      stageIdByIndex[i] = sid;
      stageIndexById[sid] = i;
      stagesById[sid] = { ...stagesById[sid], ordering: i };
    });

    const groupIdByStage = { ...st.ids.groupIdByStage };
    delete groupIdByStage[stageIdx];
    const shifted: Record<number, Record<number, number | undefined>> = {};
    Object.keys(groupIdByStage).forEach((k: string) => {
      const idx = Number(k);
      if (idx < stageIdx) shifted[idx] = groupIdByStage[idx];
      else if (idx > stageIdx) shifted[idx - 1] = groupIdByStage[idx];
    });

    const draftMatches = st.draftMatches.filter((m: DraftMatch) => m.stageIdx !== stageIdx).map((m: DraftMatch) => ({
      ...m,
      stageIdx: m.stageIdx! > stageIdx ? (m.stageIdx! - 1) : m.stageIdx,
    }));
    const overlay: Record<string, DbOverlay> = {};
    draftMatches.forEach((m: DraftMatch) => {
      const base =
        st.dbOverlayBySig[rowSignatureStable(m)] ||
        st.dbOverlayBySig[rowSignatureDB(m)] ||
        st.dbOverlayBySig[rowSignature(m)];
      if (base) {
        overlay[rowSignatureStable(m)] = base;
        overlay[rowSignatureDB(m)] = base;
        overlay[rowSignature(m)] = base;
      }
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
      .filter((g: DbGroup) => g.stage_id === stageId)
      .sort((a: DbGroup, b: DbGroup) => (a.ordering ?? 0) - (b.ordering ?? 0));

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

    const id = nextTempId();
    const next: DbGroup = {
      id,
      stage_id: stageId,
      name: patch.name ?? `Group ${groupIdx != null ? groupIdx + 1 : groupsForStage.length + 1}`,
      ordering: patch.ordering ?? (groupIdx ?? groupsForStage.length),
    };

    const groupsById = { ...st.entities.groupsById, [id]: next };

    const groupMap = { ...(st.ids.groupIdByStage[stageIdx] ?? {}) };
    const insertAt = groupIdx ?? Object.keys(groupMap).length;
    const arr = Object.keys(groupMap)
      .map((k: string) => Number(k))
      .sort((a: number, b: number) => a - b)
      .map((i) => groupMap[i]!)
    arr.splice(insertAt, 0, id);

    const newMap: Record<number, number> = {};
    arr.forEach((gid2: number, i: number) => (newMap[i] = gid2));

    const groupIdByStage = { ...st.ids.groupIdByStage, [stageIdx]: newMap };
    const groupIndexByStageAndId = { ...st.ids.groupIndexByStageAndId };
    groupIndexByStageAndId[stageId] = groupIndexByStageAndId[stageId] ?? {};
    arr.forEach((gid2: number, i: number) => (groupIndexByStageAndId[stageId][gid2] = i));

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

    const groupsById = { ...st.entities.groupsById };
    delete groupsById[gid];

    const arr = Object.keys(groupMap)
      .map((k: string) => Number(k))
      .sort((a: number, b: number) => a - b)
      .map((i) => groupMap[i]!)
      .filter((x: number, i: number) => i !== groupIdx);

    const newMap: Record<number, number> = {};
    arr.forEach((id: number, i: number) => (newMap[i] = id));

    const groupIdByStage = { ...st.ids.groupIdByStage, [stageIdx]: newMap };

    const groupIndexByStageAndId = { ...st.ids.groupIndexByStageAndId };
    groupIndexByStageAndId[stageId] = groupIndexByStageAndId[stageId] ?? {};
    Object.keys(groupIndexByStageAndId[stageId]).forEach((k: string) => {
      if (Number(k) === gid) delete groupIndexByStageAndId[stageId][gid];
    });
    arr.forEach((id: number, i: number) => (groupIndexByStageAndId[stageId][id] = i));

    const draftMatches = st.draftMatches.filter(
      (m: DraftMatch) => !(m.stageIdx === stageIdx && m.groupIdx === groupIdx)
    ).map((m: DraftMatch) =>
      m.stageIdx === stageIdx && typeof m.groupIdx === "number" && m.groupIdx > groupIdx
        ? { ...m, groupIdx: (m.groupIdx as number) - 1 }
        : m
    );

    const overlay: Record<string, DbOverlay> = {};
    draftMatches.forEach((m: DraftMatch) => {
      const base =
        st.dbOverlayBySig[rowSignatureStable(m)] ||
        st.dbOverlayBySig[rowSignatureDB(m)] ||
        st.dbOverlayBySig[rowSignature(m)];
      if (base) {
        overlay[rowSignatureStable(m)] = base;
        overlay[rowSignatureDB(m)] = base;
        overlay[rowSignature(m)] = base;
      }
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
      const idx = arr.findIndex((tt: DbTournamentTeam) => tt.tournament_id === tid && tt.team_id === teamId);
      if (idx >= 0) arr[idx] = { ...arr[idx], seed };
      else arr.push({ id: nextTempId(), tournament_id: tid, team_id: teamId, seed: seed ?? null });
      return { entities: { ...st.entities, tournamentTeams: arr }, dirty: { ...st.dirty, tournamentTeams: true } };
    });
  },

  assignTeamToGroup: (teamId, stageId, groupId) => {
    set((st) => {
      const tid = st.ids.tournamentId!;
      const arr = st.entities.tournamentTeams.slice();
      const idx = arr.findIndex((tt: DbTournamentTeam) => tt.tournament_id === tid && tt.team_id === teamId);
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
      nextArr.forEach((m: DraftMatch) => dirty.add(rowSignatureStable(m)));
      return { draftMatches: nextArr, dirty: { ...st.dirty, matches: dirty } };
    });
  },

  updateMatches: (stageIdx, updater) => {
    set((st) => {
      const beforeAll = st.draftMatches;
      const sameStage = beforeAll.filter((m: DraftMatch) => m.stageIdx === stageIdx);
      const others = beforeAll.filter((m: DraftMatch) => m.stageIdx !== stageIdx);

      const beforeByStable = new Map(sameStage.map((r: DraftMatch) => [rowSignatureStable(r), r]));
      const updated = updater(sameStage.slice());
      wireKnockoutSourcesLocal(updated, stageIdx);

      const dirty = new Set(st.dirty.matches);
      for (const u of updated) {
        const k = rowSignatureStable(u);
        const p = beforeByStable.get(k);
        const pHomeOutcome = (p as any)?.home_source_outcome;
        const pAwayOutcome = (p as any)?.away_source_outcome;
        const uHomeOutcome = (u as any)?.home_source_outcome;
        const uAwayOutcome = (u as any)?.away_source_outcome;

        if (
          !p ||
          p.matchday !== u.matchday ||
          p.round !== u.round ||
          p.bracket_pos !== u.bracket_pos ||
          p.groupIdx !== u.groupIdx ||
          p.team_a_id !== u.team_a_id ||
          p.team_b_id !== u.team_b_id ||
          p.match_date !== u.match_date ||
          p.home_source_round !== u.home_source_round ||
          p.home_source_bracket_pos !== u.home_source_bracket_pos ||
          p.away_source_round !== u.away_source_round ||
          p.away_source_bracket_pos !== u.away_source_bracket_pos ||
          pHomeOutcome !== uHomeOutcome ||
          pAwayOutcome !== uAwayOutcome
        ) {
          dirty.add(k);
        }
      }

      return { draftMatches: [...others, ...updated], dirty: { ...st.dirty, matches: dirty } };
    });
  },

  removeMatch: (row) => {
    set((st) => {
      const kStable = rowSignatureStable(row);  // Unique key for match signature
      const kLegacy = rowSignature(row);
      const kDBStable = rowSignatureDB(row);
  
      // Remove the match from draft matches
      const nextDraft = st.draftMatches.filter((r: DraftMatch) => rowSignatureStable(r) !== kStable);
  
      // Find DB ID to delete
      const del = new Set(st.dirty.deletedMatchIds); // Existing deleted match IDs
      let foundId: number | undefined;
  
      const fromRow = (row as any)?.db_id;
      if (typeof fromRow === "number" && fromRow > 0) foundId = fromRow;
  
      if (!foundId) {
        const ovExact =
          st.dbOverlayBySig[kStable] ||
          st.dbOverlayBySig[kDBStable] ||
          st.dbOverlayBySig[kLegacy];
        if (ovExact?.db_id && ovExact.db_id > 0) foundId = ovExact.db_id;
      }
  
      if (typeof foundId === "number" && foundId > 0) del.add(foundId);  // Add to deleted match IDs set
  
      // Drop overlay entries for this match
      const nextOverlay = { ...st.dbOverlayBySig };
      delete nextOverlay[kStable];
      delete nextOverlay[kLegacy];
      delete nextOverlay[kDBStable];
  
      // Also remove from dirty matches set
      const nextDirty = new Set(st.dirty.matches);
      nextDirty.delete(kStable);  // Mark this match as no longer dirty
  
      return {
        draftMatches: nextDraft,  // Remove from draft matches
        dbOverlayBySig: nextOverlay,  // Remove overlay for match
        dirty: { ...st.dirty, deletedMatchIds: del, matches: nextDirty },  // Update the dirty state
      };
    });
  },
  

  setKOLink: (
    stageIdx: number,
    child: KOCoord,
    side: "home" | "away",
    parent: KOCoord | null,
    outcome = "W"
  ) => {
    get().updateMatches(stageIdx, (rows: DraftMatch[]) => {
      const next = rows.slice();
      const idx = next.findIndex(
        (r: DraftMatch) => r.round === child.round && r.bracket_pos === child.bracket_pos
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

  setKOTeams: (stageIdx: number, where: KOCoord, teamAId: number | null, teamBId: number | null) => {
    get().updateMatches(stageIdx, (rows: DraftMatch[]) => {
      const next = rows.slice();
      const idx = next.findIndex(
        (r: DraftMatch) => r.round === where.round && r.bracket_pos === where.bracket_pos
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

  setKORoundPos: (stageIdx: number, from: KOCoord, to: KOCoord) => {
    get().updateMatches(stageIdx, (rows: DraftMatch[]) => {
      const next = rows.slice();
      const i = next.findIndex((r: DraftMatch) => r.round === from.round && r.bracket_pos === from.bracket_pos);
      if (i < 0) return next;
      const j = next.findIndex((r: DraftMatch) => r.round === to.round && r.bracket_pos === to.bracket_pos);
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

  setUIKnockoutLayout: (stageIdx: number, koKey: string, frame: Frame) => {
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
        (s: DbStageSlot) => s.stage_id === stage_id && s.group_id === groupIdx && s.slot_id === slotId
      );

      const prevUpdatedAt = idx >= 0 ? slots[idx].updated_at : undefined;

      const nextRow: DbStageSlot = {
        stage_id,
        group_id: groupIdx,
        slot_id: slotId,
        team_id: teamId ?? null,
        source,
        updated_at: prevUpdatedAt,
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
        (x: DbIntakeMapping) =>
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
      entities: { ...st.entities, intakeMappings: st.entities.intakeMappings.filter((m: DbIntakeMapping) => !predicate(m)) },
      dirty: { ...st.dirty, intakeMappings: true },
    }));
  },

  /* -------------------- Persist -------------------- */

  saveAll: async () => {
    const rid = makeRid();  // Generate a unique request ID
  
    // Function to log the payload being sent to the server
    const logPayload = (payload: any) => {
      console.log("[save-all] - Payload being sent:", JSON.stringify(payload, null, 2));
    };
  
    // Function to send the data to the server
    const doPost = async (tid: number, payload: any, phase: string) => {
      if (DEBUG_SAVEALL) {
        console.debug("[save-all][out]", rid, phase, JSON.stringify({
          t: !!payload.tournament,
          st_upsert: payload.stages?.upsert?.length ?? 0,
          st_del: payload.stages?.deleteIds ?? [],
          g_upsert: payload.groups?.upsert?.length ?? 0,
          g_del: payload.groups?.deleteIds ?? [],
          tt_upsert: payload.tournamentTeams?.upsert?.length ?? 0,
          slots_upsert: payload.stageSlots?.upsert?.length ?? 0,
          intake_replace: payload.intakeMappings?.replace?.length ?? 0,
          m_upsert: payload.matches?.upsert?.length ?? 0,
          m_del: payload.matches?.deleteIds ?? [],
          force: payload.force ?? {},
        }));
      }
    
      const send = async (body: any) => {
        // Log the request payload before sending it to the backend
        logPayload(body);
    
        return fetch(`/api/tournaments/${tid}/save-all`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "x-debug-id": rid,
            "x-debug-phase": phase,
          },
          credentials: "include",
          cache: "no-store", // No caching to ensure fresh data
          body: JSON.stringify(body),
        });
      };
    
      let res = await send(payload); // First attempt to send
    
      // Check for 409 Conflict, handle if it occurs
      if (res.status === 409) {
        console.log("[save-all] - 409 Conflict detected, reloading tournament state...");
    
        try {
          // Reload the latest state from the server
          const mod = await import("./loadSnapshotClient");
          await mod.loadTournamentIntoStore(tid);
          console.log("[save-all] - Tournament state reloaded successfully");
        } catch (e) {
          console.error("[save-all] - Error while reloading tournament state:", e);
        }
    
        // Force save to override the server's state with the client’s changes
        const forced = {
          ...payload,
          force: { ...(payload.force || {}), matches: true, stageSlots: true },
        };
    
        console.log("[save-all] - Attempting to force save with modified data...");
        res = await send(forced); // Try again with the force flag
      }
    
      // Clone the response to allow multiple reads if needed (e.g., for json and text)
      const clonedRes = res.clone();
    
      // If we get a 409 conflict again, log the details and throw an error
      if (res.status === 409) {
        const body = await clonedRes.json().catch(() => ({}));
        const conflictError = body?.db_updated_at
          ? `409 ${body.entity}#${body.id}\nsent=${body.sent_updated_at}\ndb=${body.db_updated_at}`
          : body?.error || "Some items are stale (409). Reload or force overwrite.";
    
        console.error("[save-all] - Conflict not resolved, error:", conflictError);
        throw new Error(conflictError);
      }
    
      // If the response is not OK, log the response text and throw an error
      if (!res.ok) {
        const txt = await clonedRes.text().catch(() => "");
        console.error("[save-all] - Save failed with status:", res.status, txt);
        throw new Error(txt || `Save failed (${res.status})`);
      }      
        
      const data = await res.json();
      console.log("[save-all] - Data saved successfully:", data);
      return data;
    };
  
    const st0 = get();
    const tid = st0.ids.tournamentId;
    if (!tid) return;
  
    // Check if there are any dirty states that need saving
    const nothingPhase1 =
      !st0.dirty.tournament && !st0.dirty.stages && st0.dirty.deletedStageIds.size === 0;
    const nothingPhase2 =
      !st0.dirty.groups && st0.dirty.deletedGroupIds.size === 0;
    const nothingPhase3 = !st0.dirty.tournamentTeams;
    const nothingPhase4 =
      st0.dirty.matches.size === 0 &&
      st0.dirty.stageSlots.size === 0 &&
      !st0.dirty.intakeMappings &&
      st0.dirty.deletedMatchIds.size === 0;
  
    if (nothingPhase1 && nothingPhase2 && nothingPhase3 && nothingPhase4) {
      console.log("[save-all] - No changes detected, skipping save.");
      return;
    }
  
    set({ busy: true });
    try {
      /* -------- PHASE 1: tournament + stages -------- */
      let payload1: any = {};
      const st1 = get();
  
      // Log the state before making changes
      console.log("[save-all] - Preparing PHASE 1: tournament and stages.");
  
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
        const upsert = order.map((sid: number, i: number) => {
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
            ? Array.from(st1.dirty.deletedStageIds).filter((x: number) => x > 0)
            : [];
  
        payload1 = {
          ...payload1,
          ...(upsert.length || deleteIds.length
            ? { stages: { ...(upsert.length ? { upsert } : {}), ...(deleteIds.length ? { deleteIds } : {}) } }
            : {}),
        };
      }
  
      // Send data to backend for Phase 1
      if (payload1.tournament || payload1.stages) {
        console.log("[save-all] - Sending Phase 1 data...");
        const resp1 = await doPost(tid, payload1, "phase1");
  
        if (resp1.tournament) {
          set((curr) => ({
            entities: { ...curr.entities, tournament: resp1.tournament! },
          }));
        }
  
        if (resp1.stages) {
          const stagesArr = resp1.stages.slice().sort((a: DbStage, b: DbStage) => (a.ordering ?? 0) - (b.ordering ?? 0));
          const stagesById: Record<number, DbStage> = {};
          const stageIdByIndex: Record<number, number> = {};
          const stageIndexById: Record<number, number> = {};
          stagesArr.forEach((s: DbStage, i: number) => {
            stagesById[s.id] = s;
            stageIdByIndex[i] = s.id;
            stageIndexById[s.id] = i;
          });
  
          set((curr) => ({
            entities: { ...curr.entities, stagesById },
            ids: { ...curr.ids, stageIdByIndex, stageIndexById },
            dirty: { ...curr.dirty, tournament: false, stages: false, deletedStageIds: new Set() },
          }));
        }
      }

      /* -------- PHASE 2: groups -------- */
      let payload2: any = {};
      const st2 = get();

      console.log("[save-all] - Preparing PHASE 2: groups.");

      if (st2.dirty.groups || st2.dirty.deletedGroupIds.size) {
        const upsert: any[] = [];
        Object.entries(st2.ids.groupIdByStage).forEach(([sIdxStr, groupMap]: [string, Record<number, number | undefined>]) => {
          const sIdx = Number(sIdxStr);
          const stageId = st2.ids.stageIdByIndex[sIdx];
          if (!stageId) return;
          const order = Object.keys(groupMap)
            .map(Number)
            .sort((a: number, b: number) => a - b)
            .map((i) => groupMap[i]!);
          order.forEach((gid: number, i: number) => {
            const g = st2.entities.groupsById[gid];
            const row: any = {
              ...(gid > 0 ? { id: gid } : {}),
              stage_id: stageId,
              name: g.name,
              ordering: i,
            };
            upsert.push(row);
          });
        });
        const deleteIds = Array.from(st2.dirty.deletedGroupIds).filter((x: number) => x > 0);
        payload2 = {
          ...(upsert.length || deleteIds.length
            ? { groups: { ...(upsert.length ? { upsert } : {}), ...(deleteIds.length ? { deleteIds } : {}) } }
            : {}),
        };
      }

      if (Object.keys(payload2).length) {
        console.log("[save-all] - Sending Phase 2 data...");
        const resp2 = await doPost(tid, payload2, "phase2");

        if (resp2.groups) {
          const groupsById: Record<number, DbGroup> = { ...get().entities.groupsById };
          resp2.groups.forEach((g: DbGroup) => (groupsById[g.id] = g));

          const groupsByStage: Record<number, DbGroup[]> = {};
          resp2.groups.forEach((g: DbGroup) => {
            (groupsByStage[g.stage_id] ??= []).push(g);
          });

          const groupIdByStage: Record<number, Record<number, number | undefined>> = {};
          const groupIndexByStageAndId: Record<number, Record<number, number | undefined>> = {};
          Object.entries(groupsByStage).forEach(([stageIdStr, arr]: [string, DbGroup[]]) => {
            const stageId = Number(stageIdStr);
            const sIdx = st2.ids.stageIndexById[stageId];
            if (sIdx == null) return;
            arr.sort((a: DbGroup, b: DbGroup) => (a.ordering ?? 0) - (b.ordering ?? 0));
            groupIdByStage[sIdx] = {};
            groupIndexByStageAndId[stageId] = {};
            arr.forEach((g: DbGroup, gi: number) => {
              groupIdByStage[sIdx][gi] = g.id;
              groupIndexByStageAndId[stageId][g.id] = gi;
            });
          });

          set((curr) => ({
            entities: { ...curr.entities, groupsById },
            ids: { ...curr.ids, groupIdByStage, groupIndexByStageAndId },
            dirty: { ...curr.dirty, groups: false, deletedGroupIds: new Set() },
          }));
        }
      }

      /* -------- PHASE 3: tournament teams -------- */
      let payload3: any = {};
      const st3 = get();

      console.log("[save-all] - Preparing PHASE 3: tournament teams.");

      if (st3.dirty.tournamentTeams) {
        const upsert = st3.entities.tournamentTeams.map((tt: DbTournamentTeam) => ({
          ...(tt.id > 0 ? { id: tt.id } : {}),
          tournament_id: tt.tournament_id,
          team_id: tt.team_id,
          stage_id: tt.stage_id ?? null,
          group_id: tt.group_id ?? null,
          seed: tt.seed ?? null,
        }));
        payload3 = { tournamentTeams: { upsert, deleteIds: [] } }; // Assuming no deletes for tournamentTeams
      }

      if (Object.keys(payload3).length) {
        console.log("[save-all] - Sending Phase 3 data...");
        const resp3 = await doPost(tid, payload3, "phase3");

        if (resp3.tournamentTeams) {
          set((curr) => ({
            entities: { ...curr.entities, tournamentTeams: resp3.tournamentTeams },
            dirty: { ...curr.dirty, tournamentTeams: false },
          }));
        }
      }

      /* -------- PHASE 4: matches + stage slots + intake mappings -------- */
      let payload4: any = {};
      const st4 = get();

      console.log("[save-all] - Preparing PHASE 4: matches, stage slots, and intake mappings.");

      if (st4.dirty.intakeMappings) {
        const replace = st4.entities.intakeMappings.map((m: DbIntakeMapping) => ({
          ...(m.id ? { id: m.id } : {}),
          target_stage_id: m.target_stage_id,
          group_idx: m.group_idx,
          slot_idx: m.slot_idx,
          from_stage_id: m.from_stage_id,
          round: m.round,
          bracket_pos: m.bracket_pos,
          outcome: m.outcome,
        }));
        payload4.intakeMappings = { replace };
      }

      if (st4.dirty.stageSlots.size) {
        const upsert: any[] = [];
        st4.entities.stageSlots.forEach((s: DbStageSlot) => {
          const key = `${s.stage_id}|${s.group_id}|${s.slot_id}`;
          if (st4.dirty.stageSlots.has(key)) {
            upsert.push({
              stage_id: s.stage_id,
              group_id: s.group_id,
              slot_id: s.slot_id,
              team_id: s.team_id,
              source: s.source,
              updated_at: s.updated_at,
            });
          }
        });
        payload4.stageSlots = { upsert };
      }

      if (st4.dirty.matches.size || st4.dirty.deletedMatchIds.size) {
        const upsert: any[] = [];
        st4.draftMatches.forEach((m: DraftMatch) => {
          const kStable = rowSignatureStable(m);
          if (!st4.dirty.matches.has(kStable)) return;
          const stage_id = st4.ids.stageIdByIndex[m.stageIdx ?? -1]!;
          const group_id = m.groupIdx != null ? st4.ids.groupIdByStage[m.stageIdx ?? -1]?.[m.groupIdx] ?? null : null;
          const ov = st4.dbOverlayBySig[kStable] || st4.dbOverlayBySig[rowSignatureDB(m)] || st4.dbOverlayBySig[rowSignature(m)];
          const row = {
            ...(ov && ov.db_id != null && ov.db_id > 0 ? { id: ov.db_id } : {}),
            stage_id,
            group_id,
            team_a_id: m.team_a_id ?? null,
            team_b_id: m.team_b_id ?? null,
            team_a_score: ov?.team_a_score ?? null,
            team_b_score: ov?.team_b_score ?? null,
            winner_team_id: ov?.winner_team_id ?? null,
            status: ov?.status ?? "scheduled",
            match_date: m.match_date ?? null,
            matchday: m.matchday ?? null,
            round: m.round ?? null,
            bracket_pos: m.bracket_pos ?? null,
            home_source_round: m.home_source_round ?? null,
            home_source_bracket_pos: m.home_source_bracket_pos ?? null,
            away_source_round: m.away_source_round ?? null,
            away_source_bracket_pos: m.away_source_bracket_pos ?? null,
            home_source_outcome: ov?.home_source_outcome ?? null,
            away_source_outcome: ov?.away_source_outcome ?? null,
            updated_at: ov?.updated_at ?? null,
          };
          upsert.push(row);
        });
        const deleteIds = Array.from(st4.dirty.deletedMatchIds).filter((x: number) => x > 0);
        payload4.matches = { upsert, deleteIds };
      }

      if (Object.keys(payload4).length) {
        console.log("[save-all] - Sending Phase 4 data...");
        const resp4 = await doPost(tid, payload4, "phase4");

        if (resp4.intakeMappings) {
          set((curr) => ({
            entities: { ...curr.entities, intakeMappings: resp4.intakeMappings },
            dirty: { ...curr.dirty, intakeMappings: false },
          }));
        }

        if (resp4.stageSlots) {
          const nextSlots = [...get().entities.stageSlots];
          resp4.stageSlots.forEach((newS: DbStageSlot) => {
            const idx = nextSlots.findIndex((old: DbStageSlot) => old.stage_id === newS.stage_id && old.group_id === newS.group_id && old.slot_id === newS.slot_id);
            if (idx >= 0) nextSlots[idx] = newS;
            else nextSlots.push(newS);
          });
          set((curr) => ({
            entities: { ...curr.entities, stageSlots: nextSlots },
            dirty: { ...curr.dirty, stageSlots: new Set() },
          }));
        }

        if (resp4.matches) {
          const nextOverlay: Record<string, DbOverlay> = { ...get().dbOverlayBySig };
          resp4.matches.forEach((newM: DbMatchRow) => {
            const sIdx = get().ids.stageIndexById[newM.stage_id];
            const groupIdx = newM.group_id ? get().ids.groupIndexByStageAndId[newM.stage_id]?.[newM.group_id] : null;
            const uiRow: DraftMatch = {
              stageIdx: sIdx!,
              groupIdx,
              matchday: newM.matchday ?? null,
              round: newM.round ?? null,
              bracket_pos: newM.bracket_pos ?? null,
              match_date: newM.match_date ?? null,
              team_a_id: newM.team_a_id ?? null,
              team_b_id: newM.team_b_id ?? null,
              home_source_round: newM.home_source_round ?? null,
              home_source_bracket_pos: newM.home_source_bracket_pos ?? null,
              away_source_round: newM.away_source_round ?? null,
              away_source_bracket_pos: newM.away_source_bracket_pos ?? null,
            };
            const base: DbOverlay = {
              db_id: newM.id ?? null,
              updated_at: newM.updated_at ?? null,
              status: newM.status ?? null,
              team_a_score: newM.team_a_score ?? null,
              team_b_score: newM.team_b_score ?? null,
              winner_team_id: newM.winner_team_id ?? null,
              home_source_round: newM.home_source_round ?? null,
              home_source_bracket_pos: newM.home_source_bracket_pos ?? null,
              away_source_round: newM.away_source_round ?? null,
              away_source_bracket_pos: newM.away_source_bracket_pos ?? null,
              home_source_outcome: newM.home_source_outcome ?? null,
              away_source_outcome: newM.away_source_outcome ?? null,
            };
            const sigStable = rowSignatureStable(uiRow);
            const sigDB = rowSignatureDB(uiRow);
            const sigLegacy = rowSignature(uiRow);
            nextOverlay[sigStable] = base;
            nextOverlay[sigDB] = base;
            nextOverlay[sigLegacy] = base;
          });
          set((curr) => ({
            dbOverlayBySig: nextOverlay,
            dirty: { ...curr.dirty, matches: new Set(), deletedMatchIds: new Set() },
          }));
        } else if (payload4.matches) {
          set((curr) => ({
            dirty: { ...curr.dirty, matches: new Set(), deletedMatchIds: new Set() },
          }));
        }
      }
  
    } finally {
      set({ busy: false });
    }
  }  
}));

/* =========================================================
   Convenience hooks
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
  const st = useTournamentStore.getState();
  const ov =
    st.dbOverlayBySig[rowSignatureStable(row)] ||
    st.dbOverlayBySig[rowSignatureDB(row)] ||
    st.dbOverlayBySig[rowSignature(row)] ||
    findOverlayLoose(st.dbOverlayBySig as any, rowSignature(row));
  return ov ? ({ ...row, ...ov } as DraftMatch & DbOverlay) : row;
}
