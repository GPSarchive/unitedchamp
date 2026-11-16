// Preview route — the two versions of the «Θρύλος» (Legend) card side by
// side, to choose between them: the same players in «Έκδοση 1», «Έκδοση 2»
// and the normal card (with a photo, with a second photo, without a photo),
// then the mini cards of all three. Real players from the players directory;
// static + ISR like the directory itself.
//
// On a phone the big cards are shown smaller, so that two fit next to each
// other; each version's own page shows them at full size.
import type { Metadata } from "next";
import Link from "next/link";
import { isPlaceholderPhoto } from "@/app/lib/image-config";
import HoloShieldCard from "@/app/preview/paiktes-v2/[id]/HoloShieldCard";
import type { DirectoryPlayer, DirectoryTeam } from "@/app/preview/paiktes-v2/model";
import MiniCard from "@/app/paiktes/MiniCard";
import { loadDirectoryV3 } from "@/app/paiktes/data";
import LegendMiniCardV1 from "./v1/LegendMiniCard";
import LegendShieldCardV1 from "./v1/LegendShieldCard";
import LegendMiniCardV2 from "./v2/LegendMiniCard";
import LegendShieldCardV2 from "./v2/LegendShieldCard";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Κάρτα «Θρύλος» · Σύγκριση εκδόσεων · UltraChamp.gr",
  robots: { index: false, follow: false },
};

type Pick = { player: DirectoryPlayer; team: DirectoryTeam | null };

const GOALS = 2;

const VERSIONS = [
  { label: "Έκδοση 1", Big: LegendShieldCardV1, Mini: LegendMiniCardV1 },
  { label: "Έκδοση 2", Big: LegendShieldCardV2, Mini: LegendMiniCardV2 },
  { label: "Κανονική κάρτα", Big: HoloShieldCard, Mini: MiniCard },
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

function BigRow({ title, pick, intro }: { title: string; pick: Pick; intro: boolean }) {
  return (
    <section className="mt-12 md:mt-16">
      <h2 className="text-xl font-bold">{title}</h2>
      <div className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-8 md:justify-start md:gap-x-10">
        {VERSIONS.map(({ label, Big }) => (
          <figure key={label}>
            <Sized>
              <Big
                first={pick.player.first}
                last={pick.player.last}
                photo={pick.player.photo}
                team={pick.team}
                stats={pick.player.season}
                intro={intro}
              />
            </Sized>
            <figcaption className="mt-3 text-center text-[13px] text-[#F3EFE6]/65">{label}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

export default async function LegendCardComparePage() {
  const data = await loadDirectoryV3();
  const teamsById = new Map(data.teams.map((t) => [t.id, t] as const));
  const hasLogo = (team: DirectoryTeam | null) => team != null && !isPlaceholderPhoto(team.logo);

  // Players with numbers and a team that has a logo, top scorers first — the
  // same choice as on each version's own page.
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

  const initial = (p: DirectoryPlayer) => (p.last || p.first || "?").charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-[#0a0a14] text-[#F3EFE6] [--card-scale:0.53] md:[--card-scale:1]">
      <div className="mx-auto max-w-6xl px-4 pb-20 pt-10 md:px-6 md:pt-14">
        <h1 className="text-4xl font-bold italic leading-none tracking-tight md:text-5xl">Κάρτα «Θρύλος»</h1>
        <p className="mt-3 text-[15px] text-[#F3EFE6]/65">
          Οι δύο εκδόσεις δίπλα δίπλα. Σε πλήρες μέγεθος:{" "}
          <Link href="/preview/special-cards/legend/v1" className="underline underline-offset-4">
            Έκδοση 1
          </Link>
          {" · "}
          <Link href="/preview/special-cards/legend/v2" className="underline underline-offset-4">
            Έκδοση 2
          </Link>
        </p>

        {star && <BigRow title="Με φωτογραφία" pick={star} intro />}
        {second && <BigRow title="Με άλλη φωτογραφία" pick={second} intro={false} />}
        {plain && <BigRow title="Χωρίς φωτογραφία" pick={plain} intro={false} />}

        <section className="mt-12 md:mt-16">
          <h2 className="text-xl font-bold">Μικρή κάρτα (λίστες)</h2>
          <div className="mt-6 flex flex-wrap gap-x-10 gap-y-8">
            {VERSIONS.map(({ label, Mini }) => (
              <figure key={label}>
                <div className="flex gap-3">
                  {miniPicks.map(({ player, team }) => (
                    <div key={player.id} className="w-14">
                      <Mini photo={player.photo} logo={team?.logo ?? null} initial={initial(player)} />
                    </div>
                  ))}
                </div>
                <figcaption className="mt-3 text-[13px] text-[#F3EFE6]/65">{label}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
