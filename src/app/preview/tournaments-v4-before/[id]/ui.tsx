// Pieces the tournament's pages share, in the old page's look: the heading of
// a section, a bordered panel, a match as a row, a table. Server components.
//
// The lettering of a player's name (Chrome) and a team's crest are the ones
// the player cards go with, taken from tournaments-v3 as they are.
import Link from "next/link";
import { formatMatchDate, formatMatchTime } from "@/app/lib/datetime";
import { ProfileTrigger } from "../../paiktes-v3/ProfileHost";
import { playerName, type MatchPlayer } from "../../matches-v3/[id]/model";
import { matchWinner, type TMatch, type TTeam, type Table } from "../../tournaments-v3/[id]/model";
import { Chrome, Crest, fitName, parseId, plural } from "../../tournaments-v3/[id]/ui";
import { MATCH_PATH, TEAM_PATH } from "./paths";
import { FOCUS, LABEL, MONO } from "./tokens";

export { Chrome, Crest, fitName, parseId, plural };

/** 1 → «01»: the old page's place numbers. */
export const pad2 = (n: number) => String(n).padStart(2, "0");

// ───────────────────────────────────────────────────────────────────────
// Headings and panels
// ───────────────────────────────────────────────────────────────────────

/**
 * A section's heading: a short orange rule and a small line saying what the
 * section belongs to (only when there is something to say), the title in big
 * italics, and a count at the far end.
 */
export function Rubric({
  id,
  kicker,
  title,
  meta,
}: {
  id?: string;
  kicker?: string | null;
  title: string;
  meta?: string | null;
}) {
  return (
    <div className="mb-5 md:mb-7">
      {kicker ? (
        <p className={`${LABEL} mb-2 flex items-center gap-3 text-[#fb923c]`}>
          <span aria-hidden className="h-[2px] w-8 bg-[#fb923c]" />
          {kicker}
        </p>
      ) : null}
      <div className="flex items-end justify-between gap-6 border-b-2 border-[#F3EFE6]/20 pb-3">
        <h2
          id={id}
          className="font-bold italic leading-none tracking-[-0.02em]"
          style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)" }}
        >
          {title}
        </h2>
        {meta ? <span className={`${LABEL} shrink-0 pb-1 text-[#F3EFE6]/60`}>{meta}</span> : null}
      </div>
    </div>
  );
}

/** A bordered box with a darker strip on top naming it. */
export function Panel({
  id,
  title,
  meta,
  heading: Heading = "h3",
  className = "",
  children,
}: {
  id?: string;
  title?: string | null;
  meta?: string | null;
  heading?: "h2" | "h3";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`border-2 border-[#F3EFE6]/20 bg-[#0a0a14] ${className}`}>
      {title ? (
        <div className="flex items-center justify-between gap-4 border-b-2 border-[#F3EFE6]/20 bg-[#13131d] px-4 py-2.5 md:px-5">
          <Heading id={id} className={`${LABEL} first-letter:uppercase`}>
            {title}
          </Heading>
          {meta ? <span className={`${LABEL} shrink-0 text-[#F3EFE6]/60`}>{meta}</span> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

export function Chevron({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 12 12"
      className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-open:rotate-180 ${className}`}
    >
      <path d="M1.5 4 6 8.5 10.5 4" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

/** Opens the player's profile on top of the page (the part marked `data-profile-card` flies into it). */
export function ProfileLink({
  player,
  href,
  className,
  children,
}: {
  player: MatchPlayer;
  /** This page's own address with `?player=` (extra.profileHref). */
  href: string;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <ProfileTrigger
      playerId={player.id}
      href={href}
      className={`${className} ${FOCUS}`}
      label={`${playerName(player)}: προφίλ`}
    >
      {children}
    </ProfileTrigger>
  );
}

// ───────────────────────────────────────────────────────────────────────
// A match as a row
// ───────────────────────────────────────────────────────────────────────

/** The day as a small block: the number big, the month under it. */
function DayBlock({ date }: { date: string }) {
  return (
    <span className="flex w-12 shrink-0 flex-col items-center border-2 border-[#F3EFE6]/20 bg-[#0a0a14] py-1.5 leading-none">
      <span className="text-2xl font-bold tabular-nums">{formatMatchDate(date, { day: "numeric" })}</span>
      <span className={`${MONO} mt-1 text-[10px] uppercase tracking-[0.14em] text-[#F3EFE6]/65`}>
        {formatMatchDate(date, { month: "short" })}
      </span>
    </span>
  );
}

function Side({ team, lost }: { team: TTeam | null; lost: boolean }) {
  return (
    <span className={`flex h-9 items-center gap-2.5 ${lost ? "text-[#F3EFE6]/50" : ""}`}>
      <Crest team={team} className="h-6 w-6 text-[12px]" sizes="24px" />
      <span className={`min-w-0 flex-1 truncate text-[17px] ${team ? "font-bold" : "italic text-[#F3EFE6]/55"}`}>
        {team?.name ?? "Αναμένεται"}
      </span>
    </span>
  );
}

/** The score in a box, the winner's number in orange; before the match, its time in a dashed one. */
function Outcome({ match }: { match: TMatch }) {
  if (match.score) {
    const winner = matchWinner(match);
    return (
      <span className="grid w-11 shrink-0 border-2 border-[#F3EFE6]/20 bg-[#0a0a14] text-center text-xl font-bold leading-none tabular-nums">
        <span className={`flex h-[calc(2.25rem-2px)] items-center justify-center ${winner === "a" ? "text-[#fb923c]" : ""}`}>
          {match.score.a}
        </span>
        <span
          className={`flex h-[calc(2.25rem-2px)] items-center justify-center border-t-2 border-[#F3EFE6]/15 ${
            winner === "b" ? "text-[#fb923c]" : ""
          }`}
        >
          {match.score.b}
        </span>
      </span>
    );
  }
  const postponed = match.status === "postponed";
  // No date yet and nothing else to say: no box.
  if (!postponed && !match.date) return null;
  return (
    <span
      className={`${MONO} shrink-0 self-center border-2 border-dashed px-2.5 py-2 text-[13px] tabular-nums tracking-[0.08em] ${
        postponed ? "border-[#c084fc]/60 text-[#c084fc]" : "border-[#F3EFE6]/40"
      }`}
    >
      {postponed ? "Αναβολή" : formatMatchTime(match.date)}
    </span>
  );
}

/**
 * Two teams one above the other, the score in a box at the end (or the
 * kick-off time, before the match). The loser steps back; a shootout is named
 * under them. `day` puts the date in front. The whole row opens the match.
 */
export function MatchRow({ match, day, note }: { match: TMatch; day: boolean; note?: string | null }) {
  const winner = matchWinner(match);
  const pens = match.status === "finished" && match.pens ? `πέναλτι ${match.pens.a}–${match.pens.b}` : null;
  const under = [note, pens].filter(Boolean).join(", ");
  return (
    <li className="border-b-2 border-[#F3EFE6]/15 last:border-b-0 hover:border-[#fb923c]">
      <Link
        href={`${MATCH_PATH}/${match.id}`}
        className={`flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[#F3EFE6]/[0.04] md:px-5 ${FOCUS}`}
      >
        {day && match.date ? <DayBlock date={match.date} /> : null}
        <span className="min-w-0 flex-1">
          <span className="flex items-stretch gap-3">
            <span className="grid min-w-0 flex-1">
              <Side team={match.a} lost={winner === "b"} />
              <Side team={match.b} lost={winner === "a"} />
            </span>
            <Outcome match={match} />
          </span>
          {under ? <span className={`${LABEL} mt-1.5 block leading-snug text-[#F3EFE6]/60`}>{under}</span> : null}
        </span>
      </Link>
    </li>
  );
}

// ───────────────────────────────────────────────────────────────────────
// A table
// ───────────────────────────────────────────────────────────────────────

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

/**
 * A league or group table, the old page's: the place as a big number (the
 * leader's in orange, the last one's faded), the points big at the far end.
 * `compact` keeps only played, goal difference and points (group tables stand
 * side by side); otherwise the full row shows from tablet width up. A dashed
 * orange line under the last qualifying place says who goes through, when the
 * next stage takes its teams from this table.
 */
export function StandingsTable({
  table,
  caption,
  advancers,
  compact = false,
}: {
  table: Table;
  /** For screen readers: which table this is. */
  caption: string;
  advancers: number | null;
  compact?: boolean;
}) {
  const head = `${MONO} py-2.5 text-[10px] font-normal uppercase tracking-[0.16em] text-[#F3EFE6]/60`;
  const num = `${MONO} py-2.5 text-center text-sm`;
  const wide = compact ? "hidden" : "hidden md:table-cell";
  // The narrow columns: a little wider where the whole row has room.
  const place = compact ? "w-11 pl-3" : "w-11 pl-3 md:w-16 md:pl-4";
  const played = compact ? "w-9" : "w-9 md:w-14";
  const diff = compact ? "w-11" : "w-11 md:w-16";
  const points = compact ? "w-11 pr-3" : "w-11 pr-3 md:w-16 md:pr-4";
  const cut = advancers !== null && advancers < table.rows.length ? advancers : null;
  const last = table.rows.length - 1;
  return (
    <table className="w-full table-fixed border-collapse whitespace-nowrap tabular-nums">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="border-b-2 border-[#F3EFE6]/20">
          <th scope="col" className={`${head} ${place} text-left`}>
            <abbr title="Θέση" className="no-underline">
              #
            </abbr>
          </th>
          <th scope="col" className={`${head} text-left`}>
            Ομάδα
          </th>
          <th scope="col" className={`${head} ${played} text-center`}>
            <abbr title="Αγώνες" className="no-underline">
              Αγ
            </abbr>
          </th>
          <th scope="col" className={`${head} ${wide} w-12 text-center`}>
            <abbr title="Νίκες" className="no-underline">
              Ν
            </abbr>
          </th>
          <th scope="col" className={`${head} ${wide} w-12 text-center`}>
            <abbr title="Ισοπαλίες" className="no-underline">
              Ι
            </abbr>
          </th>
          <th scope="col" className={`${head} ${wide} w-12 text-center`}>
            <abbr title="Ήττες" className="no-underline">
              Η
            </abbr>
          </th>
          <th scope="col" className={`${head} ${wide} w-20 text-center`}>
            <abbr title="Γκολ υπέρ και κατά" className="no-underline">
              Γκολ
            </abbr>
          </th>
          <th scope="col" className={`${head} ${diff} text-center`}>
            <abbr title="Διαφορά τερμάτων" className="no-underline">
              Διαφ
            </abbr>
          </th>
          <th scope="col" className={`${head} ${points} text-right`}>
            <abbr title="Βαθμοί" className="no-underline">
              Βαθ
            </abbr>
          </th>
        </tr>
      </thead>
      <tbody>
        {table.rows.map((r, index) => (
          <tr
            key={r.team.id}
            className={`transition-colors hover:bg-[#13131d] ${
              cut !== null && index === cut - 1
                ? "border-b-2 border-dashed border-[#fb923c]"
                : "border-b border-[#F3EFE6]/15 last:border-b-0"
            }`}
          >
            <td
              className={`py-2.5 pl-3 text-2xl leading-none ${compact ? "" : "md:pl-4 md:text-3xl"} ${
                index === 0 ? "text-[#fb923c]" : index === last && last > 2 ? "text-[#F3EFE6]/30" : ""
              }`}
            >
              {pad2(r.rank)}
            </td>
            <td className="py-2 pr-2">
              <Link
                href={`${TEAM_PATH}/${r.team.id}`}
                className={`flex min-w-0 items-center gap-2.5 hover:text-[#fb923c] ${FOCUS}`}
              >
                <Crest team={r.team} className="h-7 w-7 text-[13px]" sizes="28px" />
                {/* A long name takes a second line instead of being cut. */}
                <span
                  className={`min-w-0 whitespace-normal text-base font-bold leading-[1.15] [overflow-wrap:anywhere] ${
                    compact ? "" : "md:text-lg md:leading-[1.15]"
                  }`}
                >
                  {r.team.name}
                </span>
              </Link>
            </td>
            <td className={num}>{r.played}</td>
            <td className={`${num} ${wide}`}>{r.won}</td>
            <td className={`${num} ${wide}`}>{r.drawn}</td>
            <td className={`${num} ${wide}`}>{r.lost}</td>
            <td className={`${num} ${wide}`}>
              {r.gf}–{r.ga}
            </td>
            <td className={`${num} text-[#F3EFE6]/80`}>{signed(r.gd)}</td>
            <td className={`py-2.5 pr-3 text-right text-xl font-bold ${compact ? "" : "md:pr-4 md:text-2xl"}`}>
              {r.points}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
