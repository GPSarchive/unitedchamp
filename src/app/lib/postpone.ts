// Match postponement rules — shared by the postpone route, the match PATCH
// route and the tournament save-all route.
//
// The rule: "postponed" means "no date yet". The moment a postponed match
// gets a date it is back on the schedule (status "scheduled"); the date it
// was originally meant to be played stays in original_match_date.

import { formatMatchDateTime, toNaiveIso } from "@/app/lib/datetime";

/**
 * Status to store for a match given the date it will have. A postponed match
 * with a date becomes "scheduled"; every other status passes through.
 */
export function statusForDate<S extends string | null | undefined>(
  status: S,
  matchDate: string | null | undefined
): S | "scheduled" {
  return status === "postponed" && matchDate ? "scheduled" : status;
}

/** "postpone": a scheduled match is being postponed. "reschedule": a postponed match gets its new date. */
export type PostponeMode = "postpone" | "reschedule";

export type PostponeCurrent = {
  status: string | null;
  match_date: string | null;
  original_match_date: string | null;
  postponement_reason: string | null;
};

export type PostponePlan =
  | { ok: false; status: 400 | 409; error: string }
  | {
      ok: true;
      mode: PostponeMode;
      update: {
        status: "scheduled" | "postponed";
        match_date: string | null;
        original_match_date: string | null;
        postponement_reason: string | null;
        postponed_at?: string;
        postponed_by?: string;
      };
      /** The date the announcement says the match was moved away from. */
      previousDate: string | null;
    };

/**
 * Decide what a postpone-dialog submit writes.
 *
 * @param newDateISO  validated ISO string (wall-clock digits) or null
 * @param nowInstant  real UTC timestamp, stored in postponed_at
 * @param nowWall     current Athens wall clock (nowWallClockIso), for the future check
 */
export function planPostpone(args: {
  current: PostponeCurrent;
  newDateISO: string | null;
  reason: string | null;
  userId: string;
  nowInstant: string;
  nowWall: string;
}): PostponePlan {
  const { current, newDateISO, reason, userId, nowInstant, nowWall } = args;

  if (current.status !== "scheduled" && current.status !== "postponed") {
    return {
      ok: false,
      status: 409,
      error: "Μόνο αγώνες που δεν έχουν ολοκληρωθεί μπορούν να αναβληθούν ή να πάρουν νέα ημερομηνία.",
    };
  }

  // The date the match was meant to be played before any postponement.
  const originalDate = current.original_match_date ?? current.match_date;

  if (current.status === "postponed") {
    // Setting the new date. A past date is allowed: the match may already
    // have been played and the date is only being filled in.
    if (!newDateISO) {
      return { ok: false, status: 400, error: "Ορίστε τη νέα ημερομηνία του αγώνα." };
    }
    return {
      ok: true,
      mode: "reschedule",
      update: {
        status: "scheduled",
        match_date: newDateISO,
        original_match_date: originalDate,
        // keep the recorded reason unless a new one was given
        postponement_reason: reason ?? current.postponement_reason,
      },
      previousDate: originalDate,
    };
  }

  // Postponing a scheduled match.
  if (!current.match_date) {
    return {
      ok: false,
      status: 400,
      error: "Ο αγώνας δεν έχει ημερομηνία· ορίστε την από την επεξεργασία του αγώνα.",
    };
  }
  if (newDateISO && toNaiveIso(newDateISO) <= nowWall) {
    return { ok: false, status: 400, error: "Η νέα ημερομηνία πρέπει να είναι μεταγενέστερη από τώρα." };
  }
  return {
    ok: true,
    mode: "postpone",
    update: {
      status: statusForDate("postponed", newDateISO),
      match_date: newDateISO,
      original_match_date: originalDate,
      postponement_reason: reason,
      postponed_at: nowInstant,
      postponed_by: userId,
    },
    previousDate: current.match_date,
  };
}

const longDate = (iso: string) =>
  formatMatchDateTime(iso, { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

/** Titles a fixture's postponement notices use — matched to retire stale ones. */
export function postponeAnnouncementTitles(teamAName: string, teamBName: string) {
  return {
    postpone: `Αναβολή Αγώνα: ${teamAName} - ${teamBName}`,
    reschedule: `Νέα ημερομηνία αγώνα: ${teamAName} - ${teamBName}`,
  };
}

/** The announcement a postpone/reschedule publishes. */
export function buildPostponeAnnouncement(args: {
  mode: PostponeMode;
  teamAName: string;
  teamBName: string;
  previousDate: string | null;
  newDateISO: string | null;
  reason: string | null;
  now: Date;
}) {
  const { mode, teamAName, teamBName, previousDate, newDateISO, reason, now } = args;
  const titles = postponeAnnouncementTitles(teamAName, teamBName);
  const fixture = `**${teamAName}** vs **${teamBName}**`;

  let title: string;
  let body: string;
  if (mode === "reschedule") {
    title = titles.reschedule;
    body = `Ο αγώνας ${fixture}, που είχε αναβληθεί, θα διεξαχθεί **${longDate(newDateISO!)}**.\n\n`;
    if (previousDate) body += `🗓️ **Αρχική ημερομηνία**: ${longDate(previousDate)}\n\n`;
  } else {
    title = titles.postpone;
    body = `Ο αγώνας ${fixture}`;
    if (previousDate) body += ` που ήταν προγραμματισμένος για **${longDate(previousDate)}**`;
    body += ` αναβλήθηκε.\n\n`;
    body += newDateISO
      ? `📅 **Νέα ημερομηνία**: ${longDate(newDateISO)}\n\n`
      : `📅 **Νέα ημερομηνία**: Θα ανακοινωθεί σύντομα\n\n`;
    if (reason) body += `ℹ️ **Λόγος**: ${reason}\n\n`;
  }
  body += `Σας ευχαριστούμε για την κατανόησή σας.`;

  // Shown until a day after the new date, or for 30 days while it is unknown.
  const end = newDateISO ? new Date(newDateISO) : new Date(now);
  end.setDate(end.getDate() + (newDateISO ? 1 : 30));

  return { title, body, end_at: end.toISOString() };
}
