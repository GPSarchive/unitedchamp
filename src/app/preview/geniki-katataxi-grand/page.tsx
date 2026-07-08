// app/preview/geniki-katataxi-grand/page.tsx
// PREVIEW: the GRAND redesign of the Γενική Κατάταξη — hall-of-champions treatment
// (champion altar, podium flanks, editorial ledger). Same data + season model as the
// live route ("field"); only the presentation differs. The live route and the shared
// StandingsView are untouched.
import type { Metadata } from "next";
import StandingsViewGrand from "@/app/geniki-katataxi/StandingsViewGrand";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Γενική Κατάταξη · Προεπισκόπηση (Grand)",
  robots: { index: false, follow: false },
};

export default async function PreviewGenikiKataxiGrandPage({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const requested = Array.isArray(sp.season) ? sp.season[0] : sp.season;

  return (
    <StandingsViewGrand
      seasonMode="field"
      basePath="/preview/geniki-katataxi-grand"
      requestedSeason={requested}
    />
  );
}
