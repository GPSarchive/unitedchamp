// What the «Αγώνες» tab shows, as plain data the server
// hands to the client part: every match with the few words that go with it,
// the stages in playing order, and the rule that picks the day the page opens
// on. Pure: no React, no database.
import { toNaiveIso } from "@/app/lib/datetime";
import type { TMatch, TTeam } from "../../../tournaments-v3/[id]/model";
import type { StageState } from "../stages";

/** The key of the strip item for matches with no date yet (sorts after every real day). */
export const UNDATED = "undated";

export type StageInfo = {
  id: number;
  /** Its number among the stages that have matches, first = 1. */
  n: number;
  title: string;
  state: StageState;
};

export type ViewMatch = {
  m: TMatch;
  /** Index into the stages list; -1 for a match entered without a stage. */
  stage: number;
  /** A knockout round's name («Ημιτελικά»), from the stage's tree. Never a matchday. */
  round: string | null;
  /** The group, or which leg («Ρεβάνς»). */
  note: string | null;
};

export type Day = {
  key: string;
  /** A match date of that day, to format the day from. Null for the undated item. */
  date: string | null;
  /** The stage of the day's first match (-1 when none, and for the undated item). */
  stage: number;
  matches: ViewMatch[];
};

const kickoff = (m: TMatch) => (m.date ? toNaiveIso(m.date) : null);

/** The calendar day a match is played on, from its literal wall-clock date. */
export const dayKey = (m: TMatch) => {
  const k = kickoff(m);
  return k ? k.slice(0, 10) : UNDATED;
};

/** Kick-off order; a match with no date comes after the dated ones. */
export const byKickoff = (x: ViewMatch, y: ViewMatch) =>
  (kickoff(x.m) ?? "9999").localeCompare(kickoff(y.m) ?? "9999") || x.m.id - y.m.id;

/** The matches by day, days in calendar order, the undated ones last. */
export function toDays(matches: ViewMatch[]): Day[] {
  const days = new Map<string, Day>();
  for (const vm of [...matches].sort(byKickoff)) {
    const key = dayKey(vm.m);
    // The undated item belongs to no stage: it stands last, out of the stages' time order.
    const day = days.get(key) ?? { key, date: vm.m.date, stage: key === UNDATED ? -1 : vm.stage, matches: [] };
    day.matches.push(vm);
    days.set(key, day);
  }
  return [...days.values()];
}

/** Consecutive days of the same stage, for the runs of the strip. */
export function stageRuns(days: Day[]): { stage: number; days: Day[] }[] {
  const runs: { stage: number; days: Day[] }[] = [];
  for (const day of days) {
    const last = runs[runs.length - 1];
    if (last && last.stage === day.stage) last.days.push(day);
    else runs.push({ stage: day.stage, days: [day] });
  }
  return runs;
}

/** The day the strip opens on: the first day today or later; else the last dated day; else the undated item. */
export function openingDay(days: Day[], nowIso: string): string | null {
  const today = nowIso.slice(0, 10);
  const dated = days.filter((d) => d.key !== UNDATED);
  const next = dated.find((d) => d.key >= today);
  if (next) return next.key;
  if (dated.length > 0) return dated[dated.length - 1].key;
  return days[0]?.key ?? null;
}

const plays = (vm: ViewMatch, team: number | null) => team === null || vm.m.a?.id === team || vm.m.b?.id === team;

/** One team's matches, in order. */
export const teamMatches = (matches: ViewMatch[], team: number) =>
  matches.filter((vm) => plays(vm, team)).sort(byKickoff);

/** Teams that have at least one match listed, in the order given (base.teams is by name). */
export const teamsWithMatches = (teams: TTeam[], matches: ViewMatch[]) =>
  teams.filter((t) => matches.some((vm) => vm.m.a?.id === t.id || vm.m.b?.id === t.id));
