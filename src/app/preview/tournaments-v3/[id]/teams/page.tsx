// The tournament's «Ομάδες» tab: every team as a row; a click opens the row
// to the team's squad, in the small player cards. Each card opens the player's
// profile on top of the page.
//
// The rows are native <details>: they open with no script, work with the
// keyboard, and the browser's find-in-page opens the right one. A closed row's
// cards are not drawn (and their photos not fetched) until it is opened. The
// opening itself — the row growing, the cards dealt in one after the other —
// is in tournament.module.css.
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlayerMini } from "@/app/matches/[id]/cards";
import { mainName, smallName } from "@/app/matches/[id]/model";
import { loadBase, loadSquads, loadTables } from "../data";
import { standingOf, type Squad, type SquadMember, type StageTables } from "../model";
import { TEAM_PATH } from "../paths";
import styles from "../tournament.module.css";
import { Chrome, Crest, FOCUS, ProfileLink, fitName, parseId, plural } from "../ui";

export const revalidate = 60;

export function generateStaticParams() {
  return [];
}

function Member({ player, logo, index }: { player: SquadMember; logo: string | null; index: number }) {
  const name = mainName(player);
  return (
    <li className="@container min-w-0" style={{ "--i": index } as React.CSSProperties}>
      <ProfileLink player={player} className="group/card block text-center">
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
          <div className="mt-1 text-[13px] leading-none text-[#fb923c]">{player.goals} γκολ</div>
        ) : null}
      </ProfileLink>
    </li>
  );
}

/** «3η στη βαθμολογία, 12 βαθμοί» / «2η, Όμιλος Α, 6 βαθμοί» (a group's name is printed as it was given). */
function standingText(tables: StageTables[], teamId: number): string | null {
  const s = standingOf(tables, teamId);
  if (!s) return null;
  const where = s.groupName ? `, ${s.groupName}` : " στη βαθμολογία";
  return `${s.rank}η${where}, ${plural(s.points, "βαθμός", "βαθμοί")}`;
}

function TeamRow({ squad, standing, champion }: { squad: Squad; standing: string | null; champion: boolean }) {
  const { team, players } = squad;
  return (
    <li className="border-b border-[#F3EFE6]/15">
      <details className={`group ${styles.team}`}>
        <summary
          className={`flex cursor-pointer list-none items-center gap-3 py-3 transition-colors hover:bg-[#F3EFE6]/[0.05] md:gap-5 md:py-4 [&::-webkit-details-marker]:hidden ${FOCUS}`}
        >
          <Crest team={team} className="h-11 w-11 text-lg md:h-14 md:w-14" sizes="56px" />
          <span className="@container min-w-0 flex-1">
            <Chrome gold={champion} size={fitName(team.name, "2.4rem", "1.3rem")} className="truncate pr-2">
              {team.name}
            </Chrome>
            <span className="mt-0.5 block truncate text-[13px] text-[#F3EFE6]/65">
              {champion ? <span className="font-bold text-[#FFE08A]">Πρωταθλήτρια. </span> : null}
              {standing ?? plural(players.length, "παίκτης", "παίκτες")}
            </span>
          </span>
          {standing ? (
            <span className="hidden shrink-0 text-[13px] tabular-nums text-[#F3EFE6]/65 sm:block">
              {plural(players.length, "παίκτης", "παίκτες")}
            </span>
          ) : null}
          <svg
            aria-hidden
            viewBox="0 0 12 12"
            className="mr-1 h-3.5 w-3.5 shrink-0 text-[#F3EFE6]/65 transition-transform duration-200 group-open:rotate-180"
          >
            <path d="M1.5 4 6 8.5 10.5 4" fill="none" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </summary>

        <div className="pb-7 pt-3">
          {players.length === 0 ? (
            <p className="text-[15px] text-[#F3EFE6]/65">Το ρόστερ δεν έχει δηλωθεί ακόμα.</p>
          ) : (
            <ul className={`${styles.squad} grid grid-cols-[repeat(auto-fill,minmax(5.25rem,1fr))] gap-x-3 gap-y-6`}>
              {players.map((player, index) => (
                <Member key={player.id} player={player} logo={team.logo} index={index} />
              ))}
            </ul>
          )}
          <p className="mt-6">
            <Link
              href={`${TEAM_PATH}/${team.id}`}
              className={`inline-flex h-11 items-center border border-[#F3EFE6]/25 px-5 text-[15px] hover:border-[#fb923c] hover:text-[#fb923c] ${FOCUS}`}
            >
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
  const [squads, tables] = await Promise.all([loadSquads(id), loadTables(id)]);

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
      <h2 id="teams" className="sr-only">
        Ομάδες
      </h2>
      <p className="mb-4 max-w-2xl text-[15px] text-[#F3EFE6]/70">
        Πατήστε μια ομάδα για να δείτε το ρόστερ της. Κάθε κάρτα ανοίγει το προφίλ του παίκτη.
      </p>
      <ul className="border-t border-[#F3EFE6]/15">
        {ordered.map((squad) => (
          <TeamRow
            key={squad.team.id}
            squad={squad}
            standing={standingText(tables, squad.team.id)}
            champion={base.winner?.id === squad.team.id}
          />
        ))}
      </ul>
    </section>
  );
}
