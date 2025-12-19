'use client';

import * as React from 'react';
import Link from 'next/link';
import { Trophy } from 'lucide-react';
import { supabase } from '@/app/lib/supabase/supabaseClient';
import { resolveImageUrl, ImageType } from '@/app/lib/image-config';

type Props = {
  className?: string;
  pageSize?: number;  // Set default page size to 5
  tournamentId?: number;
  variant?: 'glass' | 'transparent';
  maxWClass?: string;
};

type TeamLite = { name: string | null; logo: string | null };
type TournamentLite = { id: number; name: string | null; logo: string | null };
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
};

const PLACEHOLDER = '/placeholder.png';
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

function nowISO() {
  return new Date().toISOString();
}

function formatLocal(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso); // Create Date object from the ISO string

  // Use toLocaleString to show the date and time in UTC
  return d.toLocaleString('el-GR', {
    weekday: 'long', // Full name of the weekday
    year: 'numeric', // Full year
    month: 'long', // Full month name
    day: '2-digit', // Day with leading zero if necessary
    hour: '2-digit', // Hour in 2-digit format
    minute: '2-digit', // Minute in 2-digit format
    second: '2-digit', // Optional, can be removed
    hour12: false, // Use 24-hour format
    timeZone: 'UTC', // Explicitly display the date in UTC time zone
  });
}


type TabKey = 'upcoming' | 'finished';

export default function RecentMatchesTabs({
  className,
  pageSize = 5,  // Default to 5 matches per page
  tournamentId,
  variant = 'glass',
  maxWClass = 'max-w-7xl',
}: Props) {
  const [tab, setTab] = React.useState<TabKey>('upcoming');
  const [page, setPage] = React.useState(1);
  const [rows, setRows] = React.useState<MatchRow[]>([]);
  const [total, setTotal] = React.useState<number>(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const currentISO = React.useMemo(() => nowISO(), []);

  React.useEffect(() => {
    setPage(1);  // Reset to first page when tab changes
  }, [tab]);

  React.useEffect(() => {
    const fetchMatches = async () => {
      setLoading(true);
      setError(null);

      const isUpcoming = tab === 'upcoming';
      try {
        // Build base query for matches
        let dataQ = supabase
          .from('matches')
          .select(
            `id, match_date, status, team_a_score, team_b_score,
             stage_id, group_id, matchday, round,
             teamA:teams!matches_team_a_id_fkey (name, logo),
             teamB:teams!matches_team_b_id_fkey (name, logo),
             tournament:tournament_id (id, name, logo)`,
            { count: 'exact' }
          );

        if (typeof tournamentId === 'number') {
          dataQ = dataQ.eq('tournament_id', tournamentId);
        }

        // No status filter

        // Filter based on date only
        dataQ = isUpcoming 
          ? dataQ.gte('match_date', currentISO) 
          : dataQ.lt('match_date', currentISO);

        // Order: upcoming ascending (soonest first), finished descending (most recent first)
        dataQ = dataQ.order('match_date', { ascending: isUpcoming });

        // Set the pagination range
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        dataQ = dataQ.range(from, to);

        const { data, error, count } = await dataQ;
        if (error) throw error;

        setRows(data ?? []);
        setTotal(count ?? 0);
      } catch (e: any) {
        setError(e?.message ?? 'Failed to load matches');
      } finally {
        setLoading(false);
      }
    };

    fetchMatches();
  }, [tab, page, pageSize, tournamentId, currentISO]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const wrapperClasses =
    variant === 'transparent'
      ? 'rounded-2xl border-0 bg-transparent shadow-none backdrop-blur-0'
      : 'rounded-2xl border border-white/10 bg-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),_0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur';

  return (
    <section className={className} aria-label="Recent matches with tabs">
      <div className={['mx-auto w-full sm:max-w-[440px] md:max-w-[440px] lg:max-w-[880px]', maxWClass].join(' ')}>
        <div className={wrapperClasses + ' overflow-hidden'}>
          {/* Tabs */}
          <div className="px-5 sm:px-6 pt-4">
            <div className="inline-flex rounded-xl bg-white/5 p-1 ring-1 ring-white/10">
              <button
                onClick={() => setTab('upcoming')}
                className={[
                  'px-5 py-3 text-sm font-semibold rounded-lg transition',
                  tab === 'upcoming'
                    ? 'bg-white/90 text-black'
                    : 'text-white/80 hover:text-white hover:bg-white/10',
                ].join(' ')}
                aria-pressed={tab === 'upcoming'}
              >
                Upcoming
              </button>
              <button
                onClick={() => setTab('finished')}
                className={[
                  'px-5 py-3 text-sm font-semibold rounded-lg transition',
                  tab === 'finished'
                    ? 'bg-white/90 text-black'
                    : 'text-white/80 hover:text-white hover:bg-white/10',
                ].join(' ')}
                aria-pressed={tab === 'finished'}
              >
                Finished
              </button>
            </div>
          </div>

          {/* Header */}
          <div className="px-5 sm:px-6 py-5 flex items-center justify-between border-b border-white/10">
            <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
              {tab === 'upcoming' ? 'Επερχόμενοι Αγώνες' : 'Ολοκληρωμένοι Αγώνες'}
            </h3>
            <span className="text-xs sm:text-sm text-white/70">{total} σύνολο</span>
          </div>

          {/* Body */}
          {loading && (
            <ul className="divide-y divide-white/10">
              {Array.from({ length: Math.min(pageSize, 6) }).map((_, i) => (
                <li key={i} className="px-5 sm:px-6 py-5">
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-white/10 animate-pulse" />
                    <div className="flex-1">
                      <div className="h-6 w-2/3 bg-white/10 rounded mb-2 animate-pulse" />
                      <div className="h-4 w-1/3 bg-white/10 rounded animate-pulse" />
                    </div>
                    <div className="h-12 w-12 rounded-full bg-white/10 animate-pulse" />
                  </div>
                </li>
              ))}
            </ul>
          )}

          {!loading && error && (
            <div className="px-5 sm:px-6 py-5 text-sm text-red-400">Σφάλμα: {error}</div>
          )}

          {!loading && !error && (
            <>
              <ul className="divide-y divide-white/10">
                {rows.length === 0 && (
                  <li className="px-5 sm:px-6 py-5 text-sm text-white/70">
                    Δεν υπάρχουν αγώνες σε αυτή την καρτέλα.
                  </li>
                )}
                {rows.map((m) => {
                  const A = one(m.teamA);
                  const B = one(m.teamB);
                  const aName = A?.name ?? 'Ομάδα Α';
                  const bName = B?.name ?? 'Ομάδα Β';
                  const aLogo = A?.logo || PLACEHOLDER;
                  const bLogo = B?.logo || PLACEHOLDER;

                  // Show scores if they exist, regardless of tab, but typically for past matches they will
                  const aScore = typeof m.team_a_score === 'number' ? m.team_a_score : null;
                  const bScore = typeof m.team_b_score === 'number' ? m.team_b_score : null;

                  // Tournament and matchday/round info
                  const tournament = one(m.tournament);
                  const tournamentName = tournament?.name ?? null;
                  const tournamentLogoRaw = tournament?.logo ?? null;
                  const tournamentLogo = tournamentLogoRaw ? resolveImageUrl(tournamentLogoRaw, ImageType.TOURNAMENT) : null;
                  const matchdayRound = m.round
                    ? `Round ${m.round}`
                    : m.matchday
                    ? `Αγωνιστική ${m.matchday}`
                    : null;

                  return (
                    <li key={m.id} className="relative px-5 sm:px-6 py-6 hover:bg-white/5 transition-colors">
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-4 min-w-0 w-full sm:w-auto">
                          <img
                            src={aLogo}
                            alt={aName}
                            className="h-12 w-12 rounded-full object-contain ring-1 ring-white/20 bg-black/30"
                          />
                          <span className="truncate font-extrabold text-white uppercase tracking-wide text-lg">
                            {aName}
                          </span>
                        </div>
                        <div className="flex flex-col items-center justify-center text-center shrink-0">
                          {aScore !== null && bScore !== null ? (
                            <div className="font-black tabular-nums text-white text-[24px] sm:text-[28px] leading-none">
                              {aScore} <span className="mx-2">–</span> {bScore}
                            </div>
                          ) : (
                            <div className="font-extrabold text-white/85 text-[22px] sm:text-[24px] leading-none">
                              VS
                            </div>
                          )}
                          <div className="mt-2 text-[13px] text-white/60 leading-none whitespace-nowrap">
                            {formatLocal(m.match_date)}
                          </div>
                          {(tournamentName || matchdayRound) && (
                            <div className="mt-1.5 flex flex-col items-center gap-0.5 text-[11px] text-white/50 leading-tight">
                              {tournamentName && (
                                <div className="flex items-center gap-1">
                                  {tournamentLogo ? (
                                    <img src={tournamentLogo} alt={tournamentName} className="h-4 w-4 object-contain" />
                                  ) : (
                                    <Trophy className="h-4 w-4" />
                                  )}
                                  <span className="font-semibold">{tournamentName}</span>
                                </div>
                              )}
                              {matchdayRound && <div>{matchdayRound}</div>}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-4 justify-end min-w-0 w-full sm:w-auto sm:justify-start">
                          <span className="truncate font-extrabold text-white uppercase tracking-wide text-lg text-right sm:text-left">
                            {bName}
                          </span>
                          <img
                            src={bLogo}
                            alt={bName}
                            className="h-12 w-12 rounded-full object-contain ring-1 ring-white/20 bg-black/30"
                          />
                        </div>
                      </div>
                      <Link href={`/matches/${m.id}`} className="absolute inset-0" aria-label={`${aName} vs ${bName}`} />
                    </li>
                  );
                })}
              </ul>

              {/* Pagination */}
              <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-t border-white/10">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white/90 disabled:text-white/40 disabled:cursor-not-allowed bg-white/10 hover:bg-white/15 transition"
                >
                  Προηγούμενα
                </button>
                <div className="text-xs text-white/70">
                  Σελίδα <span className="font-semibold text-white">{page}</span> / {totalPages}
                </div>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white/90 disabled:text-white/40 disabled:cursor-not-allowed bg-white/10 hover:bg-white/15 transition"
                >
                  Επόμενα
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}