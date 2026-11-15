// Preview route — every edition of the player card side by side: the normal
// card, «Θρύλος» (version 1) and the four editions made from the FIFA 16
// colourings — «Ομάδα της Χρονιάς», «Ομάδα της Εβδομάδας» (in red), «Ήρωας»,
// «Επαγγελματίας». The same players in each: with a photo, with another
// photo, without a photo; then the mini cards, on their own and one of each
// among normal minis, as they would stand in a list. Real players from the
// players directory; static + ISR like the directory itself.
//
// On a phone the big cards are shown smaller, so that two fit next to each
// other; each edition's own page shows them at full size.
import type { Metadata } from "next";
import Link from "next/link";
import { isPlaceholderPhoto } from "@/app/lib/image-config";
import HoloShieldCard from "@/app/preview/paiktes-v2/[id]/HoloShieldCard";
import type { DirectoryPlayer, DirectoryTeam } from "@/app/preview/paiktes-v2/model";
import MiniCard from "@/app/preview/paiktes-v3/MiniCard";
import { loadDirectoryV3 } from "@/app/preview/paiktes-v3/data";
import HeroMiniCard from "../heroes/v1/HeroMiniCard";
import HeroShieldCard from "../heroes/v1/HeroShieldCard";
import LegendMiniCard from "../legend/v1/LegendMiniCard";
import LegendShieldCard from "../legend/v1/LegendShieldCard";
import ProMiniCard from "../pro-players/v1/ProMiniCard";
import ProShieldCard from "../pro-players/v1/ProShieldCard";
import TotwMiniCard from "../totw/v1/TotwMiniCard";
import TotwShieldCard from "../totw/v1/TotwShieldCard";
import TotyMiniCard from "../toty/v1/TotyMiniCard";
import TotyShieldCard from "../toty/v1/TotyShieldCard";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Ειδικές κάρτες · UltraChamp.gr",
  robots: { index: false, follow: false },
};

type Pick = { player: DirectoryPlayer; team: DirectoryTeam | null };

const GOALS = 2;

const EDITIONS = [
  { key: "normal", label: "Κανονική", href: null, Big: HoloShieldCard, Mini: MiniCard },
  { key: "legend", label: "Θρύλος", href: "/preview/special-cards/legend/v1", Big: LegendShieldCard, Mini: LegendMiniCard },
  { key: "toty", label: "Ομάδα της Χρονιάς", href: "/preview/special-cards/toty/v1", Big: TotyShieldCard, Mini: TotyMiniCard },
  { key: "totw", label: "Ομάδα της Εβδομάδας", href: "/preview/special-cards/totw/v1", Big: TotwShieldCard, Mini: TotwMiniCard },
  { key: "hero", label: "Ήρωας", href: "/preview/special-cards/heroes/v1", Big: HeroShieldCard, Mini: HeroMiniCard },
  { key: "pro", label: "Επαγγελματίας", href: "/preview/special-cards/pro-players/v1", Big: ProShieldCard, Mini: ProMiniCard },
] as const;

/**
 * A big card in a 300px box (the width it is designed for), shown at the
 * page's scale: smaller on a phone, full size from `md` up.
 */
function Sized({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-[calc(420px*var(--card-scale))] w-[calc(300px*var(--card-scale))]">
      <div className="w-[300px] origin-top-left [transform:scale(var(--card-scale))]">{children}</div>
    </div>
  );
}

function Label({ edition }: { edition: (typeof EDITIONS)[number] }) {
  return (
    <figcaption className="mt-3 text-center text-[13px] text-[#F3EFE6]/65">
      {edition.href ? (
        <Link href={edition.href} className="underline-offset-4 hover:underline">
          {edition.label}
        </Link>
      ) : (
        edition.label
      )}
    </figcaption>
  );
}

function BigRow({ title, shot, pick, intro }: { title: string; shot: string; pick: Pick; intro: boolean }) {
  return (
    <section data-shot={shot} className="mt-12 md:mt-16">
      <h2 className="text-xl font-bold">{title}</h2>
      <div className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-8 md:justify-start md:gap-x-10 md:gap-y-12">
        {EDITIONS.map((edition) => (
          <figure key={edition.key} data-shot={`${shot}-${edition.key}`}>
            <Sized>
              <edition.Big
                first={pick.player.first}
                last={pick.player.last}
                photo={pick.player.photo}
                team={pick.team}
                stats={pick.player.season}
                intro={intro}
              />
            </Sized>
            <Label edition={edition} />
          </figure>
        ))}
      </div>
    </section>
  );
}

export default async function SpecialEditionsPage() {
  const data = await loadDirectoryV3();
  const teamsById = new Map(data.teams.map((t) => [t.id, t] as const));
  const hasLogo = (team: DirectoryTeam | null) => team != null && !isPlaceholderPhoto(team.logo);

  // Players with numbers and a team that has a logo, top scorers first — the
  // same choice as on each edition's own page.
  const picks: Pick[] = data.players
    .filter((p) => p.season != null)
    .map((player) => ({ player, team: teamsById.get(player.teamIds[0]) ?? null }))
    .filter((pick) => hasLogo(pick.team))
    .sort((a, b) => (b.player.season?.[GOALS] ?? 0) - (a.player.season?.[GOALS] ?? 0) || a.player.id - b.player.id);

  const withPhoto = picks.filter((pick) => !isPlaceholderPhoto(pick.player.photo));
  const withoutPhoto = picks.filter((pick) => isPlaceholderPhoto(pick.player.photo));
  const star = withPhoto[0];
  const second = withPhoto[2];
  const plain = withoutPhoto[0];
  const miniPicks = [star, second, plain].filter((pick): pick is Pick => pick != null);

  // A list of normal minis with one of each edition among them: photos and
  // no photos mixed, as a real list would be.
  const listPicks = [...withPhoto.slice(0, 7), ...withoutPhoto.slice(0, 5)].sort((a, b) => a.player.id - b.player.id);
  const specials = EDITIONS.filter((edition) => edition.key !== "normal");
  const specialAt = new Map(specials.map((edition, i) => [1 + i * 2, edition] as const));

  const initial = (p: DirectoryPlayer) => (p.last || p.first || "?").charAt(0).toUpperCase();
  const miniProps = ({ player, team }: Pick) => ({
    photo: player.photo,
    logo: team?.logo ?? null,
    initial: initial(player),
  });

  return (
    <div className="min-h-screen bg-[#0a0a14] text-[#F3EFE6] [--card-scale:0.53] md:[--card-scale:1]">
      <div className="mx-auto max-w-6xl px-4 pb-20 pt-10 md:px-6 md:pt-14">
        <h1 className="text-4xl font-bold italic leading-none tracking-tight md:text-5xl">Ειδικές κάρτες</h1>

        {star && <BigRow title="Με φωτογραφία" shot="photo" pick={star} intro />}
        {second && <BigRow title="Με άλλη φωτογραφία" shot="photo2" pick={second} intro={false} />}
        {plain && <BigRow title="Χωρίς φωτογραφία" shot="nophoto" pick={plain} intro={false} />}

        <section data-shot="minis" className="mt-12 md:mt-16">
          <h2 className="text-xl font-bold">Μικρή κάρτα</h2>
          <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 md:flex md:flex-wrap md:gap-x-10">
            {EDITIONS.map((edition) => (
              <figure key={edition.key}>
                <div className="flex gap-2 md:gap-3">
                  {miniPicks.map((pick) => (
                    <div key={pick.player.id} className="w-12 md:w-14">
                      <edition.Mini {...miniProps(pick)} />
                    </div>
                  ))}
                </div>
                <figcaption className="mt-3 text-[13px] text-[#F3EFE6]/65">{edition.label}</figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section data-shot="list" className="mt-12 md:mt-16">
          <h2 className="text-xl font-bold">Μέσα σε λίστα</h2>
          <div className="mt-6 flex flex-wrap gap-3">
            {listPicks.map((pick, i) => {
              const edition = specialAt.get(i);
              return (
                <div key={pick.player.id} data-shot={edition ? `list-${edition.key}` : undefined} className="w-12 md:w-14">
                  {edition ? <edition.Mini {...miniProps(pick)} /> : <MiniCard {...miniProps(pick)} />}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
