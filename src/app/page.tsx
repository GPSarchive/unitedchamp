// app/page.tsx
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
import type { Tournament } from "@/app/tournaments/useTournamentData";
import { signTournamentLogos } from "@/app/tournaments/signTournamentLogos";
import { resolveImageUrl, ImageType } from "@/app/lib/image-config";
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

// Format like SQL timestamp (no tz)
function toTimestampNoTz(iso: string) {
  const { y, M, d, h, min, s } = parseIsoPreserveClock(iso);
  return `${y}-${pad2(M)}-${pad2(d)} ${pad2(h)}:${pad2(min)}:${pad2(s)}`;
}

// For components expecting 'YYYY-MM-DDTHH:mm:ss'
function toNaiveIso(iso: string) {
  return toTimestampNoTz(iso).replace(' ', 'T');
}

function daysInMonth(y: number, M: number) {
  return new Date(y, M, 0).getDate(); // M is 1..12
}

// Add minutes without timezone math; just tick the clock/date forward
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
  // Normalize date forward (sufficient for +50 min)
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
const pretty = (v: unknown) =>
  JSON.stringify(v, (k, val) => (typeof val === 'bigint' ? val.toString() : val), 2);

async function withConsoleTiming<T>(label: string, fn: () => Promise<T>): Promise<T> {
  console.time(label);
  try {
    return await fn();
  } finally {
    console.timeEnd(label);
  }
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
    if (error) {
      console.error('Error fetching user:', error.message);
    } else {
      console.log('User query result:', data ? pretty(data) : 'No user found');
    }
    return { user: data ?? null, userError: error as { message: string } | null };
  });
}

async function fetchMatchesWithTeams() {
  type SupaResp = { data: MatchRowRaw[] | null; error: { message: string } | null };
  return withConsoleTiming('db:matches', async () => {
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
      .order('match_date', { ascending: true })) as unknown as SupaResp;
    if (error) {
      console.error('Error fetching matches:', error.message);
    } else {
      console.log(`Matches fetched: ${data?.length ?? 0}`);
      const matchesTimestampView = (data ?? []).map((m) => ({
        ...m,
        // Only format when a date exists
        match_date_timestamp: m.match_date ? toTimestampNoTz(m.match_date) : null,
      }));
      console.log('Matches (match_date as timestamp, up to 5):\n', pretty(matchesTimestampView.slice(0, 5)));
    }
    return { rawMatches: data ?? [], matchesError: error };
  });
}

async function fetchTournaments() {
  return withConsoleTiming('db:tournaments', async () => {
    const { data, error } = await supabaseAdmin
      .from('tournaments')
      .select('id, name, slug, format, season, logo, status, winner_team_id')
      .order('id', { ascending: false })
      .limit(6); // Limit to 6 tournaments for homepage

    if (error) {
      console.error('Error fetching tournaments:', error.message);
      return { tournaments: [], tournamentsError: error };
    }

    console.log(`Tournaments fetched: ${data?.length ?? 0}`);

    // Fetch counts for each tournament
    const tournamentsWithCounts = await Promise.all(
      (data ?? []).map(async (tournament) => {
        // Fetch teams count
        const { count: teamsCount } = await supabaseAdmin
          .from('tournament_teams')
          .select('*', { count: 'exact', head: true })
          .eq('tournament_id', tournament.id);

        // Fetch matches count
        const { count: matchesCount } = await supabaseAdmin
          .from('matches')
          .select('*', { count: 'exact', head: true })
          .eq('tournament_id', tournament.id);

        return {
          ...tournament,
          teams_count: String(teamsCount ?? 0),
          matches_count: String(matchesCount ?? 0),
        };
      })
    );

    // Sign tournament logos
    const signedTournaments = await signTournamentLogos(tournamentsWithCounts as Tournament[]);

    return { tournaments: signedTournaments, tournamentsError: null };
  });
}

async function fetchRecentAnnouncementsCount() {
  return withConsoleTiming('db:recent-announcements', async () => {
    // Calculate date 2 days ago
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const twoDaysAgoISO = twoDaysAgo.toISOString();

    const { count, error } = await supabaseAdmin
      .from('announcements')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'published')
      .gte('created_at', twoDaysAgoISO);

    if (error) {
      console.error('Error fetching recent announcements count:', error.message);
      return { recentAnnouncementsCount: 0 };
    }

    console.log(`Recent announcements count: ${count ?? 0}`);
    return { recentAnnouncementsCount: count ?? 0 };
  });
}

/**
 * ------------------------------
 * Mapping functions
 * ------------------------------
 */
function matchRowToEvent(m: MatchRowRaw): CalendarEvent | null {
  if (!m.match_date) {
    // Skip matches that don't have a scheduled date yet
    return null;
  }
  const a = normalizeTeam(m.teamA);
  const b = normalizeTeam(m.teamB);
  // start: keep same clock time as DB, drop offset
  const startIso = toNaiveIso(m.match_date); // 'YYYY-MM-DDTHH:mm:ss'
  // end: naive +50 minutes, normalized across midnight/month
  const startParts = parseIsoPreserveClock(m.match_date);
  const endParts = addMinutesNaive(startParts, 50);
  const endIso = partsToIso(endParts, 'T');

  // Extend with DB status + scores so the client pill can render them
  const teamAScore = (m as any).team_a_score ?? null;
  const teamBScore = (m as any).team_b_score ?? null;
  const status = (m as any).status ?? null; // 'scheduled' | 'finished'

  // Tournament and matchday/round info
  const tournament = (m as any).tournament ?? null;
  const tournamentName = tournament?.name ?? null;
  const tournamentLogo = tournament?.logo ?? null;
  const matchday = (m as any).matchday ?? null;
  const round = (m as any).round ?? null;

  // NOTE: CalendarEvent doesn't know these extra fields, but it's fine to attach them.
  const ev: CalendarEvent & any = {
    id: String(m.id),
    title: `${a?.name ?? 'Άγνωστο'} vs ${b?.name ?? 'Άγνωστο'}`,
    start: startIso,
    end: endIso,
    all_day: false,
    teams: [a?.name ?? 'Άγνωστο', b?.name ?? 'Άγνωστο'],
    logos: [a?.logo ?? '/placeholder.png', b?.logo ?? '/placeholder.png'],

    // NEW: match state/score for EventPillShrimp
    status,
    home_score: teamAScore,
    away_score: teamBScore,
    score: (typeof teamAScore === 'number' && typeof teamBScore === 'number')
      ? [teamAScore, teamBScore]
      : undefined,

    // Tournament and matchday/round info
    tournament_name: tournamentName,
    tournament_logo: tournamentLogo,
    matchday,
    round,
  };

  return ev;
}

function mapMatchesToEvents(rows: MatchRowRaw[]): CalendarEvent[] {
  const events = rows
    .map(matchRowToEvent)
    .filter((e): e is CalendarEvent => e !== null);
  console.log(`Events mapped for calendar: ${events.length}`);
  console.log('Events (after formation, up to 5):\n', pretty(events.slice(0, 5)));
  return events;
}

function resolveMatchTournamentLogos(events: CalendarEvent[]): CalendarEvent[] {
  // Resolve tournament logos to public URLs
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
  const nonce = (await headers()).get('x-nonce') ?? undefined;     // + add

  const [{ user }, { rawMatches }, { tournaments }, { recentAnnouncementsCount }] = await Promise.all([
    fetchSingleUser(),
    fetchMatchesWithTeams(),
    fetchTournaments(),
    fetchRecentAnnouncementsCount()
  ]);
  const events = mapMatchesToEvents(rawMatches ?? []);
  const eventsToPass = resolveMatchTournamentLogos(events);
  console.log('Rendering Home page with events:', eventsToPass.length);
  console.log('Tournaments for homepage:', tournaments.length);
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
      <GridBgSection className="py-12 sm:py-16 text-white">
        <div className="container mx-auto max-w-7xl">
          {/* Desktop: Side by side, Mobile: Stacked */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_480px] gap-6 lg:gap-8">
            
            {/* Left: Team Dashboard */}
            <div className="flex flex-col">
              <TeamDashboard
                allMatches={eventsToPass}
                userTeams={[]} // TODO: Get from user auth/profile when implemented
                className="flex-1"
              />
            </div>

            {/* Right: Calendar */}
            <div className="flex flex-col lg:sticky lg:top-4 lg:self-start">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <svg className="h-6 w-6 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Πλήρες Πρόγραμμα Αγώνων
              </h2>
              <EnhancedMobileCalendar
              initialEvents={eventsToPass}
              highlightTeams={[]} // TODO: Match userTeams above
              className="h-full"
            />
            </div>

          </div>
        </div>
       </GridBgSection>
       



        {/* Features Section */}
        <VantaSection className="py-12 sm:py-16 text-white" overlayClassName="bg-black/20">
         <div className="container mx-auto px-4">
    <h2 className="text-2xl sm:text-4xl font-ubuntu mb-8 sm:mb-12 text-center text-white">
      Η ομάδα σε περιμένει
    </h2>

    <div className="grid md:grid-cols-3 gap-6 sm:gap-8">
      {/* Card */}
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
      </VantaSection>

      {/* Call to Action */}
      <GridBgSection className="min-h-[70vh] sm:min-h-[75vh] flex items-center justify-center text-white">
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
      </GridBgSection>

      {/* Testimonials */}
      <section>

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

      </section>
      {/* Footer */}
      <footer className="py-8 bg-zinc-950 text-white text-center">

        <div className="container mx-auto px-4">
          <p>© 2025 Ultra Champ.</p>
          <div className="mt-4">
            <a href="/privacy" className="mx-2 hover:underline">Πολιτική Απορρήτου</a>
            <a href="/terms" className="mx-2 hover:underline">Όροι Χρήσης</a>
            <a href="/contact" className="mx-2 hover:underline">Επικοινωνία</a>
          </div>
        </div>
      </footer>

      {/* Recent Announcements Bubble */}
      <RecentAnnouncementsBubble count={recentAnnouncementsCount} />
    </div>
  );
}