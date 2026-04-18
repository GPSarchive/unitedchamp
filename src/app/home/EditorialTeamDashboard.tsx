"use client";

/**
 * EditorialTeamDashboard — sandbox redesign of the Πρόγραμμα section.
 * Broadsheet aesthetic: hard borders, offset accent shadows, mono-caps
 * labels, Fraunces italic team names, Archivo Black numerals.
 */

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronRight, Trophy, MapPin } from "lucide-react";
import TeamFilter from "@/components/TeamFilter";
import { resolveImageUrl, ImageType } from "@/app/lib/image-config";

// =========================================================
// Types
// =========================================================
export type Match = {
  id: string;
  title: string;
  start: string;
  end: string;
  teams?: [string, string];
  logos?: [string, string];
  status?: "scheduled" | "live" | "finished";
  score?: [number, number];
  venue?: string;
  tournament_name?: string | null;
  tournament_logo?: string | null;
  matchday?: number | null;
  round?: number | null;
};

export type TeamDashboardProps = {
  allMatches: Match[];
  userTeams?: string[];
  className?: string;
};

// =========================================================
// Date helpers
// =========================================================
const GREEK_WEEKDAYS_SHORT = ["ΚΥΡ", "ΔΕΥ", "ΤΡΙ", "ΤΕΤ", "ΠΕΜ", "ΠΑΡ", "ΣΑΒ"];
const GREEK_MONTHS_SHORT = ["ΙΑΝ", "ΦΕΒ", "ΜΑΡ", "ΑΠΡ", "ΜΑΪ", "ΙΟΥΝ", "ΙΟΥΛ", "ΑΥΓ", "ΣΕΠ", "ΟΚΤ", "ΝΟΕ", "ΔΕΚ"];

function parts(iso: string) {
  const d = new Date(iso);
  return {
    day: d.getDate(),
    month: d.getMonth(),
    year: d.getFullYear(),
    weekday: d.getDay(),
    hours: d.getHours(),
    minutes: d.getMinutes(),
  };
}
function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function formatTime(iso: string) {
  const m = /T(\d{2}):(\d{2})/.exec(iso);
  return m ? `${m[1]}:${m[2]}` : "";
}
function formatRelative(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMs / 3600000);
  const diffD = Math.floor(diffMs / 86400000);
  if (diffMin < 0) return "ΟΛΟΚΛΗΡΩΘΗΚΕ";
  if (diffMin < 60) return `ΣΕ ${diffMin}′`;
  if (diffH < 24) return `ΣΕ ${diffH}Ω`;
  if (diffD === 0) return "ΣΗΜΕΡΑ";
  if (diffD === 1) return "ΑΥΡΙΟ";
  if (diffD < 7) return `ΣΕ ${diffD} ΗΜΕΡΕΣ`;
  return `ΣΕ ${diffD} ΗΜΕΡΕΣ`;
}
function isUpcoming(iso: string) {
  return new Date(iso) > new Date();
}

// =========================================================
// Hero card — the "next match" editorial broadsheet card
// =========================================================
function NextMatchHero({ match }: { match: Match }) {
  const [teamA, teamB] = match.teams ?? ["Ομάδα Α", "Ομάδα Β"];
  const [logoA, logoB] = match.logos ?? ["/placeholder.png", "/placeholder.png"];

  const p = parts(match.start);
  const relative = formatRelative(match.start);
  const time = formatTime(match.start);
  const isLive = match.status === "live";
  const accent = isLive ? "#fb923c" : "#fb923c";

  return (
    <Link
      href={`/matches/${match.id}`}
      className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-[#fb923c] focus-visible:ring-offset-2 focus-visible:ring-offset-[#08080f]"
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
        className="relative"
        style={{ boxShadow: `10px 10px 0 0 ${accent}` }}
      >
        <div className="relative overflow-hidden border-2 border-[#F3EFE6]/25 bg-[#0a0a14] transition-all duration-300 group-hover:border-[#F3EFE6]/45 group-hover:-translate-y-0.5 group-hover:translate-x-0.5">
          {/* Top accent strip */}
          <div className="h-[3px] w-full" style={{ background: accent }} />

          {/* Masthead row */}
          <div className="flex items-center justify-between border-b-2 border-[#F3EFE6]/15 bg-[#13131d] px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.3em]">
            <span
              className="flex items-center gap-2 font-bold"
              style={{ color: accent }}
            >
              {isLive ? (
                <>
                  <span
                    className="h-1.5 w-1.5 animate-pulse rounded-full"
                    style={{ background: accent }}
                  />
                  Ζωντανά τώρα
                </>
              ) : (
                <>
                  <span className="h-[2px] w-6" style={{ background: accent }} />
                  Επόμενος αγώνας
                </>
              )}
            </span>
            <span className="text-[#F3EFE6]/60">{relative}</span>
          </div>

          {/* Body */}
          <div className="relative p-6 md:p-10">
            {/* Decorative giant "VS" in the back */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 flex items-center justify-center font-[var(--f-brutal)] italic text-[#F3EFE6]/[0.04] select-none"
              style={{ fontSize: "clamp(10rem, 28vw, 18rem)", lineHeight: 1 }}
            >
              VS
            </div>

            <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-4 md:gap-8">
              {/* Team A */}
              <div className="flex flex-col items-center text-center">
                <div className="relative h-20 w-20 md:h-28 md:w-28 mb-4">
                  <Image
                    src={logoA}
                    alt={teamA}
                    fill
                    className="object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
                    sizes="(max-width: 768px) 80px, 112px"
                    priority
                  />
                </div>
                <h3
                  className="font-[var(--f-display)] italic font-black text-[#F3EFE6] leading-none"
                  style={{ fontSize: "clamp(1.1rem, 2.6vw, 1.9rem)" }}
                >
                  {teamA}
                </h3>
              </div>

              {/* Center meta column */}
              <div className="flex flex-col items-center gap-3 px-2 md:px-4">
                {/* Day block */}
                <div
                  className="border-2 px-3 py-2 text-center"
                  style={{ borderColor: accent }}
                >
                  <div
                    className="font-mono text-[9px] uppercase tracking-[0.3em]"
                    style={{ color: accent }}
                  >
                    {GREEK_WEEKDAYS_SHORT[p.weekday]}
                  </div>
                  <div className="font-[var(--f-brutal)] text-3xl md:text-4xl leading-none text-[#F3EFE6]">
                    {pad2(p.day)}
                  </div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.28em] text-[#F3EFE6]/65">
                    {GREEK_MONTHS_SHORT[p.month]}
                  </div>
                </div>

                {/* Time */}
                <div className="font-[var(--f-brutal)] text-xl md:text-2xl text-[#F3EFE6] leading-none">
                  {time}
                </div>
              </div>

              {/* Team B */}
              <div className="flex flex-col items-center text-center">
                <div className="relative h-20 w-20 md:h-28 md:w-28 mb-4">
                  <Image
                    src={logoB}
                    alt={teamB}
                    fill
                    className="object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
                    sizes="(max-width: 768px) 80px, 112px"
                    priority
                  />
                </div>
                <h3
                  className="font-[var(--f-display)] italic font-black text-[#F3EFE6] leading-none"
                  style={{ fontSize: "clamp(1.1rem, 2.6vw, 1.9rem)" }}
                >
                  {teamB}
                </h3>
              </div>
            </div>
          </div>

          {/* Footer meta strip */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t-2 border-[#F3EFE6]/15 bg-[#0d0d18] px-5 py-3 font-mono text-[10px] uppercase tracking-[0.25em] text-[#F3EFE6]/70">
            {match.tournament_name && (
              <span className="flex items-center gap-2">
                {match.tournament_logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={
                      resolveImageUrl(match.tournament_logo, ImageType.TOURNAMENT) ||
                      match.tournament_logo
                    }
                    alt={match.tournament_name}
                    className="h-4 w-4 object-contain"
                  />
                ) : (
                  <Trophy className="h-3.5 w-3.5" />
                )}
                <span className="text-[#F3EFE6]">{match.tournament_name}</span>
              </span>
            )}
            {(match.round || match.matchday) && (
              <span className="text-[#F3EFE6]/55">
                {match.round ? `Round ${match.round}` : `Αγ. ${match.matchday}`}
              </span>
            )}
            {match.venue && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3 w-3" />
                {match.venue}
              </span>
            )}
            <span
              className="ml-auto flex items-center gap-2 transition-colors"
              style={{ color: "rgba(243,239,230,0.6)" }}
            >
              <span className="group-hover:text-[#fb923c] transition-colors">
                Προβολή Λεπτομερειών
              </span>
              <ChevronRight
                className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1 group-hover:text-[#fb923c]"
              />
            </span>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

// =========================================================
// Editorial row — one match, broadsheet style
// =========================================================
function EditorialMatchRow({ match, index }: { match: Match; index: number }) {
  const [teamA, teamB] = match.teams ?? ["Ομάδα Α", "Ομάδα Β"];
  const [logoA, logoB] = match.logos ?? ["/placeholder.png", "/placeholder.png"];
  const p = parts(match.start);
  const time = formatTime(match.start);
  const matchdayRound = match.round
    ? `R${match.round}`
    : match.matchday
    ? `Αγ. ${match.matchday}`
    : null;

  return (
    <Link
      href={`/matches/${match.id}`}
      className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-[#fb923c] focus-visible:ring-offset-2 focus-visible:ring-offset-[#08080f]"
    >
      <motion.div
        initial={{ opacity: 0, x: -12 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.3) }}
        className="relative border-t border-[#F3EFE6]/10 first:border-t-0 transition-colors group-hover:bg-[#F3EFE6]/[0.03]"
      >
        {/* Left accent bar — slides in on hover */}
        <span
          aria-hidden
          className="absolute left-0 top-0 h-full w-[3px] bg-[#fb923c] scale-y-0 origin-center transition-transform duration-300 group-hover:scale-y-100"
        />

        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4 px-3 py-4 md:px-5 md:py-5">
          {/* Date block */}
          <div className="flex flex-col items-center w-14 md:w-16 shrink-0 border-r border-[#F3EFE6]/10 pr-3 md:pr-4">
            <span className="font-mono text-[9px] uppercase tracking-[0.28em] text-[#F3EFE6]/55">
              {GREEK_WEEKDAYS_SHORT[p.weekday]}
            </span>
            <span className="font-[var(--f-brutal)] text-2xl md:text-3xl leading-none text-[#F3EFE6] mt-0.5">
              {pad2(p.day)}
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[0.24em] text-[#F3EFE6]/50 mt-0.5">
              {GREEK_MONTHS_SHORT[p.month]}
            </span>
          </div>

          {/* Teams */}
          <div className="min-w-0 flex flex-col gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative h-7 w-7 shrink-0">
                <Image
                  src={logoA}
                  alt={teamA}
                  fill
                  className="object-contain"
                  sizes="28px"
                />
              </div>
              <span className="font-[var(--f-display)] italic text-base md:text-lg text-[#F3EFE6] truncate leading-tight">
                {teamA}
              </span>
            </div>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative h-7 w-7 shrink-0">
                <Image
                  src={logoB}
                  alt={teamB}
                  fill
                  className="object-contain"
                  sizes="28px"
                />
              </div>
              <span className="font-[var(--f-display)] italic text-base md:text-lg text-[#F3EFE6] truncate leading-tight">
                {teamB}
              </span>
            </div>
          </div>

          {/* Right column — time + meta + arrow */}
          <div className="flex flex-col items-end gap-1.5 shrink-0 text-right">
            <span className="font-[var(--f-brutal)] text-lg md:text-xl text-[#F3EFE6] leading-none group-hover:text-[#fb923c] transition-colors">
              {time}
            </span>
            {(match.tournament_name || matchdayRound) && (
              <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.25em] text-[#F3EFE6]/55 max-w-[180px] truncate">
                {match.tournament_name && (
                  <span className="truncate">{match.tournament_name}</span>
                )}
                {matchdayRound && (
                  <>
                    <span className="text-[#F3EFE6]/25">·</span>
                    <span>{matchdayRound}</span>
                  </>
                )}
              </span>
            )}
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

// =========================================================
// Main Component
// =========================================================
export default function EditorialTeamDashboard({
  allMatches = [],
  userTeams = [],
  className = "",
}: TeamDashboardProps) {
  const [selectedTeam, setSelectedTeam] = useState<string | null>(
    userTeams.length > 0 ? userTeams[0] : null
  );

  const upcomingMatches = useMemo(
    () =>
      allMatches
        .filter((m) => isUpcoming(m.start))
        .sort((a, b) => a.start.localeCompare(b.start)),
    [allMatches]
  );

  const allTeams = useMemo(() => {
    const teams = new Set<string>();
    upcomingMatches.forEach((m) => {
      if (m.teams) {
        teams.add(m.teams[0]);
        teams.add(m.teams[1]);
      }
    });
    return Array.from(teams).sort();
  }, [upcomingMatches]);

  const teamLogos = useMemo(() => {
    const map = new Map<string, string>();
    const source = upcomingMatches.length ? upcomingMatches : allMatches;
    source.forEach((m) => {
      if (m.teams && m.logos) {
        const [a, b] = m.teams;
        const [la, lb] = m.logos;
        if (a && la && !map.has(a)) map.set(a, la);
        if (b && lb && !map.has(b)) map.set(b, lb);
      }
    });
    return Object.fromEntries(map);
  }, [upcomingMatches, allMatches]);

  const filteredMatches = useMemo(() => {
    if (!selectedTeam) return upcomingMatches;
    return upcomingMatches.filter((m) => m.teams?.includes(selectedTeam));
  }, [upcomingMatches, selectedTeam]);

  const nextMatch = filteredMatches[0] || null;
  const listMatches = useMemo(() => filteredMatches.slice(0, 6), [filteredMatches]);
  const hasMore =
    filteredMatches.length > listMatches.length + (nextMatch ? 1 : 0);

  return (
    <div className={className}>
      {/* Intro row — mono kicker + filter aligned like an editorial tools bar */}
      <div className="mb-6 md:mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between border-b border-[#F3EFE6]/10 pb-5">
        <div>
          <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.3em] text-[#fb923c] mb-2">
            <span className="h-[2px] w-6 bg-[#fb923c]" />
            Βρες τον αγώνα σου
          </div>
          <h3
            className="font-[var(--f-display)] italic font-black leading-[0.95] tracking-[-0.01em] text-[#F3EFE6]"
            style={{ fontSize: "clamp(1.4rem, 3vw, 2rem)" }}
          >
            Επίλεξε ομάδα, δες πότε παίζει.
          </h3>
        </div>
        <div className="w-full md:max-w-sm">
          <TeamFilter
            options={allTeams}
            pinned={userTeams}
            logosByTeam={teamLogos}
            value={selectedTeam}
            onChange={setSelectedTeam}
          />
        </div>
      </div>

      {/* Empty state */}
      {filteredMatches.length === 0 && (
        <div
          className="relative border-2 border-dashed border-[#F3EFE6]/25 p-10 text-center"
          style={{ background: "rgba(19,19,29,0.4)" }}
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#fb923c]">
            / 00 · Πρόγραμμα
          </span>
          <p className="mt-4 font-[var(--f-display)] italic text-2xl md:text-3xl font-black leading-tight text-[#F3EFE6]">
            Δεν υπάρχουν προσεχείς αγώνες
          </p>
          <p className="mt-3 font-[var(--f-body)] text-sm text-[#F3EFE6]/60">
            {selectedTeam
              ? `Η ομάδα ${selectedTeam} δεν έχει προγραμματισμένους αγώνες`
              : "Δεν υπάρχουν προγραμματισμένοι αγώνες αυτή τη στιγμή."}
          </p>
        </div>
      )}

      {/* Hero next match */}
      {nextMatch && (
        <div className="mb-10 md:mb-14">
          <NextMatchHero match={nextMatch} />
        </div>
      )}

      {/* List */}
      {listMatches.length > 0 && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.3em] text-[#F3EFE6]/65">
              <span className="h-[2px] w-6 bg-[#F3EFE6]/30" />
              Επόμενοι αγώνες
              <span className="text-[#F3EFE6]/40">· {pad2(filteredMatches.length)}</span>
            </div>
            {selectedTeam && (
              <button
                onClick={() => setSelectedTeam(null)}
                className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#fb923c] hover:text-[#F3EFE6] transition-colors"
              >
                Όλες οι ομάδες →
              </button>
            )}
          </div>

          <div className="border-y border-[#F3EFE6]/10 bg-[#0a0a14]/40">
            {listMatches.map((m, i) => (
              <EditorialMatchRow key={m.id} match={m} index={i} />
            ))}
          </div>

          {hasMore && (
            <div className="mt-5 text-center">
              <Link
                href="/matches"
                className="inline-flex items-center gap-2 border-2 border-[#F3EFE6]/25 bg-transparent px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.28em] text-[#F3EFE6] hover:border-[#fb923c] hover:text-[#fb923c] transition-colors"
              >
                Προβολή όλων ({pad2(filteredMatches.length)})
                <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
