// Preview route — tournament page v4: the split into tabs of tournaments-v3
// (one thing per page: table, knockout tree, matches, players, teams) with
// what was worth keeping of the live page's look — its dark ground with the
// orange light behind the name, the name in big italics, the orange strip of
// next matches, framed panels with a strip naming them, the place in a table
// as a big number. The players are on the new cards.
//
//   (this address)  the stages in order — tables, then the knockout tree — with
//                   the next and the latest matches beside
//   /matches        the matches, stage by stage
//   /players        the scorers, and the tournament's leaders on the big card
//   /teams          every team as a tile, opening to its squad in the new player cards
//
// What the tournament is and what its pages show come from tournaments-v3
// (data.ts, model.ts); only the drawing is here.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TournamentImage } from "@/app/lib/OptimizedImage";
import { formatMatchDate, nowWallClockIso } from "@/app/lib/datetime";
import { LINE, SURFACE, layers } from "@/app/lib/ui/flat";
import { ProfileHost } from "../../paiktes-v3/ProfileHost";
import { loadBase, loadSquads, loadTables } from "../../tournaments-v3/[id]/data";
import { headline, splitMatches, type Headline, type TTeam } from "../../tournaments-v3/[id]/model";
import styles from "./dispatch.module.css";
import { TEAM_PATH, TOURNAMENT_PATH } from "./paths";
import Tabs, { type Tab } from "./Tabs";
import Ticker from "./Ticker";
import { BUTTON, FOCUS, LABEL, SAFFRON } from "./tokens";
import { Crest, parseId, plural } from "./ui";

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

/** How many matches the moving strip carries. */
const IN_TICKER = 10;

const TEAM_LINK = `font-bold text-[#F3EFE6] underline decoration-[#fb923c] decoration-2 underline-offset-4 hover:text-[#fb923c] ${FOCUS}`;

/** Where the tournament stands, in a sentence. (A tournament that has been won shows its winner's plate instead.) */
function State({ head }: { head: Exclude<Headline, { kind: "champion" }> }) {
  if (head.kind === "running") {
    return (
      <>
        {head.played === 1 ? "Έχει παιχτεί 1" : `Έχουν παιχτεί ${head.played}`} από {head.total} αγώνες.
        {head.leader ? (
          <>
            {" "}
            Στην κορυφή:{" "}
            <Link href={`${TEAM_PATH}/${head.leader.team.id}`} className={TEAM_LINK}>
              {head.leader.team.name}
            </Link>
            , {plural(head.leader.points, "βαθμός", "βαθμοί")}.
          </>
        ) : null}
      </>
    );
  }
  if (head.kind === "upcoming") {
    return head.firstDate
      ? `Ξεκινά ${formatMatchDate(head.firstDate, { weekday: "long", day: "numeric", month: "long" })}.`
      : "Το πρόγραμμα δεν έχει ανακοινωθεί ακόμα.";
  }
  return `Ολοκληρώθηκε. ${head.played === 1 ? "Παίχτηκε 1 αγώνας" : `Παίχτηκαν ${head.played} αγώνες`}.`;
}

/**
 * The winner's plate, where the sentence would be: the one thing in the
 * header that stands on the old page's hard shadow, in the colour kept for
 * the title (the final in the knockout tree wears the same).
 */
function ChampionPlate({ team }: { team: TTeam }) {
  return (
    <Link
      href={`${TEAM_PATH}/${team.id}`}
      className={`mt-7 inline-flex max-w-[calc(100%-6px)] items-center gap-4 ${SURFACE} py-3 pl-4 pr-6 transition-colors hover:bg-[#171724] md:mt-8 md:gap-5 md:py-3.5 md:pl-5 md:pr-8 ${FOCUS}`}
      style={{ boxShadow: layers(SAFFRON) }}
    >
      <Crest team={team} className="h-12 w-12 text-xl md:h-14 md:w-14" sizes="56px" />
      <span className="min-w-0">
        <span className={`${LABEL} block font-bold`} style={{ color: SAFFRON }}>
          Πρωταθλητές
        </span>
        <span className="mt-1 block text-2xl font-bold italic leading-none [overflow-wrap:anywhere] md:text-[2rem]">
          {team.name}
        </span>
      </span>
    </Link>
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
  const [tables, squads] = await Promise.all([loadTables(id), loadSquads(id)]);

  const head = headline({ winner: base.winner, status: base.status, matches: base.matches, tables });
  const hasTables = tables.length > 0;
  const hasKnockout = base.stages.some((s) => s.kind === "knockout");
  const home = `${TOURNAMENT_PATH}/${base.id}`;

  // The first tab is the tournament's stages in order: called by what it is
  // made of when that is one thing (a table, a tree), «Φάσεις» when it is both.
  const tabs: Tab[] = [
    {
      segment: null,
      label: hasTables && hasKnockout ? "Φάσεις" : hasTables ? "Βαθμολογία" : hasKnockout ? "Νοκ άουτ" : "Αγώνες",
      href: home,
    },
    ...(hasTables || hasKnockout ? [{ segment: "matches", label: "Αγώνες", href: `${home}/matches` }] : []),
    { segment: "players", label: "Παίκτες", href: `${home}/players` },
    { segment: "teams", label: "Ομάδες", href: `${home}/teams` },
  ];

  const finished = base.matches.filter((m) => m.status === "finished");
  // Everyone in a squad of one of the tournament's teams, counted once (the same squads the «Ομάδες» tab opens).
  const players = new Set(squads.flatMap((s) => s.players.map((p) => p.id))).size;
  const counts = [
    { label: "Ομάδες", value: base.teams.length, of: null as number | null },
    { label: "Αγώνες", value: finished.length, of: finished.length < base.matches.length ? base.matches.length : null },
    { label: "Παίκτες", value: players, of: null },
  ];
  const upcoming = splitMatches(base.matches, nowWallClockIso()).upcoming.slice(0, IN_TICKER);


  return (
    <ProfileHost>
      <div className="relative isolate min-h-screen overflow-x-hidden bg-[#0a0a14] text-[#F3EFE6] selection:bg-[#fb923c] selection:text-[#0a0a14]">
        {/* The strip of next matches closes the header when there is one; otherwise a line does. */}
        <header className={`${styles.masthead} ${upcoming.length === 0 ? `border-b ${LINE}` : ""}`}>
          <div className="mx-auto max-w-[1320px] px-4 pb-8 pt-4 md:px-6 md:pb-12 md:pt-5">
            <nav aria-label="Διαδρομή" className={`${LABEL} flex items-center gap-2 text-[#F3EFE6]/65`}>
              <Link href="/" className={`hover:text-[#fb923c] ${FOCUS}`}>
                Αρχική
              </Link>
              <span aria-hidden>/</span>
              <Link href="/tournaments" className={`hover:text-[#fb923c] ${FOCUS}`}>
                Διοργανώσεις
              </Link>
            </nav>

            <div className="mt-7 grid gap-x-10 gap-y-7 md:mt-11 md:grid-cols-12 md:items-end">
              <div className="min-w-0 md:col-span-8">
                {/* No season chip and no status label above the name (owner, 2026-11-16). */}
                <h1
                  className="text-balance font-bold italic leading-[0.94] tracking-[-0.025em] [overflow-wrap:anywhere]"
                  style={{ fontSize: "clamp(2.5rem, 7vw, 5.75rem)" }}
                >
                  {base.name}
                </h1>
                {head.kind === "champion" ? (
                  <ChampionPlate team={head.team} />
                ) : (
                  <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-[#F3EFE6]/80 md:mt-7 md:text-lg">
                    <State head={head} />
                  </p>
                )}
              </div>

              {/* Beside the name: the emblem as it is, and three counts under it (next to it on a phone). */}
              <aside className="flex min-w-0 items-center gap-4 md:col-span-4 md:flex-col md:items-stretch md:gap-7">
                {base.logo ? (
                  <div className="relative h-[4.75rem] w-[4.75rem] shrink-0 md:h-44 md:w-full">
                    <TournamentImage
                      src={base.logo}
                      alt=""
                      fill
                      objectFit="contain"
                      sizes="(min-width: 768px) 360px, 120px"
                      priority
                      animate={false}
                    />
                  </div>
                ) : null}
                <dl
                  className={`grid min-w-0 flex-1 grid-cols-3 ${SURFACE} md:flex-none`}
                  style={{ boxShadow: layers("#fb923c") }}
                >
                  {counts.map((c, index) => (
                    <div
                      key={c.label}
                      className={`flex flex-col items-center gap-1.5 px-1 py-3 md:py-3.5 ${
                        index > 0 ? "border-l border-[#F3EFE6]/20" : ""
                      }`}
                    >
                      <dt className={`${LABEL} text-[#F3EFE6]/65`}>{c.label}</dt>
                      <dd className="order-first flex h-7 items-baseline text-2xl font-bold leading-7 tabular-nums md:text-[1.75rem]">
                        {c.value}
                        {c.of !== null ? (
                          <span className="text-base font-normal leading-none text-[#F3EFE6]/55">/{c.of}</span>
                        ) : null}
                      </dd>
                    </div>
                  ))}
                </dl>
              </aside>
            </div>
          </div>
        </header>

        <Ticker matches={upcoming} />

        <div className="mx-auto max-w-[1320px] px-4 md:px-6">
          <div className="pt-6 md:pt-8">
            <Tabs tabs={tabs} />
          </div>
          <main className="pb-14 pt-8 md:pb-20 md:pt-11">{children}</main>
        </div>

        <footer className={`border-t ${LINE}`}>
          <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-x-6 gap-y-4 px-4 py-6 md:px-6">
            <p className={`${LABEL} text-[#F3EFE6]/65`}>
              {base.name}
              {base.season ? `, σεζόν ${base.season.display}` : ""}
            </p>
            <Link href="/tournaments" className={BUTTON}>
              Όλες οι διοργανώσεις
            </Link>
          </div>
        </footer>
      </div>
    </ProfileHost>
  );
}
