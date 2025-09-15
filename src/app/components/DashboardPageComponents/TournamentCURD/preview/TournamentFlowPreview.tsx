"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";

// ⬇️ NEW: view-only bracket component
import ModernKnockoutViewer from "@/app/tournoua/[slug]/components/ModernKnockoutViewer";

/* =========================
   Types (relaxed for compat)
   ========================= */
type StageKind = "league" | "groups" | "knockout";

type DBStage = {
  id: number;
  tournament_id: number;
  name: string;
  kind: StageKind;
  ordering: number;
  config: any;
};

type StageStats = {
  matchesTotal: number;
  matchesFinished: number;
  slotsTotal: number;
  slotsFilled: number;
};

type TeamLite = { id: number; name: string; logo?: string | null; seed?: number | null };

// Minimal shape the viewer needs for a bracket match
type BracketMatch = {
  id: number;
  stage_id: number;
  round: number | null;
  bracket_pos: number | null;
  home_source_match_id: number | null;
  away_source_match_id: number | null;
  team_a_id: number | null;
  team_b_id: number | null;
  team_a_score: number | null;
  team_b_score: number | null;
  status: "scheduled" | "finished";
};

type GroupView = {
  key: string; // stable key
  title: string; // e.g., "Group A" or custom name
  slots: Array<{ slot: number; team: TeamLite | null }>;
};

type TeamDraft = {
  id: number;
  name?: string;
  logo?: string | null;
  seed?: number | null;
  groupsByStage?: Record<number, number | null>;
};

type DraftStage = {
  name: string;
  kind: StageKind;
  groups?: Array<{ name: string }>;
};

type DraftMatch = {
  stageIdx: number;
  groupIdx?: number | null;
  bracket_pos?: number | null;
  round?: number | null;
  team_a_id?: number | null;
  team_b_id?: number | null;
  matchday?: number | null;
};

type NewTournamentPayloadLike = {
  tournament: { name: string; slug?: string | null };
  stages: DraftStage[];
};

type DBProps = { tournamentId: number; className?: string };
type DraftProps = {
  payload: NewTournamentPayloadLike;
  teams: TeamDraft[];
  draftMatches: DraftMatch[];
  className?: string;
};
type Props = DBProps | DraftProps;

/* =========================
   UI helpers
   ========================= */
function KindBadge({ kind }: { kind: StageKind }) {
  const label = kind === "knockout" ? "Knockout" : kind === "groups" ? "Groups" : "League";
  return (
    <span className="inline-block text-xs px-2 py-0.5 rounded border border-white/10 bg-black/20">
      {label}
    </span>
  );
}

function StatChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block text-xs px-2 py-0.5 rounded bg-white/10 ring-1 ring-white/10">
      {children}
    </span>
  );
}

function letterFromIndex(i: number) {
  return String.fromCharCode(65 + (i ?? 0)); // 0 -> A
}

/* =========================
   DB mode loader
   ========================= */
async function fetchDbFlow(tournamentId: number) {
  // 1) Stages
  const { data: stages, error: stErr } = await supabase
    .from("tournament_stages")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("ordering", { ascending: true });
  if (stErr) throw stErr;

  const stageIds = (stages ?? []).map((s) => s.id);

  // 2) Matches → finished/total per stage, and full rows for KO rendering
  const statsByStage = new Map<number, StageStats>();
  const matchesByStage = new Map<number, BracketMatch[]>();

  if (stageIds.length) {
    const { data: ms } = await supabase
      .from("matches")
      .select(
        [
          "id",
          "stage_id",
          "status",
          "round",
          "bracket_pos",
          "home_source_match_id",
          "away_source_match_id",
          "team_a_id",
          "team_b_id",
          "team_a_score",
          "team_b_score",
        ].join(",")
      )
      .in("stage_id", stageIds);

    (stageIds ?? []).forEach((sid) => {
      // Work with any[] then map to our exact shape
      const rawForStage = ((ms ?? []) as any[]).filter((m) => m.stage_id === sid);

      const finished = rawForStage.filter((m) => m.status === "finished").length;

      statsByStage.set(sid, {
        matchesTotal: rawForStage.length,
        matchesFinished: finished,
        slotsTotal: 0,
        slotsFilled: 0,
      });

      const sortedRaw = rawForStage
        .slice()
        .sort(
          (a, b) =>
            (a.round ?? 0) - (b.round ?? 0) ||
            (a.bracket_pos ?? 0) - (b.bracket_pos ?? 0) ||
            a.id - b.id
        );

      // ✅ Shape to BracketMatch[]
      const shaped: BracketMatch[] = sortedRaw.map((m) => ({
        id: Number(m.id),
        stage_id: Number(m.stage_id),
        round: m.round ?? null,
        bracket_pos: m.bracket_pos ?? null,
        home_source_match_id: m.home_source_match_id ?? null,
        away_source_match_id: m.away_source_match_id ?? null,
        team_a_id: m.team_a_id ?? null,
        team_b_id: m.team_b_id ?? null,
        team_a_score: m.team_a_score ?? null,
        team_b_score: m.team_b_score ?? null,
        status: (m.status as "scheduled" | "finished") ?? "scheduled",
      }));

      matchesByStage.set(sid, shaped);
    });
  }

  // 3) Groups metadata
  const { data: groupRows } = await supabase
    .from("tournament_groups")
    .select("id, stage_id, name, ordering")
    .in("stage_id", stageIds)
    .order("ordering", { ascending: true });

  const namesByStageId: Record<number, string[]> = {};
  (groupRows ?? []).forEach((g: any) => {
    const arr = namesByStageId[g.stage_id] ?? [];
    arr.push(String(g.name || ""));
    namesByStageId[g.stage_id] = arr;
  });

  // 4) Stage slots (group_id/slot_id in your schema)
  const { data: slotRows } = await supabase
    .from("stage_slots")
    .select("stage_id, group_id, slot_id, team_id")
    .in("stage_id", stageIds);

  // Slots counters
  (slotRows ?? []).forEach((r: any) => {
    const s = statsByStage.get(r.stage_id) ?? {
      matchesTotal: 0,
      matchesFinished: 0,
      slotsTotal: 0,
      slotsFilled: 0,
    };
    s.slotsTotal += 1;
    if (r.team_id != null) s.slotsFilled += 1;
    statsByStage.set(r.stage_id, s);
  });

  // 5) Resolve team names — collect from both slots and matches
  const teamIds = new Set<number>();
  (slotRows ?? []).forEach((r: any) => {
    if (r.team_id != null) teamIds.add(r.team_id);
  });
  matchesByStage.forEach((list) => {
    list.forEach((m) => {
      if (m.team_a_id != null) teamIds.add(m.team_a_id);
      if (m.team_b_id != null) teamIds.add(m.team_b_id);
    });
  });

  const teamsMap: Record<number, TeamLite> = {};
  if (teamIds.size) {
    const { data: teams } = await supabase
      .from("teams")
      .select("id,name,logo")
      .in("id", Array.from(teamIds));
    (teams ?? []).forEach((t: any) => {
      teamsMap[t.id] = { id: t.id, name: t.name, logo: t.logo ?? null };
    });
  }

  // 6) Build per-stage group views
  const groupsByStage = new Map<number, GroupView[]>();

  (stages ?? []).forEach((stg: any) => {
    if (stg.kind === "groups" || stg.kind === "league") {
      const allSlots = (slotRows ?? []).filter((r: any) => r.stage_id === stg.id);
      const maxByGroup = new Map<number, number>();
      allSlots.forEach((r: any) => {
        const cur = maxByGroup.get(r.group_id) ?? 0;
        maxByGroup.set(r.group_id, Math.max(cur, Number(r.slot_id || 0)));
      });

      const stageGroupNames = namesByStageId[stg.id] ?? [];

      const groupIndices =
        stg.kind === "league"
          ? [0]
          : Array.from(new Set(allSlots.map((r: any) => Number(r.group_id || 0)))).sort((a, b) => a - b);

      const views: GroupView[] = groupIndices.map((gIdx) => {
        const title =
          stg.kind === "league"
            ? "League"
            : stageGroupNames[gIdx] || `Group ${letterFromIndex(gIdx)}`;

        const maxSlots = maxByGroup.get(gIdx) ?? 0;
        const slots: Array<{ slot: number; team: TeamLite | null }> = [];

        for (let s = 1; s <= Math.max(maxSlots, 1); s++) {
          const row = allSlots.find(
            (r: any) => Number(r.group_id || 0) === gIdx && Number(r.slot_id || 0) === s
          );
          const team =
            row?.team_id != null ? teamsMap[row.team_id] ?? null : null;
          slots.push({ slot: s, team });
        }

        return { key: `${stg.id}-${gIdx}`, title, slots };
      });

      groupsByStage.set(stg.id, views);
    }
  });

  return {
    stages: (stages ?? []) as DBStage[],
    statsByStage,
    groupsByStage,
    matchesByStage,
    teamsMap,
  };
}

/* =========================
   Draft mode builder
   ========================= */
function computeDraft(
  payload: NewTournamentPayloadLike,
  teams: TeamDraft[],
  draftMatches: DraftMatch[]
) {
  const stages = payload.stages.map((s, i) => ({
    id: i + 1,
    tournament_id: -1,
    name: s.name || `Stage ${i + 1}`,
    kind: s.kind,
    ordering: i + 1,
    config: {},
  })) as DBStage[];

  const statsByStage = new Map<number, StageStats>();
  const groupsByStage = new Map<number, GroupView[]>();
  const matchesByStage = new Map<number, BracketMatch[]>();
  const teamsMap: Record<number, TeamLite> = {};

  teams.forEach((t) => {
    teamsMap[t.id] = { id: t.id, name: t.name ?? `#${t.id}`, logo: t.logo ?? null, seed: t.seed ?? null };
  });

  stages.forEach((stg, idx) => {
    // matches-only stats
    const ms = draftMatches.filter((m) => m.stageIdx === idx);
    statsByStage.set(stg.id, {
      matchesTotal: ms.length,
      matchesFinished: 0,
      slotsTotal: 0,
      slotsFilled: 0,
    });

    if (stg.kind === "knockout") {
      // synthesize IDs for draft matches
      const draft: BracketMatch[] = ms.map((m, i) => ({
        id: i + 1,
        stage_id: stg.id,
        round: m.round ?? 1,
        bracket_pos: m.bracket_pos ?? (i + 1),
        home_source_match_id: null,
        away_source_match_id: null,
        team_a_id: m.team_a_id ?? null,
        team_b_id: m.team_b_id ?? null,
        team_a_score: null,
        team_b_score: null,
        status: "scheduled",
      }));
      matchesByStage.set(stg.id, draft);
    }

    if (stg.kind === "groups" || stg.kind === "league") {
      const groupNames = payload.stages[idx].groups?.map((g) => g.name) ?? [];
      const groupsCount = Math.max(groupNames.length, 1);

      const buckets: Array<TeamLite[]> = Array.from({ length: groupsCount }, () => []);
      teams.forEach((t) => {
        const gi = t.groupsByStage?.[idx];
        if (gi != null && gi >= 0 && gi < groupsCount) {
          buckets[gi].push({ id: t.id, name: t.name ?? `#${t.id}`, logo: t.logo ?? null });
        }
      });

      const views: GroupView[] = buckets.map((list, gIdx) => {
        const title = stg.kind === "league" ? "League" : groupNames[gIdx] || `Group ${letterFromIndex(gIdx)}`;
        const slots = list.map((tm, i) => ({ slot: i + 1, team: tm }));
        // quick stats
        const s = statsByStage.get(stg.id)!;
        s.slotsTotal += slots.length;
        s.slotsFilled += slots.length;
        return { key: `${stg.id}-${gIdx}`, title, slots };
      });

      groupsByStage.set(stg.id, views);
    }
  });

  return { stages, statsByStage, groupsByStage, matchesByStage, teamsMap };
}

/* =========================
   Component
   ========================= */
export default function TournamentFlowPreview(props: Props) {
  const isDbMode = "tournamentId" in props;

  const [dbStages, setDbStages] = useState<DBStage[]>([]);
  const [statsByStage, setStatsByStage] = useState<Map<number, StageStats>>(new Map());
  const [groupsByStage, setGroupsByStage] = useState<Map<number, GroupView[]>>(new Map());
  const [matchesByStage, setMatchesByStage] = useState<Map<number, BracketMatch[]>>(new Map());
  const [teamsMap, setTeamsMap] = useState<Record<number, TeamLite>>({});
  const [loading, setLoading] = useState(isDbMode);
  const [error, setError] = useState<string | null>(null);

  // load
  useEffect(() => {
    let stop = false;
    async function run() {
      if (!isDbMode) return;
      setLoading(true);
      setError(null);
      try {
        const { stages, statsByStage, groupsByStage, matchesByStage, teamsMap } = await fetchDbFlow(
          props.tournamentId
        );
        if (!stop) {
          setDbStages(stages);
          setStatsByStage(statsByStage);
          setGroupsByStage(groupsByStage);
          setMatchesByStage(matchesByStage);
          setTeamsMap(teamsMap);
        }
      } catch (e: any) {
        if (!stop) setError(e?.message ?? String(e));
      } finally {
        if (!stop) setLoading(false);
      }
    }
    void run();
    return () => {
      stop = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDbMode, isDbMode ? props.tournamentId : null]);

  // realtime in DB mode
  useEffect(() => {
    if (!isDbMode) return;
    const channel = supabase
      .channel(`tflow_${props.tournamentId}`)
      .on(
        "postgres_changes",
        { schema: "public", event: "*", table: "matches", filter: `tournament_id=eq.${props.tournamentId}` },
        async () => {
          const { stages, statsByStage, groupsByStage, matchesByStage, teamsMap } = await fetchDbFlow(
            props.tournamentId
          );
          setDbStages(stages);
          setStatsByStage(statsByStage);
          setGroupsByStage(groupsByStage);
          setMatchesByStage(matchesByStage);
          setTeamsMap(teamsMap);
        }
      )
      .on(
        "postgres_changes",
        { schema: "public", event: "*", table: "stage_slots" },
        async () => {
          const { stages, statsByStage, groupsByStage, matchesByStage, teamsMap } = await fetchDbFlow(
            props.tournamentId
          );
          setDbStages(stages);
          setStatsByStage(statsByStage);
          setGroupsByStage(groupsByStage);
          setMatchesByStage(matchesByStage);
          setTeamsMap(teamsMap);
        }
      )
      .on(
        "postgres_changes",
        { schema: "public", event: "*", table: "tournament_groups" },
        async () => {
          const { stages, statsByStage, groupsByStage, matchesByStage, teamsMap } = await fetchDbFlow(
            props.tournamentId
          );
          setDbStages(stages);
          setStatsByStage(statsByStage);
          setGroupsByStage(groupsByStage);
          setMatchesByStage(matchesByStage);
          setTeamsMap(teamsMap);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDbMode, isDbMode ? props.tournamentId : null]);

  const view = useMemo(() => {
    if (isDbMode) {
      return {
        title: `Tournament #${props.tournamentId}`,
        stages: dbStages,
        statsByStage,
        groupsByStage,
        matchesByStage,
        teamsMap,
      };
    }
    const draft = computeDraft((props as DraftProps).payload, (props as DraftProps).teams, (props as DraftProps).draftMatches);
    return {
      title: (props as DraftProps).payload.tournament?.name || "New tournament",
      ...draft,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDbMode, dbStages, statsByStage, groupsByStage, matchesByStage, teamsMap, isDbMode ? props : (props as DraftProps).payload]);

  if (loading) return <div className={(props as any).className}>Loading tournament flow…</div>;
  if (error)
    return (
      <div className={(props as any).className}>
        <div className="rounded-md border border-red-500/40 bg-red-900/20 p-3 text-red-200 text-sm">
          Failed to load flow: {error}
        </div>
      </div>
    );

  const { stages } = view;
  if (!stages || stages.length === 0) return <div className={(props as any).className}>No stages yet.</div>;

  return (
    <div className={(props as any).className}>
      <div className="overflow-x-auto rounded-2xl bg-zinc-800/30 p-4">
        <div className="flex items-stretch gap-6">
          {stages.map((stg, idx) => {
            const stats = view.statsByStage.get(stg.id);
            const matchesLine =
              stats && (stats.matchesTotal > 0 || stats.matchesFinished > 0)
                ? `Matches: ${stats.matchesFinished}/${stats.matchesTotal}`
                : null;
            const slotsLine =
              stats && (stats.slotsTotal > 0 || stats.slotsFilled > 0)
                ? `Slots: ${stats.slotsFilled}/${stats.slotsTotal}`
                : null;

            const groupViews = view.groupsByStage.get(stg.id) ?? [];
            const bracketMatches = view.matchesByStage.get(stg.id) ?? [];
            const stageTeamsMap = view.teamsMap;

            return (
              <React.Fragment key={stg.id}>
                <div className="min-w-[520px] rounded-2xl bg-zinc-700/80 ring-1 ring-white/10 p-4 text-white">
                  <div className="text-xs text-white/70 mb-1">Stage {idx + 1}</div>
                  <div className="text-lg font-semibold leading-tight">{stg.name || `Stage ${idx + 1}`}</div>
                  <div className="mt-2"><KindBadge kind={stg.kind} /></div>

                  {(matchesLine || slotsLine) && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {matchesLine && <StatChip>{matchesLine}</StatChip>}
                      {slotsLine && stg.kind !== "knockout" && <StatChip>{slotsLine}</StatChip>}
                    </div>
                  )}

                  {/* 🔵 Knockout: show the bracket viewer */}
                  {stg.kind === "knockout" && (
                    <div className="mt-4">
                      <ModernKnockoutViewer
                        title="Bracket"
                        matches={bracketMatches}
                        teamsMap={stageTeamsMap}
                        // optional: click to open a modal / route
                        onMatchClick={(m) => {
                          // console.log("match", m.id);
                        }}
                      />
                    </div>
                  )}

                  {/* 🟢 Groups/League contents */}
                  {(stg.kind === "groups" || stg.kind === "league") && groupViews.length > 0 && (
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {groupViews.map((g) => (
                        <div key={g.key} className="rounded-xl bg-black/20 ring-1 ring-white/10 p-3">
                          <div className="text-sm font-medium mb-2">{g.title}</div>
                          <ul className="space-y-1">
                            {g.slots.length === 0 ? (
                              <li className="text-white/60 text-xs">No teams assigned yet.</li>
                            ) : (
                              g.slots.map((s) => (
                                <li key={s.slot} className="flex items-center justify-between text-sm">
                                  <span className="text-white/60">#{s.slot}</span>
                                  <span className="font-medium">
                                    {s.team ? s.team.name : <span className="text-white/50">TBD</span>}
                                  </span>
                                </li>
                              ))
                            )}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {idx < stages.length - 1 && <div className="self-center w-10 h-px bg-blue-400/60 opacity-70" />}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
