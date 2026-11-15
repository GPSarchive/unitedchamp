// Preview route — the «Θρύλος» (Legend) edition of the player card, v1.
// Shows the big Legend card with and without a photo next to the normal card,
// a few more real photos in the same finish, and the mini cards at the size
// they have in a list row. Real players from the players directory; static +
// ISR like the directory itself.
import type { Metadata } from "next";
import { isPlaceholderPhoto } from "@/app/lib/image-config";
import HoloShieldCard from "@/app/preview/paiktes-v2/[id]/HoloShieldCard";
import type { DirectoryPlayer, DirectoryTeam } from "@/app/preview/paiktes-v2/model";
import MiniCard from "@/app/preview/paiktes-v3/MiniCard";
import { loadDirectoryV3 } from "@/app/preview/paiktes-v3/data";
import LegendMiniCard from "./LegendMiniCard";
import LegendShieldCard from "./LegendShieldCard";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Κάρτα «Θρύλος» · UltraChamp.gr",
  robots: { index: false, follow: false },
};

type Pick = { player: DirectoryPlayer; team: DirectoryTeam | null };

const GOALS = 2;

function Caption({ children }: { children: React.ReactNode }) {
  return <figcaption className="mt-4 text-center text-[13px] text-[#F3EFE6]/55">{children}</figcaption>;
}

export default async function LegendCardPreviewPage() {
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

  const initial = (p: DirectoryPlayer) => (p.last || p.first || "?").charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-[#0a0a14] text-[#F3EFE6]">
      <div className="mx-auto max-w-6xl px-4 pb-20 pt-10 md:px-6 md:pt-14">
        <h1 className="text-4xl font-bold italic leading-none tracking-tight md:text-5xl">Κάρτα «Θρύλος»</h1>

        <section className="mt-10 flex flex-wrap justify-center gap-x-10 gap-y-12 md:justify-start">
          {star && (
            <figure className="w-[300px] max-w-full">
              <LegendShieldCard
                first={star.player.first}
                last={star.player.last}
                photo={star.player.photo}
                team={star.team}
                stats={star.player.season}
              />
              <Caption>«Θρύλος» με φωτογραφία</Caption>
            </figure>
          )}
          {plain && (
            <figure className="w-[300px] max-w-full">
              <LegendShieldCard
                first={plain.player.first}
                last={plain.player.last}
                photo={plain.player.photo}
                team={plain.team}
                stats={plain.player.season}
              />
              <Caption>«Θρύλος» χωρίς φωτογραφία</Caption>
            </figure>
          )}
          {star && (
            <figure className="w-[300px] max-w-full">
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
            <div className="mt-8 flex flex-wrap justify-center gap-x-10 gap-y-12 md:justify-start">
              {morePhotos.map(({ player, team }) => (
                <div key={player.id} className="w-[300px] max-w-full">
                  <LegendShieldCard
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
          <div className="mt-8 flex flex-wrap items-start gap-x-8 gap-y-8">
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
      </div>
    </div>
  );
}
