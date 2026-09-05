// Age in whole years from a 'YYYY-MM-DD' birth date. Pure: no I/O and no
// time-zone conversion — both sides are plain calendar dates, so the result
// never shifts with the server's UTC offset. "Today" defaults to the league's
// calendar date (Europe/Athens), like the season preflight. Unit-tested in
// __tests__/playerAge.test.ts.

import { calendarDateIn } from "@/app/lib/seasonChecks";

const LEAGUE_TZ = "Europe/Athens";

function ymd(s: string): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return [y, mo, d];
}

/** Whole years lived on `todayIso`; null for a missing, malformed or implausible date. */
export function ageFromBirthDate(
  birthDate: string | null | undefined,
  todayIso: string = calendarDateIn(LEAGUE_TZ),
): number | null {
  if (!birthDate) return null;
  const b = ymd(birthDate);
  const t = ymd(todayIso);
  if (!b || !t) return null;
  let age = t[0] - b[0];
  if (t[1] < b[1] || (t[1] === b[1] && t[2] < b[2])) age -= 1;
  return age >= 0 && age <= 120 ? age : null;
}
