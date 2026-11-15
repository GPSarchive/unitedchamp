// The tournament's «Ομάδες» tab: every team as a tile in a grid — two across
// on a phone, up to six on a desk — with its colour down the side. A tap opens
// the team under the tile's row: first its course through the tournament
// (where it stands, its points match by match, its last result, the table
// around it), then its squad in the small player cards; each card opens the
// player's profile on top of the page. A tile already shows the team's last
// five results as marks.
//
// What a tile and a squad show is drawn here, on the server; which one is open
// is the only thing the browser keeps (TeamGrid).
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlayerMini } from "../../../matches-v3/[id]/cards";
import { mainName, smallName } from "../../../matches-v3/[id]/model";
import { loadBase, loadSquads, loadTables } from "../../../tournaments-v3/[id]/data";
import { standingOf, type Squad, type SquadMember, type StageTables } from "../../../tournaments-v3/[id]/model";
import styles from "../dispatch.module.css";
import { loadColours, profileHref } from "../extra";
import { TEAM_PATH } from "../paths";
import { BUTTON, LABEL, SAFFRON } from "../tokens";
import { Chrome, Crest, ProfileLink, Rubric, fitName, parseId, plural } from "../ui";
import Progress, { FormMarks } from "./TeamCourse";
import { teamResults, type Outcome, type TeamResult } from "./progress";
import TeamGrid from "./TeamGrid";

export const revalidate = 60;

export function generateStaticParams() {
  return [];
}

const playersOf = (n: number) => plural(n, "παίκτης", "παίκτες");

function Member({
  player,
  href,
  logo,
  index,
}: {
  player: SquadMember;
  href: string;
  logo: string | null;
  index: number;
}) {
  const name = mainName(player);
  return (
    <li className="@container min-w-0" style={{ "--i": index } as React.CSSProperties}>
      <ProfileLink player={player} href={href} className="group/card block text-center">
        <div
          data-profile-card
          className="mx-auto w-full max-w-[7rem] transition-transform duration-200 group-hover/card:scale-105 motion-reduce:transition-none"
        >
          <PlayerMini player={player} logo={logo} />
        </div>
        {/* Always a line, so one-name players do not sit higher than the rest. */}
        <div className="mt-2 truncate text-[0.75rem] uppercase leading-none tracking-[0.08em] text-[#F3EFE6]/65">
          {smallName(player) || " "}
        </div>
        {/* Names of one squad stay close in size: only a very long one is set smaller. */}
        <Chrome size={fitName(name, "1.1rem", "0.75rem")} className="mt-1 truncate px-0.5">
          {name}
        </Chrome>
        {player.goals > 0 ? (
          <div className="mt-1.5 text-[13px] leading-none text-[#fb923c]">{player.goals} γκολ</div>
        ) : null}
      </ProfileLink>
    </li>
  );
}

type Standing = { rank: number; points: number; groupName: string | null };

/** «1η θέση, 12 βαθμοί» / «2η, Όμιλος Α, 6 βαθμοί» (a group's name is printed as it was given). */
const standingText = (s: Standing) =>
  `${s.rank}η${s.groupName ? `, ${s.groupName}` : " θέση"}, ${plural(s.points, "βαθμός", "βαθμοί")}`;

/** What a team's tile shows: its colour down the side, crest, name, where it stands, how many players. */
function Tile({
  squad,
  standing,
  colour,
  champion,
  form,
}: {
  squad: Squad;
  standing: Standing | null;
  /** The team's own colour, or null when it has none. */
  colour: string | null;
  champion: boolean;
  /** Its last results in the tournament, oldest first. */
  form: Outcome[];
}) {
  const { team, players } = squad;
  return (
    <>
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1"
        style={{ background: colour ?? "rgb(243 239 230 / 0.2)" }}
      />
      <Crest team={team} className="h-12 w-12 text-lg md:h-14 md:w-14" sizes="56px" />
      {/* A long name takes a second line instead of being cut. */}
      <span className="mt-3 block text-[1.15rem] font-bold italic leading-[1.1] [overflow-wrap:anywhere] md:text-xl">
        {team.name}
      </span>
      {/* Pinned to the foot of the tile, so the tiles of a row line up whatever the names' length. */}
      <span className={`${LABEL} mt-auto block pt-2.5 text-[#F3EFE6]/65`}>
        {form.length > 0 ? (
          <span className="mb-2 block">
            <FormMarks outcomes={form} className="h-[1.15rem] w-[1.15rem] text-[11px]" />
          </span>
        ) : null}
        {champion ? (
          <span className="block font-bold" style={{ color: SAFFRON }}>
            Πρωταθλητές
          </span>
        ) : null}
        {standing ? <span className="block">{standingText(standing)}</span> : null}
        <span className="block">{playersOf(players.length)}</span>
      </span>
    </>
  );
}

/** A team's squad: a strip naming it, then its players on the small cards. */
function SquadPanel({
  squad,
  tournamentId,
  results,
  tables,
  colour,
}: {
  squad: Squad;
  tournamentId: number;
  results: TeamResult[];
  tables: StageTables[];
  colour: string | null;
}) {
  const { team, players } = squad;
  return (
    <>
      <div className="flex items-center gap-3 border-b border-[#F3EFE6]/20 bg-[#151522] px-4 py-3 md:px-5">
        <Crest team={team} className="h-8 w-8 text-sm" sizes="32px" />
        <h3 className="min-w-0 flex-1 text-xl font-bold italic leading-[1.1] [overflow-wrap:anywhere]">{team.name}</h3>
        <span className={`${LABEL} shrink-0 text-[#F3EFE6]/65`}>{playersOf(players.length)}</span>
      </div>
      <Progress team={team} results={results} tables={tables} colour={colour ?? "#fb923c"} />
      <div className="px-4 py-6 md:px-5">
        {players.length === 0 ? (
          <p className="text-[15px] text-[#F3EFE6]/65">Το ρόστερ δεν έχει δηλωθεί ακόμα.</p>
        ) : (
          <ul className={`${styles.squad} grid grid-cols-[repeat(auto-fill,minmax(5.75rem,1fr))] gap-x-3 gap-y-6`}>
            {players.map((player, index) => (
              <Member
                key={player.id}
                player={player}
                href={profileHref(tournamentId, "teams", player.id)}
                logo={team.logo}
                index={index}
              />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

export default async function TeamsPage({ params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) notFound();
  const base = await loadBase(id);
  if (!base) notFound();
  const [squads, tables, colours] = await Promise.all([loadSquads(id), loadTables(id), loadColours(id)]);

  if (squads.length === 0) {
    return <p className="text-[17px] text-[#F3EFE6]/70">Οι ομάδες της διοργάνωσης δεν έχουν δηλωθεί ακόμα.</p>;
  }

  // While one table ranks everybody, the teams follow it; otherwise (groups, knockout only) they go by name.
  const latest = tables[tables.length - 1];
  const place =
    latest && latest.tables.length === 1
      ? new Map(latest.tables[0].rows.map((row, index) => [row.team.id, index] as const))
      : null;
  const ordered = place
    ? [...squads].sort((a, b) => (place.get(a.team.id) ?? 9999) - (place.get(b.team.id) ?? 9999))
    : squads;

  return (
    <section aria-labelledby="teams">
      <Rubric id="teams" title="Ομάδες" meta={plural(squads.length, "ομάδα", "ομάδες")} />
      <p className="mb-5 max-w-2xl text-[15px] text-[#F3EFE6]/70">
        Πατήστε μια ομάδα για να δείτε το ρόστερ της. Κάθε κάρτα ανοίγει το προφίλ του παίκτη.
      </p>
      <TeamGrid
        teams={ordered.map((squad) => {
          const results = teamResults(base.matches, squad.team.id);
          const colour = colours.get(squad.team.id) ?? null;
          return {
          id: squad.team.id,
          name: squad.team.name,
          tile: (
            <Tile
              squad={squad}
              standing={standingOf(tables, squad.team.id)}
              colour={colour}
              champion={base.winner?.id === squad.team.id}
              form={results.slice(-5).map((r) => r.outcome)}
            />
          ),
          squad: (
            <SquadPanel squad={squad} tournamentId={base.id} results={results} tables={tables} colour={colour} />
          ),
          page: (
            <Link href={`${TEAM_PATH}/${squad.team.id}`} className={BUTTON}>
              Σελίδα ομάδας
            </Link>
          ),
          };
        })}
      />
    </section>
  );
}
