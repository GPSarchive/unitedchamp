// app/geniki-katataxi/page.tsx
// Γενική Κατάταξη — per-season overall team standings, computed by the points engine
// in ./points.ts. Styled to match the editorial theme of /OMADES and /paiktes.
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import {
  computeGeneralStandings,
  NO_SEASON_LABEL,
  POINTS,
  type TeamSeasonLine,
} from "./points";
import PointsLog, { type LogTeam } from "./PointsLog";
import { Fraunces, Archivo_Black, JetBrains_Mono, Figtree } from "next/font/google";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Γενική Κατάταξη",
  description: "Η γενική κατάταξη των ομάδων ανά σεζόν, με ενιαίο σύστημα πόντων.",
};

// ───────────────────────────────────────────────────────────────────────
// Typography (same set as /OMADES)
// ───────────────────────────────────────────────────────────────────────
const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600", "700", "900"],
  style: ["normal", "italic"],
  variable: "--f-display",
  display: "swap",
});
const archivoBlack = Archivo_Black({
  subsets: ["latin", "latin-ext"],
  weight: ["400"],
  variable: "--f-brutal",
  display: "swap",
});
const jetbrains = JetBrains_Mono({
  subsets: ["latin", "greek"],
  weight: ["400", "500", "700"],
  variable: "--f-mono",
  display: "swap",
});
const figtree = Figtree({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--f-body",
  display: "swap",
});

const pad2 = (n: number | string) => String(n).padStart(2, "0");
const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

// ───────────────────────────────────────────────────────────────────────
// Atmosphere
// ───────────────────────────────────────────────────────────────────────
function PaperBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 20% 0%, #1a1a2e 0%, #0a0a14 45%, #08080f 100%)",
        }}
      />
      <div
        className="absolute -top-40 -left-40 h-[60rem] w-[60rem] rounded-full opacity-[0.18] blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, #fb923c 0%, rgba(251,146,60,0) 70%)",
        }}
      />
      <div
        className="absolute -bottom-60 -right-40 h-[55rem] w-[55rem] rounded-full opacity-[0.14] blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, #a855f7 0%, rgba(168,85,247,0) 70%)",
        }}
      />
      <svg className="absolute inset-0 h-full w-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="katataxigrid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#F3EFE6" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#katataxigrid)" />
      </svg>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${fraunces.variable} ${archivoBlack.variable} ${jetbrains.variable} ${figtree.variable} relative min-h-screen text-[#F3EFE6] font-[var(--f-body)] selection:bg-[#fb923c] selection:text-[#0a0a14]`}
    >
      <PaperBackground />
      {children}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Header
// ───────────────────────────────────────────────────────────────────────
function PageHeader({ season, teamCount }: { season: string; teamCount: number }) {
  return (
    <header className="relative border-b-2 border-[#F3EFE6]/20">
      <div className="mx-auto max-w-[1400px] px-6 pt-8 pb-6 md:pt-10 md:pb-8">
        <nav className="mb-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[#F3EFE6]/55">
          <Link href="/" className="hover:text-[#fb923c] transition-colors">
            Αρχική
          </Link>
          <span>/</span>
          <span className="text-[#F3EFE6]">Γενική Κατάταξη</span>
        </nav>

        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.3em] text-[#fb923c]">
              <span className="h-[2px] w-8 bg-[#fb923c]" />
              Ανά έτος · Ενιαίο σύστημα πόντων
            </div>
            <h1
              className="mt-2 font-[var(--f-display)] font-black italic leading-[0.9] tracking-[-0.02em] text-[#F3EFE6]"
              style={{ fontSize: "clamp(2.25rem, 5.5vw, 4rem)" }}
            >
              Γενική Κατάταξη
            </h1>
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-[#F3EFE6]/70">
            <span className="border border-[#F3EFE6]/20 bg-[#13131d] px-2.5 py-1">
              Σεζόν · {season}
            </span>
            <span className="border border-[#F3EFE6]/20 bg-[#13131d] px-2.5 py-1">
              Ομάδες · {pad2(teamCount)}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Season picker (server-rendered links)
// ───────────────────────────────────────────────────────────────────────
function SeasonTabs({ seasons, active }: { seasons: string[]; active: string }) {
  if (seasons.length <= 1) return null;
  return (
    <div className="mb-8 flex flex-wrap items-center gap-2">
      <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.25em] text-[#F3EFE6]/55">
        Σεζόν
      </span>
      {seasons.map((s) => {
        const isActive = s === active;
        return (
          <Link
            key={s}
            href={`/geniki-katataxi?season=${encodeURIComponent(s)}`}
            className={`border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.2em] transition-colors ${
              isActive
                ? "border-[#fb923c] bg-[#fb923c] text-[#0a0a14]"
                : "border-[#F3EFE6]/25 bg-[#13131d] text-[#F3EFE6]/75 hover:border-[#fb923c]/60 hover:text-[#fb923c]"
            }`}
          >
            {s}
          </Link>
        );
      })}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Points system legend
// ───────────────────────────────────────────────────────────────────────
const RULES: Array<{ label: string; pts: number; manual?: boolean }> = [
  { label: "Συμμετοχή σε τουρνουά", pts: POINTS.participation },
  { label: "Πρόκριση σε επόμενη φάση", pts: POINTS.qualification },
  { label: "Νικητής τουρνουά", pts: POINTS.tournamentWinner },
  { label: "Διεκδικητής (φιναλίστ)", pts: POINTS.runnerUp },
  { label: "Διεθνής διάκριση", pts: POINTS.international, manual: true },
  { label: "Διεθνής συμμετοχή", pts: POINTS.internationalParticipation, manual: true },
  { label: "Νίκη", pts: POINTS.win },
  { label: "Ισοπαλία", pts: POINTS.draw },
  { label: "Ήττα", pts: POINTS.loss },
  { label: "Αποχώρηση από τουρνουά", pts: POINTS.withdrawal, manual: true },
  { label: "Διακοπή αγώνα (υπαίτιος)", pts: POINTS.abandonment, manual: true },
];

function PointsLegend() {
  return (
    <section className="mb-10 border-2 border-[#F3EFE6]/20 bg-[#13131d]/60">
      <div className="flex items-center justify-between border-b border-[#F3EFE6]/15 px-5 py-3">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.3em] text-[#fb923c]">
          Σύστημα πόντων
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#F3EFE6]/45">
          Η κατάταξη μηδενίζει κάθε σεζόν
        </span>
      </div>
      <div className="grid grid-cols-2 gap-px bg-[#F3EFE6]/10 sm:grid-cols-3 lg:grid-cols-5">
        {RULES.map((r) => (
          <div key={r.label} className="flex flex-col gap-1 bg-[#0f0f19] px-4 py-3">
            <span className="text-[13px] leading-snug text-[#F3EFE6]/80">
              {r.label}
              {r.manual && <span className="text-[#fb923c]"> *</span>}
            </span>
            <span
              className={`font-mono text-lg font-bold tabular-nums ${
                r.pts >= 0 ? "text-[#F3EFE6]" : "text-red-400"
              }`}
            >
              {signed(r.pts)}
            </span>
          </div>
        ))}
      </div>
      <p className="border-t border-[#F3EFE6]/15 px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.15em] text-[#F3EFE6]/45">
        * Καταχωρείται χειροκίνητα από τη διοργάνωση
      </p>
    </section>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Standings table
// ───────────────────────────────────────────────────────────────────────
type TeamInfo = { id: number; name: string | null; logo: string | null };

function StandingsTable({
  lines,
  teams,
}: {
  lines: Array<TeamSeasonLine & { rank: number }>;
  teams: Map<number, TeamInfo>;
}) {
  const th =
    "px-3 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-[#F3EFE6]/55";
  return (
    <section className="border-2 border-[#F3EFE6]/20 bg-[#0f0f19]/70">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b-2 border-[#F3EFE6]/20 bg-[#13131d]">
              <th className={`${th} w-12 text-left`}>#</th>
              <th className={`${th} text-left`}>Ομάδα</th>
              <th className={`${th} text-center`} title="Συμμετοχές σε τουρνουά">Συμ.</th>
              <th className={`${th} text-center`} title="Προκρίσεις">Προκ.</th>
              <th className={`${th} text-center`} title="Τίτλοι (νικητής τουρνουά)">Τίτλοι</th>
              <th className={`${th} text-center`} title="Διεκδικητής (φιναλίστ)">Τελικοί</th>
              <th className={`${th} text-center`} title="Νίκες">Ν</th>
              <th className={`${th} text-center`} title="Ισοπαλίες">Ι</th>
              <th className={`${th} text-center`} title="Ήττες">Η</th>
              <th className={`${th} text-center`} title="Χειροκίνητες προσαρμογές">Έξτρα</th>
              <th className={`${th} text-right`}>Πόντοι</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((r) => {
              const team = teams.get(r.teamId);
              const name = team?.name ?? `Ομάδα #${r.teamId}`;
              const podium = r.rank <= 3;
              return (
                <tr
                  key={r.teamId}
                  className={`border-b border-[#F3EFE6]/10 transition-colors hover:bg-[#fb923c]/[0.06] ${
                    podium ? "bg-[#fb923c]/[0.05]" : ""
                  }`}
                >
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-flex h-7 w-7 items-center justify-center border font-mono text-[11px] font-bold tabular-nums ${
                        podium
                          ? "border-[#fb923c]/70 bg-[#fb923c]/15 text-[#fb923c]"
                          : "border-[#F3EFE6]/15 text-[#F3EFE6]/70"
                      }`}
                    >
                      {pad2(r.rank)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/OMADA/${r.teamId}`}
                      className="group flex items-center gap-3"
                    >
                      {team?.logo ? (
                        <Image
                          src={team.logo}
                          alt={name}
                          width={26}
                          height={26}
                          className="h-[26px] w-[26px] rounded-sm object-cover"
                        />
                      ) : (
                        <div className="h-[26px] w-[26px] rounded-sm border border-[#F3EFE6]/15 bg-[#13131d]" />
                      )}
                      <span className="font-medium text-[#F3EFE6] transition-colors group-hover:text-[#fb923c]">
                        {name}
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-center tabular-nums text-[#F3EFE6]/75">
                    {r.participations}
                  </td>
                  <td className="px-3 py-2.5 text-center tabular-nums text-[#F3EFE6]/75">
                    {r.qualifications}
                  </td>
                  <td className="px-3 py-2.5 text-center tabular-nums">
                    {r.titles > 0 ? (
                      <span className="font-bold text-[#fb923c]">{r.titles}</span>
                    ) : (
                      <span className="text-[#F3EFE6]/35">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center tabular-nums">
                    {r.runnerUps > 0 ? (
                      <span className="text-[#F3EFE6]/90">{r.runnerUps}</span>
                    ) : (
                      <span className="text-[#F3EFE6]/35">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center tabular-nums text-[#F3EFE6]/90">
                    {r.wins}
                  </td>
                  <td className="px-3 py-2.5 text-center tabular-nums text-[#F3EFE6]/75">
                    {r.draws}
                  </td>
                  <td className="px-3 py-2.5 text-center tabular-nums text-[#F3EFE6]/75">
                    {r.losses}
                  </td>
                  <td className="px-3 py-2.5 text-center tabular-nums">
                    {r.adjustmentCount > 0 ? (
                      <span
                        className={r.adjustmentPoints >= 0 ? "text-[#F3EFE6]/90" : "text-red-400"}
                      >
                        {signed(r.adjustmentPoints)}
                      </span>
                    ) : (
                      <span className="text-[#F3EFE6]/35">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span
                      className={`font-mono text-base font-bold tabular-nums ${
                        podium ? "text-[#fb923c]" : "text-[#F3EFE6]"
                      }`}
                    >
                      {r.points}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function StateBlock({ kicker, title, body }: { kicker: string; title: string; body: string }) {
  return (
    <div
      className="relative border-2 border-dashed border-[#F3EFE6]/25 p-12 text-center"
      style={{ background: "rgba(19,19,29,0.4)" }}
    >
      <div className="mx-auto max-w-md">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#fb923c]">
          / 00 · {kicker}
        </span>
        <p className="mt-4 font-[var(--f-display)] text-3xl font-black italic leading-tight text-[#F3EFE6]">
          {title}
        </p>
        <p className="mt-3 font-[var(--f-body)] text-sm text-[#F3EFE6]/60">{body}</p>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Page
// ───────────────────────────────────────────────────────────────────────
export default async function GenikiKataxiPage({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const requested = (Array.isArray(sp.season) ? sp.season[0] : sp.season)?.trim();

  const [standings, teamsRes] = await Promise.all([
    computeGeneralStandings(),
    supabaseAdmin.from("teams").select("id, name, logo"),
  ]);

  const teams = new Map<number, TeamInfo>(
    ((teamsRes.data ?? []) as TeamInfo[]).map((t) => [t.id, t])
  );

  const season =
    requested && standings.seasons.includes(requested)
      ? requested
      : standings.seasons.find((s) => s !== NO_SEASON_LABEL) ?? standings.seasons[0] ?? "—";

  const lines = standings.bySeason.get(season) ?? [];
  // Public log: hide the admin's counter-adjustment rows (they'd read as stray
  // "+X/−X" lines); cancelled automatic events are shown struck-through by PointsLog.
  const seasonEvents = standings.events.filter(
    (e) => e.season === season && !e.cancelsSourceKey
  );
  const logTeams: Record<number, LogTeam> = Object.fromEntries(
    [...teams].map(([id, t]) => [id, { name: t.name ?? `Ομάδα #${id}`, logo: t.logo }])
  );

  // Dense rank: teams with equal points share a rank.
  let lastPts: number | null = null;
  let rank = 0;
  const ranked = lines.map((l) => {
    if (lastPts === null || l.points !== lastPts) {
      rank += 1;
      lastPts = l.points;
    }
    return { ...l, rank };
  });

  return (
    <Shell>
      <PageHeader season={season} teamCount={ranked.length} />

      <section className="relative">
        <div className="mx-auto max-w-[1400px] px-6 py-10 md:py-14">
          <SeasonTabs seasons={standings.seasons} active={season} />

          <PointsLegend />

          {ranked.length === 0 ? (
            <StateBlock
              kicker="Κατάταξη"
              title="Δεν υπάρχουν δεδομένα"
              body="Η γενική κατάταξη θα εμφανιστεί μόλις ολοκληρωθούν οι πρώτοι αγώνες της σεζόν."
            />
          ) : (
            <>
              <StandingsTable lines={ranked} teams={teams} />
              <PointsLog events={seasonEvents} teams={logTeams} />
            </>
          )}

          <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.15em] text-[#F3EFE6]/40">
            Οι πόντοι υπολογίζονται αυτόματα από τα τουρνουά και τους αγώνες κάθε σεζόν.
            {!standings.adjustmentsAvailable &&
              " · Οι χειροκίνητες προσαρμογές θα ενεργοποιηθούν με την επόμενη ενημέρωση της βάσης."}
          </p>
        </div>
      </section>

      <footer className="border-t-2 border-[#F3EFE6]/20 bg-[#13131d] text-[#F3EFE6]">
        <div className="mx-auto flex max-w-[1400px] flex-col items-start justify-between gap-4 px-6 py-6 md:flex-row md:items-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#F3EFE6]/60">
            Γενική Κατάταξη · Σεζόν {season}
          </p>
          <Link
            href="/"
            className="border border-[#F3EFE6]/30 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.25em] text-[#F3EFE6] hover:bg-[#F3EFE6] hover:text-[#0a0a14] transition-colors"
          >
            ← Επιστροφή στην Αρχική
          </Link>
        </div>
      </footer>
    </Shell>
  );
}
