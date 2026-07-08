// app/geniki-katataxi/page.tsx
// Γενική Κατάταξη — per-season overall team standings, computed by the points engine
// in ./points.ts and rendered by the shared ./StandingsView. This live route uses the
// current season model (the typed `tournaments.season` field). The date-derived model
// (Sept 30 cutoff) is under review at /preview/geniki-katataxi.
import type { Metadata } from "next";
import StandingsView from "./StandingsView";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Γενική Κατάταξη",
  description: "Η γενική κατάταξη των ομάδων ανά σεζόν, με ενιαίο σύστημα πόντων.",
};

export default async function GenikiKataxiPage({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const requested = Array.isArray(sp.season) ? sp.season[0] : sp.season;

  return (
    <StandingsView
      seasonMode="field"
      basePath="/geniki-katataxi"
      requestedSeason={requested}
    />
  );
}
