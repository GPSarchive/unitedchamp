// Canonical date/time helpers — the single place that decides how a
// datetime is parsed and displayed.
//
// ── Match datetimes (`match_date`, calendar `start`/`end`) ────────────────
// The digits stored in the ISO string ARE the intended kickoff wall-clock
// time. Never run them through timezone conversion: `new Date(iso)` would
// reinterpret them as a UTC instant and re-render them in the runtime's
// zone (UTC on the server, the visitor's zone in the browser), shifting the
// time and sometimes rolling the date across midnight. Format the literal
// parts instead, so server and every browser render the same thing.
// (Decided in commit 3beac7e — "Show literal match date/time".)
//
// ── True instants (`published_at`, `created_at`, `postponed_at`, …) ───────
// These are real UTC timestamps. Convert them explicitly to Europe/Athens
// with `formatInstant` — never rely on the runtime's default zone.

const ISO_RE =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/;

const pad2 = (n: number | string) => String(n).padStart(2, "0");

export type DateParts = {
  y: number;
  M: number;
  d: number;
  h: number;
  min: number;
  s: number;
};

/** Literal Y-M-D-H-m-s digits of an ISO string, ignoring any zone suffix. */
export function parseIsoPreserveClock(
  iso: string | null | undefined
): DateParts | null {
  if (!iso) return null;
  const m = ISO_RE.exec(iso);
  if (!m) return null;
  const [, y, M, d, h, min, s] = m;
  return { y: +y, M: +M, d: +d, h: +h, min: +min, s: s ? +s : 0 };
}

/** The literal parts re-serialized as a zone-less ISO string. */
export function toNaiveIso(iso: string): string {
  const p = parseIsoPreserveClock(iso);
  if (!p) return iso;
  return partsToIso(p);
}

export function partsToIso({ y, M, d, h, min, s }: DateParts): string {
  return `${y}-${pad2(M)}-${pad2(d)}T${pad2(h)}:${pad2(min)}:${pad2(s)}`;
}

function daysInMonth(y: number, M: number) {
  return new Date(y, M, 0).getDate();
}

/** Shift wall-clock parts by whole minutes (e.g. kickoff + 50' = end time). */
export function addMinutesNaive(parts: DateParts, deltaMin: number): DateParts {
  const start = parts.h * 60 + parts.min;
  const total = start + deltaMin;
  let dayDelta = Math.floor(total / 1440);
  let minutesInDay = total % 1440;
  if (minutesInDay < 0) {
    minutesInDay += 1440;
    dayDelta -= 1;
  }
  const h = Math.floor(minutesInDay / 60);
  const min = minutesInDay % 60;
  let { y, M, d } = parts;
  d += dayDelta;
  while (true) {
    const dim = daysInMonth(y, M);
    if (d <= dim) break;
    d -= dim;
    M += 1;
    if (M > 12) {
      M = 1;
      y += 1;
    }
  }
  return { y, M, d, h, min, s: parts.s };
}

/**
 * The literal parts as a runtime-local Date. Safe for grouping, sorting and
 * `toLocaleDateString` WITHOUT a timeZone option (construction and
 * formatting use the same zone, so the parts round-trip on any runtime).
 * Do NOT pin a timeZone when formatting one of these.
 */
export function wallClockDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const p = parseIsoPreserveClock(iso);
  if (!p) {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
  }
  return new Date(p.y, p.M - 1, p.d, p.h, p.min, p.s);
}

/**
 * Match date for display, e.g. "12 Ιουν". Pass Intl options to change the
 * shape: { weekday: "long" }, { month: "short" } alone, { year: "numeric" }…
 */
export function formatMatchDate(
  iso: string | null | undefined,
  opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" }
): string {
  const d = wallClockDate(iso);
  return d ? d.toLocaleDateString("el-GR", opts) : "";
}

/** Match kickoff time as the stored "HH:mm" — no conversion, no DST edge. */
export function formatMatchTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const p = parseIsoPreserveClock(iso);
  if (p) return `${pad2(p.h)}:${pad2(p.min)}`;
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? ""
    : d.toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit" });
}

/** "12 Ιουν 2026, 21:00" — date and time joined; separator overridable. */
export function formatMatchDateTime(
  iso: string | null | undefined,
  opts?: Intl.DateTimeFormatOptions,
  separator = ", "
): string {
  const date = formatMatchDate(iso, opts);
  const time = formatMatchTime(iso);
  return date && time ? `${date}${separator}${time}` : date || time;
}

/**
 * A real UTC timestamp (published_at, created_at, …) rendered in Greek
 * local time. Not for match_date — match digits are already wall-clock.
 */
export function formatInstant(
  iso: string | null | undefined,
  opts: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" }
): string {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? ""
    : d.toLocaleString("el-GR", { timeZone: "Europe/Athens", ...opts });
}
