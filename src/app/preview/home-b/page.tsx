// app/preview/home-b/page.tsx
// PREVIEW — Option B: editorial standard for all sections, keep photo-carousel hero
// This is a read-only preview route. The live home page at / is untouched.

export const revalidate = 300;

import React, { Suspense } from "react";
import Link from "next/link";
import { Fraunces, Archivo_Black, JetBrains_Mono, Figtree } from "next/font/google";
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import { fetchRecentNewsCount } from "@/app/lib/fetchRecentNewsCount";
import { Trophy, Users, BarChart3 } from "lucide-react";
import { UserRow as DbUser, MatchRowRaw, CalendarEvent, normalizeTeam } from "@/app/lib/types";
import { resolveImageUrl, ImageType } from "@/app/lib/image-config";
import type { Tournament } from "@/app/tournaments/useTournamentData";
import { signTournamentLogos } from "@/app/tournaments/signTournamentLogos";

import PreviewHero from "./PreviewHero";
import TeamDashboard from "@/app/home/TeamDashboard";
import EnhancedMobileCalendar from "@/app/home/EnhancedMobileCalendar";
import TournamentsGrid from "@/app/home/TournamentsGrid";
import HomeArticles from "@/app/home/HomeArticles";
import HomeVideos from "@/app/home/HomeVideos";
import TopPlayersSection from "@/app/home/TopPlayersSection";
import RecentAnnouncementsBubble from "@/app/home/RecentAnnouncementsBubble";

// ───────────────────────────────────────────────────────────────────────
// Typography (same stack as /tournaments, /paiktes, /matches)
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
// PaperBackground — shared atmosphere (lifted from tournaments page)
// ───────────────────────────────────────────────────────────────────────
const PaperBackground: React.FC = () => (
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
      style={{ background: "radial-gradient(closest-side, #fb923c 0%, rgba(251,146,60,0) 70%)" }}
    />
    <div
      className="absolute -bottom-60 -right-40 h-[55rem] w-[55rem] rounded-full opacity-[0.14] blur-3xl"
      style={{ background: "radial-gradient(closest-side, #a855f7 0%, rgba(168,85,247,0) 70%)" }}
    />
    <svg className="absolute inset-0 h-full w-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="pg-bb" width="48" height="48" patternUnits="userSpaceOnUse">
          <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#F3EFE6" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#pg-bb)" />
    </svg>
    <svg className="absolute inset-0 h-full w-full mix-blend-screen opacity-[0.08]" xmlns="http://www.w3.org/2000/svg">
      <filter id="pg-noise">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
        <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.4 0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#pg-noise)" />
    </svg>
  </div>
);

// ───────────────────────────────────────────────────────────────────────
// SectionKicker — small mono caps label + underline bar (reused below)
// ───────────────────────────────────────────────────────────────────────
const SectionKicker: React.FC<{ label: string; eyebrow?: string; align?: "left" | "center" }> = ({
  label,
  eyebrow,
  align = "left",
}) => (
  <div className={`flex flex-col ${align === "center" ? "items-center text-center" : "items-start"}`}>
    {eyebrow && (
      <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.3em] text-[#fb923c] mb-3">
        <span className="h-[2px] w-8 bg-[#fb923c]" />
        {eyebrow}
      </div>
    )}
    <h2
      className="font-[var(--f-display)] font-black italic leading-[0.95] tracking-[-0.02em] text-[#F3EFE6]"
      style={{ fontSize: "clamp(1.75rem, 4.5vw, 3.25rem)" }}
    >
      {label}
    </h2>
  </div>
);

// ───────────────────────────────────────────────────────────────────────
// Date helpers (copied verbatim from home page to preserve behavior)
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
// Data fetchers (same shape as home page)
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
export default async function PreviewHomeB() {
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
      className={`${fraunces.variable} ${archivoBlack.variable} ${jetbrains.variable} ${figtree.variable} font-[var(--f-body)] relative min-h-screen bg-[#08080f] text-[#F3EFE6] overflow-x-hidden`}
    >
      <PaperBackground />

      {/* Preview banner — lets you know it's the preview */}
      <div className="relative z-20 border-b border-[#fb923c]/30 bg-[#0a0a14]/80 backdrop-blur">
        <div className="mx-auto max-w-[1400px] px-6 py-2 flex items-center justify-between gap-4 font-mono text-[10px] uppercase tracking-[0.28em] text-[#F3EFE6]/70">
          <span className="flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#fb923c] animate-pulse" />
            Preview · Option B
          </span>
          <Link href="/" className="text-[#F3EFE6]/60 hover:text-[#fb923c] transition-colors">
            ← Αρχική (live)
          </Link>
        </div>
      </div>

      {/* ═══ Hero — photo carousel kept, editorial typography overlay ═══ */}
      <PreviewHero
        images={[
          "/carousel5.jpg",
          "/carousel8.jpg",
          "/carousel0.jpg",
          "/carousel1.jpg",
          "/Carousel6.jpg",
          "/carousel0.jpg",
        ]}
      />

      {/* ═══ Welcome / brand statement ═══ */}
      <section className="relative py-20 md:py-28">
        <div className="mx-auto max-w-[1400px] px-6">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-10 md:gap-16 items-end">
            <div className="flex flex-col gap-3 font-mono text-[10px] uppercase tracking-[0.3em] text-[#fb923c]">
              <span className="h-[2px] w-8 bg-[#fb923c]" />
              <span>Vol. I — The League</span>
              <span className="text-[#F3EFE6]/55">Est. Ελλάδα</span>
            </div>
            <div>
              <h2
                className="font-[var(--f-display)] font-black italic leading-[0.95] tracking-[-0.02em] text-[#F3EFE6]"
                style={{ fontSize: "clamp(2rem, 5.5vw, 4.25rem)" }}
              >
                UltraChamp — <span className="text-[#fb923c]">η νέα τάση</span> στο mini football.
              </h2>
              <p className="mt-6 max-w-2xl text-[#F3EFE6]/75 text-base md:text-lg leading-relaxed">
                Συναρπαστικοί αγώνες, δίκαιη διαιτησία και μια ζωντανή κοινότητα. Αγωνίσου σε κλίμα
                ασφάλειας, οργάνωσης και ηθικής — και γίνε εσύ ο επόμενος UltraChamp.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ Team Dashboard + Calendar ═══ */}
      <section className="relative py-16 md:py-24 border-t border-[#F3EFE6]/10">
        <div className="mx-auto max-w-[1400px] px-6">
          <div className="mb-10 md:mb-14">
            <SectionKicker eyebrow="Matchday" label="Το πρόγραμμα" />
          </div>

          <div className="flex flex-col gap-12 lg:gap-16">
            <TeamDashboard allMatches={eventsToPass} userTeams={[]} />

            <div>
              <div className="mb-6 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.3em] text-[#F3EFE6]/55">
                <span className="h-[2px] w-6 bg-[#F3EFE6]/30" />
                Πλήρες Πρόγραμμα
              </div>
              <EnhancedMobileCalendar initialEvents={eventsToPass} highlightTeams={[]} />
            </div>
          </div>
        </div>
      </section>

      {/* ═══ Articles ═══ */}
      <section className="relative py-16 md:py-24 border-t border-[#F3EFE6]/10">
        <div className="mx-auto max-w-[1400px] px-6">
          <div className="mb-10 md:mb-14">
            <SectionKicker eyebrow="Dispatch" label="Τελευταία Νέα" />
          </div>
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
      </section>

      {/* ═══ Videos ═══ */}
      <section className="relative py-16 md:py-24 border-t border-[#F3EFE6]/10">
        <div className="mx-auto max-w-[1400px] px-6">
          <div className="mb-10 md:mb-14">
            <SectionKicker eyebrow="Reels" label="Highlights" />
          </div>
          <HomeVideos videos={videoMatches} />
        </div>
      </section>

      {/* ═══ Top Players ═══ */}
      <section className="relative py-16 md:py-24 border-t border-[#F3EFE6]/10">
        <div className="mx-auto max-w-[1400px] px-6">
          <div className="mb-10 md:mb-14">
            <SectionKicker eyebrow="Form Chart" label="Οι κορυφαίοι" />
          </div>
          <Suspense
            fallback={
              <div className="py-20 flex items-center justify-center">
                <div className="w-10 h-10 rounded-full border-2 border-[#fb923c]/40 border-t-[#fb923c] animate-spin" />
              </div>
            }
          >
            <TopPlayersSection />
          </Suspense>
        </div>
      </section>

      {/* ═══ Features — "Η ομάδα σε περιμένει" ═══ */}
      <section className="relative py-20 md:py-28 border-t border-[#F3EFE6]/10">
        <div className="mx-auto max-w-[1400px] px-6">
          <div className="mb-12 md:mb-16 max-w-3xl">
            <SectionKicker eyebrow="Manifesto" label="Η ομάδα σε περιμένει" />
            <p className="mt-5 text-[#F3EFE6]/70 text-base md:text-lg leading-relaxed">
              Τρεις λόγοι που μας εμπιστεύονται παίκτες κάθε επιπέδου.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-px bg-[#F3EFE6]/10">
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
                className="group relative bg-[#0a0a14] p-8 md:p-10 hover:bg-[#0f0f1b] transition-colors"
              >
                <div className="flex items-start justify-between mb-8">
                  <span className="font-mono text-[10px] uppercase tracking-[0.35em] text-[#fb923c]">
                    № {n}
                  </span>
                  <Icon className="w-6 h-6 text-[#F3EFE6]/40 group-hover:text-[#fb923c] transition-colors" />
                </div>
                <h3 className="font-[var(--f-display)] font-black italic leading-tight text-[#F3EFE6] mb-4 text-2xl md:text-3xl">
                  {title}
                </h3>
                <p className="text-[#F3EFE6]/70 text-sm md:text-base leading-relaxed">{body}</p>
                <div className="mt-6 h-[2px] w-12 bg-[#fb923c] transition-all group-hover:w-24" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ Tournaments CTA ═══ */}
      <section className="relative py-20 md:py-28 border-t border-[#F3EFE6]/10">
        <div className="mx-auto max-w-[1400px] px-6">
          <div className="mb-12 md:mb-16 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <SectionKicker eyebrow="Fixtures" label="Έτοιμοι για σέντρα;" />
              <p className="mt-5 max-w-xl text-[#F3EFE6]/70 text-base md:text-lg leading-relaxed">
                Κάντε εγγραφή σήμερα και μπείτε στον γεμάτο δράση κόσμο του Ultra Champ.
              </p>
            </div>
            <Link
              href="/tournaments"
              className="group inline-flex items-center gap-3 self-start border-2 border-[#fb923c] bg-transparent px-6 py-3 font-mono text-[11px] uppercase tracking-[0.28em] text-[#fb923c] hover:bg-[#fb923c] hover:text-[#08080f] transition-all"
            >
              Όλα τα Τουρνουά
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </Link>
          </div>
          <TournamentsGrid tournaments={tournaments} />
        </div>
      </section>

      {/* ═══ Testimonials ═══ */}
      <section className="relative py-20 md:py-28 border-t border-[#F3EFE6]/10">
        <div className="mx-auto max-w-[1400px] px-6">
          <div className="mb-14 md:mb-20 max-w-3xl">
            <SectionKicker eyebrow="On the Record" label="Τι λένε οι παίκτες μας" />
          </div>

          <div className="grid md:grid-cols-3 gap-px bg-[#F3EFE6]/10">
            {[
              {
                quote:
                  "Ενα πρότζεκτ για όλους με άξονα την ποδοσφαιρική παιδεία.",
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
                className="relative bg-[#0a0a14] p-8 md:p-10 flex flex-col gap-6"
              >
                <span
                  aria-hidden
                  className="font-[var(--f-display)] italic text-[#fb923c]/60 leading-none text-6xl md:text-7xl"
                >
                  “
                </span>
                <blockquote className="font-[var(--f-display)] italic text-[#F3EFE6] text-xl md:text-2xl leading-snug">
                  {t.quote}
                </blockquote>
                <figcaption className="mt-auto pt-6 border-t border-[#F3EFE6]/10">
                  <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#fb923c] mb-1">
                    № 0{i + 1}
                  </div>
                  <div className="font-[var(--f-body)] font-semibold text-[#F3EFE6]">{t.name}</div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#F3EFE6]/55 mt-1">
                    {t.role}
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom spacer so the final border meets the footer cleanly */}
      <div className="h-px bg-[#F3EFE6]/10" />

      <RecentAnnouncementsBubble count={recentContentCount} />
    </div>
  );
}
