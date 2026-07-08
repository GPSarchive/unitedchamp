// app/geniki-katataxi/points.ts
// Points engine for the Γενική Κατάταξη (per-season, team-based).
//
// Automatic (computed from tournaments/matches):
//   Συμμετοχή σε τουρνουά  +50
//   Πρόκριση (κάθε πέρασμα σε επόμενη φάση — όμιλοι, προημιτελικά, ημιτελικά, τελικός)  +50
//   Νικητής τουρνουά  +500
//   Διεκδικητής (φιναλίστ)  +200
//   Νίκη +15 · Ισοπαλία +5 · Ήττα −10
//
// Manual (rows in season_team_adjustments — migrations/add-season-team-adjustments.sql):
//   Διεθνής διάκριση +1000 · Διεθνής συμμετοχή +300 · Αποχώρηση −100 · Διακοπή −30,
//   plus manual grants of any other rule via the dashboard (/dashboard/geniki-katataxi).

import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import {
  ADJUSTMENT_PRESETS,
  NO_SEASON_LABEL,
  POINTS,
  automaticSourceKey,
  parseCancelTag,
  type AdjustmentKind,
  type EventKind,
  type PointsEvent,
} from "./rules";

export { ADJUSTMENT_PRESETS, NO_SEASON_LABEL, POINTS } from "./rules";
export type { AdjustmentKind, EventKind, PointsEvent } from "./rules";

export interface SeasonAdjustment {
  id: number;
  season: string;
  team_id: number;
  kind: AdjustmentKind;
  points: number;
  reason: string | null;
}

export interface TeamSeasonLine {
  teamId: number;
  participations: number;
  qualifications: number;
  titles: number;
  runnerUps: number;
  wins: number;
  draws: number;
  losses: number;
  adjustmentPoints: number;
  adjustmentCount: number;
  points: number;
}

export interface GeneralStandings {
  /** Season labels, newest first. */
  seasons: string[];
  /** season label → lines sorted by points desc (unranked). */
  bySeason: Map<string, TeamSeasonLine[]>;
  /** Full log of every points award, all seasons. */
  events: PointsEvent[];
  /** Whether the manual-adjustments table was readable. */
  adjustmentsAvailable: boolean;
}

type TournamentRow = {
  id: number;
  name: string | null;
  season: string | null;
  status: string;
  winner_team_id: number | null;
};
type StageRow = { id: number; tournament_id: number; kind: string; ordering: number | null };
type ParticipationRow = { tournament_id: number; team_id: number; stage_id: number | null };
type MatchRow = {
  tournament_id: number | null;
  stage_id: number | null;
  team_a_id: number | null;
  team_b_id: number | null;
  team_a_score: number | null;
  team_b_score: number | null;
  winner_team_id: number | null;
  status: string;
  round: number | null;
  bracket_pos: number | null;
  leg: number | null;
};

const PAGE = 1000;

async function fetchAll<T>(table: string, columns: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select(columns)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`[geniki-katataxi] ${table}: ${error.message}`);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

function seasonKey(raw: string | null): string {
  const s = (raw ?? "").trim();
  return s || NO_SEASON_LABEL;
}

function blankLine(teamId: number): TeamSeasonLine {
  return {
    teamId,
    participations: 0,
    qualifications: 0,
    titles: 0,
    runnerUps: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    adjustmentPoints: 0,
    adjustmentCount: 0,
    points: 0,
  };
}

export async function computeGeneralStandings(): Promise<GeneralStandings> {
  const [tournaments, stages, participations, matches] = await Promise.all([
    fetchAll<TournamentRow>("tournaments", "id, name, season, status, winner_team_id"),
    fetchAll<StageRow>("tournament_stages", "id, tournament_id, kind, ordering"),
    fetchAll<ParticipationRow>("tournament_teams", "tournament_id, team_id, stage_id"),
    fetchAll<MatchRow>(
      "matches",
      "tournament_id, stage_id, team_a_id, team_b_id, team_a_score, team_b_score, winner_team_id, status, round, bracket_pos, leg"
    ),
  ]);

  // Manual adjustments live in an optional table; degrade gracefully until the migration runs.
  let adjustments: SeasonAdjustment[] = [];
  let adjustmentsAvailable = true;
  try {
    adjustments = await fetchAll<SeasonAdjustment>(
      "season_team_adjustments",
      "id, season, team_id, kind, points, reason"
    );
  } catch {
    adjustmentsAvailable = false;
  }

  const stageById = new Map(stages.map((s) => [s.id, s]));
  const stagesByTournament = new Map<number, StageRow[]>();
  for (const s of stages) {
    const list = stagesByTournament.get(s.tournament_id) ?? [];
    list.push(s);
    stagesByTournament.set(s.tournament_id, list);
  }

  const participantsByTournament = new Map<number, Set<number>>();
  const participationsByTournament = new Map<number, ParticipationRow[]>();
  for (const p of participations) {
    const set = participantsByTournament.get(p.tournament_id) ?? new Set<number>();
    set.add(p.team_id);
    participantsByTournament.set(p.tournament_id, set);
    const list = participationsByTournament.get(p.tournament_id) ?? [];
    list.push(p);
    participationsByTournament.set(p.tournament_id, list);
  }

  const matchesByTournament = new Map<number, MatchRow[]>();
  for (const m of matches) {
    if (m.tournament_id == null) continue;
    const list = matchesByTournament.get(m.tournament_id) ?? [];
    list.push(m);
    matchesByTournament.set(m.tournament_id, list);
  }

  const bySeason = new Map<string, Map<number, TeamSeasonLine>>();
  const events: PointsEvent[] = [];
  const line = (season: string, teamId: number): TeamSeasonLine => {
    let teamMap = bySeason.get(season);
    if (!teamMap) {
      teamMap = new Map();
      bySeason.set(season, teamMap);
    }
    let l = teamMap.get(teamId);
    if (!l) {
      l = blankLine(teamId);
      teamMap.set(teamId, l);
    }
    return l;
  };

  for (const t of tournaments) {
    const tMatches = matchesByTournament.get(t.id) ?? [];
    // Registration alone isn't participation — the tournament must have started.
    // Admins don't always flip status off "scheduled", so a finished match also counts.
    const anyFinished = tMatches.some((m) => m.status === "finished");
    if (t.status === "scheduled" && !anyFinished) continue;
    const season = seasonKey(t.season);
    const tName = (t.name ?? "").trim() || `Τουρνουά #${t.id}`;
    // Emit one aggregated automatic event, tagged with a stable source key so the
    // admin panel can cancel/override it with a counter-adjustment.
    const emit = (teamId: number, kind: EventKind, count: number, points: number) => {
      events.push({
        season,
        teamId,
        kind,
        count,
        points,
        label: tName,
        tournamentId: t.id,
        sourceKey: automaticSourceKey(season, teamId, kind, t.id),
      });
    };

    const tParticipations = participationsByTournament.get(t.id) ?? [];

    // Participants: registered teams plus anyone who actually appears in a match.
    const participants = new Set(participantsByTournament.get(t.id) ?? []);
    for (const m of tMatches) {
      if (m.team_a_id != null) participants.add(m.team_a_id);
      if (m.team_b_id != null) participants.add(m.team_b_id);
    }
    for (const teamId of participants) {
      line(season, teamId).participations += 1;
      emit(teamId, "participation", 1, POINTS.participation);
    }

    // Πρόκριση: +50 for each new phase a team enters after its first one in the
    // tournament. Every stage entered counts as a phase (including parallel /
    // consolation knockout paths), and inside a knockout stage every extra tie the
    // team is slotted into counts as a phase. Ties are (round, bracket_pos) pairs —
    // rounds are not always numbered sequentially, and two legs share a tie.
    const stagesByTeam = new Map<number, Set<number>>();
    const koTiesByTeam = new Map<number, Map<number, Set<string>>>();
    const enterStage = (teamId: number | null, stageId: number) => {
      if (teamId == null) return;
      let set = stagesByTeam.get(teamId);
      if (!set) {
        set = new Set();
        stagesByTeam.set(teamId, set);
      }
      set.add(stageId);
    };
    const enterTie = (teamId: number | null, stageId: number, tieKey: string) => {
      if (teamId == null) return;
      let byStage = koTiesByTeam.get(teamId);
      if (!byStage) {
        byStage = new Map();
        koTiesByTeam.set(teamId, byStage);
      }
      let ties = byStage.get(stageId);
      if (!ties) {
        ties = new Set();
        byStage.set(stageId, ties);
      }
      ties.add(tieKey);
    };
    for (const p of tParticipations) {
      if (p.stage_id != null) enterStage(p.team_id, p.stage_id);
    }
    for (const m of tMatches) {
      if (m.stage_id == null) continue;
      enterStage(m.team_a_id, m.stage_id);
      enterStage(m.team_b_id, m.stage_id);
      if (stageById.get(m.stage_id)?.kind === "knockout") {
        const tieKey = `${m.round ?? 0}:${m.bracket_pos ?? 0}`;
        enterTie(m.team_a_id, m.stage_id, tieKey);
        enterTie(m.team_b_id, m.stage_id, tieKey);
      }
    }
    for (const [teamId, stageSet] of stagesByTeam) {
      let advances = stageSet.size - 1;
      const koTies = koTiesByTeam.get(teamId);
      if (koTies) for (const ties of koTies.values()) advances += ties.size - 1;
      if (advances > 0) {
        line(season, teamId).qualifications += advances;
        emit(teamId, "qualification", advances, advances * POINTS.qualification);
      }
    }

    // Per-match results. Each leg of a two-legged tie is one match result, decided
    // by its own score — on leg rows winner_team_id marks the TIE winner (aggregate
    // or penalties), not the leg's result. Level scores are a draw at match level
    // (a shootout only decides who advances).
    const records = new Map<number, { w: number; d: number; l: number }>();
    const record = (teamId: number) => {
      let r = records.get(teamId);
      if (!r) {
        r = { w: 0, d: 0, l: 0 };
        records.set(teamId, r);
      }
      return r;
    };
    for (const m of tMatches) {
      if (m.status !== "finished") continue;
      const { team_a_id: a, team_b_id: b } = m;
      if (a == null || b == null) continue;
      const hasScores = m.team_a_score != null && m.team_b_score != null;
      let winner: number | null = null;
      if (hasScores && m.team_a_score !== m.team_b_score) {
        winner = m.team_a_score! > m.team_b_score! ? a : b;
      } else if (m.leg == null && m.winner_team_id != null) {
        winner = m.winner_team_id; // e.g. a forfeit recorded without a real score
      }
      if (winner != null) {
        record(winner).w += 1;
        record(winner === a ? b : a).l += 1;
      } else if (hasScores) {
        record(a).d += 1;
        record(b).d += 1;
      }
    }
    for (const [teamId, r] of records) {
      const l = line(season, teamId);
      l.wins += r.w;
      l.draws += r.d;
      l.losses += r.l;
      if (r.w > 0) emit(teamId, "win", r.w, r.w * POINTS.win);
      if (r.d > 0) emit(teamId, "draw", r.d, r.d * POINTS.draw);
      if (r.l > 0) emit(teamId, "loss", r.l, r.l * POINTS.loss);
    }

    // Τίτλος + διεκδικητής. Winner is the admin-set winner_team_id; the runner-up is
    // the winner's opponent in their LAST finished knockout match. (Tournaments here
    // have parallel knockout paths — consolation brackets, ULTRA/GREAT paths — so the
    // final is not simply "the last knockout stage's top round".)
    if (t.winner_team_id != null) {
      line(season, t.winner_team_id).titles += 1;
      emit(t.winner_team_id, "title", 1, POINTS.tournamentWinner);

      let final: MatchRow | null = null;
      let finalKey = -1;
      for (const m of tMatches) {
        if (m.status !== "finished" || m.stage_id == null) continue;
        if (m.team_a_id !== t.winner_team_id && m.team_b_id !== t.winner_team_id) continue;
        if (stageById.get(m.stage_id)?.kind !== "knockout") continue;
        const stage = stageById.get(m.stage_id)!;
        const key =
          (stage.ordering ?? 0) * 1_000_000 + (m.round ?? 0) * 1_000 + (m.bracket_pos ?? 0);
        if (key > finalKey) {
          finalKey = key;
          final = m;
        }
      }
      const runnerUp =
        final == null
          ? null
          : final.team_a_id === t.winner_team_id
            ? final.team_b_id
            : final.team_a_id;
      if (runnerUp != null) {
        line(season, runnerUp).runnerUps += 1;
        emit(runnerUp, "runner_up", 1, POINTS.runnerUp);
      }
    }
  }

  // Manual adjustments (international distinction/participation, withdrawal,
  // abandonment, or any rule granted by hand in the dashboard). Some adjustments are
  // "counter-adjustments" created by the admin cancel action: they carry a machine tag
  // pairing them to an automatic event's sourceKey, which we use to neutralise it.
  const cancelledByKey = new Map<string, number>();
  for (const adj of adjustments) {
    const key = parseCancelTag(adj.reason);
    if (key) cancelledByKey.set(key, adj.id);
  }

  for (const adj of adjustments) {
    const season = seasonKey(adj.season);
    const l = line(season, adj.team_id);
    l.adjustmentPoints += adj.points;
    l.adjustmentCount += 1;
    const preset = ADJUSTMENT_PRESETS[adj.kind] ?? ADJUSTMENT_PRESETS.other;
    const cancelsSourceKey = parseCancelTag(adj.reason) ?? undefined;
    events.push({
      season,
      teamId: adj.team_id,
      kind: "adjustment",
      adjustmentKind: adj.kind,
      count: 1,
      points: adj.points,
      label: (adj.reason ?? "").trim() || preset.label,
      adjustmentId: adj.id,
      cancelsSourceKey,
    });
  }

  // Flag each automatic event that a counter-adjustment neutralises.
  if (cancelledByKey.size > 0) {
    for (const e of events) {
      if (e.sourceKey && cancelledByKey.has(e.sourceKey)) {
        e.cancelledBy = cancelledByKey.get(e.sourceKey);
      }
    }
  }

  // Totals.
  const result = new Map<string, TeamSeasonLine[]>();
  for (const [season, teamMap] of bySeason) {
    const lines = [...teamMap.values()].map((l) => ({
      ...l,
      points:
        l.participations * POINTS.participation +
        l.qualifications * POINTS.qualification +
        l.titles * POINTS.tournamentWinner +
        l.runnerUps * POINTS.runnerUp +
        l.wins * POINTS.win +
        l.draws * POINTS.draw +
        l.losses * POINTS.loss +
        l.adjustmentPoints,
    }));
    lines.sort((a, b) => b.points - a.points || b.wins - a.wins || a.teamId - b.teamId);
    result.set(season, lines);
  }

  const seasons = [...result.keys()].sort((a, b) => {
    if (a === NO_SEASON_LABEL) return 1;
    if (b === NO_SEASON_LABEL) return -1;
    return b.localeCompare(a, "el", { numeric: true });
  });

  return { seasons, bySeason: result, events, adjustmentsAvailable };
}
