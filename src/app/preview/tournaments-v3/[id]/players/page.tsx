// The tournament's «Παίκτες» tab: who leads it, on the big card, and the
// scorers' table as rows in the style of the players list.
//
// The leaders are worked out from the tournament's numbers (most goals, most
// assists, most MVP and best-goalkeeper awards). The live page reads them from
// a table nothing fills (tournament_awards), so there they never show.
import { notFound } from "next/navigation";
import { PlayerHolo, PlayerMini } from "@/app/matches/[id]/cards";
import { mainName, smallName } from "@/app/matches/[id]/model";
import { loadBase, loadPlayers } from "../data";
import { rankScorers, tournamentLeaders, type Leader, type PlayerLine, type TTeam } from "../model";
import { Chrome, FOCUS, ProfileLink, fitName, parseId, plural } from "../ui";

export const revalidate = 60;

export function generateStaticParams() {
  return [];
}

/** Scorers shown at once; the rest sit behind «Όλοι οι σκόρερ». */
const SHOWN = 20;

/** The big cards side by side from tablet width up: two a row, then all of them (there are at most four). */
const COLUMNS: Record<number, string> = {
  1: "md:grid-cols-[15rem]",
  2: "md:grid-cols-[repeat(2,15rem)]",
  3: "md:grid-cols-[repeat(2,15rem)] lg:grid-cols-[repeat(3,15rem)]",
  4: "md:grid-cols-[repeat(2,15rem)] lg:grid-cols-[repeat(4,15rem)]",
};

/** A card needs a team to print; a player who has left every squad gets the bare card. */
const NO_TEAM: TTeam = { id: 0, name: "", logo: null };

function LeaderCard({ leader }: { leader: Leader }) {
  const { player } = leader;
  return (
    <figure className="w-[min(74vw,18rem)] shrink-0 snap-center md:w-60">
      <figcaption className="mb-3 flex min-h-[2.6rem] items-end justify-center text-center">
        <span className="text-[15px] font-bold leading-tight text-[#fb923c]">{leader.label}</span>
      </figcaption>
      <ProfileLink player={player} className="block">
        <PlayerHolo player={player} team={player.teams[0] ?? NO_TEAM} season={player.numbers} />
      </ProfileLink>
      <p className="mt-4 text-center text-[15px] text-[#F3EFE6]/85">{leader.note}</p>
    </figure>
  );
}

/** Place, player, then matches / goals / assists. */
const GRID =
  "grid grid-cols-[1.75rem_minmax(0,1fr)_repeat(3,2.6rem)] md:grid-cols-[2.5rem_minmax(0,1fr)_repeat(3,4.5rem)]";

function Num({ value, label, lead = false }: { value: number; label: string; lead?: boolean }) {
  return (
    <div
      className={`flex items-center justify-center tabular-nums ${
        lead
          ? "bg-[#fb923c]/[0.09] text-xl font-bold text-[#fb923c]"
          : value
            ? "text-base text-[#F3EFE6]/90 md:text-lg"
            : "text-base text-[#F3EFE6]/35 md:text-lg"
      }`}
    >
      <span className="sr-only">{label}: </span>
      {value}
    </div>
  );
}

function ScorerRow({ player }: { player: PlayerLine & { rank: number } }) {
  const name = mainName(player);
  const first = smallName(player);
  const [matches, , goals, assists] = player.numbers;
  return (
    <li className="border-b border-[#F3EFE6]/[0.08]">
      <ProfileLink
        player={player}
        className={`${GRID} group ${player.href ? "transition-colors hover:bg-[#F3EFE6]/[0.05]" : ""}`}
      >
        <div className="flex items-center text-sm tabular-nums text-[#F3EFE6]/55">
          <span className="sr-only">Θέση </span>
          {player.rank}
        </div>
        <div className="flex min-w-0 items-center gap-3 py-2 pr-2 md:gap-4">
          <div
            data-profile-card
            className="w-[3.25rem] shrink-0 transition-transform duration-200 group-hover:scale-105 md:w-14"
          >
            <PlayerMini player={player} logo={player.teams[0]?.logo ?? null} />
          </div>
          <div className="@container min-w-0 flex-1">
            {first ? (
              <div className="truncate text-[0.8rem] uppercase leading-none tracking-[0.08em] text-[#F3EFE6]/70">
                {first}
              </div>
            ) : null}
            <Chrome size={fitName(name, "2.1rem", "1.15rem")} className="mt-1 truncate pr-2">
              {name}
            </Chrome>
            {player.teams.length > 0 ? (
              <div className="mt-1 truncate text-[13px] leading-tight text-[#F3EFE6]/60">
                {player.teams.map((t) => t.name).join(", ")}
              </div>
            ) : null}
          </div>
        </div>
        <Num value={matches} label="Αγώνες" />
        <Num value={goals} label="Γκολ" lead />
        <Num value={assists} label="Ασίστ" />
      </ProfileLink>
    </li>
  );
}

function ScorerList({ players }: { players: (PlayerLine & { rank: number })[] }) {
  return (
    <ul>
      {players.map((p) => (
        <ScorerRow key={p.id} player={p} />
      ))}
    </ul>
  );
}

export default async function PlayersPage({ params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) notFound();
  const base = await loadBase(id);
  if (!base) notFound();
  const players = await loadPlayers(id);
  // Πρωταγωνιστές hidden for now (the owner has a plan for them). Put the next line back to show them:
  // const leaders = tournamentLeaders(players);
  const leaders: Leader[] = [];
  const scorers = rankScorers(players);

  if (players.length === 0) {
    return (
      <p className="max-w-xl text-[17px] text-[#F3EFE6]/70">
        Τα νούμερα των παικτών εμφανίζονται εδώ μόλις καταχωρηθεί το πρώτο φύλλο αγώνα.
      </p>
    );
  }

  return (
    <div className="grid gap-12">
      {leaders.length > 0 ? (
        <section aria-labelledby="leaders">
          <h2 id="leaders" className="text-2xl font-bold italic md:text-3xl">
            Πρωταγωνιστές
          </h2>
          <p className="mt-1 max-w-2xl text-[15px] text-[#F3EFE6]/70">
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
              <LeaderCard key={leader.player.id} leader={leader} />
            ))}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="scorers">
        <h2 id="scorers" className="text-2xl font-bold italic md:text-3xl">
          Σκόρερ
        </h2>
        {scorers.length === 0 ? (
          <p className="mt-3 text-[15px] text-[#F3EFE6]/70">Δεν έχει σημειωθεί ακόμα γκολ.</p>
        ) : (
          <div className="mt-4">
            <div aria-hidden className={`${GRID} border-b border-[#F3EFE6]/20 pb-2 text-[13px] text-[#F3EFE6]/65`}>
              <span>#</span>
              <span>Παίκτης</span>
              <span className="text-center">Αγ.</span>
              <span className="text-center">Γκολ</span>
              <span className="text-center">Ασ.</span>
            </div>
            <ScorerList players={scorers.slice(0, SHOWN)} />
            {scorers.length > SHOWN ? (
              <details className="group">
                <summary
                  className={`mt-4 inline-flex h-11 cursor-pointer list-none items-center border border-[#F3EFE6]/25 px-5 text-[15px] hover:border-[#fb923c] hover:text-[#fb923c] group-open:hidden [&::-webkit-details-marker]:hidden ${FOCUS}`}
                >
                  Όλοι οι σκόρερ ({plural(scorers.length, "παίκτης", "παίκτες")})
                </summary>
                <ScorerList players={scorers.slice(SHOWN)} />
              </details>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
