// Pieces the tournament's pages share: the lettering, a team's crest, a match
// as a row, a table. Server components (the images inside are client ones).
//
// Chrome and Crest are the match and team pages' (preview/matches-v3,
// preview/omada-v3 keep their own copies for now; the three should share one
// file when the pages are promoted).
import Link from "next/link";
import { TeamImage } from "@/app/lib/OptimizedImage";
import { formatMatchDate, formatMatchTime } from "@/app/lib/datetime";
import { NAME_LETTERING } from "../../paiktes-v3/nameStyles";
import { ProfileTrigger } from "../../paiktes-v3/ProfileHost";
import { playerName, type MatchPlayer } from "../../matches-v3/[id]/model";
import { matchWinner, type TMatch, type TTeam, type Table } from "./model";
import { MATCH_PATH, TEAM_PATH } from "./paths";

export const FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#fb923c]";

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The id in the address, or null when it is not a positive whole number. */
export function parseId(raw: string): number | null {
  const id = Number(raw);
  return /^\d{1,9}$/.test(raw) && Number.isSafeInteger(id) && id > 0 ? id : null;
}

/** The player cards' gold, for the one thing gold stands for here: a title won. */
const GOLD: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(170deg, #FFF9E6 0%, #FFE08A 15%, #D4AF37 30%, #B8941F 50%, #D4AF37 70%, #FFE08A 85%, #FFF9E6 100%)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

/**
 * The players list's name lettering («Λευκό χρώμιο») at another size. The
 * lettering comes with its own sizes for the list; an inline size wins over
 * them, so the typeface and colour stay in one place. A span, so it can sit
 * inside a heading, a link or a <summary>.
 */
export function Chrome({
  size,
  gold = false,
  className = "",
  children,
}: {
  /** CSS font-size. */
  size: string;
  gold?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`block ${NAME_LETTERING.title} uppercase ${className}`}
      style={{ ...(gold ? GOLD : NAME_LETTERING.style), fontSize: size, lineHeight: 1.08 }}
    >
      {children}
    </span>
  );
}

/**
 * Font size that lets a name of this length fill its box without being cut:
 * the box's width (cqw — the box must be a size container, `@container`)
 * shared out over the letters, about half an em each in this condensed face.
 * Short names stop at `max`; very long ones stop shrinking at `min` and are
 * cut there.
 */
export const fitName = (name: string, max: string, min: string) =>
  `min(${max}, max(${min}, calc(90cqw / ${(Math.max(name.length, 1) * 0.5).toFixed(1)})))`;

export function Crest({ team, className, sizes }: { team: TTeam | null; className: string; sizes: string }) {
  return (
    <span className={`relative block shrink-0 ${className}`}>
      {team?.logo ? (
        <TeamImage src={team.logo} alt="" fill objectFit="contain" sizes={sizes} animate={false} />
      ) : (
        <span
          aria-hidden
          className={`flex h-full w-full items-center justify-center border font-bold text-[#F3EFE6]/50 ${
            team ? "border-[#F3EFE6]/20" : "border-dashed border-[#F3EFE6]/30"
          }`}
        >
          {team ? team.name.charAt(0).toUpperCase() : "?"}
        </span>
      )}
    </span>
  );
}

/**
 * Opens the player's profile on top of the page when there is one (the card
 * marked `data-profile-card` inside flies into it — see ProfileHost),
 * otherwise plain.
 */
export function ProfileLink({
  player,
  className,
  children,
}: {
  player: MatchPlayer;
  className: string;
  children: React.ReactNode;
}) {
  if (!player.href) return <div className={className}>{children}</div>;
  return (
    <ProfileTrigger
      playerId={player.id}
      href={player.href}
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

/** What the left of a match row says: nothing, the kick-off time, the day, or both. */
export type When = "none" | "time" | "date" | "datetime";

function WhenCell({ match, when }: { match: TMatch; when: Exclude<When, "none"> }) {
  if (match.status === "postponed") return <span className="text-[13px] text-[#c084fc]">Αναβολή</span>;
  if (!match.date) return <span className="text-[13px] text-[#F3EFE6]/55">Χωρίς ημ/νία</span>;
  const time = <span className="block text-[15px] font-bold tabular-nums">{formatMatchTime(match.date)}</span>;
  const day = (
    <span className="block text-[13px] text-[#F3EFE6]/65">
      {formatMatchDate(match.date, { day: "numeric", month: "short" })}
    </span>
  );
  if (when === "time") return time;
  if (when === "date") return day;
  return (
    <>
      {day}
      {time}
    </>
  );
}

function Side({
  team,
  score,
  won,
  lost,
}: {
  team: TTeam | null;
  score: number | null;
  won: boolean;
  lost: boolean;
}) {
  return (
    <span className={`flex items-center gap-2 ${lost ? "text-[#F3EFE6]/60" : ""}`}>
      <Crest team={team} className="h-5 w-5 text-[11px]" sizes="20px" />
      <span
        className={`min-w-0 flex-1 truncate ${won ? "font-bold" : ""} ${team ? "" : "italic text-[#F3EFE6]/55"}`}
      >
        {team?.name ?? "Αναμένεται"}
      </span>
      {score !== null ? <span className="shrink-0 text-[17px] font-bold tabular-nums">{score}</span> : null}
    </span>
  );
}

/**
 * Two teams one above the other, each with its score: the same on a phone and
 * on a desk. The winner is in bold and the loser steps back; a shootout is
 * named under them. The whole row opens the match.
 */
export function MatchRow({ match, when, note }: { match: TMatch; when: When; note?: string | null }) {
  const winner = matchWinner(match);
  const pens = match.status === "finished" && match.pens ? `πέναλτι ${match.pens.a}–${match.pens.b}` : null;
  const under = [note, pens].filter(Boolean).join(", ");
  return (
    <li className="border-b border-[#F3EFE6]/[0.08]">
      <Link
        href={`${MATCH_PATH}/${match.id}`}
        className={`flex items-center gap-3 py-2.5 transition-colors hover:bg-[#F3EFE6]/[0.05] ${FOCUS}`}
      >
        {when !== "none" ? (
          <span className="w-[3.75rem] shrink-0 leading-tight">
            <WhenCell match={match} when={when} />
          </span>
        ) : null}
        <span className="grid min-w-0 flex-1 gap-1 text-[15px]">
          <Side team={match.a} score={match.score?.a ?? null} won={winner === "a"} lost={winner === "b"} />
          <Side team={match.b} score={match.score?.b ?? null} won={winner === "b"} lost={winner === "a"} />
          {under ? <span className="text-[13px] leading-snug text-[#F3EFE6]/65">{under}</span> : null}
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
 * A league or group table. `compact` keeps only played, goal difference and
 * points (group tables stand side by side); otherwise the full row shows from
 * tablet width up. A dashed line under the last qualifying place says who goes
 * through, when the next stage takes its teams from this table.
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
  const head = "py-2 text-[13px] font-normal text-[#F3EFE6]/65";
  const wide = compact ? "hidden" : "hidden sm:table-cell";
  const cut = advancers !== null && advancers < table.rows.length ? advancers : null;
  return (
    <table className="w-full table-fixed border-collapse whitespace-nowrap text-[15px] tabular-nums">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr>
          <th scope="col" className={`${head} w-8 text-left`}>
            <abbr title="Θέση" className="no-underline">
              #
            </abbr>
          </th>
          <th scope="col" className={`${head} text-left`}>
            Ομάδα
          </th>
          <th scope="col" className={`${head} w-9 text-center`}>
            <abbr title="Αγώνες" className="no-underline">
              Αγ.
            </abbr>
          </th>
          <th scope="col" className={`${head} ${wide} w-9 text-center`}>
            <abbr title="Νίκες" className="no-underline">
              Ν
            </abbr>
          </th>
          <th scope="col" className={`${head} ${wide} w-9 text-center`}>
            <abbr title="Ισοπαλίες" className="no-underline">
              Ι
            </abbr>
          </th>
          <th scope="col" className={`${head} ${wide} w-9 text-center`}>
            <abbr title="Ήττες" className="no-underline">
              Η
            </abbr>
          </th>
          <th scope="col" className={`${head} ${wide} w-16 text-center`}>
            <abbr title="Γκολ υπέρ και κατά" className="no-underline">
              Γκολ
            </abbr>
          </th>
          <th scope="col" className={`${head} w-11 text-center`}>
            <abbr title="Διαφορά τερμάτων" className="no-underline">
              Διαφ.
            </abbr>
          </th>
          <th scope="col" className={`${head} w-10 pr-1 text-right`}>
            <abbr title="Βαθμοί" className="no-underline">
              Β.
            </abbr>
          </th>
        </tr>
      </thead>
      <tbody>
        {table.rows.map((r, index) => (
          <tr
            key={r.team.id}
            className={
              cut !== null && index === cut - 1
                ? "border-b-2 border-dashed border-[#fb923c]/80"
                : "border-b border-[#F3EFE6]/[0.08]"
            }
          >
            <td className="py-2 text-[#F3EFE6]/65">{r.rank}</td>
            <td className="overflow-hidden py-2 pr-2">
              <Link
                href={`${TEAM_PATH}/${r.team.id}`}
                className={`flex min-w-0 items-center gap-2 hover:text-[#fb923c] ${FOCUS}`}
              >
                <Crest team={r.team} className="h-6 w-6 text-[13px]" sizes="24px" />
                <span className="min-w-0 truncate font-bold">{r.team.name}</span>
              </Link>
            </td>
            <td className="py-2 text-center">{r.played}</td>
            <td className={`${wide} py-2 text-center`}>{r.won}</td>
            <td className={`${wide} py-2 text-center`}>{r.drawn}</td>
            <td className={`${wide} py-2 text-center`}>{r.lost}</td>
            <td className={`${wide} py-2 text-center`}>
              {r.gf}–{r.ga}
            </td>
            <td className="py-2 text-center text-[#F3EFE6]/80">{signed(r.gd)}</td>
            <td className="py-2 pr-1 text-right text-[17px] font-bold">{r.points}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
