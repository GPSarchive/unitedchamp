// app/page.tsx
export const revalidate = 300; // ISR – regenerate every 5 minutes

import Image from 'next/image';
import { supabaseAdmin } from '@/app/lib/supabase/supabaseAdmin';
import { headers } from 'next/headers';
import { Trophy, Users, BarChart3 } from 'lucide-react';
import { UserRow as DbUser, MatchRowRaw, CalendarEvent, normalizeTeam } from "@/app/lib/types";
import HomeHero from '@/app/home/HomeHero';
import EventCalendar from '@/app/home/Calendar';
import TeamDashboard from '@/app/home/TeamDashboard';
import ResponsiveCallendar from '@/app/home/ResponsiveCalendar';
import GridBgSection from '@/app/home/GridBgSection';
import VantaSection from '@/app/home/VantaSection';
import MiniAnnouncements from './home/MiniAnnouncements';
import RecentMatchesTabs from './home/RecentMatchesTabs';
import ResponsiveCalendar from '@/app/home/ResponsiveCalendar';
import EnhancedMobileCalendar from './home/EnhancedMobileCalendar';
import TournamentsGrid from './home/TournamentsGrid';
import RecentAnnouncementsBubble from './home/RecentAnnouncementsBubble';
import HomeArticles from './home/HomeArticles';
import HomeVideos from './home/HomeVideos';
import TopPlayersSection from './home/TopPlayersSection';
import type { Tournament } from "@/app/tournaments/useTournamentData";
import { signTournamentLogos } from "@/app/tournaments/signTournamentLogos";
import { resolveImageUrl, ImageType } from "@/app/lib/image-config";
import { Suspense } from 'react';

/**
 * ------------------------------
 * Date/Time helpers — preserve wall-clock time from DB and drop timezone
 * ------------------------------
 */
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/;
const pad2 = (n: number) => String(n).padStart(2, '0');

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
  return toTimestampNoTz(iso).replace(' ', 'T');
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
  T: 'T' | ' ' = 'T'
) {
  const { y, M, d, h, min, s } = parts;
  return `${y}-${pad2(M)}-${pad2(d)}${T}${pad2(h)}:${pad2(min)}:${pad2(s)}`;
}

/**
 * ------------------------------
 * Utility helpers
 * ------------------------------
 */
async function withConsoleTiming<T>(label: string, fn: () => Promise<T>): Promise<T> {
  return await fn();
}

/**
 * ------------------------------
 * DB accessors
 * ------------------------------
 */
async function fetchSingleUser() {
  return withConsoleTiming('db:users', async () => {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, name')
      .limit(1)
      .single<DbUser>();
    return { user: data ?? null, userError: error as { message: string } | null };
  });
}

async function fetchMatchesWithTeams() {
  type SupaResp = { data: MatchRowRaw[] | null; error: { message: string } | null };
  return withConsoleTiming('db:matches', async () => {
    const now = new Date();
    const windowStart = new Date(now);
    windowStart.setDate(now.getDate() - 60); // 2 months back
    const windowEnd = new Date(now);
    windowEnd.setDate(now.getDate() + 90);   // 3 months forward

    const { data, error } = (await supabaseAdmin
      .from('matches')
      .select(
        `
        id,
        match_date,
        team_a_id,
        team_b_id,
        team_a_score,
        team_b_score,
        status,
        stage_id,
        group_id,
        matchday,
        round,
        teamA:teams!matches_team_a_id_fkey (name, logo),
        teamB:teams!matches_team_b_id_fkey (name, logo),
        tournament:tournament_id (id, name, logo)
      `
      )
      .gte('match_date', windowStart.toISOString())
      .lte('match_date', windowEnd.toISOString())
      .order('match_date', { ascending: true })
      .order('id',         { ascending: true })) as unknown as SupaResp;
    return { rawMatches: data ?? [], matchesError: error };
  });
}

async function fetchTournaments() {
  return withConsoleTiming('db:tournaments', async () => {
    const { data, error } = await supabaseAdmin
      .from('tournaments')
      .select(`id, name, slug, format, season, logo, status, winner_team_id,
        tournament_teams(count),
        matches(count)`)
      .order('id', { ascending: false })
      .limit(6);

    if (error) {
      return { tournaments: [], tournamentsError: error };
    }

    const tournamentsWithCounts = (data ?? []).map((tournament: any) => ({
      ...tournament,
      teams_count: String(tournament.tournament_teams?.[0]?.count ?? 0),
      matches_count: String(tournament.matches?.[0]?.count ?? 0),
      tournament_teams: undefined,
      matches: undefined,
    }));

    const signedTournaments = await signTournamentLogos(tournamentsWithCounts as Tournament[]);

    return { tournaments: signedTournaments, tournamentsError: null };
  });
}

async function fetchRecentContentCount() {
  return withConsoleTiming('db:recent-content', async () => {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const twoDaysAgoISO = twoDaysAgo.toISOString();

    const { count: announcementsCount } = await supabaseAdmin
      .from('announcements')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'published')
      .gte('created_at', twoDaysAgoISO);

    const { count: articlesCount } = await supabaseAdmin
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'published')
      .gte('published_at', twoDaysAgoISO);

    const totalCount = (announcementsCount ?? 0) + (articlesCount ?? 0);

    return { recentContentCount: totalCount };
  });
}

async function fetchVideoMatches() {
  return withConsoleTiming('db:video-matches', async () => {
    const { data, error } = await supabaseAdmin
      .from('matches')
      .select(
        `
        id,
        video_url,
        match_date,
        team_a_score,
        team_b_score,
        teamA:teams!matches_team_a_id_fkey (name, logo),
        teamB:teams!matches_team_b_id_fkey (name, logo),
        tournament:tournament_id (name)
      `
      )
      .not('video_url', 'is', null)
      .neq('video_url', '')
      .order('match_date', { ascending: false })
      .order('id',         { ascending: false })
      .limit(20);

    if (error || !data) {
      return { videoMatches: [] };
    }

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
  });
}

/**
 * ------------------------------
 * Mapping functions
 * ------------------------------
 */
function matchRowToEvent(m: MatchRowRaw): CalendarEvent | null {
  if (!m.match_date) {
    return null;
  }
  const a = normalizeTeam(m.teamA);
  const b = normalizeTeam(m.teamB);
  const startIso = toNaiveIso(m.match_date);
  const startParts = parseIsoPreserveClock(m.match_date);
  const endParts = addMinutesNaive(startParts, 50);
  const endIso = partsToIso(endParts, 'T');

  const teamAScore = (m as any).team_a_score ?? null;
  const teamBScore = (m as any).team_b_score ?? null;
  const status = (m as any).status ?? null;

  const tournament = (m as any).tournament ?? null;
  const tournamentName = tournament?.name ?? null;
  const tournamentLogo = tournament?.logo ?? null;
  const matchday = (m as any).matchday ?? null;
  const round = (m as any).round ?? null;

  const ev: CalendarEvent & any = {
    id: String(m.id),
    title: `${a?.name ?? 'Άγνωστο'} vs ${b?.name ?? 'Άγνωστο'}`,
    start: startIso,
    end: endIso,
    all_day: false,
    teams: [a?.name ?? 'Άγνωστο', b?.name ?? 'Άγνωστο'],
    logos: [a?.logo ?? '/placeholder.png', b?.logo ?? '/placeholder.png'],
    status,
    home_score: teamAScore,
    away_score: teamBScore,
    score: (typeof teamAScore === 'number' && typeof teamBScore === 'number')
      ? [teamAScore, teamBScore]
      : undefined,
    tournament_name: tournamentName,
    tournament_logo: tournamentLogo,
    matchday,
    round,
  };

  return ev;
}

function mapMatchesToEvents(rows: MatchRowRaw[]): CalendarEvent[] {
  return rows
    .map(matchRowToEvent)
    .filter((e): e is CalendarEvent => e !== null);
}

function resolveMatchTournamentLogos(events: CalendarEvent[]): CalendarEvent[] {
  return events.map((e: any) => {
    if (e.tournament_logo) {
      const resolvedLogo = resolveImageUrl(e.tournament_logo, ImageType.TOURNAMENT);
      return { ...e, tournament_logo: resolvedLogo };
    }
    return e;
  });
}

/**
 * ------------------------------
 * Page component (Server)
 * ------------------------------
 */
export default async function Home() {
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  const [{ user }, { rawMatches }, { tournaments }, { recentContentCount }, { videoMatches }] = await Promise.all([
    fetchSingleUser(),
    fetchMatchesWithTeams(),
    fetchTournaments(),
    fetchRecentContentCount(),
    fetchVideoMatches()
  ]);

  const events = mapMatchesToEvents(rawMatches ?? []);
  const eventsToPass = resolveMatchTournamentLogos(events);

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden bg-zinc-950">
      {/* Hero Carousel Section */}
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

      {/* Welcome Section */}
      <VantaSection className="py-12 sm:py-16 text-white" overlayClassName="bg-black/20">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl sm:text-5xl font-semibold font-sans mb-2 drop-shadow">
            UltraChamp
          </h1>
          <p className="text-lg sm:text-xl max-w-3xl mx-auto text-white/90 leading-relaxed">
            Ο απόλυτος προορισμός για συναρπαστικούς αγώνες mini football στην Ελλάδα και όλον τον κοσμο!
            Ώρα να κυριαρχήσεις στο ποδόσφαιρο μικρών διαστάσεων και να γίνει εσύ ο Ultrachamp! Αγωνισου
            σε κλίμα ασφάλειας οργάνωσης και ηθικής!
          </p>
        </div>
      </VantaSection>

      {/* Combined Calendar & Dashboard Section */}
      <GridBgSection className="py-12 sm:py-16 text-white" bgColor="#08080f" baseColor="#1a1a2e" redPurpleGlow>
        <div className="container mx-auto max-w-7xl">
          <div className="flex flex-col gap-10 lg:gap-14">

            {/* Team Dashboard */}
            <TeamDashboard
              allMatches={eventsToPass}
              userTeams={[]}
            />

            {/* Calendar */}
            <div>
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                Πλήρες Πρόγραμμα Αγώνων
              </h2>
              <EnhancedMobileCalendar
                initialEvents={eventsToPass}
                highlightTeams={[]}
              />
            </div>

          </div>
        </div>
      </GridBgSection>

      {/* Articles Section */}
      <VantaSection className="py-12 sm:py-16 text-white" overlayClassName="bg-black/20">
        <Suspense fallback={
          <div className="py-20 flex items-center justify-center">
            <div className="w-10 h-10 rounded-full border-2 border-orange-400/40 border-t-orange-400 animate-spin" />
          </div>
        }>
          <HomeArticles />
        </Suspense>
      </VantaSection>

      {/* Videos Section */}
      <GridBgSection className="py-12 sm:py-16 text-white" bgColor="#08080f" baseColor="#1a1a2e">
        <HomeVideos videos={videoMatches} />
      </GridBgSection>

      {/* Top Players Section — lazy loaded via Suspense */}
      <VantaSection className="py-12 sm:py-16 text-white" overlayClassName="bg-black/20">
        <Suspense fallback={
          <div className="py-20 flex items-center justify-center">
            <div className="w-10 h-10 rounded-full border-2 border-orange-400/40 border-t-orange-400 animate-spin" />
          </div>
        }>
          <TopPlayersSection />
        </Suspense>
      </VantaSection>

      {/* Features Section — "Η ομάδα σε περιμένει" */}
      <GridBgSection className="py-12 sm:py-16 text-white" bgColor="#08080f" baseColor="#1a1a2e">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl sm:text-4xl font-ubuntu mb-8 sm:mb-12 text-center text-white">
            Η ομάδα σε περιμένει
          </h2>

          <div className="grid md:grid-cols-3 gap-6 sm:gap-8">
            <div className="group p-6 sm:p-8 rounded-2xl bg-black/80 ring-1 ring-black hover:ring-white/25 backdrop-blur-2xl shadow-xl shadow-black/40">
              <div className="p-3 w-fit rounded-full bg-black/75 border border-white/15 ring-2 ring-orange-400/60 outline outline-1 -outline-offset-1 outline-black/80 mb-4">
                <Users className="w-7 h-7 sm:w-8 sm:h-8 text-white/90" aria-hidden="true" />
              </div>
              <h3 className="text-xl sm:text-2xl font-sans font-semibold mb-3 sm:mb-4 text-white">
                Φιλόξενη Κοινότητα
              </h3>
              <p className="text-white/75 text-sm sm:text-base">
                Σε καλωσορίζουμε με χαμόγελο — γνώρισε συμπαίκτες, βρες παρέες και γίνε μέλος μιας ζωντανής κοινότητας.
              </p>
            </div>

            <div className="group p-6 sm:p-8 rounded-2xl bg-black/80 ring-1 ring-black hover:ring-white/25 backdrop-blur-2xl shadow-xl shadow-black/40">
              <div className="p-3 w-fit rounded-full bg-black/75 border border-white/15 ring-2 ring-orange-400/60 outline outline-1 -outline-offset-1 outline-black/80 mb-4">
                <Trophy className="w-7 h-7 sm:w-8 sm:h-8 text-white/90" aria-hidden="true" />
              </div>
              <h3 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4 text-white">
                Ποιοτικοί Αγώνες
              </h3>
              <p className="text-white/75 text-sm sm:text-base">
                Καλοοργανωμένα παιχνίδια, δίκαιη διαιτησία και ευκαιρίες για όλους — όχι μόνο για τους «πρωταθλητές».
              </p>
            </div>

            <div className="group p-6 sm:p-8 rounded-xl bg-black/80 ring-1 ring-black hover:ring-white/25 backdrop-blur-2xl shadow-xl shadow-black/40">
              <div className="p-3 w-fit rounded-full bg-black/75 border border-white/15 ring-2 ring-orange-400/60 outline outline-1 -outline-offset-1 outline-black/80 mb-4">
                <BarChart3 className="w-7 h-7 sm:w-8 sm:h-8 text-white/90" aria-hidden="true" />
              </div>
              <h3 className="text-xl sm:text-2xl font-semibold mb-2 text-white">
                Προφίλ & Στατιστικά
              </h3>
              <p className="text-white/75 text-sm sm:text-base">
                Γκολ, ασίστ, συμμετοχές και MVPs — κράτα το ιστορικό σου και δες την πρόοδό σου σε κάθε σεζόν.
              </p>
            </div>
          </div>
        </div>
      </GridBgSection>

      {/* Call to Action — Tournaments */}
      <VantaSection className="min-h-[70vh] sm:min-h-[75vh] flex items-center justify-center text-white" overlayClassName="bg-black/20">
        <div className="w-full max-w-7xl mt-12 px-4 flex flex-col items-center text-center">
          <h2 className="text-2xl sm:text-4xl font-sans font-bold mb-4 sm:mb-6">
            Έτοιμοι για σέντρα;
          </h2>
          <p className="text-base sm:text-xl mb-6 sm:mb-8">
            Κάντε εγγραφή σήμερα και μπείτε στον γεμάτο δράση κόσμο του Ultra Champ.
          </p>

          <div className="w-full max-w-7xl">
            <TournamentsGrid tournaments={tournaments} />
          </div>
        </div>
      </VantaSection>

      {/* Testimonials */}
      <GridBgSection className="py-16 sm:py-28 text-white" bgColor="#08080f" baseColor="#1a1a2e">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl sm:text-4xl font-bold mb-8 sm:mb-12 text-center text-white">
            Τι λένε οι παίκτες μας
          </h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            <div className="group p-6 rounded-2xl bg-black/80 ring-1 ring-black hover:ring-white/25 backdrop-blur-2xl shadow-xl shadow-black/40">
              <p className="mb-4 text-white/90">«Ενα πρότζεκτ για όλους με αξονα την ποδοσφαιρικη παιδεία.»</p>
              <div className="font-semibold text-white/80">- ΦΙΛΙΠΠΟΣ ΑΣΤΕΡΙΑΔΗΣ- ΑΡΧΗΓΟΣ ΜΕΙΚΤΗΣ ΟΜΑΔΑΣ ULTRACHAMP</div>
            </div>

            <div className="group p-6 rounded-2xl bg-black/80 ring-1 ring-black hover:ring-white/25 backdrop-blur-2xl shadow-xl shadow-black/40">
              <p className="mb-4 text-white/90">«Μια διοργάνωση που σου προσφέρει εμπιστοσύνη και αντιμετωπίζει τις ομάδες με επαγγελματισμό και σοβαρότητα.»</p>
              <div className="font-semibold text-white/80">- ΤΟΛΗΣ ΠΑΥΛΟΥ - ΑΡΧΗΓΟΣ ΠΑΝΣΟΥΓΚΑΡΙΑΚΟΥ</div>
            </div>

            <div className="group p-6 rounded-2xl bg-black/80 ring-1 ring-black hover:ring-white/25 backdrop-blur-2xl shadow-xl shadow-black/40">
              <p className="mb-4 text-white/90">«Ποδοσφαιρικό Πάθος . Όλοι οι παίχτες με το ίδιο πάθος και σεβασμό προς το άθλημα και την διοργάνωση!»</p>
              <div className="font-semibold text-white/80">- ΠΕΤΡΟΣ ΤΣΙΑΒΟ - Αρχηγός Ελληνικής Ομάδας F7</div>
            </div>
          </div>
        </div>
      </GridBgSection>

      {/* Footer */}
      <footer className="py-8 bg-zinc-950 text-white text-center">
        <div className="container mx-auto px-4">
          <p>© 2025 Ultra Champ.</p>
          <div className="mt-4">
            <a href="/privacy" className="mx-2 hover:underline">Πολιτική Απορρήτου</a>
            <a href="/terms" className="mx-2 hover:underline">Όροι Χρήσης</a>
            <a href="/contact" className="mx-2 hover:underline">Επικοινωνία</a>
          </div>
          <div className="mt-4 text-zinc-400 text-sm">
            Κατασκευή ιστοσελίδας από{" "}
            <a
              href="https://www.digitalfootprint.gr"
              target="_blank"
              rel="noopener"
              className="hover:underline text-zinc-300"
            >
              Digital Footprint
            </a>
          </div>
        </div>
      </footer>

      {/* Recent Content Bubble */}
      <RecentAnnouncementsBubble count={recentContentCount} />
    </div>
  );
}