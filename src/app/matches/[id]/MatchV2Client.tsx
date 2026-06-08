"use client";

/**
 * Match detail — editorial sports-broadsheet × kinetic brutalism.
 * Same atmosphere/typography as /OMADA/[id]: dark ground, ivory ink, orange
 * signal, saffron honours, 2px borders with offset hard shadows, mono labels,
 * italic display headlines.
 */

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Fraunces,
  Archivo_Black,
  JetBrains_Mono,
  Figtree,
} from "next/font/google";
import { PlayerImage, TeamImage, TournamentImage } from "@/app/lib/OptimizedImage";
import {
  GoalIcon,
  AssistIcon,
  OwnGoalIcon,
  YellowCardIcon,
  RedCardIcon,
  BlueCardIcon,
  MvpIcon,
  BestGkIcon,
  CaptainIcon,
  GkIcon,
} from "./StatIcons";
import type { Id, MatchPlayerStatRow } from "@/app/lib/types";
import {
  FormerPlayerBadge,
  isFormerPlayer,
} from "@/components/FormerPlayerBadge";

// ───────────────────────────────────────────────────────────────────────
// Typography
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
// Types (mirrors what page.tsx passes in)
// ───────────────────────────────────────────────────────────────────────
type Team = { id: Id; name: string; logo: string | null };

type Player = {
  id: Id;
  first_name: string | null;
  last_name: string | null;
  photo?: string | null;
  deleted_at?: string | null;
};

type Scorer = {
  player: { id: Id; first_name: string | null; last_name: string | null };
  goals: number;
  ownGoals?: number;
  teamId: Id;
};

type ParticipantWithStats = {
  player: {
    id: Id;
    first_name: string | null;
    last_name: string | null;
    photo: string | null;
  };
  teamId: Id;
  played: boolean;
  stats: MatchPlayerStatRow | null;
  playerNumber?: number | null;
};

type RosterPlayer = {
  player: {
    id: Id;
    first_name: string | null;
    last_name: string | null;
    photo: string | null;
    deleted_at?: string | null;
  };
  teamId: Id;
};

type MatchLite = {
  id: Id;
  status: string;
  match_date: string | null;
  team_a_score: number | null;
  team_b_score: number | null;
  referee: string | null;
  team_a: Team;
  team_b: Team;
  tournament: { id: number; name: string; logo: string | null } | null;
};

type Props = {
  match: MatchLite;
  scorers: Scorer[];
  participants: ParticipantWithStats[];
  roster: RosterPlayer[];
  showWelcomeMessage: boolean;
  isScheduled: boolean;
  videoId: string | null;
  dataLoadErrors: string[];
  /** Admin-only sections (stats editor, video CRUD, postpone), rendered by the
   * server component and gated behind isAdmin. Null/absent for public viewers. */
  adminSlot?: React.ReactNode;
};

// ───────────────────────────────────────────────────────────────────────
// Utilities
// ───────────────────────────────────────────────────────────────────────
const pad2 = (n: number | string) => String(n).padStart(2, "0");

const fmtDay = (iso: string | null) =>
  iso ? String(new Date(iso).getDate()).padStart(2, "0") : "—";

const fmtMonthShort = (iso: string | null) =>
  iso
    ? new Date(iso)
        .toLocaleDateString("el-GR", { month: "short" })
        .toUpperCase()
    : "";

const fmtFullDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("el-GR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "";

const fmtTime = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleTimeString("el-GR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

const playerNameOf = (p: { first_name: string | null; last_name: string | null }) =>
  `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "Άγνωστος";

// ───────────────────────────────────────────────────────────────────────
// Atmosphere — paper background (matches /OMADA, /preview/anakoinoseis-v2)
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
    <svg
      className="absolute inset-0 h-full w-full opacity-[0.04]"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id="mv2grid" width="48" height="48" patternUnits="userSpaceOnUse">
          <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#F3EFE6" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#mv2grid)" />
    </svg>
  </div>
);

// ───────────────────────────────────────────────────────────────────────
// Breadcrumb header
// ───────────────────────────────────────────────────────────────────────
const PageHeader: React.FC<{ tournamentName: string | null }> = ({
  tournamentName,
}) => (
  <header className="relative border-b-2 border-[#F3EFE6]/20">
    <div className="mx-auto max-w-[1400px] px-4 pt-8 pb-4 md:px-6 md:pt-10 md:pb-6">
      <nav className="flex min-w-0 items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[#F3EFE6]/55">
        <Link href="/" className="shrink-0 hover:text-[#fb923c] transition-colors">
          Αρχική
        </Link>
        <span className="shrink-0">/</span>
        <Link
          href="/matches"
          className="shrink-0 hover:text-[#fb923c] transition-colors"
        >
          Αγώνες
        </Link>
        <span className="shrink-0">/</span>
        <span className="min-w-0 truncate text-[#F3EFE6]">
          {tournamentName ?? "Αγώνας"}
        </span>
      </nav>
    </div>
  </header>
);

// ───────────────────────────────────────────────────────────────────────
// Tournament masthead
// ───────────────────────────────────────────────────────────────────────
const TournamentMasthead: React.FC<{
  tournament: { id: number; name: string; logo: string | null } | null;
  matchDate: string | null;
}> = ({ tournament, matchDate }) => {
  if (!tournament) return null;

  return (
    <header className="relative overflow-hidden border-b-2 border-[#F3EFE6]/20">
      <div className="relative mx-auto max-w-[1400px] px-4 pt-8 pb-10 md:px-6 md:pt-14 md:pb-16">
        <div className="grid grid-cols-12 gap-6 md:gap-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
            className="col-span-12 md:col-span-8"
          >
            <div className="mb-5 flex flex-wrap items-center gap-3 font-mono text-[10px] uppercase tracking-[0.3em]">
              <span className="h-[2px] w-8 bg-[#fb923c]" />
              <span className="text-[#fb923c]">Διοργάνωση</span>
            </div>

            <h1
              className="font-[var(--f-display)] font-black italic leading-[0.9] tracking-[-0.02em] text-[#F3EFE6]"
              style={{ fontSize: "clamp(1.75rem, 6vw, 4.5rem)" }}
            >
              {tournament.name}
            </h1>

            <div className="mt-6 flex items-center gap-4">
              <span className="h-[2px] w-12 bg-[#fb923c]" />
              <p className="font-[var(--f-body)] max-w-xl text-sm md:text-base text-[#F3EFE6]/70 leading-relaxed">
                Επίσημο δελτίο αγώνα ·{" "}
                <span className="italic text-[#fb923c] font-semibold">
                  στατιστικά, συμμετοχές και αποτελέσματα
                </span>
                .
              </p>
            </div>
          </motion.div>

          {/* Right: logo + status card */}
          <motion.aside
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.2, 0.8, 0.2, 1] }}
            className="col-span-12 md:col-span-4 flex flex-col gap-4"
          >
            <div className="relative overflow-hidden border-2 border-[#F3EFE6]/20 bg-[#0a0a14] p-4 shadow-[6px_6px_0_0_#fb923c] md:p-5 md:shadow-[10px_10px_0_0_#fb923c]">
              <div className="flex items-center gap-4">
                {tournament.logo ? (
                  <div className="relative h-16 w-16 shrink-0 md:h-20 md:w-20">
                    <TournamentImage
                      src={tournament.logo}
                      alt={tournament.name}
                      width={80}
                      height={80}
                      className="h-full w-full object-contain"
                      priority
                    />
                  </div>
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="font-[var(--f-display)] text-base italic font-semibold leading-tight text-[#F3EFE6] line-clamp-2">
                    {tournament.name}
                  </p>
                  {matchDate && (
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-[#F3EFE6]/60">
                      {fmtFullDate(matchDate)}
                      {fmtTime(matchDate) ? ` · ${fmtTime(matchDate)}` : ""}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </motion.aside>
        </div>
      </div>
    </header>
  );
};

// ───────────────────────────────────────────────────────────────────────
// Score panel (replaces TeamVersusScore)
// ───────────────────────────────────────────────────────────────────────
const ScorePanel: React.FC<{
  match: MatchLite;
  scorers: Scorer[];
}> = ({ match, scorers }) => {
  const isFinished = match.status === "finished";
  const isPostponed = match.status === "postponed";

  const teamAScorers = scorers.filter(
    (s) => s.teamId === match.team_a.id && s.goals > 0,
  );
  const teamBScorers = scorers.filter(
    (s) => s.teamId === match.team_b.id && s.goals > 0,
  );
  const teamAOwnGoals = scorers.filter(
    (s) => s.teamId === match.team_b.id && (s.ownGoals ?? 0) > 0,
  );
  const teamBOwnGoals = scorers.filter(
    (s) => s.teamId === match.team_a.id && (s.ownGoals ?? 0) > 0,
  );

  // Result accent
  let accent = "#F3EFE6";
  let resultLabel: string | null = null;
  if (isFinished && match.team_a_score !== null && match.team_b_score !== null) {
    if (match.team_a_score > match.team_b_score) {
      accent = "#fb923c";
      resultLabel = `Νίκη ${match.team_a.name}`;
    } else if (match.team_b_score > match.team_a_score) {
      accent = "#fb923c";
      resultLabel = `Νίκη ${match.team_b.name}`;
    } else {
      accent = "#E8B931";
      resultLabel = "Ισοπαλία";
    }
  } else if (isPostponed) {
    accent = "#a855f7";
    resultLabel = "Αναβολή";
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative overflow-hidden border-2 border-[#F3EFE6]/20 bg-[#0a0a14] shadow-[6px_6px_0_0_var(--s)] md:shadow-[10px_10px_0_0_var(--s)]"
      style={{ ["--s" as any]: accent } as React.CSSProperties}
    >
      {/* Top strip */}
      <div className="flex items-center justify-between border-b-2 border-[#F3EFE6]/15 bg-[#13131d] px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.25em] md:px-6">
        <span className="text-[#F3EFE6]/70">
          {isFinished ? "Τελικό σκορ" : isPostponed ? "Αναβολή" : "Προσεχώς"}
        </span>
        {resultLabel && (
          <span
            className="border px-2 py-0.5 font-bold"
            style={{ borderColor: accent, color: accent }}
          >
            {resultLabel}
          </span>
        )}
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3 px-4 py-6 md:gap-8 md:px-8 md:py-10">
        <TeamColumn
          team={match.team_a}
          align="right"
          scorers={[...teamAScorers, ...teamAOwnGoals]}
        />

        <div className="flex flex-col items-center gap-3 pt-2 md:pt-6">
          {isFinished ? (
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
              className="flex items-center gap-2 font-[var(--f-brutal)] text-5xl leading-none tabular-nums text-[#F3EFE6] md:gap-3 md:text-7xl"
            >
              <span>{match.team_a_score ?? 0}</span>
              <span className="text-[#F3EFE6]/30">:</span>
              <span>{match.team_b_score ?? 0}</span>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="border-2 border-dashed border-[#F3EFE6]/30 px-4 py-2 font-mono text-xs uppercase tracking-[0.3em] text-[#F3EFE6]/70 md:text-sm"
            >
              {match.match_date ? fmtTime(match.match_date) : "TBA"}
            </motion.div>
          )}

          <div className="mt-1 flex flex-col items-center gap-1 font-mono text-[10px] uppercase tracking-[0.25em] text-[#F3EFE6]/55">
            {match.match_date && <span>{fmtFullDate(match.match_date)}</span>}
            {match.referee && (
              <span className="text-[#F3EFE6]/45">
                Διαιτητής · {match.referee}
              </span>
            )}
          </div>
        </div>

        <TeamColumn
          team={match.team_b}
          align="left"
          scorers={[...teamBScorers, ...teamBOwnGoals]}
        />
      </div>
    </motion.section>
  );
};

const TeamColumn: React.FC<{
  team: Team;
  align: "left" | "right";
  scorers: Scorer[];
}> = ({ team, align, scorers }) => {
  const isRight = align === "right";
  return (
    <motion.div
      initial={{ opacity: 0, x: isRight ? -16 : 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className={`flex flex-col items-center gap-3 ${
        isRight ? "md:items-end md:text-right" : "md:items-start md:text-left"
      }`}
    >
      <div className="relative h-20 w-20 overflow-hidden border-2 border-[#F3EFE6]/25 bg-[#13131d] p-2 md:h-28 md:w-28 lg:h-32 lg:w-32">
        {team.logo ? (
          <TeamImage
            src={team.logo}
            alt={team.name}
            fill
            objectFit="contain"
            sizes="(min-width: 1024px) 128px, (min-width: 768px) 112px, 80px"
            priority
            animate={false}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-[var(--f-brutal)] text-2xl text-[#F3EFE6]/40">
            {team.name.charAt(0)}
          </div>
        )}
      </div>

      <h2 className="max-w-full px-1 text-center font-[var(--f-display)] text-lg italic font-bold leading-tight text-[#F3EFE6] md:text-2xl">
        {team.name}
      </h2>

      {scorers.length > 0 && (
        <ul
          className={`mt-2 w-full space-y-1.5 ${
            isRight ? "md:text-right" : "md:text-left"
          }`}
        >
          {scorers.map((s, i) => {
            const isOG = (s.ownGoals ?? 0) > 0;
            const count = isOG ? s.ownGoals! : s.goals;
            if (count <= 0) return null;
            return (
              <li
                key={`${s.player.id}-${isOG ? "og" : "g"}-${i}`}
                className={`flex items-center gap-1.5 ${
                  isRight ? "md:justify-end" : "md:justify-start"
                } justify-center`}
              >
                <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#F3EFE6]/80">
                  {playerNameOf(s.player)}
                  {isOG && (
                    <span className="ml-1 text-[#fb923c]">(αυτογκόλ)</span>
                  )}
                </span>
                <span className="flex items-center gap-0.5">
                  {Array.from({ length: Math.min(count, 5) }).map((_, k) =>
                    isOG ? (
                      <OwnGoalIcon key={k} className="h-3.5 w-3.5" />
                    ) : (
                      <GoalIcon key={k} className="h-3.5 w-3.5" />
                    ),
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </motion.div>
  );
};

// ───────────────────────────────────────────────────────────────────────
// Welcome / kicker block (replaces WelcomeMessage)
// ───────────────────────────────────────────────────────────────────────
const WelcomeKicker: React.FC<{ matchDate: string | null }> = ({
  matchDate,
}) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5 }}
    className="relative border-2 border-dashed border-[#F3EFE6]/25 bg-[#13131d]/40 p-8 text-center md:p-10"
  >
    <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#fb923c]">
      Προγραμματισμένο
    </span>
    <p className="mt-4 font-[var(--f-display)] text-2xl font-black italic leading-tight text-[#F3EFE6] md:text-3xl">
      Ο αγώνας δεν έχει διεξαχθεί ακόμα
    </p>
    <p className="mx-auto mt-3 max-w-md font-[var(--f-body)] text-sm text-[#F3EFE6]/65">
      Επιστρέψτε μετά τη σέντρα για συμμετοχές, σκόρερ και πλήρη στατιστικά.
    </p>
    {matchDate && (
      <div className="mt-5 inline-flex items-center gap-2 border border-[#F3EFE6]/25 bg-[#0a0a14] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.25em] text-[#F3EFE6]/75">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#fb923c]" />
        <span>{fmtFullDate(matchDate)}</span>
        {fmtTime(matchDate) && (
          <>
            <span className="text-[#F3EFE6]/35">·</span>
            <span>{fmtTime(matchDate)}</span>
          </>
        )}
      </div>
    )}
  </motion.div>
);

// ───────────────────────────────────────────────────────────────────────
// Match events / stats (replaces MatchEventsTimeline)
// ───────────────────────────────────────────────────────────────────────
type StatEvent = {
  type:
    | "goal"
    | "assist"
    | "own_goal"
    | "yellow_card"
    | "red_card"
    | "blue_card"
    | "mvp"
    | "best_gk"
    | "captain"
    | "gk";
  count: number;
};

const EVENT_META: Record<
  StatEvent["type"],
  { icon: React.FC<{ className?: string }>; label: string; tint: string }
> = {
  goal: { icon: GoalIcon, label: "Γκολ", tint: "#E8B931" },
  assist: { icon: AssistIcon, label: "Ασίστ", tint: "#60a5fa" },
  own_goal: { icon: OwnGoalIcon, label: "Αυτογκόλ", tint: "#fb923c" },
  yellow_card: { icon: YellowCardIcon, label: "Κίτρινη", tint: "#facc15" },
  red_card: { icon: RedCardIcon, label: "Κόκκινη", tint: "#ef4444" },
  blue_card: { icon: BlueCardIcon, label: "Μπλε", tint: "#60a5fa" },
  mvp: { icon: MvpIcon, label: "MVP", tint: "#E8B931" },
  best_gk: { icon: BestGkIcon, label: "Best GK", tint: "#34d399" },
  captain: { icon: CaptainIcon, label: "Αρχηγός", tint: "#E8B931" },
  gk: { icon: GkIcon, label: "Τερματοφύλακας", tint: "#a78bfa" },
};

function getPlayerEvents(stats: MatchPlayerStatRow | null): StatEvent[] {
  if (!stats) return [];
  const events: StatEvent[] = [];
  if (stats.goals > 0) events.push({ type: "goal", count: stats.goals });
  if (stats.assists > 0) events.push({ type: "assist", count: stats.assists });
  if (stats.own_goals > 0) events.push({ type: "own_goal", count: stats.own_goals });
  if (stats.mvp) events.push({ type: "mvp", count: 1 });
  if (stats.best_goalkeeper) events.push({ type: "best_gk", count: 1 });
  if (stats.is_captain) events.push({ type: "captain", count: 1 });
  if (stats.gk) events.push({ type: "gk", count: 1 });
  if (stats.yellow_cards > 0)
    events.push({ type: "yellow_card", count: stats.yellow_cards });
  if (stats.red_cards > 0) events.push({ type: "red_card", count: stats.red_cards });
  if (stats.blue_cards > 0)
    events.push({ type: "blue_card", count: stats.blue_cards });
  return events;
}

const EventBadge: React.FC<{ event: StatEvent }> = ({ event }) => {
  const meta = EVENT_META[event.type];
  const Icon = meta.icon;
  const isCountable =
    event.type === "goal" ||
    event.type === "own_goal" ||
    event.type === "assist" ||
    event.type === "yellow_card" ||
    event.type === "red_card" ||
    event.type === "blue_card";

  return (
    <div
      className="flex items-center gap-1 border-2 border-[#F3EFE6]/15 bg-[#0a0a14] px-2 py-0.5"
      title={`${meta.label}${event.count > 1 ? ` ×${event.count}` : ""}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span
        className="font-mono text-[10px] uppercase tracking-[0.18em] font-semibold"
        style={{ color: meta.tint }}
      >
        {isCountable ? `${event.count} ${meta.label}` : meta.label}
      </span>
    </div>
  );
};

const PlayerStatRow: React.FC<{
  participant: ParticipantWithStats;
  teamLogo: string | null;
  index: number;
}> = ({ participant, teamLogo, index }) => {
  const { player, stats, playerNumber } = participant;
  const events = getPlayerEvents(stats);
  const playerName = playerNameOf(player);
  const isPlaceholderPhoto =
    !player.photo || player.photo === "/player-placeholder.svg";
  const hasEvents = events.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ delay: Math.min(index * 0.03, 0.3), duration: 0.35 }}
      className={`flex items-center gap-3 border-b border-[#F3EFE6]/10 px-3 py-2.5 last:border-b-0 ${
        hasEvents ? "bg-[#13131d]/60" : ""
      }`}
    >
      {/* Avatar */}
      <div className="relative h-10 w-10 shrink-0 overflow-hidden border-2 border-[#F3EFE6]/20 bg-[#0a0a14]">
        {!isPlaceholderPhoto ? (
          <PlayerImage
            src={player.photo!}
            alt={playerName}
            width={40}
            height={40}
            className="h-full w-full object-cover object-center"
          />
        ) : teamLogo ? (
          <div className="relative h-full w-full p-1">
            <TeamImage
              src={teamLogo}
              alt="team"
              width={40}
              height={40}
              className="h-full w-full object-contain"
            />
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center font-[var(--f-brutal)] text-[11px] text-[#F3EFE6]/55">
            {(player.first_name?.[0] ?? "") + (player.last_name?.[0] ?? "")}
          </div>
        )}
      </div>

      {/* Name + number */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {playerNumber && (
            <span className="font-[var(--f-brutal)] text-xs text-[#fb923c]">
              #{pad2(playerNumber)}
            </span>
          )}
          <span className="truncate font-[var(--f-display)] text-sm italic font-semibold text-[#F3EFE6]">
            {playerName}
          </span>
        </div>
        {hasEvents && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {events.map((e, i) => (
              <EventBadge key={`${e.type}-${i}`} event={e} />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};

const TeamStatsColumn: React.FC<{
  teamName: string;
  teamLogo: string | null;
  participants: ParticipantWithStats[];
}> = ({ teamName, teamLogo, participants }) => {
  const sorted = [...participants].sort((a, b) => {
    const aE = getPlayerEvents(a.stats).length;
    const bE = getPlayerEvents(b.stats).length;
    if (aE !== bE) return bE - aE;
    return playerNameOf(a.player).localeCompare(playerNameOf(b.player));
  });

  return (
    <div className="border-2 border-[#F3EFE6]/20 bg-[#0a0a14]">
      <div className="flex items-center gap-3 border-b-2 border-[#F3EFE6]/15 bg-[#13131d] px-4 py-3">
        {teamLogo && (
          <div className="relative h-8 w-8 shrink-0 overflow-hidden border border-[#F3EFE6]/25 bg-[#0a0a14] p-0.5">
            <TeamImage
              src={teamLogo}
              alt={teamName}
              width={32}
              height={32}
              className="h-full w-full object-contain"
            />
          </div>
        )}
        <h3 className="flex-1 truncate font-[var(--f-display)] text-base italic font-bold text-[#F3EFE6] md:text-lg">
          {teamName}
        </h3>
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#F3EFE6]/55">
          {pad2(sorted.length)} παίκτες
        </span>
      </div>
      <div>
        {sorted.map((p, i) => (
          <PlayerStatRow
            key={p.player.id}
            participant={p}
            teamLogo={teamLogo}
            index={i}
          />
        ))}
      </div>
    </div>
  );
};

const MatchEventsV2: React.FC<{
  match: MatchLite;
  participants: ParticipantWithStats[];
}> = ({ match, participants }) => {
  const teamA = participants.filter((p) => p.teamId === match.team_a.id);
  const teamB = participants.filter((p) => p.teamId === match.team_b.id);
  if (teamA.length === 0 && teamB.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.5 }}
    >
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.3em] text-[#fb923c]">
            <span className="h-[2px] w-8 bg-[#fb923c]" />
            Στατιστικά Αγώνα
          </div>
          <h2
            className="mt-2 font-[var(--f-display)] font-black italic leading-[0.95] text-[#F3EFE6]"
            style={{ fontSize: "clamp(1.5rem, 3.5vw, 2.5rem)" }}
          >
            Φύλλο Αγώνα
          </h2>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#F3EFE6]/55">
          {pad2(teamA.length + teamB.length)} εγγραφές
        </span>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
        {teamA.length > 0 && (
          <TeamStatsColumn
            teamName={match.team_a.name}
            teamLogo={match.team_a.logo}
            participants={teamA}
          />
        )}
        {teamB.length > 0 && (
          <TeamStatsColumn
            teamName={match.team_b.name}
            teamLogo={match.team_b.logo}
            participants={teamB}
          />
        )}
      </div>
    </motion.section>
  );
};

// ───────────────────────────────────────────────────────────────────────
// Roster grid (replaces TeamRostersDisplay)
// ───────────────────────────────────────────────────────────────────────
const RosterCard: React.FC<{
  player: RosterPlayer["player"];
  teamLogo: string | null;
  index: number;
}> = ({ player, teamLogo, index }) => {
  const playerName = playerNameOf(player);
  const isPlaceholderPhoto =
    !player.photo || player.photo === "/player-placeholder.svg";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ delay: Math.min(index * 0.04, 0.4), duration: 0.45 }}
      whileHover={{ y: -4 }}
      className="group relative"
    >
      <div className="relative flex flex-col items-center border-2 border-[#F3EFE6]/20 bg-[#0a0a14] p-3 shadow-[3px_3px_0_0_#13131d] transition-colors hover:border-[#fb923c]">
        <div className="relative mb-2.5 h-20 w-20 overflow-hidden border-2 border-[#F3EFE6]/20 bg-[#13131d]">
          {!isPlaceholderPhoto ? (
            <PlayerImage
              src={player.photo!}
              alt={playerName}
              width={80}
              height={80}
              className="block h-full w-full object-cover object-center"
            />
          ) : teamLogo ? (
            <div className="relative h-full w-full p-2">
              <TeamImage
                src={teamLogo}
                alt={`${playerName} logo`}
                fill
                objectFit="contain"
                sizes="80px"
                className="block h-full w-full object-contain"
              />
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center font-[var(--f-brutal)] text-xl text-[#F3EFE6]/55">
              {(player.first_name?.[0] ?? "") + (player.last_name?.[0] ?? "")}
            </div>
          )}
        </div>
        <div className="w-full text-center">
          <div className="font-[var(--f-display)] text-sm italic font-bold leading-tight text-[#F3EFE6]">
            {player.first_name || "Άγνωστος"}
          </div>
          {player.last_name && (
            <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[#F3EFE6]/65">
              {player.last_name}
            </div>
          )}
          <FormerPlayerBadge
            show={isFormerPlayer(player)}
            size="xs"
            className="mt-1"
          />
        </div>
      </div>
    </motion.div>
  );
};

const RosterTeam: React.FC<{
  teamName: string;
  teamLogo: string | null;
  roster: RosterPlayer[];
}> = ({ teamName, teamLogo, roster }) => (
  <div className="border-2 border-[#F3EFE6]/20 bg-[#13131d]/30 p-5">
    <div className="mb-4 flex items-center gap-3">
      {teamLogo && (
        <div className="relative h-9 w-9 shrink-0 overflow-hidden border border-[#F3EFE6]/25 bg-[#0a0a14] p-0.5">
          <TeamImage
            src={teamLogo}
            alt={teamName}
            width={36}
            height={36}
            className="h-full w-full object-contain"
          />
        </div>
      )}
      <h3 className="flex-1 truncate font-[var(--f-display)] text-lg italic font-bold text-[#F3EFE6]">
        {teamName}
      </h3>
      <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#F3EFE6]/55">
        {pad2(roster.length)} παίκτες
      </span>
    </div>
    <div className="grid grid-cols-[repeat(auto-fill,minmax(115px,1fr))] gap-3">
      {roster.map((r, i) => (
        <RosterCard
          key={r.player.id}
          player={r.player}
          teamLogo={teamLogo}
          index={i}
        />
      ))}
    </div>
  </div>
);

const RostersV2: React.FC<{
  match: MatchLite;
  roster: RosterPlayer[];
}> = ({ match, roster }) => {
  const teamA = roster.filter((p) => p.teamId === match.team_a.id);
  const teamB = roster.filter((p) => p.teamId === match.team_b.id);
  if (teamA.length === 0 && teamB.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.5 }}
    >
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.3em] text-[#fb923c]">
            <span className="h-[2px] w-8 bg-[#fb923c]" />
            Ρόστερ Αγώνα
          </div>
          <h2
            className="mt-2 font-[var(--f-display)] font-black italic leading-[0.95] text-[#F3EFE6]"
            style={{ fontSize: "clamp(1.5rem, 3.5vw, 2.5rem)" }}
          >
            Οι Παίκτες που θα αγωνιστούν
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
        {teamA.length > 0 && (
          <RosterTeam
            teamName={match.team_a.name}
            teamLogo={match.team_a.logo}
            roster={teamA}
          />
        )}
        {teamB.length > 0 && (
          <RosterTeam
            teamName={match.team_b.name}
            teamLogo={match.team_b.logo}
            roster={teamB}
          />
        )}
      </div>
    </motion.section>
  );
};

// ───────────────────────────────────────────────────────────────────────
// Video section
// ───────────────────────────────────────────────────────────────────────
const VideoV2: React.FC<{ videoId: string }> = ({ videoId }) => (
  <motion.section
    initial={{ opacity: 0 }}
    whileInView={{ opacity: 1 }}
    viewport={{ once: true, amount: 0.2 }}
    transition={{ duration: 0.5 }}
    className="border-2 border-[#F3EFE6]/20 bg-[#0a0a14] shadow-[6px_6px_0_0_#13131d]"
  >
    <div className="flex items-center justify-between border-b-2 border-[#F3EFE6]/15 bg-[#13131d] px-4 py-3 font-mono text-[10px] uppercase tracking-[0.25em]">
      <div className="flex items-center gap-3">
        <span className="h-[2px] w-8 bg-[#fb923c]" />
        <span className="text-[#fb923c]">Video Αγώνα</span>
      </div>
      <span className="text-[#F3EFE6]/55">YouTube</span>
    </div>
    <div className="aspect-video w-full overflow-hidden">
      <iframe
        className="h-full w-full"
        src={`https://www.youtube.com/embed/${videoId}`}
        title="YouTube video player"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  </motion.section>
);

// ───────────────────────────────────────────────────────────────────────
// Main client
// ───────────────────────────────────────────────────────────────────────
const MatchV2Client: React.FC<Props> = ({
  match,
  scorers,
  participants,
  roster,
  showWelcomeMessage,
  isScheduled,
  videoId,
  dataLoadErrors,
  adminSlot,
}) => {
  const showRoster = isScheduled && roster.length > 0;
  const showEvents = !showRoster && participants.length > 0;

  return (
    <div
      className={`${fraunces.variable} ${archivoBlack.variable} ${jetbrains.variable} ${figtree.variable} min-h-screen overflow-x-hidden text-[#F3EFE6] font-[var(--f-body)] selection:bg-[#fb923c] selection:text-[#0a0a14]`}
    >
      <PaperBackground />

      <PageHeader tournamentName={match.tournament?.name ?? null} />

      <TournamentMasthead
        tournament={match.tournament}
        matchDate={match.match_date}
      />

      <section className="relative">
        <div className="mx-auto max-w-[1400px] space-y-10 px-4 py-10 md:space-y-14 md:px-6 md:py-16">
          {dataLoadErrors.length > 0 && (
            <div className="border-2 border-[#E8B931]/50 bg-[#1a1605] p-4 font-mono text-[11px] uppercase tracking-[0.22em] text-[#E8B931]">
              <p className="font-semibold">Μερική φόρτωση δεδομένων</p>
              <ul className="mt-2 list-disc space-y-0.5 pl-5 text-[#E8B931]/85">
                {dataLoadErrors.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
          )}

          {showWelcomeMessage && <WelcomeKicker matchDate={match.match_date} />}

          <ScorePanel match={match} scorers={scorers} />

          {showRoster && <RostersV2 match={match} roster={roster} />}
          {showEvents && (
            <MatchEventsV2 match={match} participants={participants} />
          )}

          {videoId && <VideoV2 videoId={videoId} />}

          {adminSlot && (
            <section className="space-y-6 border-t-2 border-dashed border-[#fb923c]/30 pt-10">
              <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.3em] text-[#fb923c]">
                <span className="h-[2px] w-8 bg-[#fb923c]" />
                Διαχείριση Αγώνα
              </div>
              {adminSlot}
            </section>
          )}
        </div>
      </section>

      <footer className="border-t-2 border-[#F3EFE6]/20 bg-[#13131d] text-[#F3EFE6]">
        <div className="mx-auto flex max-w-[1400px] flex-col items-start justify-between gap-4 px-4 py-6 md:flex-row md:items-center md:px-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#F3EFE6]/60">
            Επίσημο δελτίο αγώνα
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/matches"
              className="border border-[#F3EFE6]/30 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.25em] text-[#F3EFE6] hover:bg-[#F3EFE6] hover:text-[#0a0a14] transition-colors"
            >
              Όλοι οι αγώνες
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default MatchV2Client;
