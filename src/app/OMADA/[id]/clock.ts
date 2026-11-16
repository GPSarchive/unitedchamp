// Europe/Athens clock helpers for the next-match block. Pure, and small enough
// to ship to the browser (the countdown runs there).
//
// match_date digits ARE the Athens kick-off wall-clock (lib/datetime.ts), so
// the real instant of a kick-off is found by asking what Athens' offset is at
// that moment — never by `new Date(match_date)`.
//
// The same rules as src/app/lib/profile/athensTime.ts of the player area
// (branch feat/player-profile-area). When that lands, import from there.
import { parseIsoPreserveClock, type DateParts } from "@/app/lib/datetime";

const ATHENS_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Athens",
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** Athens wall-clock parts of a real instant. */
export function athensParts(now: Date): DateParts {
  const p: Record<string, number> = {};
  for (const part of ATHENS_FORMAT.formatToParts(now)) {
    if (part.type !== "literal") p[part.type] = Number(part.value);
  }
  return { y: p.year, M: p.month, d: p.day, h: p.hour % 24, min: p.minute, s: p.second };
}

const asUtc = (p: DateParts) => Date.UTC(p.y, p.M - 1, p.d, p.h, p.min, p.s);

/** Real instant (epoch ms) of a match kick-off, summer time included; null when undated. */
export function kickoffEpoch(matchDate: string | null | undefined): number | null {
  const parts = parseIsoPreserveClock(matchDate);
  if (!parts) return null;
  const guess = asUtc(parts);
  const offsetAt = (t: number) => asUtc(athensParts(new Date(t))) - t;
  // Two passes: the offset at the guess can sit on the other side of a clock change.
  const first = guess - offsetAt(guess);
  return guess - offsetAt(first);
}

/** Whole calendar days from today (Athens) to the match day: 0 today, 1 tomorrow. */
export function daysUntil(matchDate: string | null | undefined, now: Date): number | null {
  const k = parseIsoPreserveClock(matchDate);
  if (!k) return null;
  const a = athensParts(now);
  return Math.round((Date.UTC(k.y, k.M - 1, k.d) - Date.UTC(a.y, a.M - 1, a.d)) / 86_400_000);
}

/** «Σήμερα», «Αύριο», «σε 6 μέρες». Empty when undated or already past. */
export function dayLabel(matchDate: string | null | undefined, now: Date): string {
  const d = daysUntil(matchDate, now);
  if (d === null || d < 0) return "";
  if (d === 0) return "Σήμερα";
  if (d === 1) return "Αύριο";
  return `σε ${d} μέρες`;
}

export type Countdown = { days: number; hours: number; minutes: number; seconds: number; done: boolean };

/** Time left until `kickoffMs`; all zeros (done) once it has passed. */
export function countdownParts(kickoffMs: number, nowMs: number): Countdown {
  const left = Math.max(0, Math.floor((kickoffMs - nowMs) / 1000));
  return {
    days: Math.floor(left / 86_400),
    hours: Math.floor((left % 86_400) / 3600),
    minutes: Math.floor((left % 3600) / 60),
    seconds: left % 60,
    done: left === 0,
  };
}
