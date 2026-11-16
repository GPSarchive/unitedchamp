// Preview route — the «Θρύλος» (Legend) card, version 3 = version 1 refined.
// A comparison sheet: for a few real players, version 1 and version 3 side by
// side with the same photo framing, plus the normal card; then the mini cards
// of both. Real players from the players directory; static + ISR like the
// directory itself.
import type { Metadata } from "next";
import { isPlaceholderPhoto } from "@/app/lib/image-config";
import HoloShieldCard from "@/app/preview/paiktes-v2/[id]/HoloShieldCard";
import type { DirectoryPlayer, DirectoryTeam } from "@/app/preview/paiktes-v2/model";
import MiniCard from "@/app/paiktes/MiniCard";
import { loadDirectoryV3 } from "@/app/paiktes/data";
import { DEFAULT_FRAMING, Framed, FramingStyles, type Framing } from "../../framing";
import LegendMiniCardV1 from "../v1/LegendMiniCard";
import LegendShieldCardV1 from "../v1/LegendShieldCard";
import LegendMiniCard from "./LegendMiniCard";
import LegendShieldCard from "./LegendShieldCard";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Κάρτα «Θρύλος» · Έκδοση 3 · UltraChamp.gr",
  robots: { index: false, follow: false },
};

type Pick = { player: DirectoryPlayer; team: DirectoryTeam | null };

const GOALS = 2;

// How each sample photo is framed on this sheet (what an admin would set by
// hand with the framing tool), by player id. The same values go to every card
// of that player, so the versions are compared on the same picture.
const FRAMINGS: Record<number, Framing> = {
  681: { x: 46, y: 100, zoom: 1.2 },
  979: { x: 32, y: 64, zoom: 1.6 },
  104: { x: 58, y: 0, zoom: 1 },
  629: { x: 85, y: 40, zoom: 1.3 },
};

function Caption({ children }: { children: React.ReactNode }) {
  return <figcaption className="mt-4 text-center text-[13px] text-[#F3EFE6]/55">{children}</figcaption>;
}

export default async function LegendCardV3PreviewPage() {
  const data = await loadDirectoryV3();
  const teamsById = new Map(data.teams.map((t) => [t.id, t] as const));
  const hasLogo = (team: DirectoryTeam | null) => team != null && !isPlaceholderPhoto(team.logo);

  // Same choice of players as version 1's page: players with numbers and a
  // team that has a logo, top scorers first.
  const picks: Pick[] = data.players
    .filter((p) => p.season != null)
    .map((player) => ({ player, team: teamsById.get(player.teamIds[0]) ?? null }))
    .filter((pick) => hasLogo(pick.team))
    .sort((a, b) => (b.player.season?.[GOALS] ?? 0) - (a.player.season?.[GOALS] ?? 0) || a.player.id - b.player.id);

  const withPhoto = picks.filter((pick) => !isPlaceholderPhoto(pick.player.photo)).slice(0, 4);
  const withoutPhoto = picks.filter((pick) => isPlaceholderPhoto(pick.player.photo)).slice(0, 1);
  const samples = [...withPhoto, ...withoutPhoto];

  const framingOf = (p: DirectoryPlayer) => FRAMINGS[p.id] ?? DEFAULT_FRAMING;
  const initial = (p: DirectoryPlayer) => (p.last || p.first || "?").charAt(0).toUpperCase();
  const miniProps = ({ player, team }: Pick) => ({
    photo: player.photo,
    logo: team?.logo ?? null,
    initial: initial(player),
  });

  return (
    <div className="min-h-screen bg-[#0a0a14] text-[#F3EFE6]">
      <FramingStyles />
      <div className="mx-auto max-w-6xl px-4 pb-20 pt-10 md:px-6 md:pt-14">
        <h1 className="text-3xl font-bold leading-tight tracking-tight md:text-4xl">Κάρτα «Θρύλος»: Έκδοση 1 και Έκδοση 3</h1>

        {samples.map(({ player, team }, i) => {
          const card = {
            first: player.first,
            last: player.last,
            photo: player.photo,
            team,
            stats: player.season,
            intro: false,
          };
          const framing = framingOf(player);
          return (
            <section key={player.id} data-shot={`row-${i}`} data-player={player.id} className="mt-12">
              <h2 className="text-xl font-bold">
                {player.first} {player.last}
              </h2>
              <div className="mt-6 flex flex-wrap justify-center gap-x-10 gap-y-10 md:justify-start">
                <figure data-shot={`v1-${i}`} className="w-[300px] max-w-full">
                  <Framed framing={framing}>
                    <LegendShieldCardV1 {...card} />
                  </Framed>
                  <Caption>Έκδοση 1</Caption>
                </figure>
                <figure data-shot={`v3-${i}`} className="w-[300px] max-w-full">
                  <Framed framing={framing}>
                    <LegendShieldCard {...card} />
                  </Framed>
                  <Caption>Έκδοση 3</Caption>
                </figure>
                <figure data-shot={`normal-${i}`} className="w-[300px] max-w-full">
                  <Framed framing={framing}>
                    <HoloShieldCard {...card} />
                  </Framed>
                  <Caption>Κανονική κάρτα</Caption>
                </figure>
              </div>
            </section>
          );
        })}

        <section data-shot="minis" className="mt-16">
          <h2 className="text-xl font-bold">Μικρή κάρτα (λίστες)</h2>
          {(
            [
              ["Έκδοση 1", LegendMiniCardV1],
              ["Έκδοση 3", LegendMiniCard],
              ["Κανονική κάρτα", MiniCard],
            ] as const
          ).map(([label, Mini]) => (
            <div key={label} className="mt-8">
              <h3 className="text-[13px] text-[#F3EFE6]/55">{label}</h3>
              <div className="mt-3 flex flex-wrap items-start gap-4">
                {samples.map((pick) => (
                  <div key={pick.player.id} className="w-14">
                    <Framed framing={framingOf(pick.player)}>
                      <Mini {...miniProps(pick)} />
                    </Framed>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>

        {/* One «Θρύλος» among normal cards, as it would stand in a list. */}
        <section data-shot="minis-mixed" className="mt-16">
          <h2 className="text-xl font-bold">Μέσα σε λίστα</h2>
          {(
            [
              ["Έκδοση 1", LegendMiniCardV1],
              ["Έκδοση 3", LegendMiniCard],
            ] as const
          ).map(([label, Mini]) => (
            <div key={label} className="mt-8">
              <h3 className="text-[13px] text-[#F3EFE6]/55">{label}</h3>
              <div className="mt-3 flex flex-wrap items-start gap-4">
                {samples.map((pick, i) => (
                  <div key={pick.player.id} className="w-14">
                    <Framed framing={framingOf(pick.player)}>
                      {i === 1 || i === samples.length - 1 ? <Mini {...miniProps(pick)} /> : <MiniCard {...miniProps(pick)} />}
                    </Framed>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
