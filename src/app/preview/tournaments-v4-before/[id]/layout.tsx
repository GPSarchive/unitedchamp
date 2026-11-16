// Preview route — tournament page v4: the split into tabs of tournaments-v3
// (one thing per page: table, knockout tree, matches, players, teams) wearing
// the look of the live page — its dark ground with the orange and purple
// glows, the big italic name with the tilted emblem beside it, the orange
// strip of next matches, numbered tables, bordered panels with small tracked
// labels. The players are on the new cards.
//
//   (this address)  the table(s), with the next and the latest matches beside
//   /matches        the programme and the results, by round
//   /bracket        the knockout tree
//   /players        the scorers, and the tournament's leaders on the big card
//   /teams          every team, opening to its squad in the new player cards
//
// What the tournament is and what its pages show come from tournaments-v3
// (data.ts, model.ts); only the drawing is here.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JetBrains_Mono } from "next/font/google";
import { TournamentImage } from "@/app/lib/OptimizedImage";
import { formatMatchDate, nowWallClockIso } from "@/app/lib/datetime";
import { ProfileHost } from "@/app/paiktes/ProfileHost";
import { loadBase, loadTables } from "../../tournaments-v3/[id]/data";
import { headline, splitMatches, type Headline, type TTeam } from "../../tournaments-v3/[id]/model";
import styles from "./dispatch.module.css";
import { loadColours } from "./extra";
import { TEAM_PATH, TOURNAMENT_PATH } from "./paths";
import Tabs, { type Tab } from "./Tabs";
import Ticker from "./Ticker";
import { BUTTON, FOCUS, LABEL } from "./tokens";
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

// The old page asked for this face and never got it (its class did not reach
// the labels, which fell back to the device's own monospace).
const mono = JetBrains_Mono({
  subsets: ["latin", "greek"],
  weight: ["400", "700"],
  variable: "--f-mono",
  display: "swap",
});

/** How many matches the moving strip carries. */
const IN_TICKER = 10;

const SAFFRON = "#E8B931";

const TEAM_LINK = `font-bold text-[#F3EFE6] underline decoration-[#fb923c] decoration-2 underline-offset-4 hover:text-[#fb923c] ${FOCUS}`;

/** Where the tournament stands, in a sentence. */
function State({ head }: { head: Headline }) {
  if (head.kind === "champion") {
    return (
      <>
        Ολοκληρώθηκε. Πρωταθλήτρια:{" "}
        <Link href={`${TEAM_PATH}/${head.team.id}`} className={TEAM_LINK}>
          {head.team.name}
        </Link>
        .
      </>
    );
  }
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

/** The winner's plate: tilted the other way from the emblem, on a hard shadow in the team's colour. */
function ChampionPlate({ team, colour }: { team: TTeam; colour: string }) {
  return (
    <Link
      href={`${TEAM_PATH}/${team.id}`}
      className={`relative col-span-full block rotate-[1.5deg] border-2 border-[#F3EFE6]/20 bg-[#13131d] ${FOCUS}`}
      style={{ boxShadow: `8px 8px 0 0 ${colour}` }}
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-1.5" style={{ background: colour }} />
      <span
        className={`${LABEL} block border-b-2 border-[#F3EFE6]/15 bg-[#0a0a14]/60 py-2 pl-5 pr-4 font-bold`}
        style={{ color: SAFFRON }}
      >
        Πρωταθλήτρια
      </span>
      <span className="flex items-center gap-4 py-4 pl-5 pr-4">
        <Crest team={team} className="h-14 w-14 text-xl" sizes="56px" />
        <span className="min-w-0 text-2xl font-bold italic leading-none [overflow-wrap:anywhere] md:text-[1.7rem]">
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
  const [tables, colours] = await Promise.all([loadTables(id), loadColours(id)]);

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

  const finished = base.matches.filter((m) => m.status === "finished");
  const goals = finished.reduce((sum, m) => sum + (m.score ? m.score.a + m.score.b : 0), 0);
  const counts = [
    { label: "Ομάδες", value: base.teams.length, of: null as number | null },
    { label: "Αγώνες", value: finished.length, of: finished.length < base.matches.length ? base.matches.length : null },
    { label: "Γκολ", value: goals, of: null },
  ];
  const upcoming = splitMatches(base.matches, nowWallClockIso()).upcoming.slice(0, IN_TICKER);

  /** The three counts stand side by side on a phone too, when no emblem takes half the row. */
  const across = !base.logo;

  const [first, ...rest] = base.name.split(/\s+/);

  return (
    <ProfileHost>
      <div className={`${mono.variable} relative isolate min-h-screen overflow-x-hidden text-[#F3EFE6] selection:bg-[#fb923c] selection:text-[#0a0a14]`}>
        <div aria-hidden className={styles.ground} />

        {/* The line across the top: where this page is. (No season, no status label: owner, 2026-11-16.) */}
        <div className="border-b-2 border-[#F3EFE6]/20 bg-[#0a0a14]/70">
          <div className={`${LABEL} mx-auto flex max-w-[1320px] items-center justify-between gap-4 px-4 py-2.5 md:px-6`}>
            <nav aria-label="Διαδρομή" className="flex min-w-0 items-center gap-2 text-[#F3EFE6]/65">
              <Link href="/" className={`hover:text-[#fb923c] ${FOCUS}`}>
                Αρχική
              </Link>
              <span aria-hidden>/</span>
              <Link href="/tournaments" className={`hover:text-[#fb923c] ${FOCUS}`}>
                Διοργανώσεις
              </Link>
            </nav>
          </div>
        </div>

        <header className="relative overflow-hidden border-b-2 border-[#F3EFE6]/20">
          {/* The name once more, enormous and barely there, behind everything. */}
          <span
            aria-hidden
            className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 select-none whitespace-nowrap font-bold italic leading-none tracking-tighter text-[#F3EFE6] opacity-[0.05]"
            style={{ fontSize: "clamp(11rem, 27vw, 28rem)" }}
          >
            {base.name}
          </span>

          <div className="relative mx-auto grid max-w-[1320px] gap-x-10 gap-y-9 px-4 pb-10 pt-8 md:grid-cols-12 md:px-6 md:pb-16 md:pt-14">
            <div className="min-w-0 md:col-span-8">
              <h1
                className="font-bold leading-[0.88] tracking-[-0.03em] [overflow-wrap:anywhere]"
                style={{ fontSize: "clamp(2.75rem, 8.5vw, 7.5rem)" }}
              >
                <span className="block italic">{first}</span>
                {rest.length > 0 ? <span className="block text-[#F3EFE6]/90">{rest.join(" ")}</span> : null}
              </h1>
              <div className="mt-7 flex items-start gap-4">
                <span aria-hidden className="mt-3 h-[2px] w-10 shrink-0 bg-[#fb923c] md:w-14" />
                <p className="max-w-xl text-[17px] leading-relaxed text-[#F3EFE6]/80 md:text-lg">
                  <State head={head} />
                </p>
              </div>
            </div>

            {/* Beside the name: the emblem on its orange shadow, three counts, and the winner's plate. */}
            <aside
              className={`grid content-start items-center gap-x-6 gap-y-5 md:col-span-4 md:grid-cols-1 ${
                base.logo ? "grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)]" : ""
              }`}
            >
              {base.logo ? (
                <div className="-rotate-[1.5deg] border-2 border-[#F3EFE6]/20 bg-[#0a0a14] p-4 shadow-[6px_6px_0_0_#fb923c] md:p-6 md:shadow-[8px_8px_0_0_#fb923c]">
                  <div className="relative h-24 md:h-40">
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
                </div>
              ) : null}
              {/* Three across; on a phone with the emblem beside them, one under the other. */}
              <dl className={`grid border-2 border-[#F3EFE6]/20 bg-[#0a0a14] ${across ? "grid-cols-3" : "md:grid-cols-3"}`}>
                {counts.map((c, index) => (
                  <div
                    key={c.label}
                    className={`flex gap-x-3 gap-y-1.5 md:flex-col md:items-center md:p-3 ${
                      across ? "flex-col items-center p-3" : "items-baseline justify-between px-3 py-2"
                    } ${
                      index < counts.length - 1
                        ? `border-[#F3EFE6]/20 ${across ? "border-r-2" : "border-b-2 md:border-b-0 md:border-r-2"}`
                        : ""
                    }`}
                  >
                    <dt className={`${LABEL} text-[10px] text-[#F3EFE6]/60`}>{c.label}</dt>
                    <dd className="order-first text-2xl leading-none tabular-nums md:text-[1.7rem]">
                      {c.value}
                      {c.of !== null ? <span className="text-base text-[#F3EFE6]/45">/{c.of}</span> : null}
                    </dd>
                  </div>
                ))}
              </dl>
              {base.winner ? (
                <ChampionPlate team={base.winner} colour={colours.get(base.winner.id) ?? SAFFRON} />
              ) : null}
            </aside>
          </div>
        </header>

        <Ticker matches={upcoming} />

        <div className="mx-auto max-w-[1320px] px-4 md:px-6">
          <div className="pt-6 md:pt-8">
            <Tabs tabs={tabs} />
          </div>
          <main className="pb-14 pt-9 md:pb-20 md:pt-12">{children}</main>
        </div>

        <footer className="border-t-2 border-[#F3EFE6]/20 bg-[#13131d]">
          <div className="mx-auto flex max-w-[1320px] flex-col items-start justify-between gap-6 px-4 py-9 md:flex-row md:items-end md:px-6">
            <p className="text-3xl font-bold italic leading-none [overflow-wrap:anywhere] md:text-4xl">{base.name}</p>
            <div className="flex flex-col items-start gap-3 md:items-end">
              {base.season ? <p className={`${LABEL} text-[#F3EFE6]/60`}>Σεζόν {base.season.display}</p> : null}
              <Link href="/tournaments" className={BUTTON}>
                Όλες οι διοργανώσεις
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </ProfileHost>
  );
}
