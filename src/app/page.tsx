// page.tsx
import Image from 'next/image';
import { Carousel } from '@/app/components/HomePageComponents/Carousel';
import EventCalendar from './components/HomePageComponents/Calendar';
import { supabaseAdmin } from '@/app/lib/supabaseAdmin';
import { Trophy, Users, CalendarDays, BarChart3 } from 'lucide-react';
import { UserRow as DbUser, TeamLite, MatchRowRaw, CalendarEvent, normalizeTeam } from "@/app/lib/types";
import HomeHero from './components/HomePageComponents/HomeHero';

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
        teamA:teams!matches_team_a_id_fkey (name, logo),
        teamB:teams!matches_team_b_id_fkey (name, logo)
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
  return {
    id: String(m.id),
    title: `${a?.name ?? 'Άγνωστο'} vs ${b?.name ?? 'Άγνωστο'}`,
    start: startIso,
    end: endIso,
    all_day: false,
    teams: [a?.name ?? 'Άγνωστο', b?.name ?? 'Άγνωστο'],
    logos: [a?.logo ?? '/placeholder.png', b?.logo ?? '/placeholder.png'],
  };
}

function mapMatchesToEvents(rows: MatchRowRaw[]): CalendarEvent[] {
  const events = rows
    .map(matchRowToEvent)
    .filter((e): e is CalendarEvent => e !== null);
  console.log(`Events mapped for calendar: ${events.length}`);
  console.log('Events (after formation, up to 5):\n', pretty(events.slice(0, 5)));
  return events;
}

/**
 * ------------------------------
 * Page component
 * ------------------------------
 */
export default async function Home() {
  const [{ user }, { rawMatches }] = await Promise.all([fetchSingleUser(), fetchMatchesWithTeams()]);
  const eventsToPass = mapMatchesToEvents(rawMatches ?? []);

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden bg-zinc-950">
      {/* Hero Carousel Section */}
      <HomeHero
        images={[
          "/pexels-omar.jpg",
          "/pexels-omar2.jpg",
          "/pexels-omar3.jpg",
          "/pexels-omar4.jpg",
        ]}
      />

      {/* Welcome Section - mobile-first sizes */}
      <section className="py-12 sm:py-16 bg-gradient-to-b from-yellow-400/80 to-black-900 text-white">
        <div className="container mx-auto px-4 text-center text-black">
          <h1 className="text-3xl sm:text-5xl font-semibold font-sans mb-4"> {/* [CTRL-A] */}
            Καλώς ήρθατε στο Ultra Champ
          </h1>
          <p className="text-base sm:text-xl font-sans mb-8 max-w-3xl mx-auto"> {/* [CTRL-B] */}
            Ο απόλυτος προορισμός για συναρπαστικούς αγώνες και τουρνουά ποδοσφαίρου. Ελάτε μαζί με παθιασμένους παίκτες, φτιάξτε ομάδες και ανταγωνιστείτε σε δυναμικά events που γιορτάζουν το πνεύμα του παιχνιδιού. Είτε είστε έμπειροι είτε μόλις ξεκινάτε, έχουμε το ιδανικό γήπεδο για εσάς!
          </p>
          <a
            href="/sign-up"
            className="bg-white text-black px-6 sm:px-8 py-3 rounded-full font-semibold transition border border-transparent hover:bg-black hover:text-white hover:border-white"
          >
            Εγγραφείτε τώρα
          </a>
        </div>
      </section>

      {/* Calendar Section - use safer full-bleed utility */}
      <section className="full-bleed safe-px safe-pb"> {/* [CTRL-C] */}
        <EventCalendar className="w-full" initialEvents={eventsToPass} fetchFromDb={false} />
      </section>

      {/* Features Section */}
      <section className="py-12 sm:py-16 bg-grid-18 text-white">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl sm:text-4xl font-ubuntu mb-8 sm:mb-12 text-center">Η ομάδα σε περιμένει</h2>
          <div className="grid md:grid-cols-3 gap-6 sm:gap-8">
            <div className="p-6 sm:p-8 rounded-lg shadow-lg border border-orange-400/20 bg-white/5 backdrop-blur-md hover:border-orange-400/40 transition">
              <div className="p-3 w-fit rounded-full bg-orange-500/20 border border-orange-400/30 mb-4">
                <Users className="w-7 h-7 sm:w-8 sm:h-8 text-orange-400" aria-hidden="true" />
              </div>
              <h3 className="text-xl sm:text-2xl font-sans font-semibold mb-3 sm:mb-4">Φιλόξενη Κοινότητα</h3>
              <p className="text-gray-200 text-sm sm:text-base">
                Σε καλωσορίζουμε με χαμόγελο — γνώρισε συμπαίκτες, βρες παρέες και γίνε μέλος μιας ζωντανής κοινότητας.
              </p>
            </div>

            <div className="p-6 sm:p-8 rounded-lg shadow-lg border border-orange-400/20 bg-white/5 backdrop-blur-md hover:border-orange-400/40 transition">
              <div className="p-3 w-fit rounded-full bg-orange-500/20 border border-orange-400/30 mb-4">
                <Trophy className="w-7 h-7 sm:w-8 sm:h-8 text-orange-400" aria-hidden="true" />
              </div>
              <h3 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4">Διασκεδαστικοί Αγώνες</h3>
              <p className="text-gray-200 text-sm sm:text-base">
                Καλοοργανωμένα παιχνίδια, δίκαιη διαιτησία και ευκαιρίες για όλους — όχι μόνο για τους «πρωταθλητές».
              </p>
            </div>

            <div className="p-6 sm:p-8 rounded-lg shadow-lg border border-orange-400/20 bg-white/5 backdrop-blur-md hover:border-orange-400/40 transition">
              <div className="p-3 w-fit rounded-full bg-orange-500/20 border border-orange-400/30 mb-4">
                <BarChart3 className="w-7 h-7 sm:w-8 sm:h-8 text-orange-400" aria-hidden="true" />
              </div>
              <h3 className="text-xl sm:text-2xl font-semibold mb-2">Προφίλ & Στατιστικά</h3>
              <p className="text-gray-200 text-sm sm:text-base">
                Γκολ, ασίστ, clean sheets και MVPs — κράτα το ιστορικό σου και δες την πρόοδό σου σε κάθε σεζόν.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* About Us Section */}
      <section className="py-12 sm:py-16 bg-gradient-to-r from-yellow-500 to-yellow-900 text-white">
        <div className="container mx-auto px-4 grid md:grid-cols-2 gap-8 sm:gap-12 items-center">
          <div>
            <h2 className="text-2xl sm:text-4xl font-sans text-black font-bold mb-4 sm:mb-6">Σχετικά με εμάς</h2>
            <p className="text-base sm:text-lg text-black mb-3 sm:mb-4">
              Στο Ultra Champ , είμαστε αφοσιωμένοι στη δημιουργία μιας κοινότητας φίλων του ποδοσφαίρου. Η πλατφόρμα μας οργανώνει αγώνες και τουρνουά σε διάφορα επίπεδα, προσφέροντας ευκαιρίες στους παίκτες να δείξουν τις ικανότητές τους, να κάνουν νέους φίλους και να απολαύσουν το όμορφο παιχνίδι.
            </p>
            <p className="text-base sm:text-lg text-black">
              Με σύγχρονες εγκαταστάσεις, κανόνες fair play και πάθος για το ποδόσφαιρο, διασφαλίζουμε ότι κάθε event είναι αξέχαστο και συναρπαστικό.
            </p>
          </div>
          <div className="relative h-56 sm:h-64 md:h-96">
            <Image
              src="/pexels-omar2.jpg"
              alt="Ποδοσφαιριστές σε δράση"
              fill
              className="object-cover rounded-lg shadow-lg"
              priority
            />
          </div>
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="min-h-[50vh] sm:min-h-[60vh] flex items-center justify-center bg-grid-18 text-white text-center">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl sm:text-4xl font-sans font-bold mb-4 sm:mb-6">Έτοιμοι για σέντρα;</h2>
          <p className="text-base sm:text-xl mb-6 sm:mb-8">
            Κάντε εγγραφή σήμερα και μπείτε στον γεμάτο δράση κόσμο του Ultra Champ.
          </p>
          <a
            href="/sign-up"
            className="bg-yellow-600 text-white px-6 sm:px-8 py-3 rounded-full font-semibold transition hover:bg-black hover:border hover:border-white"
          >
            Ξεκινήστε
          </a>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-12 sm:py-16 bg-gradient-to-r from-yellow-500 to-yellow-900 text-white">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl sm:text-4xl text-black font-bold mb-8 sm:mb-12 text-center">Τι λένε οι παίκτες μας</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            <div className="bg-white text-black p-6 rounded-lg shadow-md">
              <p className="mb-4">«Φοβερή εμπειρία! Τα τουρνουά είναι άρτια οργανωμένα και γεμάτα ενέργεια.»</p>
              <div className="font-semibold">- Alex Johnson</div>
            </div>
            <div className="bg-white text-black p-6 rounded-lg shadow-md">
              <p className="mb-4">«Βρήκα την ιδανική ομάδα μου εδώ. Το προτείνω ανεπιφύλακτα!»</p>
              <div className="font-semibold">- Maria Gonzalez</div>
            </div>
            <div className="bg-white text-black p-6 rounded-lg shadow-md">
              <p className="mb-4">«Υπέροχη πλατφόρμα για τους λάτρεις του ποδοσφαίρου. Εύχρηστη και διασκεδαστική!»</p>
              <div className="font-semibold">- David Lee</div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 bg-zinc-950 text-white text-center">
        <div className="container mx-auto px-4">
          <p>© 2025 Ultra Chamnp.</p>
          <div className="mt-4">
            <a href="/privacy" className="mx-2 hover:underline">Πολιτική Απορρήτου</a>
            <a href="/terms" className="mx-2 hover:underline">Όροι Χρήσης</a>
            <a href="/contact" className="mx-2 hover:underline">Επικοινωνία</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
