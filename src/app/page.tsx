// app/page.tsx — UltraChamp home page (editorial language).

export const revalidate = 300; // ISR — regenerate every 5 minutes

import React, { Suspense } from "react";
import Link from "next/link";
import { Fraunces, Archivo_Black, JetBrains_Mono, Figtree } from "next/font/google";
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import { fetchRecentNewsCount } from "@/app/lib/fetchRecentNewsCount";
import { Trophy, Users, BarChart3 } from "lucide-react";
import { MatchRowRaw, CalendarEvent, normalizeTeam } from "@/app/lib/types";
import { resolveImageUrl, ImageType } from "@/app/lib/image-config";
import type { Tournament } from "@/app/tournaments/useTournamentData";
import { signTournamentLogos } from "@/app/tournaments/signTournamentLogos";

// Existing home wrappers (backgrounds kept for Welcome / Videos / Features / Testimonials)
import HomeHero from "@/app/home/HomeHero";
import GridBgSection from "@/app/home/GridBgSection";
import VantaSection from "@/app/home/VantaSection";
import HomeArticles from "@/app/home/HomeArticles";
import HomeVideos from "@/app/home/HomeVideos";
import LeftSideBubbles from "@/app/home/LeftSideBubbles";

// Editorial components (promoted from preview/home-b)
import EditorialTeamDashboard from "@/app/home/EditorialTeamDashboard";
import EditorialCalendar from "@/app/home/EditorialCalendar";
import EditorialTournamentsGrid from "@/app/home/EditorialTournamentsGrid";
import EditorialTopPlayersSection from "@/app/home/EditorialTopPlayersSection";

// ───────────────────────────────────────────────────────────────────────
// Editorial typography stack (same as /tournaments)
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

// ───────────────────────────────────────────────────────────────────────
// PaperBgSection — shared editorial background matching /tournaments, /paiktes.
// Used for sections lifted out of Vanta (Articles, Top Players, Tournaments CTA).
// ───────────────────────────────────────────────────────────────────────
const PaperBgSection: React.FC<React.PropsWithChildren<{ className?: string }>> = ({
  className = "",
  children,
}) => (
  <section className={`relative isolate overflow-hidden ${className}`}>
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 20% 0%, #1a1a2e 0%, #0a0a14 45%, #08080f 100%)",
        }}
      />
      <div
        className="absolute -top-40 -left-40 h-[55rem] w-[55rem] rounded-full opacity-[0.18] blur-3xl"
        style={{
          background: "radial-gradient(closest-side, #fb923c 0%, rgba(251,146,60,0) 70%)",
        }}
      />
      <div
        className="absolute -bottom-60 -right-40 h-[50rem] w-[50rem] rounded-full opacity-[0.14] blur-3xl"
        style={{
          background: "radial-gradient(closest-side, #a855f7 0%, rgba(168,85,247,0) 70%)",
        }}
      />
      <svg className="absolute inset-0 h-full w-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="pbsg" width="48" height="48" patternUnits="userSpaceOnUse">
            <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#F3EFE6" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#pbsg)" />
      </svg>
      <svg className="absolute inset-0 h-full w-full mix-blend-screen opacity-[0.08]" xmlns="http://www.w3.org/2000/svg">
        <filter id="pbsn">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.4 0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#pbsn)" />
      </svg>
    </div>
    {children}
  </section>
);

// ───────────────────────────────────────────────────────────────────────
// Reusable editorial section header
// ───────────────────────────────────────────────────────────────────────
const SectionHeader: React.FC<{
  eyebrow: string;
  title: string;
  subtitle?: string;
  align?: "left" | "center";
}> = ({ eyebrow, title, subtitle, align = "center" }) => (
  <div
    className={`mb-10 md:mb-14 flex flex-col ${
      align === "center" ? "items-center text-center" : "items-start"
    }`}
  >
    <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.3em] text-[#fb923c] mb-3">
      <span className="h-[2px] w-8 bg-[#fb923c]" />
      {eyebrow}
    </div>
    <h2
      className="font-[var(--f-display)] font-black italic leading-[0.95] tracking-[-0.02em] text-white"
      style={{ fontSize: "clamp(1.75rem, 4.5vw, 3.25rem)" }}
    >
      {title}
    </h2>
    {subtitle && (
      <p
        className={`mt-5 max-w-2xl text-white/75 text-base md:text-lg leading-relaxed ${
          align === "center" ? "mx-auto" : ""
        }`}
      >
        {subtitle}
      </p>
    )}
  </div>
);

// ───────────────────────────────────────────────────────────────────────
// Date helpers — preserve wall-clock time from DB and drop timezone
// ───────────────────────────────────────────────────────────────────────
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/;
const pad2 = (n: number) => String(n).padStart(2, "0");
function parseIsoPreserveClock(iso: string) {
  const m = ISO_RE.exec(iso);
  if (!m) throw new Error(`Unrecognized ISO datetime: ${iso}`);
  const [, y, M, d, h, min, s] = m;
  return { y: +y, M: +M, d: +d, h: +h, min: +min, s: +s };
}
function toTimestampNoTz(iso: string) {
  const { y, M, d, h, min, s } = parseIsoPreserveClock(iso);
  return `${y}-${pad2(M)}-${pad2(d)} ${pad2(h)}:${pad2(min)}:${pad2(s)}`;
}
function toNaiveIso(iso: string) {
  return toTimestampNoTz(iso).replace(" ", "T");
}
function daysInMonth(y: number, M: number) {
  return new Date(y, M, 0).getDate();
}
function addMinutesNaive(
  parts: { y: number; M: number; d: number; h: number; min: number; s: number },
  deltaMin: number
) {
  const start = parts.h * 60 + parts.min;
  const total = start + deltaMin;
  let dayDelta = Math.floor(total / 1440);
  let minutesInDay = total % 1440;
  if (minutesInDay < 0) {
    minutesInDay += 1440;
    dayDelta -= 1;
  }
  let h = Math.floor(minutesInDay / 60);
  let min = minutesInDay % 60;
  let { y, M, d } = parts;
  d += dayDelta;
  while (true) {
    const dim = daysInMonth(y, M);
    if (d <= dim) break;
    d -= dim;
    M += 1;
    if (M > 12) {
      M = 1;
      y += 1;
    }
  }
  return { y, M, d, h, min, s: parts.s };
}
function partsToIso(
  parts: { y: number; M: number; d: number; h: number; min: number; s: number },
  T: "T" | " " = "T"
) {
  const { y, M, d, h, min, s } = parts;
  return `${y}-${pad2(M)}-${pad2(d)}${T}${pad2(h)}:${pad2(min)}:${pad2(s)}`;
}

// ───────────────────────────────────────────────────────────────────────
// Data fetchers
// ───────────────────────────────────────────────────────────────────────
async function fetchMatchesWithTeams() {
  type SupaResp = { data: MatchRowRaw[] | null; error: { message: string } | null };
  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setDate(now.getDate() - 60);
  const windowEnd = new Date(now);
  windowEnd.setDate(now.getDate() + 90);
  const { data, error } = (await supabaseAdmin
    .from("matches")
    .select(
      `
      id, match_date, team_a_id, team_b_id, team_a_score, team_b_score,
      status, stage_id, group_id, matchday, round,
      teamA:teams!matches_team_a_id_fkey (name, logo),
      teamB:teams!matches_team_b_id_fkey (name, logo),
      tournament:tournament_id (id, name, logo)
    `
    )
    .gte("match_date", windowStart.toISOString())
    .lte("match_date", windowEnd.toISOString())
    .order("match_date", { ascending: true })
    .order("id", { ascending: true })) as unknown as SupaResp;
  return { rawMatches: data ?? [], matchesError: error };
}

async function fetchTournaments() {
  const { data, error } = await supabaseAdmin
    .from("tournaments")
    .select(
      `id, name, slug, format, season, logo, status, winner_team_id,
       tournament_teams(count), matches(count)`
    )
    .order("id", { ascending: false })
    .limit(6);
  if (error) return { tournaments: [] as Tournament[] };
  const withCounts = (data ?? []).map((t: any) => ({
    ...t,
    teams_count: String(t.tournament_teams?.[0]?.count ?? 0),
    matches_count: String(t.matches?.[0]?.count ?? 0),
    tournament_teams: undefined,
    matches: undefined,
  }));
  const signed = await signTournamentLogos(withCounts as Tournament[]);
  return { tournaments: signed };
}

async function fetchVideoMatches() {
  const { data, error } = await supabaseAdmin
    .from("matches")
    .select(
      `
      id, video_url, match_date, team_a_score, team_b_score,
      teamA:teams!matches_team_a_id_fkey (name, logo),
      teamB:teams!matches_team_b_id_fkey (name, logo),
      tournament:tournament_id (name)
    `
    )
    .not("video_url", "is", null)
    .neq("video_url", "")
    .order("match_date", { ascending: false })
    .order("id", { ascending: false })
    .limit(20);
  if (error || !data) return { videoMatches: [] };
  const videoMatches = data.map((m: any) => {
    const a = normalizeTeam(m.teamA);
    const b = normalizeTeam(m.teamB);
    return {
      id: m.id,
      video_url: m.video_url,
      team_a_name: a?.name ?? null,
      team_b_name: b?.name ?? null,
      team_a_logo: a?.logo ? resolveImageUrl(a.logo, ImageType.TEAM) : null,
      team_b_logo: b?.logo ? resolveImageUrl(b.logo, ImageType.TEAM) : null,
      team_a_score: m.team_a_score ?? null,
      team_b_score: m.team_b_score ?? null,
      match_date: m.match_date ?? null,
      tournament_name: m.tournament?.name ?? null,
    };
  });
  return { videoMatches };
}

function matchRowToEvent(m: MatchRowRaw): CalendarEvent | null {
  if (!m.match_date) return null;
  const a = normalizeTeam(m.teamA);
  const b = normalizeTeam(m.teamB);
  const startIso = toNaiveIso(m.match_date);
  const startParts = parseIsoPreserveClock(m.match_date);
  const endParts = addMinutesNaive(startParts, 50);
  const endIso = partsToIso(endParts, "T");
  const teamAScore = (m as any).team_a_score ?? null;
  const teamBScore = (m as any).team_b_score ?? null;
  const status = (m as any).status ?? null;
  const tournament = (m as any).tournament ?? null;
  return {
    id: String(m.id),
    title: `${a?.name ?? "Άγνωστο"} vs ${b?.name ?? "Άγνωστο"}`,
    start: startIso,
    end: endIso,
    all_day: false,
    teams: [a?.name ?? "Άγνωστο", b?.name ?? "Άγνωστο"],
    logos: [a?.logo ?? "/placeholder.png", b?.logo ?? "/placeholder.png"],
    status,
    home_score: teamAScore,
    away_score: teamBScore,
    score:
      typeof teamAScore === "number" && typeof teamBScore === "number"
        ? [teamAScore, teamBScore]
        : undefined,
    tournament_name: tournament?.name ?? null,
    tournament_logo: tournament?.logo ?? null,
    matchday: (m as any).matchday ?? null,
    round: (m as any).round ?? null,
  } as any;
}
function mapMatchesToEvents(rows: MatchRowRaw[]): CalendarEvent[] {
  return rows.map(matchRowToEvent).filter((e): e is CalendarEvent => e !== null);
}
function resolveMatchTournamentLogos(events: CalendarEvent[]): CalendarEvent[] {
  return events.map((e: any) => {
    if (e.tournament_logo) {
      return { ...e, tournament_logo: resolveImageUrl(e.tournament_logo, ImageType.TOURNAMENT) };
    }
    return e;
  });
}

// ───────────────────────────────────────────────────────────────────────
// Page
// ───────────────────────────────────────────────────────────────────────
export default async function Home() {
  const [{ rawMatches }, { tournaments }, recentContentCount, { videoMatches }] = await Promise.all([
    fetchMatchesWithTeams(),
    fetchTournaments(),
    fetchRecentNewsCount(),
    fetchVideoMatches(),
  ]);
  const events = mapMatchesToEvents(rawMatches ?? []);
  const eventsToPass = resolveMatchTournamentLogos(events);

  return (
    <div
      className={`${fraunces.variable} ${archivoBlack.variable} ${jetbrains.variable} ${figtree.variable} font-[var(--f-body)] min-h-screen flex flex-col overflow-x-hidden bg-zinc-950`}
    >
      {/* ═══ Hero — photo carousel ═══ */}
      <HomeHero
        images={[
          "/carousel5.jpg",
          "/carousel8.jpg",
          "/carousel0.jpg",
          "/carousel1.jpg",
          "/Carousel6.jpg",
          "/carousel0.jpg",
        ]}
      />

      {/* ═══ Welcome / VantaSection ═══ */}
      <VantaSection className="py-12 sm:py-16 text-white" overlayClassName="bg-black/20">
        <div className="container mx-auto px-4 text-center">
          <h1
            className="font-[var(--f-display)] font-black italic leading-[0.95] tracking-[-0.02em] mb-4 text-white"
            style={{
              fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
              textShadow:
                "0 2px 24px rgba(0,0,0,0.85), 0 1px 4px rgba(0,0,0,0.95), 0 0 2px rgba(0,0,0,1)",
            }}
          >
            UltraChamp
          </h1>
          <p
            className="text-base sm:text-xl max-w-3xl mx-auto text-white leading-relaxed"
            style={{
              textShadow:
                "0 1px 16px rgba(0,0,0,0.9), 0 1px 3px rgba(0,0,0,0.95), 0 0 2px rgba(0,0,0,1)",
            }}
          >
            Ο απόλυτος προορισμός για συναρπαστικούς αγώνες mini football στην Ελλάδα και όλον τον
            κόσμο! Ώρα να κυριαρχήσεις στο ποδόσφαιρο μικρών διαστάσεων και να γίνεις εσύ ο
            Ultrachamp! Αγωνίσου σε κλίμα ασφάλειας, οργάνωσης και ηθικής!
          </p>
        </div>
      </VantaSection>

      {/* ═══ Dashboard + Calendar / GridBgSection ═══ */}
      <GridBgSection
        className="py-16 sm:py-20 text-white"
        bgColor="#08080f"
        baseColor="#1a1a2e"
        redPurpleGlow
      >
        <div className="container mx-auto max-w-7xl px-4">
          <SectionHeader eyebrow="Το πρόγραμμα" title="Επερχόμενοι αγώνες" align="left" />
          <div className="flex flex-col gap-14 lg:gap-20">
            <EditorialTeamDashboard allMatches={eventsToPass} userTeams={[]} />
            <div className="relative border-t-2 border-[#F3EFE6]/15 pt-8 md:pt-10">
              <div
                aria-hidden
                className="absolute -top-[2px] left-0 h-[2px] w-24 bg-[#fb923c]"
              />
              <div className="mb-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.3em] text-[#fb923c]">
                  <span className="h-[2px] w-6 bg-[#fb923c]" />
                  Πλήρες Πρόγραμμα
                </div>
                <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#F3EFE6]/50">
                  Ημερολόγιο
                </span>
              </div>
              <EditorialCalendar initialEvents={eventsToPass} highlightTeams={[]} />
            </div>
          </div>
        </div>
      </GridBgSection>

      {/* ═══ Articles / PaperBgSection ═══ */}
      <PaperBgSection className="py-16 sm:py-20 text-white">
        <div className="container mx-auto max-w-7xl px-4">
          <SectionHeader eyebrow="Ανακοινώσεις" title="Τελευταία Νέα" align="left" />
          <Suspense
            fallback={
              <div className="py-20 flex items-center justify-center">
                <div className="w-10 h-10 rounded-full border-2 border-[#fb923c]/40 border-t-[#fb923c] animate-spin" />
              </div>
            }
          >
            <HomeArticles />
          </Suspense>
        </div>
      </PaperBgSection>

      {/* ═══ Videos / GridBgSection ═══ */}
      <GridBgSection className="py-16 sm:py-20 text-white" bgColor="#08080f" baseColor="#1a1a2e">
        <div className="container mx-auto max-w-7xl px-4">
          <SectionHeader eyebrow="Στιγμιότυπα" title="Highlights" align="left" />
          <HomeVideos videos={videoMatches} />
        </div>
      </GridBgSection>

      {/* ═══ Top Players / PaperBgSection ═══ */}
      <PaperBgSection className="py-16 sm:py-20 text-white">
        <div className="container mx-auto max-w-7xl px-4">
          <SectionHeader eyebrow="Αποδόσεις" title="Οι κορυφαίοι" align="left" />
          <Suspense
            fallback={
              <div className="py-20 flex items-center justify-center">
                <div className="w-10 h-10 rounded-full border-2 border-[#fb923c]/40 border-t-[#fb923c] animate-spin" />
              </div>
            }
          >
            <EditorialTopPlayersSection />
          </Suspense>
        </div>
      </PaperBgSection>

      {/* ═══ Features / GridBgSection ═══ */}
      <GridBgSection className="py-20 sm:py-24 text-white" bgColor="#08080f" baseColor="#1a1a2e">
        <div className="container mx-auto max-w-7xl px-4">
          <SectionHeader
            eyebrow="Οι Αξίες μας"
            title="Η ομάδα σε περιμένει"
            subtitle="Τρεις λόγοι που μας εμπιστεύονται παίκτες κάθε επιπέδου."
            align="center"
          />

          <div className="grid md:grid-cols-3 gap-5 sm:gap-6">
            {[
              {
                n: "01",
                icon: Users,
                title: "Φιλόξενη Κοινότητα",
                body:
                  "Σε καλωσορίζουμε με χαμόγελο — γνώρισε συμπαίκτες, βρες παρέες και γίνε μέλος μιας ζωντανής κοινότητας.",
              },
              {
                n: "02",
                icon: Trophy,
                title: "Ποιοτικοί Αγώνες",
                body:
                  "Καλοοργανωμένα παιχνίδια, δίκαιη διαιτησία και ευκαιρίες για όλους — όχι μόνο για τους «πρωταθλητές».",
              },
              {
                n: "03",
                icon: BarChart3,
                title: "Προφίλ & Στατιστικά",
                body:
                  "Γκολ, ασίστ, συμμετοχές και MVPs — κράτα το ιστορικό σου και δες την πρόοδό σου σε κάθε σεζόν.",
              },
            ].map(({ n, icon: Icon, title, body }) => (
              <div
                key={n}
                className="group relative p-8 border border-white/10 bg-white/[0.03] backdrop-blur-sm hover:border-[#fb923c]/40 hover:bg-white/[0.06] transition-all"
              >
                <div className="flex items-start justify-between mb-7">
                  <span className="font-mono text-[10px] uppercase tracking-[0.35em] text-[#fb923c]">
                    № {n}
                  </span>
                  <Icon className="w-6 h-6 text-white/40 group-hover:text-[#fb923c] transition-colors" />
                </div>
                <h3 className="font-[var(--f-display)] font-black italic leading-tight text-white mb-4 text-2xl md:text-3xl">
                  {title}
                </h3>
                <p className="text-white/70 text-sm md:text-base leading-relaxed">{body}</p>
                <div className="mt-6 h-[2px] w-12 bg-[#fb923c] transition-all group-hover:w-24" />
              </div>
            ))}
          </div>
        </div>
      </GridBgSection>

      {/* ═══ Tournaments CTA / PaperBgSection ═══ */}
      <PaperBgSection className="min-h-[70vh] sm:min-h-[75vh] flex items-center justify-center py-20 text-white">
        <div className="w-full max-w-7xl px-4 flex flex-col items-center text-center">
          <SectionHeader
            eyebrow="Τα Τουρνουά"
            title="Έτοιμοι για σέντρα;"
            subtitle="Κάντε εγγραφή σήμερα και μπείτε στον γεμάτο δράση κόσμο του Ultra Champ."
            align="center"
          />

          <Link
            href="/tournaments"
            className="group mb-10 inline-flex items-center gap-3 border-2 border-[#fb923c] bg-[#fb923c] px-7 py-3 font-mono text-[11px] uppercase tracking-[0.28em] text-[#08080f] hover:bg-[#fb923c]/90 transition-all"
          >
            Όλα τα Τουρνουά
            <span className="transition-transform group-hover:translate-x-1">→</span>
          </Link>

          <div className="w-full max-w-7xl text-left">
            <EditorialTournamentsGrid tournaments={tournaments} />
          </div>
        </div>
      </PaperBgSection>

      {/* ═══ Testimonials / GridBgSection ═══ */}
      <GridBgSection className="py-20 sm:py-28 text-white" bgColor="#08080f" baseColor="#1a1a2e">
        <div className="container mx-auto max-w-7xl px-4">
          <SectionHeader eyebrow="Μαρτυρίες" title="Τι λένε οι παίκτες μας" align="center" />

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {[
              {
                quote: "Ενα πρότζεκτ για όλους με άξονα την ποδοσφαιρική παιδεία.",
                name: "Φίλιππος Αστεριάδης",
                role: "Αρχηγός Μεικτής Ομάδας UltraChamp",
              },
              {
                quote:
                  "Μια διοργάνωση που σου προσφέρει εμπιστοσύνη και αντιμετωπίζει τις ομάδες με επαγγελματισμό και σοβαρότητα.",
                name: "Τόλης Παύλου",
                role: "Αρχηγός Πανσουγκαριακού",
              },
              {
                quote:
                  "Ποδοσφαιρικό πάθος. Όλοι οι παίχτες με το ίδιο πάθος και σεβασμό προς το άθλημα και την διοργάνωση.",
                name: "Πέτρος Τσιαβό",
                role: "Αρχηγός Ελληνικής Ομάδας F7",
              },
            ].map((t, i) => (
              <figure
                key={i}
                className="relative p-8 border border-white/10 bg-white/[0.03] backdrop-blur-sm hover:border-[#fb923c]/30 hover:bg-white/[0.06] transition-all flex flex-col gap-5"
              >
                <span
                  aria-hidden
                  className="font-[var(--f-display)] italic text-[#fb923c]/60 leading-none text-6xl"
                >
                  “
                </span>
                <blockquote className="font-[var(--f-display)] italic text-white text-xl leading-snug">
                  {t.quote}
                </blockquote>
                <figcaption className="mt-auto pt-5 border-t border-white/10">
                  <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#fb923c] mb-1">
                    № 0{i + 1}
                  </div>
                  <div className="font-semibold text-white">{t.name}</div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/55 mt-1">
                    {t.role}
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </GridBgSection>

      <LeftSideBubbles count={recentContentCount} />
    </div>
  );
}
