// app/tournaments/StageMatchesTabs.tsx (updated to support groupIdx)

'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTournamentData } from './useTournamentData'; // Adjust path to your store

type Props = {
  className?: string;
  pageSize?: number;  // Set default page size to 5
  stageIdx: number;  // Required: Index of the stage to display matches for
  groupIdx?: number; // NEW: Optional group index to filter matches for
  variant?: 'glass' | 'transparent';
  maxWClass?: string;
};

type TabKey = 'upcoming' | 'finished';

const PLACEHOLDER = '/placeholder.png';

function startOfTodayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function formatLocal(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('el-GR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function StageMatchesTabs({
  className,
  pageSize = 5,  // Default to 5 matches per page
  stageIdx,
  groupIdx,
  variant = 'glass',
  maxWClass = 'max-w-7xl',
}: Props) {
  const [tab, setTab] = React.useState<TabKey>('upcoming');
  const [page, setPage] = React.useState(1);

  const matches = useTournamentData((s) => s.matches) ?? [];
  const getTeamName = useTournamentData((s) => s.getTeamName);
  const getTeamLogo = useTournamentData((s) => s.getTeamLogo);

  const todayISO = React.useMemo(() => startOfTodayISO(), []);

  React.useEffect(() => {
    setPage(1);  // Reset to first page when tab changes
  }, [tab]);

  // Filter and sort matches for the stage (and optional group)
  const stageMatches = React.useMemo(() => {
    return matches
      .filter((m) => m.stageIdx === stageIdx && (groupIdx === undefined || m.groupIdx === groupIdx))
      .sort((a, b) => {
        const dateA = a.match_date ? new Date(a.match_date).getTime() : 0;
        const dateB = b.match_date ? new Date(b.match_date).getTime() : 0;
        return tab === 'upcoming' ? dateA - dateB : dateB - dateA; // Asc for upcoming, desc for finished
      });
  }, [matches, stageIdx, groupIdx, tab]);

  // Filter for tab
  const filteredMatches = React.useMemo(() => {
    return stageMatches.filter((m) => {
      const matchDate = m.match_date ? new Date(m.match_date).toISOString() : '';
      if (tab === 'upcoming') {
        return m.status === 'scheduled' && matchDate >= todayISO;
      } else {
        return m.status === 'finished';
      }
    });
  }, [stageMatches, tab, todayISO]);

  const total = filteredMatches.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Paginate
  const paginatedMatches = React.useMemo(() => {
    const from = (page - 1) * pageSize;
    const to = from + pageSize;
    return filteredMatches.slice(from, to);
  }, [filteredMatches, page, pageSize]);

  const wrapperClasses =
    variant === 'transparent'
      ? 'rounded-2xl border-0 bg-transparent shadow-none backdrop-blur-0'
      : 'rounded-2xl border border-white/10 bg-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),_0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur';

  return (
    <section className={className} aria-label="Stage matches with tabs">
      <div className={['mx-auto w-full', maxWClass].join(' ')}>
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
          <ul className="divide-y divide-white/10">
            {paginatedMatches.length === 0 && (
              <li className="px-5 sm:px-6 py-5 text-sm text-white/70">
                Δεν υπάρχουν αγώνες σε αυτή την καρτέλα.
              </li>
            )}
            {paginatedMatches.map((m) => {
              const aName = getTeamName(m.team_a_id ?? 0) ?? 'Ομάδα Α';
              const bName = getTeamName(m.team_b_id ?? 0) ?? 'Ομάδα Β';
              const aLogo = getTeamLogo(m.team_a_id ?? 0) || PLACEHOLDER;
              const bLogo = getTeamLogo(m.team_b_id ?? 0) || PLACEHOLDER;

              const aScore =
                tab === 'finished' && typeof m.team_a_score === 'number'
                  ? m.team_a_score
                  : null;
              const bScore =
                tab === 'finished' && typeof m.team_b_score === 'number'
                  ? m.team_b_score
                  : null;

              return (
                <li key={m.db_id ?? `${m.stageIdx}-${m.groupIdx ?? ''}-${m.matchday ?? ''}`} className="relative px-5 sm:px-6 py-6 hover:bg-white/5 transition-colors">
                  <div className="flex items-center justify-between gap-6">
                    <div className="flex items-center gap-4 min-w-0">
                      <img
                        src={aLogo}
                        alt={aName}
                        className="h-12 w-12 rounded-full object-contain ring-1 ring-white/20 bg-black/30"
                      />
                      <span className="max-w-[12rem] sm:max-w-[16rem] truncate font-extrabold text-white uppercase tracking-wide text-lg">
                        {aName}
                      </span>
                    </div>
                    <div className="flex flex-col items-center justify-center text-center shrink-0 w-[120px]">
                      {aScore !== null && bScore !== null ? (
                        <div className="font-black tabular-nums text-white text-[24px] sm:text-[28px] leading-none">
                          {aScore} <span className="mx-2">–</span> {bScore}
                        </div>
                      ) : (
                        <div className="font-extrabold text-white/85 text-[22px] sm:text-[24px] leading-none">
                          VS
                        </div>
                      )}
                      <div className="mt-2 text-[13px] text-white/60 leading-none line-clamp-1">
                        {formatLocal(m.match_date ?? null)}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 justify-end min-w-0">
                      <span className="max-w-[12rem] sm:max-w-[16rem] truncate font-extrabold text-white uppercase tracking-wide text-lg text-right">
                        {bName}
                      </span>
                      <img
                        src={bLogo}
                        alt={bName}
                        className="h-12 w-12 rounded-full object-contain ring-1 ring-white/20 bg-black/30"
                      />
                    </div>
                  </div>
                  <Link href={`/matches/${m.db_id ?? ''}`} className="absolute inset-0" aria-label={`${aName} vs ${bName}`} />
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
        </div>
      </div>
    </section>
  );
}