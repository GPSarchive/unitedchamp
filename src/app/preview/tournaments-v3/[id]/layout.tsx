// Preview route — tournament page v3, rebuilt from scratch. The live page
// (/tournaments/[id]) puts everything on one long screen; here the tournament
// is a short header and a row of tabs, each tab a page that shows one thing:
//
//   (this address)  the table(s), with the next and the latest matches beside
//   /matches        the programme and the results, by round
//   /bracket        the knockout tree
//   /players        the scorers, and the tournament's leaders on the big card
//   /teams          every team, opening to its squad in the new player cards
//
// The header says where the tournament stands in a sentence — who leads, or
// who won it — instead of a row of counters.
//
// A player card anywhere under here opens the profile on top of the page.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TournamentImage } from "@/app/lib/OptimizedImage";
import { formatMatchDate } from "@/app/lib/datetime";
import { ProfileHost } from "../../paiktes-v3/ProfileHost";
import { loadBase, loadTables } from "./data";
import { headline, type Headline } from "./model";
import { TEAM_PATH, TOURNAMENT_PATH } from "./paths";
import Tabs, { type Tab } from "./Tabs";
import { Chrome, Crest, FOCUS, parseId, plural } from "./ui";

export const revalidate = 60;

// Without it a dynamic segment is rendered on every request even when
// `revalidate` is set (same as the live tournament page).
export function generateStaticParams() {
  return [];
}

export const metadata: Metadata = {
  title: "Διοργάνωση · UltraChamp.gr",
  robots: { index: false, follow: false },
};

/** Where the tournament stands, in a sentence. */
function State({ head }: { head: Headline }) {
  const line = "mt-3 max-w-2xl text-[17px] leading-snug text-[#F3EFE6]/85";
  if (head.kind === "champion") {
    return (
      <p className="mt-4 flex items-center gap-3 md:gap-4">
        <Crest team={head.team} className="h-12 w-12 text-xl md:h-16 md:w-16" sizes="64px" />
        <span className="min-w-0">
          <span className="block text-[15px] text-[#FFE08A]">Πρωταθλήτρια</span>
          <Link href={`${TEAM_PATH}/${head.team.id}`} className={`block ${FOCUS}`}>
            <Chrome gold size="clamp(1.7rem, 6.5vw, 2.75rem)" className="pr-2 [overflow-wrap:anywhere]">
              {head.team.name}
            </Chrome>
          </Link>
        </span>
      </p>
    );
  }
  if (head.kind === "running") {
    return (
      <p className={line}>
        {head.played === 1 ? "Έχει παιχτεί 1" : `Έχουν παιχτεί ${head.played}`} από {head.total} αγώνες.
        {head.leader ? (
          <>
            {" "}
            Στην κορυφή:{" "}
            <Link
              href={`${TEAM_PATH}/${head.leader.team.id}`}
              className={`font-bold text-[#F3EFE6] underline decoration-[#fb923c] decoration-2 underline-offset-4 hover:text-[#fb923c] ${FOCUS}`}
            >
              {head.leader.team.name}
            </Link>
            , {plural(head.leader.points, "βαθμός", "βαθμοί")}.
          </>
        ) : null}
      </p>
    );
  }
  if (head.kind === "upcoming") {
    return (
      <p className={line}>
        {head.firstDate
          ? `Ξεκινά ${formatMatchDate(head.firstDate, { weekday: "long", day: "numeric", month: "long" })}.`
          : "Το πρόγραμμα δεν έχει ανακοινωθεί ακόμα."}
      </p>
    );
  }
  return (
    <p className={line}>
      Ολοκληρώθηκε. {head.played === 1 ? "Παίχτηκε 1 αγώνας" : `Παίχτηκαν ${head.played} αγώνες`}.
    </p>
  );
}

export default async function TournamentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const id = parseId((await params).id);
  if (!id) notFound();
  const base = await loadBase(id);
  if (!base) notFound();
  const tables = await loadTables(id);

  const head = headline({ winner: base.winner, status: base.status, matches: base.matches, tables });
  const hasTables = tables.length > 0;
  const hasKnockout = base.stages.some((s) => s.kind === "knockout");
  const home = `${TOURNAMENT_PATH}/${base.id}`;

  // The first tab is whatever the tournament is made of: its table, or its tree.
  const tabs: Tab[] = [
    { segment: null, label: hasTables ? "Βαθμολογία" : hasKnockout ? "Νοκ άουτ" : "Αγώνες", href: home },
    ...(hasTables && hasKnockout ? [{ segment: "bracket", label: "Νοκ άουτ", href: `${home}/bracket` }] : []),
    ...(hasTables || hasKnockout ? [{ segment: "matches", label: "Αγώνες", href: `${home}/matches` }] : []),
    { segment: "players", label: "Παίκτες", href: `${home}/players` },
    { segment: "teams", label: "Ομάδες", href: `${home}/teams` },
  ];

  const facts = [
    base.season ? `Σεζόν ${base.season.display}` : null,
    base.teams.length > 0 ? plural(base.teams.length, "ομάδα", "ομάδες") : null,
    base.season?.archived ? "αρχείο" : null,
  ].filter(Boolean);

  return (
    <ProfileHost>
      <div className="min-h-screen overflow-x-hidden bg-[#0a0a14] text-[#F3EFE6]">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <header className="pb-6 pt-5 md:pb-8 md:pt-8">
            <nav aria-label="Διαδρομή" className="text-[13px] text-[#F3EFE6]/65">
              <Link href="/" className={`hover:text-[#fb923c] ${FOCUS}`}>
                Αρχική
              </Link>
              <span aria-hidden> / </span>
              <Link href="/tournaments" className={`hover:text-[#fb923c] ${FOCUS}`}>
                Διοργανώσεις
              </Link>
            </nav>

            <div className="mt-5 flex items-start gap-4 md:gap-7">
              {base.logo ? (
                <div className="relative mt-1 h-16 w-16 shrink-0 md:h-28 md:w-28">
                  <TournamentImage
                    src={base.logo}
                    alt=""
                    fill
                    objectFit="contain"
                    sizes="(min-width: 768px) 112px, 64px"
                    priority
                    animate={false}
                  />
                </div>
              ) : null}
              <div className="min-w-0 flex-1">
                <h1>
                  <Chrome size="clamp(2.1rem, 8.5vw, 4.5rem)" className="pr-2 [overflow-wrap:anywhere]">
                    {base.name}
                  </Chrome>
                </h1>
                {facts.length > 0 ? <p className="mt-1.5 text-[15px] text-[#F3EFE6]/65">{facts.join(", ")}</p> : null}
                <State head={head} />
              </div>
            </div>
          </header>

          <Tabs tabs={tabs} />

          <main className="py-7 md:py-10">{children}</main>

          <footer className="border-t border-[#F3EFE6]/15 py-6">
            <Link
              href="/tournaments"
              className={`inline-flex h-11 items-center border border-[#F3EFE6]/25 px-5 text-[15px] hover:border-[#fb923c] hover:text-[#fb923c] ${FOCUS}`}
            >
              Όλες οι διοργανώσεις
            </Link>
          </footer>
        </div>
      </div>
    </ProfileHost>
  );
}
