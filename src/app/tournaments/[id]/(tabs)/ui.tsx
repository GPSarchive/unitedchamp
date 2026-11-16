// Pieces the tournament's pages share: the heading of a section, a framed
// panel, a match as a row, a table. Server components.
//
// The lettering of a player's name (Chrome) and a team's crest are the ones
// the player cards go with, taken from tournaments-v3 as they are.
import Link from "next/link";
import { formatMatchDate, formatMatchTime } from "@/app/lib/datetime";
import { CHIP, LINE, STRIP_TOP, SURFACE, layers } from "@/app/lib/ui/flat";
import { ProfileTrigger } from "@/app/paiktes/ProfileHost";
import { playerName, type MatchPlayer } from "@/app/matches/[id]/model";
import { matchWinner, type TMatch, type TTeam, type Table } from "@/app/preview/tournaments-v3/[id]/model";
import { Chrome, Crest, fitName, parseId, plural } from "@/app/preview/tournaments-v3/[id]/ui";
import { MATCH_PATH, TEAM_PATH } from "./paths";
import { FOCUS, LABEL, NAME } from "./tokens";

export { Chrome, Crest, fitName, parseId, plural };

// ───────────────────────────────────────────────────────────────────────
// Headings and panels
// ───────────────────────────────────────────────────────────────────────

/**
 * A section's heading: the title in big italics on a rule, a count at the far
 * end, and above the title a small line saying what the section belongs to
 * (only when there is something to say).
 */
export function Rubric({
  id,
  mark,
  kicker,
  title,
  meta,
}: {
  id?: string;
  /** Stands in front of the title: a stage's numbered disc. */
  mark?: React.ReactNode;
  kicker?: string | null;
  title: string;
  meta?: string | null;
}) {
  return (
    <div className={`mb-5 flex items-end justify-between gap-6 border-b ${LINE} pb-3 md:mb-6`}>
      <div className="flex min-w-0 items-center gap-3">
        {mark}
        <div className="min-w-0">
          {kicker ? <p className={`${LABEL} mb-1.5 text-[#F3EFE6]/65`}>{kicker}</p> : null}
          <h2
            id={id}
            className="font-bold italic leading-none tracking-[-0.02em] [overflow-wrap:anywhere]"
            style={{ fontSize: "clamp(1.9rem, 4.2vw, 3rem)" }}
          >
            {title}
          </h2>
        </div>
      </div>
      {meta ? <span className={`${LABEL} shrink-0 pb-1 text-[#F3EFE6]/65`}>{meta}</span> : null}
    </div>
  );
}

/** A framed box with a strip on top naming it. */
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
    <div className={`overflow-hidden ${SURFACE} ${className}`} style={{ boxShadow: layers("#fb923c") }}>
      {title ? (
        <div className={`flex items-baseline justify-between gap-4 ${STRIP_TOP} px-4 py-2.5 md:px-5`}>
          <Heading id={id} className={`${NAME} first-letter:uppercase`}>
            {title}
          </Heading>
          {meta ? <span className={`${LABEL} shrink-0 text-[#F3EFE6]/65`}>{meta}</span> : null}
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

/** The day as a small tile: the number big, the month under it. */
function DayBlock({ date }: { date: string }) {
  return (
    <span className="flex w-11 shrink-0 flex-col items-center bg-[#F3EFE6]/[0.07] py-2 leading-none">
      <span className="text-[1.35rem] font-bold tabular-nums">{formatMatchDate(date, { day: "numeric" })}</span>
      <span className="mt-1 text-[13px] text-[#F3EFE6]/70">{formatMatchDate(date, { month: "short" })}</span>
    </span>
  );
}

function Side({ team, lost }: { team: TTeam | null; lost: boolean }) {
  return (
    <span className={`flex h-9 items-center gap-2.5 ${lost ? "text-[#F3EFE6]/55" : ""}`}>
      <Crest team={team} className="h-6 w-6 text-[12px]" sizes="24px" />
      <span className={`min-w-0 flex-1 truncate text-[17px] ${team ? "font-bold" : "italic text-[#F3EFE6]/55"}`}>
        {team?.name ?? "Αναμένεται"}
      </span>
    </span>
  );
}

/**
 * The score as two tiles one above the other, the winner's number in orange;
 * before the match, its kick-off time, plain.
 */
function Outcome({ match }: { match: TMatch }) {
  if (match.score) {
    const winner = matchWinner(match);
    const tile = "flex h-[calc(2.25rem-1px)] items-center justify-center bg-[#F3EFE6]/[0.07]";
    return (
      <span className="grid w-10 shrink-0 content-between text-center text-xl font-bold leading-none tabular-nums">
        <span className={`${tile} ${winner === "a" ? "text-[#fb923c]" : ""}`}>{match.score.a}</span>
        <span className={`${tile} ${winner === "b" ? "text-[#fb923c]" : ""}`}>{match.score.b}</span>
      </span>
    );
  }
  if (match.status === "postponed") {
    return (
      <span className={`${LABEL} shrink-0 self-center ${CHIP} px-2 py-1.5 text-[#F3EFE6]/80`}>
        Αναβολή
      </span>
    );
  }
  // No date yet and nothing else to say: nothing.
  if (!match.date) return null;
  return <span className="shrink-0 self-center text-lg font-bold tabular-nums">{formatMatchTime(match.date)}</span>;
}

/**
 * Two teams one above the other, the score at the end (or the kick-off time,
 * before the match). The loser steps back; a shootout is named under them.
 * `day` puts the date in front. The whole row opens the match.
 */
export function MatchRow({ match, day, note }: { match: TMatch; day: boolean; note?: string | null }) {
  const winner = matchWinner(match);
  const pens = match.status === "finished" && match.pens ? `πέναλτι ${match.pens.a}–${match.pens.b}` : null;
  const under = [note, pens].filter(Boolean).join(", ");
  return (
    <li className="border-b border-[#F3EFE6]/[0.14] last:border-b-0">
      <Link
        href={`${MATCH_PATH}/${match.id}`}
        className={`flex items-center gap-3.5 px-4 py-2.5 transition-colors hover:bg-[#F3EFE6]/[0.05] md:px-5 ${FOCUS}`}
      >
        {day && match.date ? <DayBlock date={match.date} /> : null}
        <span className="min-w-0 flex-1">
          <span className="flex items-stretch gap-3">
            <span className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)]">
              <Side team={match.a} lost={winner === "b"} />
              <Side team={match.b} lost={winner === "a"} />
            </span>
            <Outcome match={match} />
          </span>
          {under ? (
            <span className={`${LABEL} mt-1 block text-[#F3EFE6]/65 first-letter:uppercase`}>{under}</span>
          ) : null}
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
 * A league or group table: the place as a big number (the leader's in
 * orange), the points big at the far end. `compact` keeps only played, goal
 * difference and points (group tables stand side by side); otherwise the full
 * row shows from tablet width up. When the next stage takes its teams from
 * this table, the places that go through carry an orange edge and a dashed
 * orange line closes them: who qualifies is seen, not explained. `highlight`
 * picks out one team's row (a few rows of the table shown around a team).
 */
export function StandingsTable({
  table,
  caption,
  advancers,
  compact = false,
  highlight,
}: {
  table: Table;
  /** For screen readers: which table this is. */
  caption: string;
  advancers: number | null;
  compact?: boolean;
  /** Id of the team whose row stands out. */
  highlight?: number;
}) {
  const head = "py-2.5 text-[13px] font-normal text-[#F3EFE6]/65";
  const num = "py-2.5 text-center text-base text-[#F3EFE6]/85";
  const wide = compact ? "hidden" : "hidden md:table-cell";
  // The narrow columns: a little wider where the whole row has room.
  const place = compact ? "w-11" : "w-11 md:w-16";
  const played = compact ? "w-9" : "w-9 md:w-14";
  const diff = compact ? "w-11" : "w-11 md:w-16";
  const points = compact ? "w-11 pr-3.5" : "w-11 pr-3.5 md:w-16 md:pr-5";
  const cut = advancers !== null && advancers < table.rows.length ? advancers : null;
  return (
    <table className="w-full table-fixed border-collapse whitespace-nowrap tabular-nums">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="border-b border-[#F3EFE6]/20">
          <th scope="col" className={`${head} ${place} text-center`}>
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
            className={`transition-colors hover:bg-[#F3EFE6]/[0.05] ${
              r.team.id === highlight ? "bg-[#F3EFE6]/[0.09]" : ""
            } ${
              cut !== null && index === cut - 1
                ? "border-b-2 border-dashed border-[#fb923c]"
                : "border-b border-[#F3EFE6]/[0.14] last:border-b-0"
            }`}
          >
            <td
              className={`py-2.5 text-center text-2xl leading-none ${compact ? "" : "md:text-[1.7rem]"} ${
                r.rank === 1 ? "text-[#fb923c]" : "font-light text-[#F3EFE6]/90"
              } ${cut !== null && index < cut ? "shadow-[inset_3px_0_0_#fb923c]" : ""}`}
            >
              {r.rank}
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
            <td className={num}>{signed(r.gd)}</td>
            <td className={`py-2.5 pr-3.5 text-right text-xl font-bold ${compact ? "" : "md:pr-5 md:text-2xl"}`}>
              {r.points}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
