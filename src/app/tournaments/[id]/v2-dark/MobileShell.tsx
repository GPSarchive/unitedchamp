"use client";

/**
 * Tournament mobile shell — DISPATCH · Pocket edition.
 * Thumb-first, section-stacked, vertical knockout.
 * Visible only on < md viewports.
 */

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import Link from "next/link";
import { motion, AnimatePresence, useScroll, useSpring } from "framer-motion";
import type {
  Awards,
  DraftMatch,
  Group,
  Player,
  Stage,
  Standing,
  Team,
  Tournament,
} from "@/app/tournaments/useTournamentData";
import { resolvePlayerPhotoUrl } from "@/app/lib/player-images";
import KOBracketV2Dark from "./KOBracketV2Dark";

// ───────────────────────────────────────────────────────────────────────
// Shared types
// ───────────────────────────────────────────────────────────────────────
type Data = {
  tournament: Tournament;
  teams: Team[];
  players: Player[];
  matches: DraftMatch[];
  stages: Stage[];
  standings: Standing[];
  awards: Awards | null;
  groups: Group[];
};

// ───────────────────────────────────────────────────────────────────────
// Utilities
// ───────────────────────────────────────────────────────────────────────
const pad2 = (n: number | string) => String(n).padStart(2, "0");

const elDate = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("el-GR", {
        day: "2-digit",
        month: "short",
      })
    : "";

const elTime = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleTimeString("el-GR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

const elDayFull = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("el-GR", {
        weekday: "short",
        day: "2-digit",
        month: "short",
      })
    : "ΤΒΑ";

const safeColour = (c?: string | null) =>
  c && /^#[0-9A-Fa-f]{6}$/.test(c) ? c : null;

// ───────────────────────────────────────────────────────────────────────
// Section config for the jump nav
// ───────────────────────────────────────────────────────────────────────
const SECTIONS = [
  { id: "overview", label: "Επισκόπηση" },
  { id: "table", label: "Βαθμολογία" },
  { id: "stages", label: "Φάσεις" },
  { id: "scorers", label: "Σκόρερ" },
  { id: "awards", label: "Τιμές" },
  { id: "squads", label: "Ομάδες" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

// ───────────────────────────────────────────────────────────────────────
// MAIN
// ───────────────────────────────────────────────────────────────────────
export default function MobileShell({ data }: { data: Data }) {
  const {
    tournament,
    teams,
    players,
    matches,
    stages,
    standings,
    awards,
    groups,
  } = data;

  const teamById = useMemo(() => {
    const m = new Map<number, Team>();
    teams.forEach((t) => m.set(t.id, t));
    return m;
  }, [teams]);

  const groupById = useMemo(() => {
    const m = new Map<number, Group>();
    groups.forEach((g) => m.set(g.id, g));
    return m;
  }, [groups]);

  const winner = tournament.winner_team_id
    ? teamById.get(tournament.winner_team_id) ?? null
    : null;

  const totalGoals = useMemo(
    () =>
      matches.reduce(
        (acc, m) => acc + (m.team_a_score ?? 0) + (m.team_b_score ?? 0),
        0
      ),
    [matches]
  );
  const completedMatches = useMemo(
    () => matches.filter((m) => m.status === "finished").length,
    [matches]
  );

  const sortedStages = useMemo(
    () => [...stages].sort((a, b) => a.ordering - b.ordering),
    [stages]
  );
  const primaryStage = sortedStages[0];
  const topStandings = useMemo(() => {
    if (!primaryStage) return [];
    return standings.filter((s) => s.stage_id === primaryStage.id);
  }, [primaryStage, standings]);

  const scorer = awards?.top_scorer_id
    ? players.find((p) => p.id === awards.top_scorer_id) ?? null
    : null;
  const mvp = awards?.mvp_player_id
    ? players.find((p) => p.id === awards.mvp_player_id) ?? null
    : null;
  const gk = awards?.best_gk_player_id
    ? players.find((p) => p.id === awards.best_gk_player_id) ?? null
    : null;

  const hasOverview = !!winner || !!tournament.logo;
  const hasTable = !!primaryStage && topStandings.length > 0;
  const hasStages = sortedStages.length > 0;
  const hasScorers = players.length > 0;
  const hasAwards = !!(scorer || mvp || gk);
  const hasSquads = teams.length > 0;

  const visibleSections = SECTIONS.filter((s) => {
    if (s.id === "overview") return hasOverview;
    if (s.id === "table") return hasTable;
    if (s.id === "stages") return hasStages;
    if (s.id === "scorers") return hasScorers;
    if (s.id === "awards") return hasAwards;
    if (s.id === "squads") return hasSquads;
    return true;
  });

  return (
    <div className="relative">
      <ScrollProgress />

      <MobileTopStrip tournament={tournament} />

      <MobileMasthead
        tournament={tournament}
        totals={{
          teams: teams.length,
          stages: stages.length,
          matches: completedMatches,
          goals: totalGoals,
        }}
      />

      <JumpNav sections={visibleSections} />

      {hasOverview && (
        <Section id="overview">
          <OverviewBlock
            tournament={tournament}
            winner={winner}
            totals={{
              teams: teams.length,
              stages: stages.length,
              matches: completedMatches,
              goals: totalGoals,
              total: matches.length,
            }}
          />
        </Section>
      )}

      {hasTable && (
        <Section id="table">
          <RubricMobile
            kicker={`Βαθμολογία · ${primaryStage.name}`}
            title="Ο Πίνακας"
          />
          <MobileStandings
            standings={topStandings}
            teamById={teamById}
            groupById={groupById}
          />
        </Section>
      )}

      {hasStages && (
        <Section id="stages">
          <RubricMobile
            kicker="Ιστορικό"
            title="Φάσεις & Αγώνες"
            meta={`${sortedStages.length} κεφάλαια`}
          />
          <div className="space-y-8">
            {sortedStages.map((stage, i) => (
              <MobileStageSection
                key={stage.id}
                stage={stage}
                index={i}
                matches={matches}
                standings={standings}
                teamById={teamById}
                groupById={groupById}
                championTeamId={tournament.winner_team_id}
              />
            ))}
          </div>
        </Section>
      )}

      {hasScorers && (
        <Section id="scorers">
          <RubricMobile
            kicker="Σκόρερ"
            title="Κορυφαίοι"
            meta="Σύνολα σεζόν"
          />
          <MobileTopScorers players={players} teamById={teamById} />
        </Section>
      )}

      {hasAwards && (
        <Section
          id="awards"
          className="bg-[#13131d]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 10% 10%, #fb923c22 0%, transparent 50%), radial-gradient(circle at 90% 90%, #E8B93122 0%, transparent 50%)",
          }}
        >
          <RubricMobile
            kicker="Αίθουσα Τιμής"
            title="Οι Ήρωες"
            accent="#E8B931"
          />
          <MobileAwardsCarousel
            scorer={scorer}
            mvp={mvp}
            gk={gk}
            teamById={teamById}
            awards={awards}
          />
        </Section>
      )}

      {hasSquads && (
        <Section id="squads">
          <RubricMobile
            kicker="Ρόστερ"
            title="Οι Ομάδες"
            meta={`${teams.length} ομάδες`}
          />
          <MobileTeamsGrid teams={teams} />
        </Section>
      )}

      <MobileColophon tournament={tournament} />
      <ScrollToTopFab />
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Scroll progress bar — pinned to top, reads document scroll
// ───────────────────────────────────────────────────────────────────────
const ScrollProgress: React.FC = () => {
  const { scrollYProgress } = useScroll();
  const width = useSpring(scrollYProgress, {
    stiffness: 200,
    damping: 30,
    restDelta: 0.001,
  });
  return (
    <motion.div
      style={{ scaleX: width }}
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[2px] origin-left bg-[#fb923c]"
      aria-hidden
    />
  );
};

// ───────────────────────────────────────────────────────────────────────
// Top meta strip — same feel as desktop, tighter
// ───────────────────────────────────────────────────────────────────────
const MobileTopStrip: React.FC<{ tournament: Tournament }> = ({
  tournament,
}) => {
  const statusCopy =
    tournament.status === "running"
      ? "ΖΩΝΤΑΝΑ"
      : tournament.status === "completed"
      ? "ΕΛΗΞΕ"
      : tournament.status === "archived"
      ? "ΑΡΧΕΙΟ"
      : "ΠΡΟΓΡΑΜΜΑΤΙΣΜΕΝΟ";

  return (
    <div className="border-b-2 border-[#F3EFE6]/20 bg-[#0a0a14]/85 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3 px-4 py-2 font-mono text-[9px] uppercase tracking-[0.25em] text-[#F3EFE6]/85">
        <span>N°{pad2(tournament.id)}</span>
        <div className="flex items-center gap-2">
          {tournament.status === "running" && (
            <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-[#fb923c]" />
          )}
          <span className="font-bold">{statusCopy}</span>
        </div>
      </div>
    </div>
  );
};

// ───────────────────────────────────────────────────────────────────────
// Compact masthead — 40vh, centered crest, big italic name
// ───────────────────────────────────────────────────────────────────────
const MobileMasthead: React.FC<{
  tournament: Tournament;
  totals: { teams: number; stages: number; matches: number; goals: number };
}> = ({ tournament }) => (
  <header className="relative border-b-2 border-[#F3EFE6]/20">
    <div className="px-5 pt-6 pb-8">
      {/* breadcrumb */}
      <nav className="mb-5 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.22em] text-[#F3EFE6]/55">
        <Link href="/" className="hover:text-[#fb923c] transition-colors">
          Αρχική
        </Link>
        <span>/</span>
        <Link
          href="/tournaments"
          className="hover:text-[#fb923c] transition-colors"
        >
          Διοργανώσεις
        </Link>
      </nav>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
        className="flex flex-col items-center text-center"
      >
        {tournament.logo && (
          <div
            className="mb-5 grid h-24 w-24 place-items-center rounded-full border-2 border-[#F3EFE6]/20 bg-[#13131d] p-2"
            style={{ boxShadow: "5px 5px 0 0 #fb923c" }}
          >
            <img
              src={tournament.logo}
              alt={tournament.name}
              className="h-full w-full object-contain"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src =
                  "/team-placeholder.svg";
              }}
            />
          </div>
        )}

        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-[#fb923c]">
          <span className="h-[2px] w-6 bg-[#fb923c]" />
          Πρωτάθλημα
          <span className="h-[2px] w-6 bg-[#fb923c]" />
        </div>

        <h1
          className="mt-3 font-[var(--f-display)] font-black italic leading-[0.88] tracking-[-0.02em] text-[#F3EFE6]"
          style={{ fontSize: "clamp(2.25rem, 12vw, 3.25rem)" }}
        >
          {tournament.name}
        </h1>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.22em]">
          {tournament.season && (
            <span className="border border-[#F3EFE6]/20 bg-[#13131d] px-2 py-1 text-[#F3EFE6]/75">
              Σεζόν {tournament.season}
            </span>
          )}
          <span className="border border-[#F3EFE6]/20 bg-[#13131d] px-2 py-1 text-[#F3EFE6]/75">
            {tournament.format}
          </span>
        </div>
      </motion.div>
    </div>
  </header>
);

// ───────────────────────────────────────────────────────────────────────
// Section wrapper
// ───────────────────────────────────────────────────────────────────────
const Section: React.FC<{
  id: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}> = ({ id, children, className = "", style }) => (
  <section
    id={id}
    className={`scroll-mt-[84px] border-b-2 border-[#F3EFE6]/15 px-5 py-10 ${className}`}
    style={style}
  >
    {children}
  </section>
);

// ───────────────────────────────────────────────────────────────────────
// Section rubric header
// ───────────────────────────────────────────────────────────────────────
const RubricMobile: React.FC<{
  kicker: string;
  title: string;
  meta?: string;
  accent?: string;
}> = ({ kicker, title, meta, accent = "#fb923c" }) => (
  <div className="mb-5">
    <div
      className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.3em]"
      style={{ color: accent }}
    >
      <span className="h-[2px] w-6" style={{ background: accent }} />
      {kicker}
    </div>
    <div className="mt-2 flex items-end justify-between gap-3 border-b-2 border-[#F3EFE6]/15 pb-2">
      <h2
        className="font-[var(--f-display)] font-black italic leading-none tracking-[-0.02em] text-[#F3EFE6]"
        style={{ fontSize: "clamp(1.75rem, 8vw, 2.25rem)" }}
      >
        {title}
      </h2>
      {meta && (
        <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#F3EFE6]/55">
          {meta}
        </span>
      )}
    </div>
  </div>
);

// ───────────────────────────────────────────────────────────────────────
// Sticky section-jump nav + progress underline
// ───────────────────────────────────────────────────────────────────────
const JumpNav: React.FC<{ sections: ReadonlyArray<{ id: string; label: string }> }> = ({
  sections,
}) => {
  const [active, setActive] = useState<string>(sections[0]?.id ?? "overview");
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    const elements = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => !!el);

    if (!elements.length) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) => b.intersectionRatio - a.intersectionRatio
          );
        if (visible[0]) setActive(visible[0].target.id);
      },
      {
        rootMargin: "-100px 0px -55% 0px",
        threshold: [0, 0.25, 0.5, 0.75, 1],
      }
    );
    elements.forEach((el) => obs.observe(el));
    observers.push(obs);
    return () => observers.forEach((o) => o.disconnect());
  }, [sections]);

  // Center the active pill in the scroller
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const pill = container.querySelector<HTMLAnchorElement>(
      `[data-jump-target="${active}"]`
    );
    if (!pill) return;
    const containerRect = container.getBoundingClientRect();
    const pillRect = pill.getBoundingClientRect();
    const scrollTarget =
      pill.offsetLeft - container.offsetLeft - containerRect.width / 2 + pillRect.width / 2;
    container.scrollTo({ left: scrollTarget, behavior: "smooth" });
  }, [active]);

  const onJump = useCallback(
    (id: string) => (e: React.MouseEvent) => {
      e.preventDefault();
      const el = document.getElementById(id);
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY - 72;
      window.scrollTo({ top, behavior: "smooth" });
    },
    []
  );

  return (
    <nav
      aria-label="Section navigation"
      className="sticky top-0 z-40 border-b-2 border-[#F3EFE6]/15 bg-[#0a0a14]/90 backdrop-blur-md"
      style={{ WebkitBackdropFilter: "blur(12px)" }}
    >
      <div
        ref={containerRef}
        className="flex items-center gap-2 overflow-x-auto scroll-smooth px-4 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {sections.map((s) => {
          const isActive = active === s.id;
          return (
            <a
              key={s.id}
              href={`#${s.id}`}
              data-jump-target={s.id}
              onClick={onJump(s.id)}
              className={`relative shrink-0 border-2 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] transition-all ${
                isActive
                  ? "border-[#fb923c] bg-[#fb923c] text-[#0a0a14]"
                  : "border-[#F3EFE6]/20 bg-[#13131d] text-[#F3EFE6]/70 active:scale-[0.97]"
              }`}
            >
              {s.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
};

// ───────────────────────────────────────────────────────────────────────
// Overview — snap carousel of stats + champion card
// ───────────────────────────────────────────────────────────────────────
const OverviewBlock: React.FC<{
  tournament: Tournament;
  winner: Team | null;
  totals: {
    teams: number;
    stages: number;
    matches: number;
    goals: number;
    total: number;
  };
}> = ({ tournament, winner, totals }) => {
  const statCards: { label: string; value: number; accent: string; sub?: string }[] = [
    { label: "Ομάδες", value: totals.teams, accent: "#fb923c" },
    { label: "Φάσεις", value: totals.stages, accent: "#F3EFE6" },
    {
      label: "Αγώνες",
      value: totals.matches,
      accent: "#F3EFE6",
      sub: `από ${pad2(totals.total)}`,
    },
    { label: "Γκολ", value: totals.goals, accent: "#E8B931" },
  ];

  return (
    <div className="space-y-5">
      {winner && <MobileChampionCard winner={winner} />}

      {/* Stats snap carousel */}
      <div className="-mx-5 overflow-hidden">
        <div
          className="flex gap-3 overflow-x-auto px-5 pb-2 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ scrollPaddingInline: 20 }}
        >
          {statCards.map((s, i) => (
            <div
              key={s.label}
              className="relative shrink-0 snap-start border-2 border-[#F3EFE6]/20 bg-[#13131d] p-5"
              style={{
                width: "70vw",
                maxWidth: 260,
                boxShadow: `4px 4px 0 0 ${s.accent}`,
              }}
            >
              <div
                className="font-mono text-[10px] font-bold uppercase tracking-[0.3em]"
                style={{ color: s.accent }}
              >
                / {pad2(i + 1)} · {s.label}
              </div>
              <div
                className="mt-3 font-[var(--f-brutal)] leading-none text-[#F3EFE6]"
                style={{ fontSize: "clamp(3rem, 16vw, 4.5rem)" }}
              >
                {s.value}
              </div>
              {s.sub && (
                <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[#F3EFE6]/55">
                  {s.sub}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ───────────────────────────────────────────────────────────────────────
// Mobile champion card — full-width pocket edition
// ───────────────────────────────────────────────────────────────────────
const MobileChampionCard: React.FC<{ winner: Team }> = ({ winner }) => {
  const colour = safeColour(winner.colour) ?? "#E8B931";
  return (
    <div
      className="relative overflow-hidden border-2 border-[#F3EFE6]/20 bg-[#13131d]"
      style={{ boxShadow: `6px 6px 0 0 ${colour}` }}
    >
      <div
        aria-hidden
        className="absolute left-0 top-0 h-full w-1.5"
        style={{ background: colour }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(circle at 85% 15%, ${colour}22 0%, transparent 55%)`,
        }}
      />

      <div className="relative flex items-center justify-between border-b-2 border-[#F3EFE6]/15 bg-[#0a0a14]/60 px-4 py-1.5 pl-5 font-mono text-[10px] uppercase tracking-[0.3em]">
        <span className="font-bold text-[#E8B931]">★ Πρωταθλητής</span>
        <span className="text-[#F3EFE6]/55">01</span>
      </div>

      <div className="relative flex items-center gap-4 px-4 py-4 pl-5">
        <div
          className="relative grid h-16 w-16 shrink-0 place-items-center rounded-full border-2 bg-[#0a0a14]"
          style={{
            borderColor: colour,
            boxShadow: `0 0 24px ${colour}33`,
          }}
        >
          {winner.logo ? (
            <img
              src={winner.logo}
              alt={winner.name}
              className="h-[90%] w-[90%] rounded-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src =
                  "/team-placeholder.svg";
              }}
            />
          ) : (
            <span
              className="font-[var(--f-brutal)] text-2xl"
              style={{ color: colour }}
            >
              {String(winner.name ?? "?").slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p
            className="font-mono text-[10px] uppercase tracking-[0.25em]"
            style={{ color: colour }}
          >
            Νικητής
          </p>
          <p className="mt-1 font-[var(--f-display)] text-xl font-black italic leading-none text-[#F3EFE6] truncate">
            {winner.name}
          </p>
        </div>
      </div>

      <div className="relative flex items-center justify-between border-t border-[#F3EFE6]/10 px-4 py-2 pl-5 font-mono text-[10px] uppercase tracking-[0.22em] text-[#F3EFE6]/60">
        <span className="flex items-center gap-2">
          <span className="text-[#F3EFE6]/45">Ρεκόρ</span>
          <span className="font-[var(--f-brutal)] text-sm text-[#F3EFE6]">
            {winner.wins}Ν·{winner.draws}Ι·{winner.losses}Η
          </span>
        </span>
        <span className="flex items-center gap-2">
          <span className="text-[#F3EFE6]/45">Βαθμοί</span>
          <span
            className="font-[var(--f-brutal)] text-base leading-none"
            style={{ color: colour }}
          >
            {winner.points}
          </span>
        </span>
      </div>
    </div>
  );
};

// ───────────────────────────────────────────────────────────────────────
// Standings — card rows, expandable
// ───────────────────────────────────────────────────────────────────────
const MobileStandings: React.FC<{
  standings: Standing[];
  teamById: Map<number, Team>;
  groupById: Map<number, Group>;
}> = ({ standings, teamById, groupById }) => {
  if (!standings.length)
    return (
      <div className="border-2 border-dashed border-[#F3EFE6]/25 bg-[#13131d]/40 p-8 text-center font-mono text-xs uppercase tracking-[0.2em] text-[#F3EFE6]/55">
        Καμία βαθμολογία ακόμα
      </div>
    );

  const byGroup = new Map<number | string, Standing[]>();
  for (const s of standings) {
    const gid = s.group_id ?? "league";
    if (!byGroup.has(gid)) byGroup.set(gid, []);
    byGroup.get(gid)!.push(s);
  }

  return (
    <div className="space-y-6">
      {Array.from(byGroup.entries()).map(([gid, rows]) => {
        const g = typeof gid === "number" ? groupById.get(gid) : null;
        const sorted = [...rows].sort(
          (a, b) => (a.rank ?? 999) - (b.rank ?? 999) || b.points - a.points
        );
        return (
          <div key={String(gid)} className="space-y-2">
            {g && (
              <div className="flex items-center justify-between border-b border-[#F3EFE6]/15 pb-1 font-mono text-[10px] uppercase tracking-[0.3em] text-[#fb923c]">
                <span>Όμιλος · {g.name}</span>
                <span className="text-[#F3EFE6]/55">
                  {pad2(sorted.length)}
                </span>
              </div>
            )}
            {sorted.map((row, i) => (
              <StandingRow
                key={`${gid}-${row.team_id}`}
                row={row}
                team={teamById.get(row.team_id)}
                index={i}
                isLast={i === sorted.length - 1 && sorted.length > 3}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
};

const StandingRow: React.FC<{
  row: Standing;
  team: Team | undefined;
  index: number;
  isLast: boolean;
}> = ({ row, team, index, isLast }) => {
  const [open, setOpen] = useState(false);
  const isLead = index === 0;
  const rank = row.rank ?? index + 1;
  const accent = safeColour(team?.colour) ?? (isLead ? "#fb923c" : "#F3EFE6");

  return (
    <div
      className="relative border-2 border-[#F3EFE6]/15 bg-[#0a0a14]"
      style={
        isLead
          ? {
              boxShadow: "3px 3px 0 0 #fb923c",
            }
          : undefined
      }
    >
      {isLead && (
        <div
          aria-hidden
          className="absolute left-0 top-0 h-full w-1"
          style={{ background: "#fb923c" }}
        />
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-[#13131d]/80 transition-colors"
      >
        <span
          className={`font-[var(--f-brutal)] text-lg leading-none tabular-nums ${
            isLead
              ? "text-[#fb923c]"
              : isLast
              ? "text-[#F3EFE6]/30"
              : "text-[#F3EFE6]"
          }`}
        >
          {pad2(rank)}
        </span>
        {team?.logo ? (
          <img
            src={team.logo}
            alt=""
            className="h-8 w-8 shrink-0 rounded-full border-2 object-cover"
            style={{ borderColor: `${accent}66` }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src =
                "/team-placeholder.svg";
            }}
          />
        ) : (
          <span className="inline-block h-8 w-8 shrink-0 rounded-full border border-[#F3EFE6]/20 bg-[#13131d]" />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-[var(--f-display)] text-sm font-semibold italic leading-tight text-[#F3EFE6] truncate">
            {team?.name ?? `Ομάδα #${row.team_id}`}
          </p>
          <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.22em] text-[#F3EFE6]/55">
            {row.won}Ν · {row.drawn}Ι · {row.lost}Η ·{" "}
            <span className={row.gd >= 0 ? "text-[#fb923c]" : "text-[#ef4444]"}>
              {row.gd >= 0 ? `+${row.gd}` : row.gd} ΔΓ
            </span>
          </p>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="font-[var(--f-brutal)] text-xl leading-none text-[#F3EFE6]">
            {row.points}
          </span>
          <span className="font-mono text-[8px] uppercase tracking-[0.22em] text-[#F3EFE6]/55">
            ΒΑΘ
          </span>
        </div>
        <span
          className={`font-mono text-[10px] text-[#F3EFE6]/40 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        >
          ▾
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-[#F3EFE6]/10 bg-[#13131d]"
          >
            <div className="grid grid-cols-5 divide-x divide-[#F3EFE6]/10 px-1 py-2">
              {[
                { l: "ΑΓ", v: row.played },
                { l: "Ν", v: row.won },
                { l: "Ι", v: row.drawn },
                { l: "ΥΠ", v: row.gf },
                { l: "ΚΑ", v: row.ga },
              ].map((c) => (
                <div key={c.l} className="px-2 text-center">
                  <div className="font-[var(--f-brutal)] text-sm text-[#F3EFE6]">
                    {c.v}
                  </div>
                  <div className="font-mono text-[8px] uppercase tracking-[0.22em] text-[#F3EFE6]/50">
                    {c.l}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ───────────────────────────────────────────────────────────────────────
// Stage section — segmented control + swipe
// ───────────────────────────────────────────────────────────────────────
type StageTab = "table" | "bracket" | "results" | "fixtures";

const MobileStageSection: React.FC<{
  stage: Stage;
  index: number;
  matches: DraftMatch[];
  standings: Standing[];
  teamById: Map<number, Team>;
  groupById: Map<number, Group>;
  championTeamId?: number | null;
}> = ({
  stage,
  index,
  matches,
  standings,
  teamById,
  groupById,
  championTeamId,
}) => {
  const isKnockout = stage.kind === "knockout";
  const [tab, setTab] = useState<StageTab>(isKnockout ? "bracket" : "table");

  const stageMatches = useMemo(
    () =>
      matches.filter(
        (m) => m.stageIdx === index || (m as any).stage_id === stage.id
      ),
    [matches, stage.id, index]
  );
  const fixtures = useMemo(
    () =>
      stageMatches
        .filter((m) => m.status === "scheduled")
        .sort((a, b) =>
          (a.match_date ?? "").localeCompare(b.match_date ?? "")
        ),
    [stageMatches]
  );
  const results = useMemo(
    () =>
      stageMatches
        .filter((m) => m.status === "finished")
        .sort((a, b) =>
          (b.match_date ?? "").localeCompare(a.match_date ?? "")
        ),
    [stageMatches]
  );
  const stageStandings = useMemo(
    () => standings.filter((s) => s.stage_id === stage.id),
    [standings, stage.id]
  );

  const kindLabel =
    stage.kind === "league"
      ? "Πρωτάθλημα"
      : stage.kind === "groups"
      ? "Όμιλοι"
      : stage.kind === "knockout"
      ? "Νοκ Άουτ"
      : stage.kind;

  const tabs = (
    isKnockout
      ? (["bracket", "results", "fixtures"] as const)
      : (["table", "results", "fixtures"] as const)
  ) as StageTab[];

  const tabLabel = (t: StageTab) => {
    if (t === "table") return "Βαθμολογία";
    if (t === "bracket") return "Δέντρο";
    if (t === "results") return `Αποτελ. (${results.length})`;
    return `Πρόγρ. (${fixtures.length})`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.5 }}
      className="overflow-hidden border-2 border-[#F3EFE6]/15 bg-[#0a0a14]"
    >
      {/* Stage header strip */}
      <div className="flex items-center gap-3 border-b-2 border-[#F3EFE6]/15 bg-[#13131d] px-4 py-3">
        <span
          className="font-[var(--f-brutal)] text-2xl leading-none text-[#E8B931]"
          style={{ fontFeatureSettings: '"tnum"' }}
        >
          {pad2(index + 1)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#fb923c]">
            Κεφάλαιο {index + 1} · {kindLabel}
          </p>
          <h3 className="font-[var(--f-display)] text-lg font-black italic leading-tight text-[#F3EFE6] truncate">
            {stage.name}
          </h3>
        </div>
      </div>

      {/* Segmented tab control */}
      <SegmentedTabs
        tabs={tabs.map((t) => ({ id: t, label: tabLabel(t) }))}
        active={tab}
        onChange={(id) => setTab(id as StageTab)}
      />

      <div className="p-4">
        <AnimatePresence mode="wait">
          {tab === "table" && (
            <motion.div
              key="table"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.2 }}
            >
              <MobileStandings
                standings={stageStandings}
                teamById={teamById}
                groupById={groupById}
              />
            </motion.div>
          )}

          {tab === "bracket" && (
            <motion.div
              key="bracket"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.2 }}
              /*
               * Reuse the desktop KO bracket verbatim.
               * Negative margins break out of the stage card's 16px padding
               * so the bracket viewport spans the full screen width — the
               * bracket's own pan/zoom + Fit button handle readability.
               */
              className="-mx-4"
            >
              <KOBracketV2Dark
                stage={stage}
                stageIdx={index}
                matches={stageMatches}
                teamById={teamById}
                championTeamId={championTeamId ?? null}
              />
            </motion.div>
          )}

          {tab === "results" && (
            <motion.div
              key="results"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-2"
            >
              {results.length ? (
                results
                  .slice(0, 20)
                  .map((m, i) => (
                    <MobileMatchCard
                      key={m.db_id ?? i}
                      m={m}
                      teamById={teamById}
                      mode="result"
                    />
                  ))
              ) : (
                <EmptyBlock text="Δεν υπάρχουν αποτελέσματα ακόμα" />
              )}
            </motion.div>
          )}

          {tab === "fixtures" && (
            <motion.div
              key="fixtures"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-2"
            >
              {fixtures.length ? (
                fixtures
                  .slice(0, 20)
                  .map((m, i) => (
                    <MobileMatchCard
                      key={m.db_id ?? i}
                      m={m}
                      teamById={teamById}
                      mode="fixture"
                    />
                  ))
              ) : (
                <EmptyBlock text="Δεν υπάρχουν προγραμματισμένοι αγώνες" />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

// Segmented iOS-style tabs with a sliding orange thumb
const SegmentedTabs: React.FC<{
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}> = ({ tabs, active, onChange }) => {
  const activeIndex = Math.max(0, tabs.findIndex((t) => t.id === active));
  return (
    <div className="relative p-2">
      <div
        className="relative grid gap-1 rounded-md border border-[#F3EFE6]/15 bg-[#13131d] p-1"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0,1fr))` }}
      >
        {/* Sliding thumb */}
        <motion.div
          layout
          aria-hidden
          className="absolute inset-y-1 rounded-[3px] bg-[#fb923c]"
          style={{
            width: `calc((100% - ${(tabs.length + 1) * 4}px) / ${tabs.length})`,
            left: `calc(${activeIndex} * ((100% - ${
              (tabs.length + 1) * 4
            }px) / ${tabs.length}) + ${4 + activeIndex * 4}px)`,
          }}
          transition={{ type: "spring", stiffness: 400, damping: 32 }}
        />
        {tabs.map((t) => {
          const isActive = t.id === active;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(t.id)}
              className={`relative z-10 py-1.5 text-center font-mono text-[10px] font-bold uppercase tracking-[0.2em] transition-colors active:scale-[0.97] ${
                isActive ? "text-[#0a0a14]" : "text-[#F3EFE6]/70"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ───────────────────────────────────────────────────────────────────────
// Mobile KO stack — vertical rounds with arrow connectors
// ───────────────────────────────────────────────────────────────────────
function getRoundLabel(round: number, maxRound: number): string {
  const diff = maxRound - round;
  if (diff === 0) return "Τελικός";
  if (diff === 1) return "Ημιτελικά";
  if (diff === 2) return "Προημιτελικά";
  return `Φάση των ${Math.pow(2, maxRound - round + 1)}`;
}

const MobileKOStack: React.FC<{
  matches: DraftMatch[];
  teamById: Map<number, Team>;
  championTeamId: number | null;
}> = ({ matches, teamById, championTeamId }) => {
  const rows = useMemo(
    () =>
      matches.filter(
        (m) => m.round != null && m.bracket_pos != null
      ),
    [matches]
  );

  if (!rows.length) {
    return <EmptyBlock text="Δεν έχει οριστεί δέντρο νοκ άουτ" />;
  }

  const maxRound = Math.max(...rows.map((m) => m.round ?? 1));

  const byRound = new Map<number, DraftMatch[]>();
  rows.forEach((m) => {
    const r = m.round ?? 1;
    if (!byRound.has(r)) byRound.set(r, []);
    byRound.get(r)!.push(m);
  });

  // Sort so final renders first (top), then Semis, etc.
  const orderedRounds = Array.from(byRound.keys()).sort((a, b) => b - a);

  const final = byRound.get(maxRound)?.[0] ?? null;
  const champion =
    championTeamId != null
      ? teamById.get(championTeamId) ?? null
      : final?.winner_team_id
      ? teamById.get(final.winner_team_id) ?? null
      : null;

  return (
    <div className="space-y-6">
      {/* Champion crown — if decided */}
      {champion && final?.status === "finished" && (
        <div
          className="relative overflow-hidden border-2 border-[#E8B931]/80 bg-[#13131d] p-4"
          style={{ boxShadow: "4px 4px 0 0 #E8B931" }}
        >
          <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.3em] text-[#E8B931]">
            <span className="flex items-center gap-1.5">★ Πρωταθλητής</span>
            <span>01</span>
          </div>
          <div className="mt-3 flex items-center gap-3">
            {champion.logo && (
              <img
                src={champion.logo}
                alt={champion.name}
                className="h-12 w-12 rounded-full border-2 border-[#E8B931] object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src =
                    "/team-placeholder.svg";
                }}
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-[var(--f-display)] text-xl font-black italic leading-none text-[#F3EFE6] truncate">
                {champion.name}
              </p>
              <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.22em] text-[#F3EFE6]/55">
                Κατακτητής
              </p>
            </div>
          </div>
        </div>
      )}

      {orderedRounds.map((round, idx) => {
        const roundMatches = (byRound.get(round) ?? []).sort(
          (a, b) => (a.bracket_pos ?? 0) - (b.bracket_pos ?? 0)
        );
        const label = getRoundLabel(round, maxRound);
        const isFinal = round === maxRound;
        return (
          <div key={round} className="relative">
            {/* Connector arrow down to next round (which is LOWER in array = earlier round visually below) */}
            {idx < orderedRounds.length - 1 && (
              <div
                className="absolute left-1/2 top-[calc(100%-6px)] z-10 flex -translate-x-1/2 flex-col items-center"
                aria-hidden
              >
                <span
                  className="block h-4 w-[2px]"
                  style={{ background: "#fb923c" }}
                />
                <span
                  className="block h-2 w-2 rotate-45 border-b-2 border-r-2"
                  style={{ borderColor: "#fb923c" }}
                />
              </div>
            )}

            {/* Round rubric */}
            <div
              className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em]"
              style={{ color: isFinal ? "#E8B931" : "#fb923c" }}
            >
              <span
                className="h-[2px] w-6"
                style={{ background: isFinal ? "#E8B931" : "#fb923c" }}
              />
              {isFinal ? "★ " : ""}
              {label}
              <span className="ml-auto text-[#F3EFE6]/45">
                {pad2(roundMatches.length)}
              </span>
            </div>

            {/* Round matches */}
            <div className="space-y-2">
              {roundMatches.map((m, i) => (
                <KOMatchCard
                  key={`${round}-${m.bracket_pos}-${i}`}
                  match={m}
                  teamById={teamById}
                  isFinal={isFinal}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const KOMatchCard: React.FC<{
  match: DraftMatch;
  teamById: Map<number, Team>;
  isFinal: boolean;
}> = ({ match, teamById, isFinal }) => {
  const a = match.team_a_id ? teamById.get(match.team_a_id) : null;
  const b = match.team_b_id ? teamById.get(match.team_b_id) : null;
  const isFinished = match.status === "finished";
  const aWon = isFinished && match.winner_team_id === match.team_a_id;
  const bWon = isFinished && match.winner_team_id === match.team_b_id;
  const accent = isFinal ? "#E8B931" : "#fb923c";

  return (
    <div
      className="overflow-hidden border-2 bg-[#0a0a14]"
      style={{ borderColor: "rgba(243,239,230,0.2)" }}
    >
      <div
        className="flex items-center justify-between border-b border-[#F3EFE6]/10 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.25em]"
        style={{ background: isFinal ? "#13131d" : "transparent" }}
      >
        <span
          className="flex items-center gap-1.5 font-bold"
          style={{ color: accent }}
        >
          R{match.round} · B{pad2(match.bracket_pos ?? 0)}
        </span>
        {isFinished ? (
          <span
            className="border px-1.5 py-0.5 text-[8px]"
            style={{ borderColor: accent, color: accent }}
          >
            FT
          </span>
        ) : match.match_date ? (
          <span className="text-[#F3EFE6]/60">
            {elDate(match.match_date)}
          </span>
        ) : (
          <span className="text-[#F3EFE6]/40">ΤΒΑ</span>
        )}
      </div>

      <KOTeamRow
        team={a}
        score={isFinished ? match.team_a_score : null}
        isWinner={aWon}
        isLoser={isFinished && bWon}
        accent={accent}
      />
      <div className="h-[1px] bg-[#F3EFE6]/10" />
      <KOTeamRow
        team={b}
        score={isFinished ? match.team_b_score : null}
        isWinner={bWon}
        isLoser={isFinished && aWon}
        accent={accent}
      />
    </div>
  );
};

const KOTeamRow: React.FC<{
  team: Team | null | undefined;
  score: number | null | undefined;
  isWinner: boolean;
  isLoser: boolean;
  accent: string;
}> = ({ team, score, isWinner, isLoser, accent }) => {
  const tbd = !team;
  return (
    <div
      className="flex items-center gap-2.5 px-3 py-2"
      style={{
        background: isWinner ? `${accent}14` : "transparent",
      }}
    >
      {team?.logo ? (
        <img
          src={team.logo}
          alt=""
          className="h-7 w-7 shrink-0 rounded-full border object-cover"
          style={{
            borderColor: isWinner ? accent : "rgba(243,239,230,0.3)",
            opacity: isLoser ? 0.45 : 1,
          }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src =
              "/team-placeholder.svg";
          }}
        />
      ) : (
        <span
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-dashed font-mono text-[10px]"
          style={{
            borderColor: "rgba(243,239,230,0.3)",
            color: "rgba(243,239,230,0.4)",
          }}
        >
          ?
        </span>
      )}
      <span
        className="flex-1 truncate font-[var(--f-display)] text-sm font-semibold italic"
        style={{
          color: isWinner
            ? "#F3EFE6"
            : isLoser
            ? "rgba(243,239,230,0.45)"
            : tbd
            ? "rgba(243,239,230,0.4)"
            : "#F3EFE6",
        }}
      >
        {team?.name ?? "ΤΒΑ"}
      </span>
      {score != null ? (
        <span
          className="font-[var(--f-brutal)] text-base leading-none tabular-nums"
          style={{
            color: isWinner ? accent : isLoser ? "rgba(243,239,230,0.45)" : "#F3EFE6",
          }}
        >
          {score}
        </span>
      ) : (
        <span
          className="font-mono text-xs"
          style={{ color: "rgba(243,239,230,0.3)" }}
        >
          —
        </span>
      )}
    </div>
  );
};

// ───────────────────────────────────────────────────────────────────────
// Match card (non-KO) — 2-row layout
// ───────────────────────────────────────────────────────────────────────
const MobileMatchCard: React.FC<{
  m: DraftMatch;
  teamById: Map<number, Team>;
  mode: "result" | "fixture";
}> = ({ m, teamById, mode }) => {
  const a = m.team_a_id ? teamById.get(m.team_a_id) : null;
  const b = m.team_b_id ? teamById.get(m.team_b_id) : null;
  const aWon = m.winner_team_id === m.team_a_id;
  const bWon = m.winner_team_id === m.team_b_id;
  const hasLink = m.db_id != null;

  const Wrapper: React.ElementType = hasLink ? Link : "div";
  const wrapperProps = hasLink
    ? { href: `/matches/${m.db_id}` }
    : {};

  return (
    <Wrapper
      {...wrapperProps}
      className="block overflow-hidden border-2 border-[#F3EFE6]/15 bg-[#0a0a14] active:bg-[#13131d] transition-colors"
    >
      <div className="flex items-center justify-between border-b border-[#F3EFE6]/10 bg-[#13131d] px-3 py-1 font-mono text-[9px] uppercase tracking-[0.25em] text-[#F3EFE6]/60">
        <span>{elDayFull(m.match_date)}</span>
        {m.matchday != null && <span>Αγωνιστική {m.matchday}</span>}
        {m.round != null && <span>Γύρος {m.round}</span>}
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-3">
        <div className="flex items-center justify-end gap-2 min-w-0">
          <span
            className="truncate text-right font-[var(--f-display)] text-sm font-semibold italic"
            style={{
              color: aWon
                ? "#F3EFE6"
                : bWon
                ? "rgba(243,239,230,0.45)"
                : "#F3EFE6",
            }}
          >
            {a?.name ?? "ΤΒΑ"}
          </span>
          {a?.logo && (
            <img
              src={a.logo}
              alt=""
              className="h-7 w-7 shrink-0 rounded-full border border-[#F3EFE6]/30 object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src =
                  "/team-placeholder.svg";
              }}
            />
          )}
        </div>
        <div className="shrink-0">
          {mode === "result" ? (
            <div className="flex items-center gap-1.5 border-2 border-[#F3EFE6]/15 bg-[#13131d] px-2 py-1 font-[var(--f-brutal)] text-lg leading-none tabular-nums">
              <span className={aWon ? "text-[#fb923c]" : "text-[#F3EFE6]"}>
                {m.team_a_score ?? 0}
              </span>
              <span className="text-[#F3EFE6]/30">:</span>
              <span className={bWon ? "text-[#fb923c]" : "text-[#F3EFE6]"}>
                {m.team_b_score ?? 0}
              </span>
            </div>
          ) : (
            <div className="border-2 border-dashed border-[#F3EFE6]/30 px-2 py-1 text-center font-mono text-[10px] uppercase tracking-[0.22em] text-[#F3EFE6]/70">
              {m.match_date ? elTime(m.match_date) : "ΤΒΑ"}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 min-w-0">
          {b?.logo && (
            <img
              src={b.logo}
              alt=""
              className="h-7 w-7 shrink-0 rounded-full border border-[#F3EFE6]/30 object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src =
                  "/team-placeholder.svg";
              }}
            />
          )}
          <span
            className="truncate font-[var(--f-display)] text-sm font-semibold italic"
            style={{
              color: bWon
                ? "#F3EFE6"
                : aWon
                ? "rgba(243,239,230,0.45)"
                : "#F3EFE6",
            }}
          >
            {b?.name ?? "ΤΒΑ"}
          </span>
        </div>
      </div>
    </Wrapper>
  );
};

// ───────────────────────────────────────────────────────────────────────
// Top scorers — podium + list
// ───────────────────────────────────────────────────────────────────────
const MobileTopScorers: React.FC<{
  players: Player[];
  teamById: Map<number, Team>;
}> = ({ players, teamById }) => {
  const top = useMemo(
    () =>
      [...players]
        .filter((p) => !p.isDeleted && (p.goals || 0) > 0)
        .sort((a, b) => b.goals - a.goals || b.assists - a.assists),
    [players]
  );
  if (!top.length)
    return <EmptyBlock text="Δεν έχουν καταγραφεί γκολ ακόμα" />;

  const podium = top.slice(0, 3);
  const rest = top.slice(3, 10);

  const heights = [96, 120, 82]; // 2nd / 1st / 3rd
  const podiumOrdered = [podium[1], podium[0], podium[2]].filter(
    Boolean
  ) as Player[];
  const labels = ["02", "01", "03"];
  const medalColours = ["#C0C0C0", "#E8B931", "#CD7F32"];

  return (
    <div className="space-y-4">
      {/* Podium */}
      <div className="relative grid grid-cols-3 items-end gap-2">
        {podiumOrdered.map((p, i) => {
          const team = teamById.get(p.teamId);
          const isFirst = p.id === podium[0]?.id;
          const colour = medalColours[labels.indexOf(
            isFirst ? "01" : p.id === podium[1]?.id ? "02" : "03"
          )];
          return (
            <div key={p.id} className="flex flex-col items-center text-center">
              <div
                className="relative flex h-16 w-16 items-center justify-center rounded-full border-2"
                style={{
                  borderColor: colour,
                  background: "#13131d",
                  boxShadow: `0 0 18px ${colour}33`,
                }}
              >
                <img
                  src={resolvePlayerPhotoUrl(p.photo)}
                  alt={p.name}
                  className="h-[94%] w-[94%] rounded-full object-cover"
                />
                <span
                  className="absolute -bottom-2 left-1/2 grid h-6 w-6 -translate-x-1/2 place-items-center border-2 rounded-full font-mono text-[9px] font-bold"
                  style={{
                    borderColor: colour,
                    background: "#0a0a14",
                    color: colour,
                  }}
                >
                  {labels[i]}
                </span>
              </div>
              <div className="mt-3 font-[var(--f-display)] text-xs font-black italic leading-tight text-[#F3EFE6] line-clamp-2 min-h-[2.2em]">
                {p.name}
              </div>
              <div className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.22em] text-[#F3EFE6]/50 truncate w-full">
                {team?.name ?? ""}
              </div>
              <div
                className="mt-2 flex w-full flex-col items-center justify-end border-2"
                style={{
                  height: heights[i],
                  borderColor: colour,
                  background: `${colour}14`,
                }}
              >
                <div
                  className="font-[var(--f-brutal)] text-2xl leading-none"
                  style={{ color: colour }}
                >
                  {p.goals}
                </div>
                <div className="mb-2 font-mono text-[8px] uppercase tracking-[0.22em] text-[#F3EFE6]/55">
                  Γκολ
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Rest of the list */}
      {rest.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 pt-1 font-mono text-[9px] uppercase tracking-[0.3em] text-[#fb923c]">
            <span className="h-[1px] w-5 bg-[#fb923c]" />
            Λοιποί σκόρερ
          </div>
          {rest.map((p, i) => {
            const team = teamById.get(p.teamId);
            return (
              <div
                key={p.id}
                className="flex items-center gap-3 border border-[#F3EFE6]/15 bg-[#13131d] px-3 py-2"
              >
                <span className="w-6 text-center font-[var(--f-brutal)] text-base leading-none text-[#F3EFE6]/80">
                  {pad2(i + 4)}
                </span>
                <img
                  src={resolvePlayerPhotoUrl(p.photo)}
                  alt=""
                  className="h-8 w-8 shrink-0 rounded-full border border-[#F3EFE6]/30 object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-[var(--f-display)] text-sm font-semibold italic leading-tight text-[#F3EFE6] truncate">
                    {p.name}
                  </p>
                  <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-[#F3EFE6]/55 truncate">
                    {team?.name ?? ""}
                  </p>
                </div>
                <span className="font-[var(--f-brutal)] text-lg leading-none tabular-nums text-[#F3EFE6]">
                  {p.goals}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ───────────────────────────────────────────────────────────────────────
// Awards — horizontal swipe deck
// ───────────────────────────────────────────────────────────────────────
type AwardVariant = "scorer" | "mvp" | "gk";

const MobileAwardsCarousel: React.FC<{
  scorer: Player | null;
  mvp: Player | null;
  gk: Player | null;
  teamById: Map<number, Team>;
  awards: Awards | null;
}> = ({ scorer, mvp, gk, teamById, awards }) => {
  const cards: {
    variant: AwardVariant;
    player: Player;
    subline: string;
  }[] = [];
  if (scorer)
    cards.push({
      variant: "scorer",
      player: scorer,
      subline: `${awards?.top_scorer_goals ?? scorer.goals} ΓΚΟΛ`,
    });
  if (mvp)
    cards.push({
      variant: "mvp",
      player: mvp,
      subline: `${mvp.mvp || 1} ΒΡΑΒΕΙΑ`,
    });
  if (gk)
    cards.push({
      variant: "gk",
      player: gk,
      subline: `${gk.bestGoalkeeper || 1} ΔΙΑΚΡΙΣΕΙΣ`,
    });

  const [idx, setIdx] = useState(0);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const onScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const cardWidth = el.clientWidth;
    const page = Math.round(el.scrollLeft / cardWidth);
    setIdx(page);
  }, []);

  return (
    <div>
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="-mx-5 flex snap-x snap-mandatory overflow-x-auto scroll-smooth px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {cards.map((c, i) => (
          <div key={c.variant} className="w-full shrink-0 snap-center pr-3">
            <AwardCardMobile
              variant={c.variant}
              player={c.player}
              team={teamById.get(c.player.teamId) ?? null}
              subline={c.subline}
              index={i}
            />
          </div>
        ))}
      </div>
      {/* Dots */}
      <div className="mt-4 flex items-center justify-center gap-2">
        {cards.map((c, i) => (
          <button
            key={c.variant}
            type="button"
            onClick={() => {
              const el = scrollerRef.current;
              if (!el) return;
              el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
            }}
            aria-label={`Πάει στην κάρτα ${i + 1}`}
            className="h-1.5 rounded-full transition-all"
            style={{
              width: idx === i ? 24 : 6,
              background: idx === i ? "#E8B931" : "rgba(243,239,230,0.25)",
            }}
          />
        ))}
      </div>
    </div>
  );
};

const AwardCardMobile: React.FC<{
  variant: AwardVariant;
  player: Player;
  team: Team | null;
  subline: string;
  index: number;
}> = ({ variant, player, team, subline, index }) => {
  const palette =
    variant === "scorer"
      ? { tint: "#fb923c", label: "Χρυσό Παπούτσι", tag: "ΠΡΩΤΟΣ ΣΚΟΡΕΡ" }
      : variant === "mvp"
      ? { tint: "#E8B931", label: "Πολυτιμότερος", tag: "MVP" }
      : { tint: "#60a5fa", label: "Χρυσά Γάντια", tag: "ΚΑΛΥΤΕΡΟΣ GK" };

  return (
    <div
      className="relative overflow-hidden border-2 border-[#F3EFE6]/20 bg-[#0a0a14]"
      style={{
        boxShadow: `5px 5px 0 0 ${palette.tint}`,
        backgroundImage: `
          radial-gradient(circle at 20% 10%, ${palette.tint}22 0%, transparent 55%),
          radial-gradient(circle at 80% 90%, ${palette.tint}14 0%, transparent 55%)
        `,
      }}
    >
      <div className="flex items-center justify-between border-b-2 border-[#F3EFE6]/15 bg-[#13131d] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.3em]">
        <span style={{ color: palette.tint }}>★ {palette.tag}</span>
        <span className="text-[#F3EFE6]/60">#{pad2(index + 1)}</span>
      </div>

      <div className="relative h-56 overflow-hidden bg-[#13131d]">
        <img
          src={resolvePlayerPhotoUrl(player.photo)}
          alt={player.name}
          className="h-full w-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(180deg, transparent 30%, rgba(10,10,20,0.85) 95%)`,
          }}
        />
        <div
          className="absolute top-3 right-3 h-12 w-1.5"
          style={{
            background: `linear-gradient(180deg, ${palette.tint} 0%, #F3EFE6 50%, ${palette.tint} 100%)`,
          }}
        />
        <div className="absolute inset-x-0 bottom-0 p-3">
          <p
            className="font-mono text-[9px] uppercase tracking-[0.3em]"
            style={{ color: palette.tint }}
          >
            {palette.label}
          </p>
          <p className="mt-1 font-[var(--f-display)] text-xl font-black italic leading-tight text-[#F3EFE6]">
            {player.name}
          </p>
          {team && (
            <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.25em] text-[#F3EFE6]/55">
              {team.name}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-baseline justify-between border-t border-[#F3EFE6]/10 px-3 py-2.5">
        <span
          className="font-[var(--f-brutal)] text-3xl leading-none"
          style={{ color: palette.tint }}
        >
          {subline.split(" ")[0]}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#F3EFE6]/55">
          {subline.split(" ").slice(1).join(" ")}
        </span>
      </div>
    </div>
  );
};

// ───────────────────────────────────────────────────────────────────────
// Teams grid — 2 col compact
// ───────────────────────────────────────────────────────────────────────
const MobileTeamsGrid: React.FC<{ teams: Team[] }> = ({ teams }) => {
  return (
    <div className="grid grid-cols-2 gap-3">
      {teams.map((team, i) => {
        const colour =
          safeColour(team.colour) ??
          (i % 2 === 0 ? "#fb923c" : "#60a5fa");
        return (
          <Link
            key={team.id}
            href={`/OMADA/${team.id}`}
            className="group relative overflow-hidden border-2 border-[#F3EFE6]/20 bg-[#0a0a14] active:scale-[0.98] transition-transform"
            style={{ boxShadow: `3px 3px 0 0 ${colour}` }}
          >
            <div
              aria-hidden
              className="absolute left-0 top-0 h-full w-1"
              style={{ background: colour }}
            />
            <div className="flex items-center gap-2 p-3 pl-3.5">
              {team.logo ? (
                <img
                  src={team.logo}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-full border-2 object-cover"
                  style={{ borderColor: colour }}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src =
                      "/team-placeholder.svg";
                  }}
                />
              ) : (
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 bg-[#13131d] font-[var(--f-brutal)] text-base"
                  style={{ borderColor: colour, color: colour }}
                >
                  {String(team.name ?? "?").slice(0, 1).toUpperCase()}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-[var(--f-display)] text-sm font-bold italic leading-tight text-[#F3EFE6] line-clamp-2">
                  {team.name}
                </p>
              </div>
            </div>
            <div
              className="grid grid-cols-3 divide-x divide-[#F3EFE6]/10 border-t border-[#F3EFE6]/10"
            >
              {[
                { l: "Ν", v: team.wins },
                { l: "Ι", v: team.draws },
                { l: "Η", v: team.losses },
              ].map((c) => (
                <div key={c.l} className="px-1 py-1.5 text-center">
                  <div className="font-[var(--f-brutal)] text-sm leading-none text-[#F3EFE6]">
                    {c.v}
                  </div>
                  <div className="font-mono text-[8px] uppercase tracking-[0.22em] text-[#F3EFE6]/55">
                    {c.l}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-[#F3EFE6]/10 px-3 py-1 font-mono text-[8px] uppercase tracking-[0.25em] text-[#F3EFE6]/55">
              <span>{pad2(team.points)} ΒΑΘ</span>
              <span className="group-active:text-[#fb923c] transition-colors">
                →
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
};

// ───────────────────────────────────────────────────────────────────────
// Colophon
// ───────────────────────────────────────────────────────────────────────
const MobileColophon: React.FC<{ tournament: Tournament }> = ({
  tournament,
}) => (
  <footer className="border-t-2 border-[#F3EFE6]/20 bg-[#13131d] text-[#F3EFE6]">
    <div className="flex flex-col items-start gap-3 px-5 py-6">
      <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#E8B931]">
        Ενημέρωση · v2.0 · Pocket
      </p>
      <h3
        className="font-[var(--f-display)] font-black italic leading-none"
        style={{ fontSize: "clamp(1.5rem, 7vw, 2rem)" }}
      >
        {tournament.name}
      </h3>
      <Link
        href="/tournaments"
        className="mt-2 inline-flex items-center gap-2 border border-[#F3EFE6]/30 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.25em] text-[#F3EFE6] active:bg-[#F3EFE6] active:text-[#0a0a14] transition-colors"
      >
        ← Όλες οι Διοργανώσεις
      </Link>
    </div>
  </footer>
);

// ───────────────────────────────────────────────────────────────────────
// Scroll to top FAB
// ───────────────────────────────────────────────────────────────────────
const ScrollToTopFab: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          transition={{ duration: 0.2 }}
          onClick={() =>
            window.scrollTo({ top: 0, behavior: "smooth" })
          }
          className="fixed bottom-5 right-5 z-50 flex h-11 w-11 items-center justify-center border-2 border-[#fb923c] bg-[#13131d] text-[#fb923c] shadow-[3px_3px_0_0_#fb923c] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_#fb923c] transition-transform"
          aria-label="Επιστροφή Επάνω"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 19V5" />
            <path d="M5 12l7-7 7 7" />
          </svg>
        </motion.button>
      )}
    </AnimatePresence>
  );
};

// ───────────────────────────────────────────────────────────────────────
// Empty state
// ───────────────────────────────────────────────────────────────────────
const EmptyBlock: React.FC<{ text: string }> = ({ text }) => (
  <div className="border-2 border-dashed border-[#F3EFE6]/25 bg-[#13131d]/40 p-8 text-center font-mono text-xs uppercase tracking-[0.2em] text-[#F3EFE6]/55">
    {text}
  </div>
);
