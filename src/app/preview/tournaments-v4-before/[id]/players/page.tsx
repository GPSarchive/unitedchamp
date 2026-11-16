// The tournament's «Παίκτες» tab: who leads it, on the big card, and the
// scorers' table — the old page's numbered rows with a bar for the goals, each
// player now on the small card and opening his profile.
//
// The leaders are worked out from the tournament's numbers (most goals, most
// assists, most MVP and best-goalkeeper awards). The live page reads them from
// a table nothing fills (tournament_awards), so there they never show.
import { notFound } from "next/navigation";
import { PlayerHolo, PlayerMini } from "@/app/matches/[id]/cards";
import { mainName, smallName } from "@/app/matches/[id]/model";
import { loadBase, loadPlayers } from "../../../tournaments-v3/[id]/data";
import {
  rankScorers,
  tournamentLeaders,
  type Leader,
  type PlayerLine,
  type TTeam,
} from "../../../tournaments-v3/[id]/model";
import { profileHref } from "../extra";
import { FOCUS, LABEL, MONO } from "../tokens";
import { Chrome, ProfileLink, Rubric, fitName, pad2, parseId, plural } from "../ui";

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

function LeaderCard({ leader, href }: { leader: Leader; href: string }) {
  const { player } = leader;
  return (
    <figure className="w-[min(74vw,18rem)] shrink-0 snap-center md:w-60">
      <figcaption className="mb-4 flex min-h-[2.4rem] items-end justify-center text-center">
        <span className={`${LABEL} font-bold leading-snug text-[#fb923c]`}>{leader.label}</span>
      </figcaption>
      <ProfileLink player={player} href={href} className="block">
        <PlayerHolo player={player} team={player.teams[0] ?? NO_TEAM} season={player.numbers} />
      </ProfileLink>
      <p className="mt-4 text-center text-[15px] text-[#F3EFE6]/85">{leader.note}</p>
    </figure>
  );
}

/** Place, player, the bar (from tablet width up), then matches / goals / assists. */
const GRID =
  "grid grid-cols-[2.5rem_minmax(0,1fr)_repeat(3,2.5rem)] md:grid-cols-[4rem_minmax(0,1.15fr)_minmax(0,1fr)_repeat(3,4rem)]";

/** The leader's bar in orange, the next two places' in ivory, the rest hatched. */
const barFill = (rank: number) =>
  rank === 1
    ? "#fb923c"
    : rank <= 3
      ? "#F3EFE6"
      : "repeating-linear-gradient(45deg, rgb(243 239 230 / 0.6), rgb(243 239 230 / 0.6) 4px, transparent 4px, transparent 8px)";

function ScorerRow({ player, href, most }: { player: PlayerLine & { rank: number }; href: string; most: number }) {
  const name = mainName(player);
  const first = smallName(player);
  const [matches, , goals, assists] = player.numbers;
  return (
    <li className="border-b-2 border-[#F3EFE6]/15 last:border-b-0">
      <ProfileLink
        player={player}
        href={href}
        className={`${GRID} group items-center px-3 transition-colors hover:bg-[#13131d] md:px-5`}
      >
        <div className={`text-xl leading-none tabular-nums md:text-2xl ${player.rank === 1 ? "text-[#fb923c]" : ""}`}>
          <span className="sr-only">Θέση </span>
          {pad2(player.rank)}
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
              <div className={`${MONO} mt-1 truncate text-[10px] uppercase leading-tight tracking-[0.16em] text-[#F3EFE6]/55`}>
                {player.teams.map((t) => t.name).join(", ")}
              </div>
            ) : null}
          </div>
        </div>
        <div aria-hidden className="hidden pr-6 md:block">
          <div className="h-3 border border-[#F3EFE6]/20 bg-[#0a0a14]">
            <div className="h-full" style={{ width: `${(goals / most) * 100}%`, background: barFill(player.rank) }} />
          </div>
        </div>
        <div className={`${MONO} text-center text-sm tabular-nums text-[#F3EFE6]/80`}>
          <span className="sr-only">Αγώνες: </span>
          {matches}
        </div>
        <div className="text-center text-2xl font-bold leading-none tabular-nums">
          <span className="sr-only">Γκολ: </span>
          {goals}
        </div>
        <div className={`${MONO} text-center text-sm tabular-nums ${assists ? "text-[#F3EFE6]/80" : "text-[#F3EFE6]/35"}`}>
          <span className="sr-only">Ασίστ: </span>
          {assists}
        </div>
      </ProfileLink>
    </li>
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
  const most = scorers[0]?.numbers[2] ?? 1;
  const href = (playerId: number) => profileHref(base.id, "players", playerId);

  if (players.length === 0) {
    return (
      <p className="max-w-xl text-[17px] text-[#F3EFE6]/70">
        Τα νούμερα των παικτών εμφανίζονται εδώ μόλις καταχωρηθεί το πρώτο φύλλο αγώνα.
      </p>
    );
  }

  const rows = (list: typeof scorers) => (
    <ul>
      {list.map((p) => (
        <ScorerRow key={p.id} player={p} href={href(p.id)} most={most} />
      ))}
    </ul>
  );

  return (
    <div className="grid gap-14">
      {leaders.length > 0 ? (
        <section aria-labelledby="leaders">
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

      <section aria-labelledby="scorers">
        <Rubric
          id="scorers"
          title="Σκόρερ"
          meta={scorers.length > 0 ? plural(scorers.length, "παίκτης", "παίκτες") : null}
        />
        {scorers.length === 0 ? (
          <p className="text-[15px] text-[#F3EFE6]/70">Δεν έχει σημειωθεί ακόμα γκολ.</p>
        ) : (
          <div className="border-2 border-[#F3EFE6]/20 bg-[#0a0a14]">
            <div
              aria-hidden
              className={`${GRID} ${LABEL} items-center border-b-2 border-[#F3EFE6]/20 bg-[#13131d] px-3 py-2.5 text-[10px] text-[#F3EFE6]/65 md:px-5`}
            >
              <span>#</span>
              <span>Παίκτης</span>
              <span className="hidden md:block" />
              <span className="text-center">Αγ</span>
              <span className="text-center">Γκολ</span>
              <span className="text-center">Ασ</span>
            </div>
            {rows(scorers.slice(0, SHOWN))}
            {scorers.length > SHOWN ? (
              <details className="group">
                <summary
                  className={`${LABEL} flex h-12 cursor-pointer list-none items-center justify-center border-t-2 border-[#F3EFE6]/20 bg-[#13131d] hover:text-[#fb923c] group-open:hidden [&::-webkit-details-marker]:hidden ${FOCUS}`}
                >
                  Όλοι οι σκόρερ ({plural(scorers.length, "παίκτης", "παίκτες")})
                </summary>
                <div className="border-t-2 border-[#F3EFE6]/15">{rows(scorers.slice(SHOWN))}</div>
              </details>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
