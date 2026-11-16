// The tournament's «Ομάδες» tab: every team as a bordered row with its colour
// down the side (the old page's team cards, laid flat); a click opens the row
// to the team's squad, in the small player cards. Each card opens the player's
// profile on top of the page.
//
// The rows are native <details>: they open with no script, work with the
// keyboard, and the browser's find-in-page opens the right one. A closed row's
// cards are not drawn (and their photos not fetched) until it is opened. The
// opening itself — the row growing onto its hard shadow, the cards dealt in
// one after the other — is in dispatch.module.css.
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlayerMini } from "@/app/matches/[id]/cards";
import { mainName, smallName } from "@/app/matches/[id]/model";
import { loadBase, loadSquads, loadTables } from "../../../tournaments-v3/[id]/data";
import { standingOf, type Squad, type SquadMember } from "../../../tournaments-v3/[id]/model";
import styles from "../dispatch.module.css";
import { loadColours, profileHref } from "../extra";
import { TEAM_PATH } from "../paths";
import { BUTTON, FOCUS, LABEL } from "../tokens";
import { Chevron, Chrome, Crest, ProfileLink, Rubric, fitName, parseId, plural } from "../ui";

export const revalidate = 60;

export function generateStaticParams() {
  return [];
}

const SAFFRON = "#E8B931";

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
          className="mx-auto w-full max-w-[7rem] transition-transform duration-200 group-hover/card:scale-105"
        >
          <PlayerMini player={player} logo={logo} />
        </div>
        {/* Always a line, so one-name players do not sit higher than the rest. */}
        <div className="mt-2 truncate text-[0.75rem] uppercase leading-none tracking-[0.08em] text-[#F3EFE6]/65">
          {smallName(player) || " "}
        </div>
        <Chrome size={fitName(name, "1.4rem", "0.85rem")} className="mt-1 truncate px-1">
          {name}
        </Chrome>
        {player.goals > 0 ? (
          <div className={`${LABEL} mt-1.5 text-[10px] leading-none text-[#fb923c]`}>{player.goals} γκολ</div>
        ) : null}
      </ProfileLink>
    </li>
  );
}

type Standing = { rank: number; points: number; groupName: string | null };

function TeamRow({
  squad,
  tournamentId,
  standing,
  colour,
  champion,
}: {
  squad: Squad;
  tournamentId: number;
  standing: Standing | null;
  /** The team's own colour, or null when it has none. */
  colour: string | null;
  champion: boolean;
}) {
  const { team, players } = squad;
  const facts = [
    standing ? `${standing.rank}η${standing.groupName ? `, ${standing.groupName}` : " θέση"}` : null,
    plural(players.length, "παίκτης", "παίκτες"),
  ].filter(Boolean);
  return (
    <li>
      <details
        className={`group relative border-2 border-[#F3EFE6]/20 bg-[#0a0a14] ${styles.team}`}
        style={colour ? ({ "--team": colour } as React.CSSProperties) : undefined}
      >
        <summary
          className={`flex cursor-pointer list-none items-center gap-3 py-3 pl-5 pr-3 transition-colors hover:bg-[#13131d] md:gap-5 md:py-4 md:pl-7 md:pr-5 [&::-webkit-details-marker]:hidden ${FOCUS}`}
        >
          {/* The team's colour down the side. */}
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 w-1.5 md:w-2"
            style={{ background: colour ?? "rgb(243 239 230 / 0.2)" }}
          />
          <Crest team={team} className="h-11 w-11 text-lg md:h-14 md:w-14" sizes="56px" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-2xl font-bold italic leading-tight md:text-3xl">{team.name}</span>
            <span className={`${LABEL} mt-1 block truncate text-[10px] text-[#F3EFE6]/60 md:text-[11px]`}>
              {champion ? (
                <span className="font-bold" style={{ color: SAFFRON }}>
                  Πρωταθλήτρια,{" "}
                </span>
              ) : null}
              {facts.join(", ")}
            </span>
          </span>
          {standing ? (
            <span className="shrink-0 text-right">
              <span className="block text-2xl font-bold leading-none tabular-nums md:text-3xl">{standing.points}</span>
              <span className={`${LABEL} mt-1 block text-[10px] text-[#F3EFE6]/55`}>
                <abbr title="Βαθμοί" className="no-underline">
                  Βαθ
                </abbr>
              </span>
            </span>
          ) : null}
          <Chevron className="ml-1 text-[#F3EFE6]/65" />
        </summary>

        <div className="border-t-2 border-[#F3EFE6]/15 pb-6 pl-5 pr-3 pt-6 md:pl-7 md:pr-5">
          {players.length === 0 ? (
            <p className="text-[15px] text-[#F3EFE6]/65">Το ρόστερ δεν έχει δηλωθεί ακόμα.</p>
          ) : (
            <ul className={`${styles.squad} grid grid-cols-[repeat(auto-fill,minmax(5.25rem,1fr))] gap-x-3 gap-y-6`}>
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
          <p className="mt-7">
            <Link href={`${TEAM_PATH}/${team.id}`} className={BUTTON}>
              Σελίδα ομάδας
            </Link>
          </p>
        </div>
      </details>
    </li>
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
      {/* Room at the right and the bottom for an open row's shadow. */}
      <ul className="grid gap-3 pb-2 pr-2">
        {ordered.map((squad) => (
          <TeamRow
            key={squad.team.id}
            squad={squad}
            tournamentId={base.id}
            standing={standingOf(tables, squad.team.id)}
            colour={colours.get(squad.team.id) ?? null}
            champion={base.winner?.id === squad.team.id}
          />
        ))}
      </ul>
    </section>
  );
}
