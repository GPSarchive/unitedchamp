// app/page.tsx — UltraChamp home page (editorial language).

export const revalidate = 300; // ISR — regenerate every 5 minutes

import React, { Suspense } from "react";
import Link from "next/link";
import { Fraunces, Archivo_Black, JetBrains_Mono, Figtree } from "next/font/google";
import { Trophy, Users, BarChart3 } from "lucide-react";
import { loadHomeData } from "@/app/home/data";

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
// Page
// ───────────────────────────────────────────────────────────────────────
export default async function Home() {
  const { events: eventsToPass, tournaments, recentContentCount, videoMatches } =
    await loadHomeData();

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
