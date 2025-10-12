'use client';
import React from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { Users, Trophy, BarChart3, Sparkles, ChevronRight } from "lucide-react";

// Next.js-ready props
export interface TeamSectionProps {
  lang?: "el" | "en";
  id?: string;
  className?: string;
}


/**
 * Drop this component anywhere on your homepage. It uses TailwindCSS and Framer Motion.
 * All copy is bilingual (Greek/English). Pass lang="en" to switch to English.
 */
export default function TeamSection({ lang = "el", id, className }: TeamSectionProps) {
  const t = TEXT[lang];
  return (
    <section id={id} className={"relative isolate overflow-hidden " + (className ?? "")}>
      {/* background */}
      <GradientBackdrop />

      <div className="mx-auto max-w-7xl px-6 py-24 md:py-32">
        <header className="mb-12 md:mb-16 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs md:text-sm backdrop-blur">
            <Sparkles className="h-4 w-4" />
            <span className="tracking-wide opacity-90">{t.ribbon}</span>
          </div>
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-white md:text-5xl">
            <span className="bg-gradient-to-r from-amber-200 via-white to-amber-200 bg-clip-text text-transparent">
              {t.title}
            </span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-white/70 md:text-base">
            {t.sub}
          </p>
        </header>

        {/* Feature cards */}
        <div className="grid gap-6 md:grid-cols-3">
          {FEATURES[lang].map((f, i) => {
          const { key: featureKey, ...rest } = f as any;
          return <FeatureCard key={featureKey} {...rest} index={i} />;
        })}
        </div>

        {/* CTA row */}
        <div className="mt-12 flex flex-col items-center justify-center gap-4 md:mt-16 md:flex-row">
          <a
            href="#join"
            className="group inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-semibold text-white shadow-lg backdrop-blur transition hover:bg-white/20"
          >
            {t.ctaPrimary}
            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </a>
          <a
            href="#how"
            className="inline-flex items-center gap-2 text-sm font-medium text-white/80 hover:text-white"
          >
            {t.ctaSecondary}
          </a>
        </div>
      </div>
    </section>
  );
}

function FeatureCard({ icon: Icon, title, desc, bullets, accent, index }: any) {
  // subtle 3D tilt based on mouse position
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useTransform(y, [-40, 40], [8, -8]);
  const rotateY = useTransform(x, [-40, 40], [-8, 8]);

  const onMove = (e: React.MouseEvent) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const dx = e.clientX - rect.left - rect.width / 2;
    const dy = e.clientY - rect.top - rect.height / 2;
    x.set(dx);
    y.set(dy);
  };

  return (
    <motion.article
      onMouseMove={onMove}
      style={{ rotateX, rotateY }}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ type: "spring", stiffness: 90, damping: 12, delay: index * 0.05 }}
      className="group relative rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur will-change-transform"
    >
      {/* glow ring */}
      <div
        className="pointer-events-none absolute -inset-px rounded-3xl opacity-0 transition duration-300 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(120px 80px at 10% 0%, var(--card-glow) 0%, transparent 65%), radial-gradient(120px 80px at 90% 100%, var(--card-glow) 0%, transparent 65%)",
          // accent color per card
          // Using CSS variable that we set inline below
        }}
      />

      <div style={{ ['--card-glow' as any]: accent }}>
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
          <Icon className="h-6 w-6" />
        </div>
        <h3 className="text-xl font-semibold text-white">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-white/70">{desc}</p>

        <ul className="mt-4 space-y-2 text-sm text-white/80">
          {bullets.map((b: string, idx: number) => (
            <li key={idx} className="flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
              {b}
            </li>
          ))}
        </ul>
      </div>
    </motion.article>
  );
}

function GradientBackdrop() {
  return (
    <div aria-hidden className="absolute inset-0 -z-10">
      {/* dark textured base */}
      <div className="absolute inset-0 bg-[#0b0b0e]" />

      {/* dotted grid */}
      <svg className="absolute inset-0 opacity-[0.08]" width="100%" height="100%">
        <defs>
          <pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="white" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dots)" />
      </svg>

      {/* glow orbs */}
      <div className="absolute left-1/2 top-0 h-48 w-48 -translate-x-1/2 rounded-full blur-3xl" style={{ background: "radial-gradient(circle at 50% 50%, rgba(253,230,138,0.35), transparent 60%)" }} />
      <div className="absolute bottom-0 right-0 h-56 w-56 translate-x-1/4 translate-y-1/4 rounded-full blur-3xl" style={{ background: "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.18), transparent 60%)" }} />
    </div>
  );
}

const TEXT = {
  el: {
    ribbon: "Η ομάδα σε περιμένει",
    title: "Όλα όσα θα ζήσεις μαζί μας",
    sub: "Όχι άλλο ‘βαρετό’ section. Micro‑interactions, καθαρή γλώσσα και ξεκάθαρα οφέλη — για να νιώθεις τι παίρνεις πριν καν γραφτείς.",
    ctaPrimary: "Γίνε μέλος τώρα",
    ctaSecondary: "Δες πώς δουλεύει",
  },
  en: {
    ribbon: "Your squad is waiting",
    title: "What you’ll experience with us",
    sub: "No more boring feature blocks. Micro‑interactions, clear language and benefits you can feel — before you even join.",
    ctaPrimary: "Join now",
    ctaSecondary: "See how it works",
  },
} as const;

const FEATURES = {
  el: [
    {
      key: "community",
      icon: Users,
      title: "Φιλόξενη Κοινότητα",
      desc: "Σε καλωσορίζουμε με χαμόγελο — γνώρισε συμπαίκτες, βρες παρέες και γίνε μέλος μιας ζωντανής κοινότητας.",
      bullets: [
        "Discord & group chats για όλους",
        "Open runs κάθε εβδομάδα",
        "Real‑life events & καφέ μετά τον αγώνα",
      ],
      accent: "linear-gradient(90deg, #f59e0b, #fde68a)",
    },
    {
      key: "matches",
      icon: Trophy,
      title: "Ποιοτικοί Αγώνες",
      desc: "Καλοοργανωμένα παιχνίδια, δίκαιη διαιτησία και ευκαιρίες για όλους — όχι μόνο για τους «πρωταθλητές».",
      bullets: [
        "Ισορροπημένα ρόστερ & επίπεδα",
        "Σταθερά γήπεδα & ώρες",
        "MVP & fair‑play ratings",
      ],
      accent: "linear-gradient(90deg, #a78bfa, #fbcfe8)",
    },
    {
      key: "profile",
      icon: BarChart3,
      title: "Προφίλ & Στατιστικά",
      desc: "Γκολ, ασίστ, clean sheets και MVPs — κράτα το ιστορικό σου και δες την πρόοδό σου σε κάθε σεζόν.",
      bullets: [
        "Προσωπικό season history",
        "Leaderboards φίλων",
        "Badges & επιτεύγματα",
      ],
      accent: "linear-gradient(90deg, #34d399, #6ee7b7)",
    },
  ],
  en: [
    {
      key: "community",
      icon: Users,
      title: "Welcoming Community",
      desc: "Join with a smile — meet teammates, find squads, and be part of a living community.",
      bullets: ["Discord & group chats", "Open runs weekly", "IRL events & coffee after"],
      accent: "linear-gradient(90deg, #f59e0b, #fde68a)",
    },
    {
      key: "matches",
      icon: Trophy,
      title: "Quality Matches",
      desc: "Well‑run games, fair refereeing and chances for everyone — not just the ‘pros’.",
      bullets: ["Balanced rosters", "Reliable venues & times", "MVP & fair‑play ratings"],
      accent: "linear-gradient(90deg, #a78bfa, #fbcfe8)",
    },
    {
      key: "profile",
      icon: BarChart3,
      title: "Profile & Stats",
      desc: "Goals, assists, clean sheets and MVPs — keep your history and watch your progress every season.",
      bullets: ["Personal season history", "Friends leaderboards", "Badges & achievements"],
      accent: "linear-gradient(90deg, #34d399, #6ee7b7)",
    },
  ],
} as const;


// Optional named export for convenience
export { TeamSection as TeamFeatureSection };
