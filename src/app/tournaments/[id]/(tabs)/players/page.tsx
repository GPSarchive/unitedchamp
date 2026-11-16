// The tournament's «Παίκτες» tab: who leads it, on the big card, and under
// them every player of the tournament by name — everyone in a squad of one of
// its teams, whether he has played or scored or not — each on the small card
// and opening his profile.
//
// The leaders are worked out from the tournament's numbers (most goals, most
// assists, most MVP and best-goalkeeper awards). The live page reads them from
// a table nothing fills (tournament_awards), so there they never show.
import { notFound } from "next/navigation";
import { STRIP_TOP, SURFACE, layers } from "@/app/lib/ui/flat";
import { PlayerHolo, PlayerMini } from "@/app/matches/[id]/cards";
import { mainName, smallName } from "@/app/matches/[id]/model";
import { searchKeys } from "@/app/preview/paiktes-v2/model";
import { loadBase, loadPlayers, loadSquads } from "@/app/preview/tournaments-v3/[id]/data";
import {
  tournamentLeaders,
  type Leader,
  type PlayerLine,
  type TTeam,
} from "@/app/preview/tournaments-v3/[id]/model";
import { profileHref } from "../extra";
import { LABEL } from "../tokens";
import { Chrome, ProfileLink, Rubric, fitName, parseId, plural } from "../ui";
import { PlayerSearch } from "./PlayerSearch";

export const revalidate = 60;

export function generateStaticParams() {
  return [];
}

/** The big cards side by side from tablet width up: two a row, then all of them (there are at most four). */
const COLUMNS: Record<number, string> = {
  1: "md:grid-cols-[15rem]",
  2: "md:grid-cols-[repeat(2,15rem)]",
  3: "md:grid-cols-[repeat(2,15rem)] lg:grid-cols-[repeat(3,15rem)]",
  4: "md:grid-cols-[repeat(2,15rem)] lg:grid-cols-[repeat(4,15rem)]",
};

/** A card needs a team to print; a player who has left every squad gets the bare card. */
const NO_TEAM: TTeam = { id: 0, name: "", logo: null };

function LeaderCard({ leader, href }: { leader: Leader; href: string }) {
  const { player } = leader;
  return (
    <figure className="w-[min(74vw,18rem)] shrink-0 snap-center md:w-60">
      <figcaption className="mb-4 flex min-h-[2.4rem] items-end justify-center text-center">
        <span className="text-base font-bold leading-tight text-[#fb923c]">{leader.label}</span>
      </figcaption>
      <ProfileLink player={player} href={href} className="block">
        <PlayerHolo player={player} team={player.teams[0] ?? NO_TEAM} season={player.numbers} />
      </ProfileLink>
      <p className="mt-4 text-center text-[15px] text-[#F3EFE6]/85">{leader.note}</p>
    </figure>
  );
}

/** Player, then matches / goals / assists. */
const GRID = "grid grid-cols-[minmax(0,1fr)_2rem_2.5rem_2rem] md:grid-cols-[minmax(0,1fr)_repeat(3,4.5rem)]";

const surname = (p: PlayerLine) => p.last || p.first;

/** By surname, then first name. */
const byName = (x: PlayerLine, y: PlayerLine) =>
  surname(x).localeCompare(surname(y), "el") || x.first.localeCompare(y.first, "el") || x.id - y.id;

function PlayerRow({ player, href }: { player: PlayerLine; href: string }) {
  const name = mainName(player);
  const first = smallName(player);
  const [matches, , goals, assists] = player.numbers;
  const num = (n: number) => (n ? "text-[#F3EFE6]/90" : "text-[#F3EFE6]/40");
  // The <li> around it is drawn by PlayerSearch.
  return (
    <ProfileLink
      player={player}
      href={href}
      className={`${GRID} group items-center px-3 transition-colors hover:bg-[#F3EFE6]/[0.05] md:px-5`}
    >
      {/* On a phone the names share a narrow column: a lower ceiling keeps them close in size. */}
      <div className="flex min-w-0 items-center gap-2.5 py-2 pr-1.5 [--name-max:1.45rem] md:gap-4 md:pr-2 md:[--name-max:2.1rem]">
        <div
          data-profile-card
          className="w-12 shrink-0 transition-transform duration-200 group-hover:scale-105 motion-reduce:transition-none md:w-14"
        >
          <PlayerMini player={player} logo={player.teams[0]?.logo ?? null} />
        </div>
        <div className="@container min-w-0 flex-1">
          {first ? (
            <div className="truncate text-[0.8rem] uppercase leading-none tracking-[0.08em] text-[#F3EFE6]/70">
              {first}
            </div>
          ) : null}
          <Chrome size={fitName(name, "var(--name-max)", "0.95rem")} className="mt-1 truncate pr-1">
            {name}
          </Chrome>
          {player.teams.length > 0 ? (
            // A long team name takes a second line instead of being cut.
            <div className="mt-1 text-[13px] leading-tight text-[#F3EFE6]/65 [overflow-wrap:anywhere]">
              {player.teams.map((t) => t.name).join(", ")}
            </div>
          ) : null}
        </div>
      </div>
      <div className={`text-center text-base tabular-nums ${num(matches)}`}>
        <span className="sr-only">Αγώνες: </span>
        {matches}
      </div>
      <div className={`text-center text-xl font-bold leading-none tabular-nums ${num(goals)}`}>
        <span className="sr-only">Γκολ: </span>
        {goals}
      </div>
      <div className={`text-center text-base tabular-nums ${num(assists)}`}>
        <span className="sr-only">Ασίστ: </span>
        {assists}
      </div>
    </ProfileLink>
  );
}

export default async function PlayersPage({ params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) notFound();
  const base = await loadBase(id);
  if (!base) notFound();
  const [players, squads] = await Promise.all([loadPlayers(id), loadSquads(id)]);
  // Πρωταγωνιστές hidden for now (the owner has a plan for them). Put the next line back to show them:
  // const leaders = tournamentLeaders(players);
  const leaders: Leader[] = [];
  const href = (playerId: number) => profileHref(base.id, "players", playerId);

  // Everyone: those with numbers in the tournament, and everybody else in a
  // squad of one of its teams (no numbers yet), each once, by name.
  const everyone = new Map<number, PlayerLine>(players.map((p) => [p.id, p]));
  for (const { team, players: members } of squads) {
    for (const m of members) {
      if (!everyone.has(m.id)) everyone.set(m.id, { ...m, teams: [team], numbers: [0, 0, 0, 0, 0, 0, 0, 0, 0] });
    }
  }
  const all = [...everyone.values()].sort(byName);

  if (all.length === 0) {
    return (
      <p className="max-w-xl text-[17px] text-[#F3EFE6]/70">Οι παίκτες της διοργάνωσης δεν έχουν δηλωθεί ακόμα.</p>
    );
  }

  return (
    // One column that may not grow past the screen: the leaders' row scrolls inside it.
    <div className="grid grid-cols-[minmax(0,1fr)] gap-14">
      {leaders.length > 0 ? (
        <section aria-labelledby="leaders" className="min-w-0">
          <Rubric id="leaders" title="Πρωταγωνιστές" />
          <p className="max-w-2xl text-[15px] text-[#F3EFE6]/70">
            Οι παίκτες που ξεχωρίζουν στη διοργάνωση. Η κάρτα δείχνει τα νούμερά τους σε αυτήν.
          </p>
          {/* On a phone the cards sit in a row that scrolls sideways, the next
              one peeking in; from md up they stand side by side. The padding
              leaves room for the cards' shadow and tilt. */}
          <div
            className={`-mx-4 mt-3 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 py-5 [scrollbar-width:none] md:mx-0 md:grid md:justify-center md:justify-items-center md:gap-x-6 md:gap-y-10 md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden ${
              leaders.length === 1 ? "justify-center" : ""
            } ${COLUMNS[Math.min(leaders.length, 4)]}`}
          >
            {leaders.map((leader) => (
              <LeaderCard key={leader.player.id} leader={leader} href={href(leader.player.id)} />
            ))}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="everyone" className="min-w-0">
        <Rubric id="everyone" title="Όλοι οι παίκτες" meta={plural(all.length, "παίκτης", "παίκτες")} />
        <PlayerSearch
          frameClassName={`overflow-hidden ${SURFACE}`}
          frameStyle={{ boxShadow: layers("#fb923c") }}
          header={
            <div
              aria-hidden
              className={`${GRID} ${LABEL} items-center ${STRIP_TOP} px-3 py-2.5 text-[#F3EFE6]/65 md:px-5`}
            >
              <span>Παίκτης</span>
              <span className="text-center">Αγ</span>
              <span className="text-center">Γκολ</span>
              <span className="text-center">Ασ</span>
            </div>
          }
          rows={all.map((p) => ({
            id: p.id,
            keys: searchKeys([p.first, p.last, ...p.teams.map((t) => t.name)].join(" ")),
            node: <PlayerRow player={p} href={href(p.id)} />,
          }))}
        />
      </section>
    </div>
  );
}
