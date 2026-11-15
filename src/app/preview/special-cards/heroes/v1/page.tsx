// Preview route — the «Ήρωας» (Hero) edition of the player card, v1.
// Shows the big Hero card with and without a photo next to the «Θρύλος» card
// and the normal card, a few more real photos in the same finish, and the
// mini cards at the size they have in a list row — also one Hero among normal
// ones, as in a list. Real players from the players directory; static + ISR
// like the directory itself.
import type { Metadata } from "next";
import { isPlaceholderPhoto } from "@/app/lib/image-config";
import HoloShieldCard from "@/app/preview/paiktes-v2/[id]/HoloShieldCard";
import type { DirectoryPlayer, DirectoryTeam } from "@/app/preview/paiktes-v2/model";
import MiniCard from "@/app/preview/paiktes-v3/MiniCard";
import { loadDirectoryV3 } from "@/app/preview/paiktes-v3/data";
import LegendMiniCard from "@/app/preview/special-cards/legend/v1/LegendMiniCard";
import LegendShieldCard from "@/app/preview/special-cards/legend/v1/LegendShieldCard";
import HeroMiniCard from "./HeroMiniCard";
import HeroShieldCard from "./HeroShieldCard";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Κάρτα «Ήρωας» · UltraChamp.gr",
  robots: { index: false, follow: false },
};

type Pick = { player: DirectoryPlayer; team: DirectoryTeam | null };

const GOALS = 2;
/** Where the one Hero stands in the row of normal mini cards. */
const HERO_IN_ROW = 3;

function Caption({ children }: { children: React.ReactNode }) {
  return <figcaption className="mt-4 text-center text-[13px] text-[#F3EFE6]/55">{children}</figcaption>;
}

export default async function HeroCardPreviewPage() {
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
  const withoutPhoto = picks.filter((pick) => isPlaceholderPhoto(pick.player.photo));
  const star = withPhoto[0];
  const plain = withoutPhoto[0];
  const morePhotos = withPhoto.slice(1, 4);
  // A list as it comes: the top scorers, with and without a photo.
  const row = picks.slice(0, 8);

  const initial = (p: DirectoryPlayer) => (p.last || p.first || "?").charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-[#0a0a14] text-[#F3EFE6]">
      <div className="mx-auto max-w-6xl px-4 pb-20 pt-10 md:px-6 md:pt-14">
        <h1 className="text-4xl font-bold italic leading-none tracking-tight md:text-5xl">Κάρτα «Ήρωας»</h1>

        <section className="mt-10 flex flex-wrap justify-center gap-x-10 gap-y-12 md:justify-start">
          {star && (
            <figure data-shot="photo" className="w-[300px] max-w-full">
              <HeroShieldCard
                first={star.player.first}
                last={star.player.last}
                photo={star.player.photo}
                team={star.team}
                stats={star.player.season}
              />
              <Caption>«Ήρωας» με φωτογραφία</Caption>
            </figure>
          )}
          {plain && (
            <figure data-shot="no-photo" className="w-[300px] max-w-full">
              <HeroShieldCard
                first={plain.player.first}
                last={plain.player.last}
                photo={plain.player.photo}
                team={plain.team}
                stats={plain.player.season}
              />
              <Caption>«Ήρωας» χωρίς φωτογραφία</Caption>
            </figure>
          )}
          {star && (
            <figure data-shot="legend" className="w-[300px] max-w-full">
              <LegendShieldCard
                first={star.player.first}
                last={star.player.last}
                photo={star.player.photo}
                team={star.team}
                stats={star.player.season}
              />
              <Caption>«Θρύλος»</Caption>
            </figure>
          )}
          {star && (
            <figure data-shot="normal" className="w-[300px] max-w-full">
              <HoloShieldCard
                first={star.player.first}
                last={star.player.last}
                photo={star.player.photo}
                team={star.team}
                stats={star.player.season}
              />
              <Caption>Κανονική κάρτα</Caption>
            </figure>
          )}
        </section>

        {morePhotos.length > 0 && (
          <section className="mt-16">
            <h2 className="text-xl font-bold">Άλλες φωτογραφίες</h2>
            <div data-shot="more" className="mt-8 flex flex-wrap justify-center gap-x-10 gap-y-12 md:justify-start">
              {morePhotos.map(({ player, team }, i) => (
                <div key={player.id} data-shot={`more-${i}`} className="w-[300px] max-w-full">
                  <HeroShieldCard
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

        <section className="mt-16">
          <h2 className="text-xl font-bold">Μικρή κάρτα (λίστες)</h2>
          <div data-shot="minis" className="mt-8 flex flex-wrap items-start gap-x-8 gap-y-8">
            {star && (
              <figure data-shot="mini-photo">
                <div className="mx-auto w-14">
                  <HeroMiniCard photo={star.player.photo} logo={star.team?.logo ?? null} initial={initial(star.player)} />
                </div>
                <Caption>«Ήρωας»</Caption>
              </figure>
            )}
            {plain && (
              <figure data-shot="mini-no-photo">
                <div className="mx-auto w-14">
                  <HeroMiniCard
                    photo={plain.player.photo}
                    logo={plain.team?.logo ?? null}
                    initial={initial(plain.player)}
                  />
                </div>
                <Caption>«Ήρωας», χωρίς φωτογραφία</Caption>
              </figure>
            )}
            {plain && (
              <figure data-shot="mini-initial">
                <div className="mx-auto w-14">
                  <HeroMiniCard photo={null} logo={null} initial={initial(plain.player)} />
                </div>
                <Caption>«Ήρωας», χωρίς σήμα</Caption>
              </figure>
            )}
            {star && (
              <figure>
                <div className="mx-auto w-14">
                  <LegendMiniCard photo={star.player.photo} logo={star.team?.logo ?? null} initial={initial(star.player)} />
                </div>
                <Caption>«Θρύλος»</Caption>
              </figure>
            )}
            {plain && (
              <figure>
                <div className="mx-auto w-14">
                  <LegendMiniCard
                    photo={plain.player.photo}
                    logo={plain.team?.logo ?? null}
                    initial={initial(plain.player)}
                  />
                </div>
                <Caption>«Θρύλος», χωρίς φωτογραφία</Caption>
              </figure>
            )}
            {star && (
              <figure>
                <div className="mx-auto w-14">
                  <MiniCard photo={star.player.photo} logo={star.team?.logo ?? null} initial={initial(star.player)} />
                </div>
                <Caption>Κανονική</Caption>
              </figure>
            )}
            {plain && (
              <figure>
                <div className="mx-auto w-14">
                  <MiniCard
                    photo={plain.player.photo}
                    logo={plain.team?.logo ?? null}
                    initial={initial(plain.player)}
                  />
                </div>
                <Caption>Κανονική, χωρίς φωτογραφία</Caption>
              </figure>
            )}
          </div>
        </section>

        {row.length > HERO_IN_ROW && (
          <section className="mt-16">
            <h2 className="text-xl font-bold">Μία «Ήρωας» ανάμεσα σε κανονικές</h2>
            <div data-shot="mini-row" className="mt-8 flex flex-wrap items-start gap-3">
              {row.map(({ player, team }, i) => {
                const Card = i === HERO_IN_ROW ? HeroMiniCard : MiniCard;
                return (
                  <div key={player.id} className="w-14">
                    <Card photo={player.photo} logo={team?.logo ?? null} initial={initial(player)} />
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
