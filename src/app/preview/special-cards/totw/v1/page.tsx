// Preview route — the «Ομάδα της Εβδομάδας» (Team of the Week) edition of the
// player card, v1. Shows the big card with and without a photo next to the
// «Θρύλος» card and the normal card, a few more real photos in the same
// finish, and the mini cards at the size they have in a list row — also one
// of them standing among normal ones, as in a list. Real players from the
// players directory; static + ISR like the directory itself.
import type { Metadata } from "next";
import { isPlaceholderPhoto } from "@/app/lib/image-config";
import HoloShieldCard from "@/app/preview/paiktes-v2/[id]/HoloShieldCard";
import type { DirectoryPlayer, DirectoryTeam } from "@/app/preview/paiktes-v2/model";
import MiniCard from "@/app/paiktes/MiniCard";
import { loadDirectoryV3 } from "@/app/paiktes/data";
import LegendMiniCard from "../../legend/v1/LegendMiniCard";
import LegendShieldCard from "../../legend/v1/LegendShieldCard";
import TotwMiniCard from "./TotwMiniCard";
import TotwShieldCard from "./TotwShieldCard";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Κάρτα «Ομάδα της Εβδομάδας» · UltraChamp.gr",
  robots: { index: false, follow: false },
};

type Pick = { player: DirectoryPlayer; team: DirectoryTeam | null };

const GOALS = 2;

function Caption({ children }: { children: React.ReactNode }) {
  return <figcaption className="mt-4 text-center text-[13px] text-[#F3EFE6]/55">{children}</figcaption>;
}

export default async function TotwCardPreviewPage() {
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
  const miniProps = ({ player, team }: Pick) => ({
    photo: player.photo,
    logo: team?.logo ?? null,
    initial: initial(player),
  });

  // A list as the site shows it: mostly photos, some team logos. In each of
  // the two rows exactly one card is the edition — the fourth.
  const SPECIAL = 3;
  const listWithPhotoInside = [...withPhoto.slice(0, 5), ...withoutPhoto.slice(1, 4)];
  const listWithLogoInside = [...withPhoto.slice(5, 8), ...withoutPhoto.slice(4, 9)];

  return (
    <div className="min-h-screen bg-[#0a0a14] text-[#F3EFE6]">
      <div className="mx-auto max-w-6xl px-4 pb-20 pt-10 md:px-6 md:pt-14">
        <h1 className="text-4xl font-bold italic leading-none tracking-tight md:text-5xl">
          Κάρτα «Ομάδα της Εβδομάδας»
        </h1>

        <section className="mt-10 flex flex-wrap justify-center gap-x-10 gap-y-12 md:justify-start" data-shot="big">
          {star && (
            <figure className="w-[300px] max-w-full" data-shot="photo">
              <TotwShieldCard
                first={star.player.first}
                last={star.player.last}
                photo={star.player.photo}
                team={star.team}
                stats={star.player.season}
              />
              <Caption>«Ομάδα της Εβδομάδας» με φωτογραφία</Caption>
            </figure>
          )}
          {plain && (
            <figure className="w-[300px] max-w-full" data-shot="plain">
              <TotwShieldCard
                first={plain.player.first}
                last={plain.player.last}
                photo={plain.player.photo}
                team={plain.team}
                stats={plain.player.season}
              />
              <Caption>«Ομάδα της Εβδομάδας» χωρίς φωτογραφία</Caption>
            </figure>
          )}
          {star && (
            <figure className="w-[300px] max-w-full" data-shot="legend">
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
            <figure className="w-[300px] max-w-full" data-shot="normal">
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
          <section className="mt-16" data-shot="more">
            <h2 className="text-xl font-bold">Άλλες φωτογραφίες</h2>
            <div className="mt-8 flex flex-wrap justify-center gap-x-10 gap-y-12 md:justify-start">
              {morePhotos.map(({ player, team }, i) => (
                <div key={player.id} className="w-[300px] max-w-full" data-shot={`more-${i}`}>
                  <TotwShieldCard
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

        <section className="mt-16" data-shot="minis">
          <h2 className="text-xl font-bold">Μικρή κάρτα (λίστες)</h2>
          <div className="mt-8 flex flex-wrap items-start gap-x-8 gap-y-8">
            {star && (
              <figure data-shot="mini-photo">
                <div className="mx-auto w-14">
                  <TotwMiniCard {...miniProps(star)} />
                </div>
                <Caption>«Ομάδα της Εβδομάδας»</Caption>
              </figure>
            )}
            {plain && (
              <figure data-shot="mini-plain">
                <div className="mx-auto w-14">
                  <TotwMiniCard {...miniProps(plain)} />
                </div>
                <Caption>«Ομάδα της Εβδομάδας», χωρίς φωτογραφία</Caption>
              </figure>
            )}
            {star && (
              <figure data-shot="mini-legend">
                <div className="mx-auto w-14">
                  <LegendMiniCard {...miniProps(star)} />
                </div>
                <Caption>«Θρύλος»</Caption>
              </figure>
            )}
            {plain && (
              <figure data-shot="mini-legend-plain">
                <div className="mx-auto w-14">
                  <LegendMiniCard {...miniProps(plain)} />
                </div>
                <Caption>«Θρύλος», χωρίς φωτογραφία</Caption>
              </figure>
            )}
            {star && (
              <figure data-shot="mini-normal">
                <div className="mx-auto w-14">
                  <MiniCard {...miniProps(star)} />
                </div>
                <Caption>Κανονική</Caption>
              </figure>
            )}
            {plain && (
              <figure data-shot="mini-normal-plain">
                <div className="mx-auto w-14">
                  <MiniCard {...miniProps(plain)} />
                </div>
                <Caption>Κανονική, χωρίς φωτογραφία</Caption>
              </figure>
            )}
          </div>
        </section>

        <section className="mt-16" data-shot="list">
          <h2 className="text-xl font-bold">Μία ανάμεσα στις κανονικές</h2>
          {[listWithPhotoInside, listWithLogoInside].map((row, r) => (
            <div key={r} className="mt-8 flex flex-wrap items-start gap-3" data-shot={`list-${r}`}>
              {row.map((pick, i) => (
                <div key={pick.player.id} className="w-14">
                  {i === SPECIAL ? <TotwMiniCard {...miniProps(pick)} /> : <MiniCard {...miniProps(pick)} />}
                </div>
              ))}
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
