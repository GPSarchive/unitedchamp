// The match page, rebuilt around the player cards of the players page.
//
// Two versions, chosen by whether the match has been played:
//   · before — kick-off time, each squad's leading scorer on the big card,
//     and both squads as a wall of small cards;
//   · after — the score with its scorers, the MVP and best goalkeeper on the
//     big card, and the match sheet as rows that look like the players list.
//
// Every card of a player who has a profile opens it on top of the page, the
// card flying into it as on the players page (ProfileHost / ProfileTrigger).
//
// A server component: only the cards and the profile overlay run in the browser.
import Link from "next/link";
import { TeamImage, TournamentImage } from "@/app/lib/OptimizedImage";
import { formatMatchDate, formatMatchTime } from "@/app/lib/datetime";
import { BUTTON_SHAPE, CHIP, SURFACE, layers } from "@/app/lib/ui/flat";
import { FormerPlayerBadge } from "@/components/FormerPlayerBadge";
import {
  AssistIcon,
  BestGkIcon,
  BlueCardIcon,
  CaptainIcon,
  GkIcon,
  GoalIcon,
  MvpIcon,
  OwnGoalIcon,
  RedCardIcon,
  YellowCardIcon,
} from "@/app/matches/[id]/StatIcons";
import { NAME_LETTERING } from "../../paiktes-v3/nameStyles";
import { ProfileHost, ProfileTrigger } from "../../paiktes-v3/ProfileHost";
import { PlayerHolo, PlayerMini } from "./cards";
import {
  mainName,
  playerName,
  smallName,
  winnerSide,
  type MatchPlayer,
  type MatchTeam,
  type MatchView,
  type ScorerLine,
  type SheetRow,
  type Star,
  type StatLine,
  type TeamSide,
} from "./model";

const FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#fb923c]";

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

const FULL_DATE = { weekday: "long", day: "numeric", month: "long", year: "numeric" } as const;

// ───────────────────────────────────────────────────────────────────────
// Small pieces
// ───────────────────────────────────────────────────────────────────────

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

function TeamLogo({ team, className, sizes }: { team: MatchTeam; className: string; sizes: string }) {
  return (
    <div className={`relative shrink-0 ${className}`}>
      {team.logo ? (
        <TeamImage src={team.logo} alt="" fill objectFit="contain" sizes={sizes} animate={false} />
      ) : (
        <div className={`flex h-full w-full items-center justify-center ${CHIP} text-lg font-bold text-[#F3EFE6]/50`}>
          {team.name.charAt(0)}
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

/** A team's name over its part of a two-column section. */
function TeamBar({ team, count }: { team: MatchTeam; count: string }) {
  return (
    <div className="flex items-center gap-3 border-b-2 border-[#fb923c] pb-2">
      <TeamLogo team={team} className="h-8 w-8" sizes="32px" />
      <h3 className="min-w-0 flex-1 truncate text-lg font-bold italic">
        <Link href={`/OMADA/${team.id}`} className={`hover:text-[#fb923c] ${FOCUS}`}>
          {team.name}
        </Link>
      </h3>
      <span className="shrink-0 text-[13px] text-[#F3EFE6]/65">{count}</span>
    </div>
  );
}

const playersCount = (n: number) => (n === 1 ? "1 παίκτης" : `${n} παίκτες`);

// ───────────────────────────────────────────────────────────────────────
// Scoreboard
// ───────────────────────────────────────────────────────────────────────

function TeamHead({ team }: { team: MatchTeam }) {
  return (
    <Link
      href={`/OMADA/${team.id}`}
      className={`group flex min-w-0 flex-col items-center gap-2 text-center md:gap-3 ${FOCUS}`}
    >
      <TeamLogo
        team={team}
        className="h-16 w-16 transition-transform duration-200 group-hover:scale-105 md:h-28 md:w-28"
        sizes="(min-width: 768px) 112px, 64px"
      />
      {/* Side padding: the clamp cuts at the box, and italic letters lean past it. */}
      <span className="line-clamp-2 max-w-full px-1.5 text-base font-bold italic leading-tight [overflow-wrap:anywhere] group-hover:text-[#fb923c] md:text-2xl">
        {team.name}
      </span>
    </Link>
  );
}

function ScorerList({
  lines,
  logo,
  toCentre,
}: {
  lines: ScorerLine[];
  logo: string | null;
  /** Left-hand team: the list hugs the middle of the scoreboard. */
  toCentre: boolean;
}) {
  return (
    <ul className="space-y-1.5">
      {lines.map((s) => (
        <li key={s.player.id}>
          <ProfileLink
            player={s.player}
            className={`group flex items-center gap-2 ${toCentre ? "flex-row-reverse text-right" : ""}`}
          >
            <div
              data-profile-card
              className="w-7 shrink-0 transition-transform duration-200 group-hover:scale-110 md:w-8"
            >
              <PlayerMini player={s.player} logo={logo} />
            </div>
            <span className="min-w-0 text-[15px] leading-tight">
              <span className="uppercase [overflow-wrap:anywhere] group-hover:text-[#fb923c]">
                {mainName(s.player)}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1 text-[15px] font-bold tabular-nums text-[#fb923c]">
              <GoalIcon className="h-3.5 w-3.5 shrink-0" />
              <span className="sr-only">, {s.count} γκολ</span>
              {s.count > 1 ? <span aria-hidden>×{s.count}</span> : null}
            </span>
          </ProfileLink>
        </li>
      ))}
    </ul>
  );
}

function Scoreboard({ view }: { view: MatchView }) {
  const { a, b, score, penalties, aggregate } = view;
  const time = formatMatchTime(view.date);
  const postponed = view.status === "postponed";

  let result: string | null = null;
  if (score) {
    const side = winnerSide(score, penalties);
    const winner = side === "a" ? a.team.name : side === "b" ? b.team.name : null;
    result = !winner ? "Ισοπαλία" : score.a === score.b ? `Νίκη ${winner} στα πέναλτι` : `Νίκη ${winner}`;
  }
  const hasScorers = a.scorers.length + b.scorers.length > 0;

  return (
    <section aria-label="Αποτέλεσμα" className="border-y border-[#F3EFE6]/15 py-6 md:py-10">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-x-3 md:gap-x-10">
        <TeamHead team={a.team} />

        <div className="flex min-w-[5.5rem] flex-col items-center text-center md:pt-3">
          <p
            className={`text-[13px] font-bold uppercase tracking-[0.14em] ${
              postponed ? "text-[#c084fc]" : score ? "text-[#F3EFE6]/65" : "text-[#fb923c]"
            }`}
          >
            {score ? "Τελικό" : postponed ? "Αναβολή" : "Προσεχώς"}
          </p>

          {score ? (
            <Chrome size="clamp(4.5rem, 18vw, 9rem)" className="whitespace-nowrap px-1">
              <span className="sr-only">
                {a.team.name} {score.a}, {b.team.name} {score.b}
              </span>
              <span aria-hidden>
                {score.a} : {score.b}
              </span>
            </Chrome>
          ) : time ? (
            <Chrome size="clamp(2.75rem, 11vw, 5.5rem)" className="whitespace-nowrap px-1">
              <span className="sr-only">Ώρα έναρξης </span>
              {time}
            </Chrome>
          ) : (
            <p className="mt-2 text-[15px] text-[#F3EFE6]/70">Ώρα προς ανακοίνωση</p>
          )}

        </div>

        <TeamHead team={b.team} />
      </div>

      {/* Under the three columns, not inside the middle one: a long line here
          would widen that column and squeeze the team names on a phone. */}
      {result ? (
        <div className="mt-3 flex flex-col items-center gap-2 text-center">
          <p className="text-[15px] font-bold text-[#fb923c]">{result}</p>
          {penalties ? (
            <p className="rounded-md bg-[#D4AF37]/[0.16] px-2.5 py-1 text-[15px] font-bold tabular-nums text-[#FFE08A]">
              Πέναλτι {penalties.a}–{penalties.b}
            </p>
          ) : null}
          {aggregate ? (
            <p className="text-[13px] tabular-nums text-[#F3EFE6]/70">
              Συνολικό σκορ {aggregate.a}–{aggregate.b}
            </p>
          ) : null}
        </div>
      ) : null}

      {hasScorers ? (
        <div className="mt-6 grid grid-cols-2 gap-x-4 border-t border-[#F3EFE6]/10 pt-4 md:gap-x-10">
          <h3 className="sr-only">Σκόρερ</h3>
          <ScorerList lines={a.scorers} logo={a.team.logo} toCentre />
          <ScorerList lines={b.scorers} logo={b.team.logo} toCentre={false} />
        </div>
      ) : null}
    </section>
  );
}

// ───────────────────────────────────────────────────────────────────────
// The big cards
// ───────────────────────────────────────────────────────────────────────

function StarCard({ star, after }: { star: Star; after: boolean }) {
  return (
    <figure className="w-[min(74vw,18rem)] shrink-0 snap-center md:w-72">
      <figcaption className="mb-3 text-center">
        <span className="block text-[13px] font-bold uppercase tracking-[0.14em] text-[#fb923c]">
          {star.label}
        </span>
        <span className="mt-0.5 block truncate text-[15px] text-[#F3EFE6]/70">{star.team.name}</span>
      </figcaption>
      <ProfileLink player={star.player} className="block">
        <PlayerHolo player={star.player} team={star.team} season={star.season} />
      </ProfileLink>
      {star.note ? (
        <p className="mt-4 text-center text-[15px] text-[#F3EFE6]/85">
          {after ? "Στον αγώνα: " : null}
          <span className="font-bold">{star.note}</span>
        </p>
      ) : null}
    </figure>
  );
}

function Stars({ view }: { view: MatchView }) {
  if (view.stars.length === 0) return null;
  const after = view.phase === "after";
  return (
    <section aria-labelledby="stars-title" className="border-b border-[#F3EFE6]/15 py-8 md:py-12">
      <SectionTitle
        id="stars-title"
        title={after ? "Πρωταγωνιστές" : "Πρόσωπα του αγώνα"}
        lede={
          after
            ? "Οι βραβευμένοι του αγώνα. Η κάρτα δείχνει τα νούμερά τους σε όλη τη σεζόν."
            : "Ο πρώτος σκόρερ κάθε ομάδας. Η κάρτα δείχνει τα νούμερά του σε όλη τη σεζόν."
        }
      />
      {/* On a phone the cards sit in a row that scrolls sideways, the next one
          peeking in; from md up they stand side by side. The padding leaves
          room for the cards' shadow and tilt, which a scrolling box would cut. */}
      <div
        className={`-mx-4 mt-4 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 py-5 [scrollbar-width:none] md:mx-0 md:justify-center md:gap-14 md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden ${
          view.stars.length === 1 ? "justify-center" : ""
        }`}
      >
        {view.stars.map((star) => (
          <StarCard key={star.player.id} star={star} after={after} />
        ))}
      </div>
    </section>
  );
}

// ───────────────────────────────────────────────────────────────────────
// After: the match sheet
// ───────────────────────────────────────────────────────────────────────

type Badge = { key: string; icon: React.ReactNode; text: string; award?: boolean };

function badgesOf(line: StatLine | null): Badge[] {
  if (!line) return [];
  const icon = "h-3.5 w-3.5 shrink-0";
  const out: Badge[] = [];
  if (line.mvp) out.push({ key: "mvp", icon: <MvpIcon className={icon} />, text: "MVP", award: true });
  if (line.bestGk) {
    out.push({
      key: "best-gk",
      icon: <BestGkIcon className={icon} />,
      text: "Καλύτερος τερματοφύλακας",
      award: true,
    });
  }
  if (line.goals > 0) out.push({ key: "goals", icon: <GoalIcon className={icon} />, text: `${line.goals} γκολ` });
  if (line.assists > 0) {
    out.push({ key: "assists", icon: <AssistIcon className={icon} />, text: `${line.assists} ασίστ` });
  }
  if (line.ownGoals > 0) {
    out.push({
      key: "own",
      icon: <OwnGoalIcon className={icon} />,
      text: line.ownGoals > 1 ? `${line.ownGoals} αυτογκόλ` : "Αυτογκόλ",
    });
  }
  if (line.captain) out.push({ key: "captain", icon: <CaptainIcon className={icon} />, text: "Αρχηγός" });
  if (line.gk) out.push({ key: "gk", icon: <GkIcon className={icon} />, text: "Τερματοφύλακας" });
  if (line.yellow > 0) {
    out.push({
      key: "yellow",
      icon: <YellowCardIcon className={icon} />,
      text: line.yellow > 1 ? `${line.yellow} κίτρινες` : "Κίτρινη κάρτα",
    });
  }
  if (line.red > 0) out.push({ key: "red", icon: <RedCardIcon className={icon} />, text: "Κόκκινη κάρτα" });
  if (line.blue > 0) out.push({ key: "blue", icon: <BlueCardIcon className={icon} />, text: "Μπλε κάρτα" });
  return out;
}

function SheetItem({ row, logo }: { row: SheetRow; logo: string | null }) {
  const { player, line } = row;
  const badges = badgesOf(line);
  const first = smallName(player);
  return (
    <li className="border-b border-[#F3EFE6]/[0.08]">
      <ProfileLink
        player={player}
        className={`group flex items-center gap-3 py-2 md:gap-4 ${
          player.href ? "transition-colors hover:bg-[#F3EFE6]/[0.05]" : ""
        }`}
      >
        <div
          data-profile-card
          className="w-[3.25rem] shrink-0 transition-transform duration-200 group-hover:scale-105 md:w-14"
        >
          <PlayerMini player={player} logo={logo} />
        </div>
        <div className="min-w-0 flex-1">
          {first ? (
            <div className="truncate text-[0.8rem] uppercase leading-none tracking-[0.08em] text-[#F3EFE6]/70">
              {first}
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <Chrome size="clamp(1.65rem, 5vw, 2.1rem)" className="mt-1 min-w-0 truncate pr-2">
              {mainName(player)}
            </Chrome>
            <FormerPlayerBadge show={player.former} size="xs" className="shrink-0" />
          </div>
          {badges.length > 0 ? (
            <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1.5">
              {badges.map((b) => (
                <li
                  key={b.key}
                  className={`inline-flex items-center gap-1 text-[13px] leading-none ${
                    b.award
                      ? "rounded-md bg-[#D4AF37]/[0.16] px-1.5 py-1 font-bold text-[#FFE08A]"
                      : "text-[#F3EFE6]/85"
                  }`}
                >
                  {b.icon}
                  {b.text}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {line?.number != null ? (
          <span className="shrink-0 pr-1 text-2xl font-bold tabular-nums text-[#F3EFE6]/25">
            <span className="sr-only">Νούμερο </span>
            {line.number}
          </span>
        ) : null}
      </ProfileLink>
    </li>
  );
}

function TeamSheet({ side }: { side: TeamSide }) {
  return (
    <div className="min-w-0">
      <TeamBar team={side.team} count={playersCount(side.sheet.length)} />
      {side.sheet.length === 0 ? (
        <p className="py-6 text-[15px] text-[#F3EFE6]/65">Δεν έχουν καταχωρηθεί συμμετοχές.</p>
      ) : (
        <ul>
          {side.sheet.map((row) => (
            <SheetItem key={row.player.id} row={row} logo={side.team.logo} />
          ))}
        </ul>
      )}
    </div>
  );
}

function MatchSheet({ view }: { view: MatchView }) {
  const empty = view.a.sheet.length + view.b.sheet.length === 0;
  return (
    <section aria-labelledby="sheet-title" className="py-8 md:py-12">
      <SectionTitle id="sheet-title" title="Φύλλο αγώνα" />
      {empty ? (
        <p className="mt-4 text-[15px] text-[#F3EFE6]/70">
          Οι συμμετοχές και τα στατιστικά του αγώνα δεν έχουν καταχωρηθεί ακόμα.
        </p>
      ) : (
        <div className="mt-5 grid gap-10 lg:grid-cols-2 lg:gap-12">
          <TeamSheet side={view.a} />
          <TeamSheet side={view.b} />
        </div>
      )}
    </section>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Before: the squads
// ───────────────────────────────────────────────────────────────────────

/**
 * Font size that lets a surname of this length fill a squad tile without being
 * cut: the tile's width (cqw — the tile is a size container) shared out over
 * the letters, about half an em each in this condensed face. Short names stop
 * at the normal size; very long ones stop shrinking at a readable floor and
 * are cut there.
 */
const tileNameSize = (name: string) =>
  `min(1.4rem, max(0.85rem, calc(92cqw / ${(Math.max(name.length, 1) * 0.5).toFixed(1)})))`;

function RosterTile({ player, logo }: { player: MatchPlayer; logo: string | null }) {
  const name = mainName(player);
  return (
    <li className="@container min-w-0">
      <ProfileLink player={player} className="group block text-center">
        <div
          data-profile-card
          className="mx-auto w-full max-w-[7rem] transition-transform duration-200 group-hover:scale-105"
        >
          <PlayerMini player={player} logo={logo} />
        </div>
        {/* Always a line, so one-name players do not sit higher than the rest. */}
        <div className="mt-2 truncate text-[0.75rem] uppercase leading-none tracking-[0.08em] text-[#F3EFE6]/65">
          {smallName(player) || " "}
        </div>
        <Chrome size={tileNameSize(name)} className="mt-1 truncate px-1">
          {name}
        </Chrome>
        <FormerPlayerBadge show={player.former} size="xs" className="mt-1" />
      </ProfileLink>
    </li>
  );
}

function TeamRoster({ side }: { side: TeamSide }) {
  return (
    <div className="min-w-0">
      <TeamBar team={side.team} count={playersCount(side.roster.length)} />
      {side.roster.length === 0 ? (
        <p className="py-6 text-[15px] text-[#F3EFE6]/65">Το ρόστερ δεν έχει δηλωθεί ακόμα.</p>
      ) : (
        <ul className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(5.25rem,1fr))] gap-x-3 gap-y-6">
          {side.roster.map((player) => (
            <RosterTile key={player.id} player={player} logo={side.team.logo} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Rosters({ view }: { view: MatchView }) {
  return (
    <section aria-labelledby="rosters-title" className="py-8 md:py-12">
      <SectionTitle id="rosters-title" title="Ρόστερ" lede="Οι παίκτες των δύο ομάδων." />
      <div className="mt-5 grid gap-10 lg:grid-cols-2 lg:gap-12">
        <TeamRoster side={view.a} />
        <TeamRoster side={view.b} />
      </div>
    </section>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Page
// ───────────────────────────────────────────────────────────────────────

/** Preview only: lets a played match be seen in its "before" version too. */
function PhaseSwitch({ view, basePath }: { view: MatchView; basePath: string }) {
  const options = [
    { phase: "after", label: "Μετά τον αγώνα", href: basePath },
    { phase: "before", label: "Πριν τον αγώνα", href: `${basePath}?view=before` },
  ] as const;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[#F3EFE6]/10 py-3">
      <span className="text-[13px] text-[#F3EFE6]/65">Έκδοση σελίδας (προεπισκόπηση)</span>
      <div className="flex gap-px overflow-hidden rounded-lg bg-[#F3EFE6]/[0.08]">
        {options.map((o) => {
          const active = o.phase === view.phase;
          return (
            <Link
              key={o.phase}
              href={o.href}
              aria-current={active ? "page" : undefined}
              className={`flex h-9 items-center px-3 text-sm ${FOCUS} ${
                active ? "bg-[#fb923c] font-bold text-[#0a0a14]" : "text-[#F3EFE6]/80 hover:bg-[#F3EFE6]/[0.06]"
              }`}
            >
              {o.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default function MatchPage({
  view,
  basePath,
  canSwitch,
}: {
  view: MatchView;
  /** This page's own address, without the query. */
  basePath: string;
  /** The match has been played, so both versions exist. */
  canSwitch: boolean;
}) {
  const day = formatMatchDate(view.date, FULL_DATE);
  const time = formatMatchTime(view.date);
  const after = view.phase === "after";

  return (
    <ProfileHost>
      <div className="min-h-screen overflow-x-hidden bg-[#0a0a14] text-[#F3EFE6]">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          {canSwitch ? <PhaseSwitch view={view} basePath={basePath} /> : null}

          <header className="pb-5 pt-5 md:pt-8">
            <nav aria-label="Διαδρομή" className="text-[13px] text-[#F3EFE6]/65">
              <Link href="/" className={`hover:text-[#fb923c] ${FOCUS}`}>
                Αρχική
              </Link>
              <span aria-hidden> / </span>
              <Link href="/matches" className={`hover:text-[#fb923c] ${FOCUS}`}>
                Αγώνες
              </Link>
            </nav>

            <div className="mt-3 flex items-center gap-3">
              {view.tournament?.logo ? (
                <div className="relative h-11 w-11 shrink-0 md:h-12 md:w-12">
                  <TournamentImage
                    src={view.tournament.logo}
                    alt=""
                    fill
                    objectFit="contain"
                    sizes="48px"
                    priority
                    animate={false}
                  />
                </div>
              ) : null}
              <div className="min-w-0">
                <h1 className="text-xl font-bold italic leading-tight md:text-2xl">
                  <span className="sr-only">
                    {view.a.team.name} – {view.b.team.name},{" "}
                  </span>
                  {view.tournament ? (
                    <Link href={`/tournaments/${view.tournament.id}`} className={`hover:text-[#fb923c] ${FOCUS}`}>
                      {view.tournament.name}
                    </Link>
                  ) : (
                    "Αγώνας"
                  )}
                </h1>
                <p className="mt-0.5 text-[15px] text-[#F3EFE6]/70">
                  {day || "Ημερομηνία προς ανακοίνωση"}
                  {after && time ? ` · ${time}` : null}
                  {view.referee ? ` · Διαιτητής: ${view.referee}` : null}
                </p>
              </div>
            </div>
          </header>

          <Scoreboard view={view} />
          {/* Πρωταγωνιστές / Πρόσωπα του αγώνα hidden for now (the owner has a plan for them): */}
          {/* <Stars view={view} /> */}
          {after ? <MatchSheet view={view} /> : <Rosters view={view} />}

          {view.videoId ? (
            <section aria-labelledby="video-title" className="border-t border-[#F3EFE6]/15 py-8 md:py-12">
              <SectionTitle id="video-title" title="Βίντεο αγώνα" />
              <div
                className={`mt-5 aspect-video w-full overflow-hidden ${SURFACE}`}
                style={{ boxShadow: layers("#fb923c") }}
              >
                <iframe
                  className="h-full w-full"
                  src={`https://www.youtube.com/embed/${view.videoId}`}
                  title="Βίντεο αγώνα στο YouTube"
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            </section>
          ) : null}

          <footer className="border-t border-[#F3EFE6]/15 py-6">
            <Link
              href="/matches"
              className={`inline-flex h-11 items-center ${BUTTON_SHAPE} px-5 text-[15px] hover:text-[#fb923c] ${FOCUS}`}
            >
              Όλοι οι αγώνες
            </Link>
          </footer>
        </div>
      </div>
    </ProfileHost>
  );
}
