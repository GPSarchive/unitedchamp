// The team page, rebuilt around the player cards of the players page, with the
// match features of the player area (/profile) that make sense in public:
//   · the next match with a countdown, and the record against that opponent;
//   · the season in numbers, the form guide, and the league table around the team;
//   · results that read correctly for knockout matches (penalties, two legs);
//   · fixtures split into upcoming / awaiting result / postponed / undated.
// The squad is a list in the style of the players list (small card, chrome
// name, numbers with this team).
//
// The accent is the team's own colour, lifted until it reads (accent.ts).
// Every card of a player who has a profile opens it on top of the page.
//
// A server component: only the cards, the profile overlay and the countdown
// run in the browser. Chrome / ProfileLink / the name sizing are the match
// page's (matches/[id]/MatchPage.tsx keeps its own copies for now; both
// should share one file later).
import Link from "next/link";
import { TeamImage } from "@/app/lib/OptimizedImage";
import { formatMatchDate, formatMatchTime } from "@/app/lib/datetime";
import { FormerPlayerBadge } from "@/components/FormerPlayerBadge";
import { BestGkIcon, GkIcon, MvpIcon } from "@/app/matches/[id]/StatIcons";
import { NAME_LETTERING } from "@/app/paiktes/nameStyles";
import { ProfileHost, ProfileTrigger } from "@/app/paiktes/ProfileHost";
import { PlayerMini } from "@/app/matches/[id]/cards";
import { mainName, playerName, smallName } from "@/app/matches/[id]/model";
import { teamAccent } from "./accent";
import { BUTTON_SHAPE, SURFACE, layer, layers } from "@/app/lib/ui/flat";
import Kickoff from "./Kickoff";
import {
  OUTCOME_LETTER,
  OUTCOME_WORD,
  competitionLabel,
  resultNote,
  tableWindow,
  type GroupTable,
  type Outcome,
  type SquadPlayer,
  type TeamMatch,
  type TeamRef,
  type TeamView,
} from "./model";
import { MATCH_PATH, TEAM_PATH, TOURNAMENT_PATH } from "./paths";

const FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--team)]";

/** Rows of a list shown at once; the rest sit behind «Όλα…». */
const SHOWN = 6;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * The players list's name lettering (plain white) at another size. The
 * lettering comes with its own sizes for the list; an inline size wins over
 * them, so the typeface and colour stay in one place.
 */
function Chrome({
  size,
  className = "",
  children,
}: {
  /** CSS font-size. */
  size: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${NAME_LETTERING.title} uppercase ${className}`}
      style={{ ...NAME_LETTERING.style, fontSize: size, lineHeight: 1.08 }}
    >
      {children}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Small pieces
// ───────────────────────────────────────────────────────────────────────

function Crest({ team, className, sizes }: { team: TeamRef | null; className: string; sizes: string }) {
  return (
    <div className={`relative shrink-0 ${className}`}>
      {team?.logo ? (
        <TeamImage src={team.logo} alt="" fill objectFit="contain" sizes={sizes} animate={false} />
      ) : (
        <div
          aria-hidden
          className="flex h-full w-full items-center justify-center border border-[#F3EFE6]/20 font-bold text-[#F3EFE6]/50"
        >
          {(team?.name ?? "?").charAt(0).toUpperCase()}
        </div>
      )}
    </div>
  );
}

function SectionTitle({ id, title, lede }: { id: string; title: string; lede?: string }) {
  return (
    <div>
      <h2 id={id} className="text-2xl font-bold italic leading-tight md:text-3xl">
        {title}
      </h2>
      {lede ? <p className="mt-1 max-w-2xl text-[15px] text-[#F3EFE6]/70">{lede}</p> : null}
    </div>
  );
}

/** A sub-heading on the team's colour, with a count on the right. */
function ListHead({ title, note }: { title: React.ReactNode; note?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b-2 border-[color:var(--team)] pb-2">
      <h3 className="min-w-0 truncate text-lg font-bold italic">{title}</h3>
      {note ? <span className="shrink-0 text-[13px] text-[#F3EFE6]/65">{note}</span> : null}
    </div>
  );
}

/** Ν / Ι / Η. The letter carries the meaning; the colour only helps. */
function OutcomeMark({ outcome, small = false }: { outcome: Outcome; small?: boolean }) {
  const tone =
    outcome === "W"
      ? "bg-[#4ade80]/[0.16] text-[#86efac]"
      : outcome === "L"
        ? "bg-[#f87171]/[0.16] text-[#fca5a5]"
        : "bg-[#F3EFE6]/[0.08] text-[#F3EFE6]/75";
  return (
    <span
      title={OUTCOME_WORD[outcome]}
      className={`inline-flex shrink-0 items-center justify-center rounded-md font-bold ${tone} ${
        small ? "h-7 w-7 text-[13px]" : "h-9 w-9 text-[15px]"
      }`}
    >
      <span aria-hidden>{OUTCOME_LETTER[outcome]}</span>
      <span className="sr-only">{OUTCOME_WORD[outcome]}</span>
    </span>
  );
}

const opponentName = (m: TeamMatch) => m.opponent?.name || "Αντίπαλος προς ορισμό";

/**
 * Opens the player's profile on top of the page when there is one (the card
 * marked `data-profile-card` inside flies into it — see ProfileHost),
 * otherwise plain.
 */
function ProfileLink({
  player,
  className,
  children,
}: {
  player: SquadPlayer;
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
// Next match
// ───────────────────────────────────────────────────────────────────────

const LONG_DATE = { weekday: "long", day: "numeric", month: "long" } as const;

function NextMatch({ view }: { view: TeamView }) {
  const match = view.schedule.next;
  if (!match) {
    // A past season has no next match to wait for.
    if (view.season?.archived) return null;
    return (
      <section aria-labelledby="next-title" className="border-b border-[#F3EFE6]/15 py-6 md:py-8">
        <h2 id="next-title" className="text-[13px] font-bold uppercase tracking-[0.14em] text-[color:var(--team)]">
          Επόμενος αγώνας
        </h2>
        <p className="mt-2 text-[15px] text-[#F3EFE6]/70">
          {view.schedule.undated.length > 0
            ? "Δεν έχει οριστεί ακόμα ημερομηνία για τον επόμενο αγώνα."
            : "Δεν υπάρχει προγραμματισμένος αγώνας."}
        </p>
      </section>
    );
  }

  const record = view.headToHead;
  return (
    <section aria-labelledby="next-title" className="border-b border-[#F3EFE6]/15 py-6 md:py-9">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="next-title" className="text-[13px] font-bold uppercase tracking-[0.14em] text-[color:var(--team)]">
          Επόμενος αγώνας
        </h2>
        <p className="text-[13px] text-[#F3EFE6]/65">{competitionLabel(match)}</p>
      </div>

      <div className="mt-4 grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-10">
        <div className="flex min-w-0 items-center gap-4 md:gap-6">
          <Crest team={match.opponent} className="h-16 w-16 text-2xl md:h-24 md:w-24" sizes="(min-width: 768px) 96px, 64px" />
          <div className="min-w-0">
            <p className="text-[13px] text-[#F3EFE6]/65">Αντίπαλος</p>
            <Chrome size="clamp(1.9rem, 7.5vw, 3.4rem)" className="pr-2 [overflow-wrap:anywhere]">
              {match.opponent ? (
                <Link href={`${TEAM_PATH}/${match.opponent.id}`} className={`hover:text-[color:var(--team)] ${FOCUS}`}>
                  {match.opponent.name}
                </Link>
              ) : (
                opponentName(match)
              )}
            </Chrome>
            <p className="mt-1.5 text-[15px] font-bold">
              {formatMatchDate(match.date, LONG_DATE)}, {formatMatchTime(match.date)}
            </p>
            {record ? (
              <p className="mt-1 text-[15px] text-[#F3EFE6]/70">
                Μεταξύ τους, σε όλες τις σεζόν: {plural(record.won, "νίκη", "νίκες")},{" "}
                {plural(record.drawn, "ισοπαλία", "ισοπαλίες")}, {plural(record.lost, "ήττα", "ήττες")}.
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col items-start gap-4">
          {view.kickoffMs !== null && match.date ? <Kickoff kickoffMs={view.kickoffMs} date={match.date} /> : null}
          <Link
            href={`${MATCH_PATH}/${match.id}`}
            className={`inline-flex h-11 items-center ${BUTTON_SHAPE} px-5 text-[15px] hover:text-[color:var(--team)] ${FOCUS}`}
          >
            Σελίδα αγώνα
          </Link>
        </div>
      </div>
    </section>
  );
}

// ───────────────────────────────────────────────────────────────────────
// The season: numbers, form, tables
// ───────────────────────────────────────────────────────────────────────

function Tile({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col-reverse bg-[#12121e] px-1 py-3 text-center">
      <dt className="mt-1 text-[13px] leading-tight text-[#F3EFE6]/65">{label}</dt>
      <dd className="m-0">
        <Chrome size="2.4rem" className="px-1 tabular-nums">
          {value}
        </Chrome>
      </dd>
    </div>
  );
}

function Table({ table, teamId }: { table: GroupTable; teamId: number }) {
  const rows = tableWindow(table.rows, table.ownIndex, 2);
  const where = [table.stageName, table.groupName].filter(Boolean).join(" · ");
  const caption = [table.competition?.name, where].filter(Boolean).join(", ");
  const head = "py-2 text-[13px] font-normal text-[#F3EFE6]/65";
  return (
    <div className="min-w-0">
      <ListHead
        title={
          table.competition ? (
            <Link href={`${TOURNAMENT_PATH}/${table.competition.id}`} className={`hover:text-[color:var(--team)] ${FOCUS}`}>
              {table.competition.name}
            </Link>
          ) : (
            table.stageName || "Βαθμολογία"
          )
        }
        note={table.competition ? where : (table.groupName ?? undefined)}
      />
      {/* Fixed layout: the number columns keep their widths, the name takes the rest and is cut if long. */}
      <table className="w-full table-fixed border-collapse whitespace-nowrap text-[15px] tabular-nums">
        <caption className="sr-only">Βαθμολογία: {caption}</caption>
        <thead>
          <tr>
            <th scope="col" className={`${head} w-9 pl-2 text-left`}>
              <abbr title="Θέση" className="no-underline">
                #
              </abbr>
            </th>
            <th scope="col" className={`${head} text-left`}>
              Ομάδα
            </th>
            <th scope="col" className={`${head} w-10 text-center`}>
              <abbr title="Αγώνες" className="no-underline">
                Αγ.
              </abbr>
            </th>
            <th scope="col" className={`${head} hidden w-20 text-center sm:table-cell`}>
              <abbr title="Νίκες, ισοπαλίες, ήττες" className="no-underline">
                Ν-Ι-Η
              </abbr>
            </th>
            <th scope="col" className={`${head} hidden w-16 text-center sm:table-cell`}>
              <abbr title="Γκολ υπέρ και κατά" className="no-underline">
                Γκολ
              </abbr>
            </th>
            <th scope="col" className={`${head} w-11 pr-2 text-right`}>
              <abbr title="Βαθμοί" className="no-underline">
                Β.
              </abbr>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const own = r.teamId === teamId;
            return (
              <tr
                key={r.teamId}
                className={`border-t border-[#F3EFE6]/[0.08] ${own ? "bg-[#F3EFE6]/[0.07] font-bold" : ""}`}
              >
                <td
                  className={`border-l-2 py-2 pl-2 ${own ? "border-[color:var(--team)]" : "border-transparent text-[#F3EFE6]/70"}`}
                >
                  {r.rank}
                </td>
                <td className="overflow-hidden py-2 pr-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <Crest team={{ id: r.teamId, name: r.name, logo: r.logo }} className="h-6 w-6 text-[13px]" sizes="24px" />
                    {own ? (
                      <span className="min-w-0 truncate">
                        {r.name}
                        <span className="sr-only"> (αυτή η ομάδα)</span>
                      </span>
                    ) : (
                      <Link
                        href={`${TEAM_PATH}/${r.teamId}`}
                        className={`min-w-0 truncate hover:text-[color:var(--team)] ${FOCUS}`}
                      >
                        {r.name}
                      </Link>
                    )}
                  </span>
                </td>
                <td className="py-2 text-center">{r.played}</td>
                <td className="hidden py-2 text-center sm:table-cell">
                  {r.won}-{r.drawn}-{r.lost}
                </td>
                <td className="hidden py-2 text-center sm:table-cell">
                  {r.gf}–{r.ga}
                </td>
                <td className="py-2 pr-2 text-right text-[17px] font-bold">{r.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {table.competition && rows.length < table.rows.length ? (
        <p className="mt-3 text-[13px]">
          <Link
            href={`${TOURNAMENT_PATH}/${table.competition.id}`}
            className={`text-[#F3EFE6]/75 underline decoration-[#F3EFE6]/30 underline-offset-4 hover:text-[color:var(--team)] ${FOCUS}`}
          >
            Ολόκληρη η βαθμολογία ({plural(table.rows.length, "ομάδα", "ομάδες")})
          </Link>
        </p>
      ) : null}
    </div>
  );
}

function Season({ view }: { view: TeamView }) {
  const { record, schedule, tables } = view;
  if (record.played === 0 && tables.length === 0) {
    return (
      <section aria-labelledby="season-title" className="border-b border-[#F3EFE6]/15 py-8 md:py-12">
        <SectionTitle id="season-title" title="Η σεζόν" />
        <p className="mt-3 text-[15px] text-[#F3EFE6]/70">Η ομάδα δεν έχει παίξει ακόμα αγώνα αυτή τη σεζόν.</p>
      </section>
    );
  }
  return (
    <section aria-labelledby="season-title" className="border-b border-[#F3EFE6]/15 py-8 md:py-12">
      <SectionTitle id="season-title" title="Η σεζόν" />
      <div className="mt-5 grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-12">
        <div className="min-w-0">
          <dl
            className="grid grid-cols-3 gap-px overflow-hidden rounded-xl bg-[#F3EFE6]/[0.08] sm:grid-cols-6 lg:grid-cols-3"
            style={{ boxShadow: layers("var(--team)") }}
          >
            <Tile value={record.played} label="Αγώνες" />
            <Tile value={record.won} label="Νίκες" />
            <Tile value={record.drawn} label="Ισοπαλίες" />
            <Tile value={record.lost} label="Ήττες" />
            <Tile value={record.goalsFor} label="Γκολ υπέρ" />
            <Tile value={record.goalsAgainst} label="Γκολ κατά" />
          </dl>

          {schedule.form.length > 0 ? (
            <div className="mt-6">
              <h3 className="text-[13px] font-bold uppercase tracking-[0.14em] text-[#F3EFE6]/65">Φόρμα</h3>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                <ol className="flex gap-1.5" aria-label="Τελευταίοι αγώνες, από τον παλαιότερο">
                  {schedule.form.map((outcome, i) => (
                    <li key={i} className="flex">
                      <OutcomeMark outcome={outcome} />
                    </li>
                  ))}
                </ol>
                <span className="text-[13px] text-[#F3EFE6]/65">
                  {schedule.form.length === 1
                    ? "Ο τελευταίος αγώνας."
                    : `Οι τελευταίοι ${schedule.form.length} αγώνες, ο πιο πρόσφατος δεξιά.`}
                </span>
              </div>
            </div>
          ) : null}
        </div>

        {tables.length > 0 ? (
          <div className="grid min-w-0 gap-8">
            {tables.map((table) => (
              <Table key={`${table.stageId}-${table.groupName ?? ""}`} table={table} teamId={view.team.id} />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

// ───────────────────────────────────────────────────────────────────────
// The squad
// ───────────────────────────────────────────────────────────────────────

/** Name column, then matches / goals / assists. */
const SQUAD_GRID = "grid grid-cols-[minmax(0,1fr)_repeat(3,2.75rem)] md:grid-cols-[minmax(0,1fr)_repeat(3,4.5rem)]";

/**
 * Font size that lets a surname of this length fill its row without being cut:
 * the name box's width (cqw — the box is a size container) shared out over the
 * letters, about half an em each in this condensed face. Short names stop at
 * the list's normal size; very long ones stop shrinking at a readable floor
 * and are cut there.
 */
const rowNameSize = (name: string) =>
  `min(2.1rem, max(1.15rem, calc(90cqw / ${(Math.max(name.length, 1) * 0.5).toFixed(1)})))`;

function Num({ value, label }: { value: number | null; label: string }) {
  return (
    <div
      className={`flex items-center justify-center text-base tabular-nums md:text-lg ${
        value ? "text-[#F3EFE6]/90" : "text-[#F3EFE6]/35"
      }`}
    >
      <span className="sr-only">{label}: </span>
      {value ?? <span aria-hidden>–</span>}
      {value === null ? <span className="sr-only">χωρίς συμμετοχή</span> : null}
    </div>
  );
}

function SquadRow({ player, logo }: { player: SquadPlayer; logo: string | null }) {
  const n = player.numbers;
  const name = mainName(player);
  const first = smallName(player);
  const mvp = n?.[4] ?? 0;
  const bestGk = n?.[5] ?? 0;
  const icon = "h-3.5 w-3.5 shrink-0";
  const award = "inline-flex items-center gap-1 rounded-md bg-[#D4AF37]/[0.16] px-1.5 py-1 font-bold text-[#FFE08A]";
  return (
    <li className="border-b border-[#F3EFE6]/[0.08]">
      <ProfileLink
        player={player}
        className={`${SQUAD_GRID} group ${player.href ? "transition-colors hover:bg-[#F3EFE6]/[0.05]" : ""}`}
      >
        <div className="flex min-w-0 items-center gap-3 py-2 pr-2 md:gap-4">
          <div
            data-profile-card
            className="w-[3.25rem] shrink-0 transition-transform duration-200 group-hover:scale-105 md:w-14"
          >
            <PlayerMini player={player} logo={logo} />
          </div>
          <div className="@container min-w-0 flex-1">
            {first ? (
              <div className="truncate text-[0.8rem] uppercase leading-none tracking-[0.08em] text-[#F3EFE6]/70">
                {first}
              </div>
            ) : null}
            <Chrome size={rowNameSize(name)} className="mt-1 truncate pr-2">
              {name}
            </Chrome>
            {player.keeper || mvp > 0 || bestGk > 0 || player.left || player.former ? (
              <ul className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] leading-none">
                {mvp > 0 ? (
                  <li className={award}>
                    <MvpIcon className={icon} />
                    MVP{mvp > 1 ? ` ×${mvp}` : ""}
                  </li>
                ) : null}
                {bestGk > 0 ? (
                  <li className={award}>
                    <BestGkIcon className={icon} />
                    Καλύτερος τερματοφύλακας{bestGk > 1 ? ` ×${bestGk}` : ""}
                  </li>
                ) : null}
                {player.keeper ? (
                  <li className="inline-flex items-center gap-1 text-[#F3EFE6]/85">
                    <GkIcon className={icon} />
                    Τερματοφύλακας
                  </li>
                ) : null}
                {player.left && !player.former ? <li className="text-[#F3EFE6]/65">Αποχώρησε</li> : null}
                {player.former ? (
                  <li>
                    <FormerPlayerBadge show size="xs" />
                  </li>
                ) : null}
              </ul>
            ) : null}
          </div>
        </div>
        <Num value={n ? n[0] : null} label="Αγώνες" />
        <Num value={n ? n[2] : null} label="Γκολ" />
        <Num value={n ? n[3] : null} label="Ασίστ" />
      </ProfileLink>
    </li>
  );
}

function SquadList({ players, logo }: { players: SquadPlayer[]; logo: string | null }) {
  return (
    <div>
      <div
        aria-hidden
        className={`${SQUAD_GRID} border-b border-[#F3EFE6]/20 pb-2 text-[13px] text-[#F3EFE6]/65`}
      >
        <span>Παίκτης</span>
        <span className="text-center">Αγ.</span>
        <span className="text-center">Γκολ</span>
        <span className="text-center">Ασ.</span>
      </div>
      <ul>
        {players.map((player) => (
          <SquadRow key={player.id} player={player} logo={logo} />
        ))}
      </ul>
    </div>
  );
}

function Squad({ view }: { view: TeamView }) {
  const { squad, departed, team } = view;
  return (
    <section aria-labelledby="squad-title" className="border-b border-[#F3EFE6]/15 py-8 md:py-12">
      <SectionTitle
        id="squad-title"
        title="Ρόστερ"
        lede={
          squad.length > 0
            ? `${plural(squad.length, "παίκτης", "παίκτες")}. Τα νούμερα αφορούν τους αγώνες με την ομάδα.`
            : undefined
        }
      />
      {squad.length === 0 ? (
        <p className="mt-3 text-[15px] text-[#F3EFE6]/70">Το ρόστερ δεν έχει δηλωθεί ακόμα.</p>
      ) : (
        <div className="mt-5">
          <SquadList players={squad} logo={team.logo} />
        </div>
      )}

      {departed.length > 0 ? (
        <div className="mt-10">
          <h3 className="text-lg font-bold italic">Έπαιξαν στη σεζόν και αποχώρησαν</h3>
          <div className="mt-3">
            <SquadList players={departed} logo={team.logo} />
          </div>
        </div>
      ) : null}
    </section>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Matches
// ───────────────────────────────────────────────────────────────────────

const ROW_LINK = `group flex items-center gap-3 py-3 transition-colors hover:bg-[#F3EFE6]/[0.05] ${FOCUS}`;

/** A match that has not been played: upcoming, awaiting its result, postponed or undated. */
function FixtureRow({ match, withDate }: { match: TeamMatch; withDate: boolean }) {
  return (
    <li className="border-b border-[#F3EFE6]/[0.08]">
      <Link href={`${MATCH_PATH}/${match.id}`} className={ROW_LINK}>
        {withDate && match.date ? (
          <span className="flex w-[4.5rem] shrink-0 flex-col gap-0.5 leading-none">
            <span className="text-[13px] text-[#F3EFE6]/65">{formatMatchDate(match.date, { weekday: "long" })}</span>
            <span className="text-lg font-bold tabular-nums">
              {formatMatchDate(match.date, { day: "numeric", month: "short" })}
            </span>
            <span className="text-[13px] tabular-nums text-[#F3EFE6]/85">{formatMatchTime(match.date)}</span>
          </span>
        ) : null}
        <Crest team={match.opponent} className="h-9 w-9" sizes="36px" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold group-hover:text-[color:var(--team)]">{opponentName(match)}</span>
          {/* Wraps, never cut: the matchday sits at the end of a long tournament name. */}
          <span className="mt-0.5 block text-[13px] leading-snug text-[#F3EFE6]/65">{competitionLabel(match)}</span>
        </span>
      </Link>
    </li>
  );
}

/** A finished match from the team's side: result mark, opponent, score. */
function ResultRow({ match }: { match: TeamMatch }) {
  const result = match.result;
  if (!result) return null;
  const note = resultNote(result);
  const when = match.date ? formatMatchDate(match.date, { day: "numeric", month: "long" }) : null;
  return (
    <li className="border-b border-[#F3EFE6]/[0.08]">
      <Link href={`${MATCH_PATH}/${match.id}`} className={ROW_LINK}>
        <OutcomeMark outcome={result.outcome} />
        <Crest team={match.opponent} className="h-9 w-9" sizes="36px" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold group-hover:text-[color:var(--team)]">{opponentName(match)}</span>
          <span className="mt-0.5 block text-[13px] leading-snug text-[#F3EFE6]/65">
            {[when, competitionLabel(match)].filter(Boolean).join(", ")}
          </span>
          {note ? <span className="mt-0.5 block text-[13px] text-[#F3EFE6]/85">{note}</span> : null}
        </span>
        <span className="shrink-0 pr-1 text-2xl font-bold tabular-nums">
          <span className="sr-only">Σκορ </span>
          {result.own}–{result.opp}
        </span>
      </Link>
    </li>
  );
}

/** The first rows of a list, and the rest behind a native disclosure (no script). */
function Collapsible<T>({
  items,
  more,
  render,
}: {
  items: T[];
  /** Label of the disclosure, e.g. «Όλα τα αποτελέσματα». */
  more: string;
  render: (item: T) => React.ReactNode;
}) {
  const rest = items.slice(SHOWN);
  return (
    <>
      <ul>{items.slice(0, SHOWN).map(render)}</ul>
      {rest.length > 0 ? (
        <details className="group/more">
          <summary
            className={`mt-3 inline-flex h-11 cursor-pointer list-none items-center ${BUTTON_SHAPE} px-5 text-[15px] hover:text-[color:var(--team)] group-open/more:hidden [&::-webkit-details-marker]:hidden ${FOCUS}`}
          >
            {more} ({items.length})
          </summary>
          <ul>{rest.map(render)}</ul>
        </details>
      ) : null}
    </>
  );
}

function FixtureGroup({ title, note, matches }: { title: string; note?: string; matches: TeamMatch[] }) {
  if (matches.length === 0) return null;
  return (
    <div className="mt-8">
      <h4 className="text-[13px] font-bold uppercase tracking-[0.14em] text-[#F3EFE6]/65">{title}</h4>
      {note ? <p className="mt-1 text-[13px] text-[#F3EFE6]/65">{note}</p> : null}
      <ul className="mt-1">
        {matches.map((m) => (
          <FixtureRow key={m.id} match={m} withDate={false} />
        ))}
      </ul>
    </div>
  );
}

function Matches({ view }: { view: TeamView }) {
  const { upcoming, awaiting, postponed, undated, results } = view.schedule;
  const pending = upcoming.length + awaiting.length + postponed.length + undated.length;
  if (pending + results.length === 0) return null;
  // A finished season has nothing left to play: the results take the whole width.
  const seasonOver = pending === 0;
  return (
    <section aria-labelledby="matches-title" className="border-b border-[#F3EFE6]/15 py-8 md:py-12">
      <SectionTitle id="matches-title" title="Αγώνες" />
      <div className={`mt-5 grid gap-10 lg:gap-12 ${seasonOver ? "" : "lg:grid-cols-2"}`}>
        {seasonOver ? null : (
        <div className="min-w-0">
          <ListHead title="Πρόγραμμα" note={upcoming.length > 0 ? plural(upcoming.length, "αγώνας", "αγώνες") : undefined} />
          {upcoming.length > 0 ? (
            <Collapsible
              items={upcoming}
              more="Όλο το πρόγραμμα"
              render={(m) => <FixtureRow key={m.id} match={m} withDate />}
            />
          ) : (
            <p className="py-5 text-[15px] text-[#F3EFE6]/65">Δεν υπάρχουν αγώνες με ημερομηνία.</p>
          )}

          {awaiting.length > 0 ? (
            <div className="mt-8">
              <h4 className="text-[13px] font-bold uppercase tracking-[0.14em] text-[#F3EFE6]/65">
                Αναμένεται το αποτέλεσμα
              </h4>
              <ul className="mt-1">
                {awaiting.map((m) => (
                  <FixtureRow key={m.id} match={m} withDate />
                ))}
              </ul>
            </div>
          ) : null}
          <FixtureGroup title="Αναβλήθηκαν" note="Η νέα ημερομηνία θα ανακοινωθεί." matches={postponed} />
          <FixtureGroup title="Χωρίς ημερομηνία ακόμα" matches={undated} />
        </div>
        )}

        <div className="min-w-0">
          <ListHead
            title="Αποτελέσματα"
            note={results.length > 0 ? plural(results.length, "αγώνας", "αγώνες") : undefined}
          />
          {results.length > 0 ? (
            <Collapsible
              items={results}
              more="Όλα τα αποτελέσματα"
              render={(m) => <ResultRow key={m.id} match={m} />}
            />
          ) : (
            <p className="py-5 text-[15px] text-[#F3EFE6]/65">Δεν έχει παιχτεί ακόμα αγώνας.</p>
          )}
        </div>
      </div>
    </section>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Tournaments
// ───────────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  running: "Σε εξέλιξη",
  completed: "Ολοκληρώθηκε",
  archived: "Αρχείο",
};

function Tournaments({ view }: { view: TeamView }) {
  if (view.tournaments.length === 0) return null;
  const titles = view.tournaments.filter((t) => t.won).length;
  return (
    <section aria-labelledby="tournaments-title" className="border-b border-[#F3EFE6]/15 py-8 md:py-12">
      <SectionTitle
        id="tournaments-title"
        title="Διοργανώσεις"
        lede={titles > 0 ? `${plural(titles, "τίτλος", "τίτλοι")} αυτή τη σεζόν.` : undefined}
      />
      <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {view.tournaments.map((t) => (
          <li key={t.id}>
            <Link
              href={`${TOURNAMENT_PATH}/${t.id}`}
              className={`group flex h-full flex-col gap-1 ${SURFACE} px-4 py-3 transition-colors hover:bg-[#171724] ${FOCUS}`}
              style={{ boxShadow: layer(t.won ? "#D4AF37" : "var(--team)") }}
            >
              <span className="text-lg font-bold italic leading-tight group-hover:text-[color:var(--team)]">
                {t.name}
              </span>
              {/* Only a status that says something: a league half-way through is often still stored as "scheduled". */}
              {t.status && STATUS_LABEL[t.status] ? (
                <span className="text-[13px] text-[#F3EFE6]/65">{STATUS_LABEL[t.status]}</span>
              ) : null}
              {t.won ? <span className="text-[13px] font-bold text-[#FFE08A]">★ Κατάκτηση τίτλου</span> : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Page
// ───────────────────────────────────────────────────────────────────────

export default function TeamPage({ view }: { view: TeamView }) {
  const { team, season, general } = view;
  const { kit, accent, ink } = teamAccent(team.colour);
  const palette = { "--team": accent, "--team-ink": ink } as React.CSSProperties;
  const fact = "text-[15px] text-[#F3EFE6]/75";

  return (
    <ProfileHost>
      <div className="min-h-screen overflow-x-hidden bg-[#0a0a14] text-[#F3EFE6]" style={palette}>
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <header className="pb-6 pt-5 md:pb-8 md:pt-8">
            <nav aria-label="Διαδρομή" className="text-[13px] text-[#F3EFE6]/65">
              <Link href="/" className={`hover:text-[color:var(--team)] ${FOCUS}`}>
                Αρχική
              </Link>
              <span aria-hidden> / </span>
              <Link href="/OMADES" className={`hover:text-[color:var(--team)] ${FOCUS}`}>
                Ομάδες
              </Link>
            </nav>

            <div className="mt-5 flex items-center gap-4 md:gap-8">
              <Crest
                team={{ id: team.id, name: team.name, logo: team.logo }}
                className="h-20 w-20 text-3xl md:h-36 md:w-36 md:text-5xl"
                sizes="(min-width: 768px) 144px, 80px"
              />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-[color:var(--team)]">
                  Ομάδα{season ? ` · Σεζόν ${season.display}` : ""}
                </p>
                <h1>
                  <Chrome size="clamp(2.3rem, 9.5vw, 5.25rem)" className="mt-1 pr-2 [overflow-wrap:anywhere]">
                    {team.name}
                  </Chrome>
                </h1>
              </div>
            </div>

            {/* The kit stripe: the team's colour exactly as stored. The hairline keeps even black visible. */}
            <div aria-hidden className="mt-5 h-1.5 border border-[#F3EFE6]/20 md:mt-7" style={{ background: kit ?? accent }} />

            {general || team.am || season?.archived ? (
              <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
                {general ? (
                  <li className={fact}>
                    {season?.archived ? (
                      <>
                        Γενική Κατάταξη:{" "}
                        <b className="text-[#F3EFE6]">
                          {general.rank}η θέση, {plural(general.points, "βαθμός", "βαθμοί")}
                        </b>
                      </>
                    ) : (
                      <Link href="/geniki-katataxi" className={`group ${FOCUS}`}>
                        Γενική Κατάταξη:{" "}
                        <b className="text-[#F3EFE6] underline decoration-[#F3EFE6]/30 underline-offset-4 group-hover:text-[color:var(--team)]">
                          {general.rank}η θέση, {plural(general.points, "βαθμός", "βαθμοί")}
                        </b>
                      </Link>
                    )}
                  </li>
                ) : null}
                {team.am ? (
                  <li className={fact}>
                    Αριθμός μητρώου: <b className="text-[#F3EFE6]">{team.am}</b>
                  </li>
                ) : null}
                {season?.archived ? <li className={fact}>Σελίδα αρχείου: η σεζόν έχει ολοκληρωθεί.</li> : null}
              </ul>
            ) : null}
          </header>

          <div className="border-t border-[#F3EFE6]/15">
            <NextMatch view={view} />
            <Season view={view} />
            <Squad view={view} />
            <Matches view={view} />
            <Tournaments view={view} />
          </div>

          <footer className="py-6">
            <Link
              href="/OMADES"
              className={`inline-flex h-11 items-center ${BUTTON_SHAPE} px-5 text-[15px] hover:text-[color:var(--team)] ${FOCUS}`}
            >
              Όλες οι ομάδες
            </Link>
          </footer>
        </div>
      </div>
    </ProfileHost>
  );
}
