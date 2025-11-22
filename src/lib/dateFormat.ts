/**
 * Centralized date formatting utilities
 *
 * All functions use el-GR locale and NO timezone specification
 * (browser's local timezone is used)
 */

const LOCALE = 'el-GR';

/**
 * Format date and time with medium date style and short time
 * Example: "15 Δεκ 2024, 14:30"
 */
export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';

  return d.toLocaleString(LOCALE, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

/**
 * Format date only (no time)
 * Example: "15/12/2024"
 */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';

  return d.toLocaleDateString(LOCALE);
}

/**
 * Format with full details: long weekday, long month, time
 * Example: "Τρίτη 15 Δεκεμβρίου 2024 14:30"
 */
export function formatDateTimeFull(date: string | Date | null | undefined): string {
  if (!date) return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';

  return d.toLocaleString(LOCALE, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Format with short details: year, short month, day, time
 * Example: "2024 Δεκ 15, 14:30"
 */
export function formatDateTimeShort(date: string | Date | null | undefined): string {
  if (!date) return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';

  return d.toLocaleString(LOCALE, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format for calendar displays: long weekday, numeric day, long month
 * Example: "Τρίτη 15 Δεκεμβρίου"
 */
export function formatCalendarDate(date: string | Date | null | undefined): string {
  if (!date) return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';

  return d.toLocaleDateString(LOCALE, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/**
 * Format month and year
 * Example: "Δεκέμβριος 2024"
 */
export function formatMonthYear(date: Date): string {
  return date.toLocaleDateString(LOCALE, {
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Format for match listings: long weekday, 2-digit day/month, time
 * Example: "Τρίτη 15/12, 14:30"
 */
export function formatMatchDateTime(date: string | Date | null | undefined): string {
  if (!date) return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';

  return d.toLocaleString(LOCALE, {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format for match short display: short weekday, 2-digit day/month
 * Example: "Τρ 15/12"
 */
export function formatMatchDateShort(date: string | Date | null | undefined): string {
  if (!date) return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';

  return d.toLocaleString(LOCALE, {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });
}
