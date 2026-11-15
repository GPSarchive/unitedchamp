// Preview route — one player's page: who they are, where they play, this
// season's numbers, the split per tournament, and earlier seasons.
import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlayerImage } from "@/app/lib/OptimizedImage";
import { isPlaceholderPhoto } from "@/app/lib/image-config";
import { loadPlayerProfile } from "../data";
import BackToList from "./BackToList";
import PlayerCard from "./PlayerCard";
import { LINK, SeasonStrip, StatTable } from "./profileParts";

export const revalidate = 300;

// Required for ISR on a dynamic segment (see OMADA/[id]): each player page is
// generated on first request, then cached for the revalidate window.
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ id: string }> };

const getProfile = cache(async (rawId: string) => {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) return null;
  return loadPlayerProfile(id);
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const profile = await getProfile(id);
  if (!profile) return { title: "Παίκτης · UltraChamp.gr", robots: { index: false, follow: false } };
  const name = `${profile.last} ${profile.first}`.trim();
  const team = profile.teams[0]?.name;
  return {
    title: `${name} · Παίκτες · UltraChamp.gr`,
    description: team
      ? `${name} (${team}): αγώνες, γκολ, ασίστ και βραβεία στο UltraChamp.`
      : `${name}: αγώνες, γκολ, ασίστ και βραβεία στο UltraChamp.`,
    robots: { index: false, follow: false },
  };
}

export default async function PlayerPage({ params }: Props) {
  const { id } = await params;
  const profile = await getProfile(id);
  if (!profile) notFound();


  const facts = [
    profile.position || null,
    profile.age != null ? `${profile.age} ετών` : null,
    profile.heightCm ? `${profile.heightCm} εκ.` : null,
  ].filter((x): x is string => x !== null);

  return (
    <div className="min-h-screen bg-[#0a0a14] text-[#F3EFE6]">
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-5 md:px-6 md:pt-8">
        <BackToList />

        <div className="mt-6 grid gap-8 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] md:gap-10">
          <div className="mx-auto w-full max-w-[20rem] md:mx-0">
            <PlayerCard
              first={profile.first}
              last={profile.last}
              photo={profile.photo}
              teams={profile.teams}
              teamColour={profile.teamColour}
              stats={profile.season}
              tier={profile.tier}
            />
          </div>

          <div className="min-w-0">
            <h1 className="text-4xl font-bold italic leading-[1.05] tracking-tight md:text-5xl">
              {profile.last}
              {profile.last && profile.first ? " " : ""}
              <span className="font-normal text-[#F3EFE6]/85">{profile.first}</span>
              {!profile.last && !profile.first ? "—" : null}
            </h1>
            {facts.length > 0 && (
              <p className="mt-3 text-lg text-[#F3EFE6]/75">{facts.join(" · ")}</p>
            )}

            {profile.teams.length > 0 ? (
              <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-3">
                {profile.teams.map((team) => (
                  <li key={team.id}>
                    <Link href={`/OMADA/${team.id}`} className={`group inline-flex items-center gap-3 ${LINK}`}>
                      <span className="h-9 w-9 shrink-0 overflow-hidden border border-[#F3EFE6]/15 bg-[#13131d]">
                        {!isPlaceholderPhoto(team.logo) && (
                          <PlayerImage
                            src={team.logo}
                            alt=""
                            width={36}
                            height={36}
                            className="h-full w-full object-contain p-0.5"
                            animate={false}
                          />
                        )}
                      </span>
                      <span className="text-lg">{team.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-5 text-[15px] text-[#F3EFE6]/60">
                Δεν ανήκει σε ομάδα την τρέχουσα σεζόν.
              </p>
            )}

            <section className="mt-10">
              <h2 className="text-xl font-bold">
                {profile.seasonLabel ? `Σεζόν ${profile.seasonLabel}` : "Τρέχουσα σεζόν"}
              </h2>
              {profile.season ? (
                <SeasonStrip stats={profile.season} />
              ) : (
                <p className="mt-3 text-[15px] text-[#F3EFE6]/70">
                  Δεν έχει καταγραφεί συμμετοχή σε αγώνα αυτή τη σεζόν.
                </p>
              )}
            </section>

            {profile.tournaments.length > 0 && (
              <StatTable caption="Ανά διοργάνωση" firstColumn="Διοργάνωση" lines={profile.tournaments} />
            )}
            {profile.history.length > 0 && (
              <StatTable caption="Προηγούμενες σεζόν" firstColumn="Σεζόν" lines={profile.history} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
