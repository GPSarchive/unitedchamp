"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Trophy, Calendar, MapPin, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { supabase } from "@/app/lib/supabase/supabaseClient";
import { resolveImageUrl, ImageType } from "@/app/lib/image-config";
import AnimatedHeroBg from "@/components/ui/AnimatedHeroBg";
import { WordByWord, FadeUp, StaggerContainer, StaggerItem } from "@/components/ui/animations";
import { StatusBadge, type MatchStatusType } from "@/components/ui/StatusBadge";

type TeamLite = { name: string | null; logo: string | null };
type TournamentLite = { id: number; name: string | null; logo: string | null; season: string | null };
type MatchRow = {
  id: number;
  match_date: string | null;
  status: string | null;
  team_a_score: number | null;
  team_b_score: number | null;
  teamA: TeamLite[] | TeamLite | null;
  teamB: TeamLite[] | TeamLite | null;
  tournament: TournamentLite[] | TournamentLite | null;
  stage_id: number | null;
  group_id: number | null;
  matchday: number | null;
  round: number | null;
  field: string | null;
};

const PLACEHOLDER = "/placeholder.png";
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

function nowISO() {
  return new Date().toISOString();
}

function formatGreekDate(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("el-GR", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

type TabKey = "all" | "upcoming" | "finished" | "postponed";

export default function MatchesClient() {
  const [tab, setTab] = React.useState<TabKey>("upcoming");
  const [page, setPage] = React.useState(1);
  const [rows, setRows] = React.useState<MatchRow[]>([]);
  const [total, setTotal] = React.useState<number>(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const pageSize = 8;

  const currentISO = React.useMemo(() => nowISO(), []);

  React.useEffect(() => {
    setPage(1);
  }, [tab]);

  React.useEffect(() => {
    const fetchMatches = async () => {
      setLoading(true);
      setError(null);

      try {
        let dataQ = supabase
          .from("matches")
          .select(
            `id, match_date, status, team_a_score, team_b_score,
             stage_id, group_id, matchday, round, field,
             teamA:teams!matches_team_a_id_fkey (name, logo),
             teamB:teams!matches_team_b_id_fkey (name, logo),
             tournament:tournament_id (id, name, logo, season)`,
            { count: "exact" }
          );

        // Apply filters based on tab
        switch (tab) {
          case "upcoming":
            dataQ = dataQ.gte("match_date", currentISO).order("match_date", { ascending: true });
            break;
          case "finished":
            dataQ = dataQ.eq("status", "finished").order("match_date", { ascending: false });
            break;
          case "postponed":
            dataQ = dataQ.eq("status", "postponed").order("match_date", { ascending: false });
            break;
          default:
            dataQ = dataQ.order("match_date", { ascending: false });
        }

        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        dataQ = dataQ.range(from, to);

        const { data, error, count } = await dataQ;
        if (error) throw error;

        setRows(data ?? []);
        setTotal(count ?? 0);
      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : "Failed to load matches";
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchMatches();
  }, [tab, page, currentISO]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const tabs: { key: TabKey; label: string }[] = [
    { key: "all", label: "Όλοι" },
    { key: "upcoming", label: "Επερχόμενοι" },
    { key: "finished", label: "Ολοκληρωμένοι" },
    { key: "postponed", label: "Αναβληθέντες" },
  ];

  return (
    <div className="min-h-screen bg-[#09090B] text-white">
      {/* Hero Section */}
      <section className="relative min-h-[35vh] flex items-center justify-center overflow-hidden">
        <AnimatedHeroBg variant="matches" />

        <div className="relative z-10 container mx-auto max-w-6xl px-4 py-16 text-center">
          {/* Section Tag */}
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-block mb-4 text-[11px] font-mono font-bold tracking-[0.2em] text-amber-400 uppercase"
          >
            ΑΓΩΝΕΣ
          </motion.span>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-4 leading-[0.95] tracking-tight">
            <WordByWord text="Πρόγραμμα &" className="block" />
            <WordByWord text="Αποτελέσματα" className="block" delay={0.3} />
          </h1>

          {/* Subtitle */}
          <FadeUp delay={0.5}>
            <p className="text-lg text-white/70 max-w-xl mx-auto">
              Όλοι οι αγώνες του UltraChamp σε πραγματικό χρόνο
            </p>
          </FadeUp>
        </div>
      </section>

      {/* Filter Bar - Sticky */}
      <div className="sticky top-16 md:top-32 z-40 bg-black/60 backdrop-blur-xl border-b border-white/10">
        <div className="container mx-auto max-w-6xl px-4 py-4">
          <div className="flex items-center justify-center gap-2 overflow-x-auto scrollbar-hide">
            {/* Status Tabs */}
            <div className="inline-flex rounded-xl bg-black/50 p-1 ring-1 ring-white/10">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`
                    relative px-4 sm:px-6 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider transition-all
                    ${tab === t.key 
                      ? "text-black" 
                      : "text-white/60 hover:text-white hover:bg-white/5"}
                  `}
                >
                  {tab === t.key && (
                    <motion.div
                      layoutId="active-tab-indicator"
                      className="absolute inset-0 bg-gradient-to-r from-amber-500 to-amber-600 rounded-lg shadow-[0_0_20px_rgba(251,191,36,0.4)]"
                      style={{ zIndex: -1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10">{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Matches List */}
      <section className="container mx-auto max-w-[900px] px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">
            {tab === "upcoming" && "Επερχόμενοι Αγώνες"}
            {tab === "finished" && "Ολοκληρωμένοι Αγώνες"}
            {tab === "postponed" && "Αναβληθέντες Αγώνες"}
            {tab === "all" && "Όλοι οι Αγώνες"}
          </h2>
          <span className="text-sm text-white/50 font-mono">{total} σύνολο</span>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div 
                key={i} 
                className="rounded-xl bg-black/40 border border-white/10 p-5 animate-pulse"
              >
                <div className="h-20 bg-white/5 rounded-lg" />
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-5 text-red-400">
            Σφάλμα: {error}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && rows.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 h-20 w-20 rounded-full bg-white/5 flex items-center justify-center">
              <Calendar className="h-10 w-10 text-white/30" />
            </div>
            <p className="text-lg text-white/60 mb-2">Δεν βρέθηκαν αγώνες</p>
            <p className="text-sm text-white/40">Δοκιμάστε άλλο φίλτρο</p>
          </div>
        )}

        {/* Matches Grid */}
        {!loading && !error && rows.length > 0 && (
          <StaggerContainer className="space-y-4" staggerDelay={0.06}>
            {rows.map((m) => (
              <StaggerItem key={m.id}>
                <MatchCard match={m} />
              </StaggerItem>
            ))}
          </StaggerContainer>
        )}

        {/* Pagination */}
        {!loading && !error && totalPages > 1 && (
          <div className="flex justify-center mt-8">
            <div className="inline-flex items-center gap-1 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 px-2 py-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-2 rounded-full text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (page <= 3) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = page - 2 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`
                      relative h-9 w-9 rounded-full text-sm font-medium transition-all
                      ${page === pageNum 
                        ? "text-black" 
                        : "text-white/60 hover:text-white hover:bg-white/10"}
                    `}
                  >
                    {page === pageNum && (
                      <motion.div
                        layoutId="page-indicator"
                        className="absolute inset-0 bg-amber-400 rounded-full shadow-[0_0_15px_rgba(251,191,36,0.4)]"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10">{pageNum}</span>
                  </button>
                );
              })}

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-2 rounded-full text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

/**
 * MatchCard - Google Champions League style match card
 */
function MatchCard({ match }: { match: MatchRow }) {
  const A = one(match.teamA);
  const B = one(match.teamB);
  const aName = A?.name ?? "Ομάδα Α";
  const bName = B?.name ?? "Ομάδα Β";
  const aLogo = A?.logo || PLACEHOLDER;
  const bLogo = B?.logo || PLACEHOLDER;

  const aScore = typeof match.team_a_score === "number" ? match.team_a_score : null;
  const bScore = typeof match.team_b_score === "number" ? match.team_b_score : null;
  const hasScores = aScore !== null && bScore !== null;

  const tournament = one(match.tournament);
  const tournamentName = tournament?.name ?? null;
  const tournamentLogoRaw = tournament?.logo ?? null;
  const tournamentLogo = tournamentLogoRaw ? resolveImageUrl(tournamentLogoRaw, ImageType.TOURNAMENT) : null;
  const tournamentSeason = tournament?.season ?? null;

  const matchdayRound = match.round
    ? `Round ${match.round}`
    : match.matchday
    ? `Αγωνιστική ${match.matchday}`
    : null;

  const status = (match.status as MatchStatusType) || "scheduled";

  return (
    <Link href={`/matches/${match.id}`}>
      <motion.div
        className="group relative rounded-xl bg-black/40 backdrop-blur-xl border border-white/10 p-5 hover:border-white/20 transition-all cursor-pointer"
        whileHover={{ y: -4, transition: { duration: 0.2 } }}
      >
        {/* Tournament Context Row */}
        {(tournamentName || matchdayRound) && (
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/5">
            <div className="flex items-center gap-2">
              {tournamentLogo ? (
                <img
                  src={tournamentLogo}
                  alt={tournamentName || ""}
                  className="h-6 w-6 object-contain"
                />
              ) : (
                <Trophy className="h-5 w-5 text-white/40" />
              )}
              <span className="text-xs text-white/60 font-medium">{tournamentName}</span>
              {tournamentSeason && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[10px] font-mono">
                  {tournamentSeason}
                </span>
              )}
            </div>
            {matchdayRound && (
              <span className="text-[10px] text-white/40 font-mono uppercase">{matchdayRound}</span>
            )}
          </div>
        )}

        {/* Teams & Score Row */}
        <div className="flex items-center justify-between gap-4">
          {/* Team A */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="relative h-14 w-14 shrink-0 rounded-xl bg-black/50 border border-white/10 p-2 overflow-hidden">
              <img
                src={aLogo}
                alt={aName}
                className="h-full w-full object-contain"
              />
            </div>
            <span className="font-bold text-white truncate text-lg">{aName}</span>
          </div>

          {/* Score / VS */}
          <div className="flex flex-col items-center justify-center shrink-0 min-w-[100px]">
            {hasScores ? (
              <div className="flex items-center gap-3 text-3xl font-black tabular-nums">
                <span className={aScore > bScore ? "text-amber-400" : "text-white/50"}>{aScore}</span>
                <span className="text-white/30">—</span>
                <span className={bScore > aScore ? "text-amber-400" : "text-white/50"}>{bScore}</span>
              </div>
            ) : (
              <div className="px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500/20 to-amber-600/20 border border-amber-500/30">
                <span className="text-xl font-black text-amber-400">VS</span>
              </div>
            )}
          </div>

          {/* Team B */}
          <div className="flex items-center gap-3 flex-1 min-w-0 justify-end">
            <span className="font-bold text-white truncate text-lg text-right">{bName}</span>
            <div className="relative h-14 w-14 shrink-0 rounded-xl bg-black/50 border border-white/10 p-2 overflow-hidden">
              <img
                src={bLogo}
                alt={bName}
                className="h-full w-full object-contain"
              />
            </div>
          </div>
        </div>

        {/* Metadata Row */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5 text-xs text-white/50">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              <span className="font-mono">{formatGreekDate(match.match_date)}</span>
            </div>
            {match.field && (
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                <span>{match.field}</span>
              </div>
            )}
          </div>
          <StatusBadge status={status} size="sm" />
        </div>

        {/* Hover Border Effect */}
        <div className="absolute inset-0 rounded-xl border-2 border-amber-400/0 group-hover:border-amber-400/20 transition-all pointer-events-none" />
      </motion.div>
    </Link>
  );
}
