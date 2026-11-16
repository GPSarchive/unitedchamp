// Preview route — the default card's black («Όνυχας») cut into facets, v1.
// Shows the card as it is today next to the faceted one: without a photo (the
// main case — most players have none) and with a photo, a few more team logos
// on the facets, and the mini cards at the size they have in a list row, also
// in rows like the players directory. Real players from the players
// directory; static + ISR like the directory itself.
//
// Since 2026-11-15 the faceted surface IS the default card (HoloShieldCard and
// MiniCard); the «Πριν» column passes them the old flat onyx as `surface`.
import type { Metadata } from "next";
import { isPlaceholderPhoto } from "@/app/lib/image-config";
import HoloShieldCard from "@/app/preview/paiktes-v2/[id]/HoloShieldCard";
import { ONYX } from "@/app/preview/paiktes-v2/[id]/onyxFinish";
import type { DirectoryPlayer, DirectoryTeam } from "@/app/preview/paiktes-v2/model";
import DefaultMiniCard from "@/app/paiktes/MiniCard";
import { loadDirectoryV3 } from "@/app/paiktes/data";
import { NAME_LETTERING } from "@/app/paiktes/nameStyles";

/** The mini card as it was: flat onyx. */
function MiniCard(props: Omit<React.ComponentProps<typeof DefaultMiniCard>, "surface">) {
  return <DefaultMiniCard {...props} surface={ONYX} />;
}
/** The default cards, faceted. */
const OnyxMiniCard = DefaultMiniCard;
const OnyxShieldCard = HoloShieldCard;

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Κάρτα «Όνυχας» με έδρες · UltraChamp.gr",
  robots: { index: false, follow: false },
};

type Pick = { player: DirectoryPlayer; team: DirectoryTeam | null };

const GOALS = 2;
const NOW = "Πριν";
const FACETED = "Με έδρες";

function Caption({ children }: { children: React.ReactNode }) {
  return <figcaption className="mt-4 text-center text-[13px] text-[#F3EFE6]/55">{children}</figcaption>;
}

/** One of each team, in the order given. */
function oneFromEachTeam(picks: Pick[]): Pick[] {
  const seen = new Set<number>();
  return picks.filter(({ team }) => {
    if (!team || seen.has(team.id)) return false;
    seen.add(team.id);
    return true;
  });
}

const initial = (p: DirectoryPlayer) => (p.last || p.first || "?").charAt(0).toUpperCase();
const miniProps = ({ player, team }: Pick) => ({
  photo: player.photo,
  logo: team?.logo ?? null,
  initial: initial(player),
});

/** A few rows as the players directory has them: mini card, name, team. */
function DirectoryRows({ picks, faceted }: { picks: Pick[]; faceted: boolean }) {
  const Mini = faceted ? OnyxMiniCard : MiniCard;
  return (
    <ul className="border-t border-[#F3EFE6]/[0.08]">
      {picks.map((pick) => (
        <li
          key={pick.player.id}
          className="flex min-w-0 items-center gap-3 border-b border-[#F3EFE6]/[0.08] py-2 pl-2 pr-2 md:gap-4"
        >
          <div className="w-[3.25rem] shrink-0 md:w-14">
            <Mini {...miniProps(pick)} />
          </div>
          <div className="min-w-0">
            {pick.player.first && pick.player.last ? (
              <div className="truncate text-[0.8rem] uppercase leading-none tracking-[0.08em] text-[#F3EFE6]/70">
                {pick.player.first}
              </div>
            ) : null}
            <div
              className={`mt-1 truncate pr-2 uppercase leading-[1.08] ${NAME_LETTERING.row}`}
              style={NAME_LETTERING.style}
            >
              {pick.player.last || pick.player.first || "—"}
            </div>
            <div className="mt-1 truncate text-[13px] leading-tight text-[#F3EFE6]/60">
              {pick.team ? pick.team.name : "Χωρίς ομάδα"}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default async function OnyxFacetedCardPreviewPage() {
  const data = await loadDirectoryV3();
  const teamsById = new Map(data.teams.map((t) => [t.id, t] as const));
  const hasLogo = (team: DirectoryTeam | null) => team != null && !isPlaceholderPhoto(team.logo);

  // Players with numbers and a team that has a logo, top scorers first.
  const picks: Pick[] = data.players
    .filter((p) => p.season != null)
    .map((player) => ({ player, team: teamsById.get(player.teamIds[0]) ?? null }))
    .filter((pick) => hasLogo(pick.team))
    .sort((a, b) => (b.player.season?.[GOALS] ?? 0) - (a.player.season?.[GOALS] ?? 0) || a.player.id - b.player.id);

  const withPhoto = picks.filter((pick) => !isPlaceholderPhoto(pick.player.photo));
  // Without a photo: the best scorer of each team, so the logos differ.
  const withoutPhoto = oneFromEachTeam(picks.filter((pick) => isPlaceholderPhoto(pick.player.photo)));
  const star = withPhoto[0];
  const plain = withoutPhoto[0];
  const moreLogos = withoutPhoto.slice(1, 4);
  // A list as the directory has it: mostly without a photo, a few with.
  const row: Pick[] = [
    ...withoutPhoto.slice(1, 4),
    ...withPhoto.slice(1, 2),
    ...withoutPhoto.slice(4, 8),
    ...withPhoto.slice(2, 3),
    ...withoutPhoto.slice(8, 11),
  ];
  const listed = row.slice(0, 6);
  /** A player with no photo and no team logo: the card shows the initial. */
  const bare = plain ? { photo: null, logo: null, initial: initial(plain.player) } : null;

  return (
    <div className="min-h-screen bg-[#0a0a14] text-[#F3EFE6]">
      <div className="mx-auto max-w-6xl px-4 pb-20 pt-10 md:px-6 md:pt-14">
        <h1 className="text-4xl font-bold italic leading-none tracking-tight md:text-5xl">
          Κάρτα «Όνυχας» με έδρες
        </h1>

        {plain && (
          <section className="mt-10">
            <h2 className="text-xl font-bold">Χωρίς φωτογραφία</h2>
            <div className="mt-8 flex flex-wrap justify-center gap-x-10 gap-y-12 md:justify-start">
              <figure data-shot="nophoto-now" className="w-[300px] max-w-full">
                <HoloShieldCard
                  first={plain.player.first}
                  last={plain.player.last}
                  photo={plain.player.photo}
                  team={plain.team}
                  stats={plain.player.season}
                  surface={ONYX}
                />
                <Caption>{NOW}</Caption>
              </figure>
              <figure data-shot="nophoto" className="w-[300px] max-w-full">
                <OnyxShieldCard
                  first={plain.player.first}
                  last={plain.player.last}
                  photo={plain.player.photo}
                  team={plain.team}
                  stats={plain.player.season}
                />
                <Caption>{FACETED}</Caption>
              </figure>
            </div>
          </section>
        )}

        {moreLogos.length > 0 && (
          <section className="mt-16">
            <h2 className="text-xl font-bold">Άλλα σήματα</h2>
            <div data-shot="more" className="mt-8 flex flex-wrap justify-center gap-x-10 gap-y-12 md:justify-start">
              {moreLogos.map(({ player, team }) => (
                <div key={player.id} data-shot="more-card" className="w-[300px] max-w-full">
                  <OnyxShieldCard
                    first={player.first}
                    last={player.last}
                    photo={player.photo}
                    team={team}
                    stats={player.season}
                    intro={false}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {star && (
          <section className="mt-16">
            <h2 className="text-xl font-bold">Με φωτογραφία</h2>
            <div className="mt-8 flex flex-wrap justify-center gap-x-10 gap-y-12 md:justify-start">
              <figure data-shot="photo-now" className="w-[300px] max-w-full">
                <HoloShieldCard
                  first={star.player.first}
                  last={star.player.last}
                  photo={star.player.photo}
                  team={star.team}
                  stats={star.player.season}
                  surface={ONYX}
                  intro={false}
                />
                <Caption>{NOW}</Caption>
              </figure>
              <figure data-shot="photo" className="w-[300px] max-w-full">
                <OnyxShieldCard
                  first={star.player.first}
                  last={star.player.last}
                  photo={star.player.photo}
                  team={star.team}
                  stats={star.player.season}
                  intro={false}
                />
                <Caption>{FACETED}</Caption>
              </figure>
            </div>
          </section>
        )}

        <section className="mt-16">
          <h2 className="text-xl font-bold">Μικρή κάρτα (λίστες)</h2>
          <div data-shot="minis" className="mt-8 flex flex-wrap items-start gap-x-12 gap-y-8">
            {plain && (
              <div className="flex gap-4">
                <figure>
                  <div className="mx-auto w-14">
                    <MiniCard {...miniProps(plain)} />
                  </div>
                  <Caption>{NOW}</Caption>
                </figure>
                <figure data-shot="mini-nophoto">
                  <div className="mx-auto w-14">
                    <OnyxMiniCard {...miniProps(plain)} />
                  </div>
                  <Caption>{FACETED}</Caption>
                </figure>
              </div>
            )}
            {bare && (
              <div className="flex gap-4">
                <figure>
                  <div className="mx-auto w-14">
                    <MiniCard {...bare} />
                  </div>
                  <Caption>{NOW}</Caption>
                </figure>
                <figure data-shot="mini-bare">
                  <div className="mx-auto w-14">
                    <OnyxMiniCard {...bare} />
                  </div>
                  <Caption>{FACETED}</Caption>
                </figure>
              </div>
            )}
            {star && (
              <div className="flex gap-4">
                <figure>
                  <div className="mx-auto w-14">
                    <MiniCard {...miniProps(star)} />
                  </div>
                  <Caption>{NOW}</Caption>
                </figure>
                <figure data-shot="mini-photo">
                  <div className="mx-auto w-14">
                    <OnyxMiniCard {...miniProps(star)} />
                  </div>
                  <Caption>{FACETED}</Caption>
                </figure>
              </div>
            )}
          </div>

          {row.length > 0 && (
            <div data-shot="rows" className="mt-12 space-y-8">
              <figure>
                <div data-shot="row-now" className="flex flex-wrap items-start gap-3">
                  {row.map((pick) => (
                    <div key={pick.player.id} className="w-[3.25rem] md:w-14">
                      <MiniCard {...miniProps(pick)} />
                    </div>
                  ))}
                </div>
                <figcaption className="mt-3 text-[13px] text-[#F3EFE6]/55">{NOW}</figcaption>
              </figure>
              <figure>
                <div data-shot="row" className="flex flex-wrap items-start gap-3">
                  {row.map((pick) => (
                    <div key={pick.player.id} className="w-[3.25rem] md:w-14">
                      <OnyxMiniCard {...miniProps(pick)} />
                    </div>
                  ))}
                </div>
                <figcaption className="mt-3 text-[13px] text-[#F3EFE6]/55">{FACETED}</figcaption>
              </figure>
            </div>
          )}
        </section>

        {listed.length > 0 && (
          <section className="mt-16">
            <h2 className="text-xl font-bold">Στη λίστα των παικτών</h2>
            <div data-shot="list" className="mt-8 grid gap-x-10 gap-y-10 md:grid-cols-2">
              <figure className="min-w-0">
                <DirectoryRows picks={listed} faceted={false} />
                <figcaption className="mt-3 text-[13px] text-[#F3EFE6]/55">{NOW}</figcaption>
              </figure>
              <figure className="min-w-0">
                <DirectoryRows picks={listed} faceted />
                <figcaption className="mt-3 text-[13px] text-[#F3EFE6]/55">{FACETED}</figcaption>
              </figure>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
