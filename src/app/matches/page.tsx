// app/matches/page.tsx
import { supabaseAdmin } from '@/app/lib/supabase/supabaseAdmin';
import { unstable_cache, revalidateTag } from 'next/cache';
import type { Metadata } from 'next';
import crypto from 'crypto';

// --- Optional (SEO) ---
export const metadata: Metadata = {
  title: 'Matches',
  description: 'Fixtures & results for our mini football community',
};

// We do our own result caching via unstable_cache; keep the page dynamic.
export const dynamic = 'force-dynamic';

// ---------- Types ----------
type Status = 'scheduled' | 'finished';

type Filters = {
  status?: Status;
  from?: string;            // ISO datetime (inclusive)
  to?: string;              // ISO datetime (inclusive)
  tournament?: number[];    // multi
  stage?: number[];         // multi
  group?: number[];         // multi
  team?: number;            // either A or B
  matchday?: number;
  round?: number;
  confirmedOnly?: boolean;  // hide bracket placeholders
};

type MatchRow = {
  id: number;
  match_date: string | null;
  status: Status;
  team_a_id: number | null;
  team_b_id: number | null;
  team_a_score: number | null;
  team_b_score: number | null;
  winner_team_id: number | null;
  tournament_id: number | null;
  stage_id: number | null;
  group_id: number | null;
  matchday: number | null;
  round: number | null;
  // Nested
  team_a?: { id: number; name: string | null; logo: string | null } | null;
  team_b?: { id: number; name: string | null; logo: string | null } | null;
  tournament?: { id: number; name: string; slug: string; season: string | null } | null;
  stage?: { id: number; name: string; kind: string; ordering: number } | null;
  tgroup?: { id: number; name: string } | null; // "group" is a reserved word in TS
};

type PageData = {
  items: MatchRow[];
  hasMore: boolean;
  nextPage: number | null;
};

// ---------- Utilities ----------
const PAGE_SIZE_DEFAULT = 20;

function parseNum(val?: string | string[]) {
  if (!val) return undefined;
  const s = Array.isArray(val) ? val[0] : val;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

function parseNumArray(val?: string | string[]) {
  if (!val) return undefined;
  if (Array.isArray(val)) {
    // support ?tournament=1&tournament=2
    return val.map(Number).filter(Number.isFinite);
  }
  // support ?tournament=1,2,3
  return val
    .split(',')
    .map((v) => Number(v.trim()))
    .filter(Number.isFinite);
}

function parseFilters(searchParams: Record<string, string | string[] | undefined>): Filters {
  const status = (Array.isArray(searchParams.status) ? searchParams.status[0] : searchParams.status) as Status | undefined;
  const from = Array.isArray(searchParams.from) ? searchParams.from[0] : searchParams.from;
  const to = Array.isArray(searchParams.to) ? searchParams.to[0] : searchParams.to;
  const team = parseNum(searchParams.team);
  const matchday = parseNum(searchParams.matchday);
  const round = parseNum(searchParams.round);
  const confirmedOnly = (Array.isArray(searchParams.confirmedOnly) ? searchParams.confirmedOnly[0] : searchParams.confirmedOnly) === 'true';

  return {
    status,
    from,
    to,
    team,
    matchday,
    round,
    confirmedOnly,
    tournament: parseNumArray(searchParams.tournament),
    stage: parseNumArray(searchParams.stage),
    group: parseNumArray(searchParams.group),
  };
}

function hashFilters(filters: Filters, page: number, pageSize: number) {
  const raw = JSON.stringify({ filters, page, pageSize });
  return crypto.createHash('sha1').update(raw).digest('hex').slice(0, 16);
}

function tagForFilters(filters: Filters) {
  // Tag without pagination so we can invalidate all pages for the same filter set.
  const raw = JSON.stringify(filters);
  const h = crypto.createHash('sha1').update(raw).digest('hex').slice(0, 16);
  return `matches:${h}`;
}

// ---------- DB Query (wrapped in Next cache) ----------
const getMatches = unstable_cache(
  async (filters: Filters, page: number, pageSize: number): Promise<PageData> => {
    // We fetch limit+1 rows so we know if there is a next page (no extra "count" query).
    const limitPlusOne = pageSize + 1;
    const from = (page - 1) * pageSize;
    const to = from + limitPlusOne - 1;

    // Base select with nested relations by FK name (see schema FKs).
    // - matches.status / match_date / tournament_id / stage_id / group_id / matchday / round
    // - team_a_id / team_b_id, winner_team_id
    const select = `
      id, match_date, status, team_a_id, team_b_id, team_a_score, team_b_score, winner_team_id,
      tournament_id, stage_id, group_id, matchday, round, is_dummy,
      team_a:teams!matches_team_a_id_fkey ( id, name, logo ),
      team_b:teams!matches_team_b_id_fkey ( id, name, logo ),
      tournament:tournaments ( id, name, slug, season ),
      stage:tournament_stages ( id, name, kind, ordering ),
      tgroup:tournament_groups ( id, name )
    `;

    let q = supabaseAdmin
      .from('matches')
      .select(select, { count: null })
      .eq('is_dummy', false); // hide dummy rows by default (schema provides is_dummy)  // :contentReference[oaicite:3]{index=3}

    // Filters
    if (filters.status) q = q.eq('status', filters.status); // scheduled|finished  // :contentReference[oaicite:4]{index=4}
    if (filters.from) q = q.gte('match_date', filters.from); // :contentReference[oaicite:5]{index=5}
    if (filters.to) q = q.lte('match_date', filters.to);     // :contentReference[oaicite:6]{index=6}
    if (filters.tournament?.length) q = q.in('tournament_id', filters.tournament); // :contentReference[oaicite:7]{index=7}
    if (filters.stage?.length) q = q.in('stage_id', filters.stage);                 // :contentReference[oaicite:8]{index=8}
    if (filters.group?.length) q = q.in('group_id', filters.group);                 // :contentReference[oaicite:9]{index=9}
    if (filters.matchday !== undefined) q = q.eq('matchday', filters.matchday);     // :contentReference[oaicite:10]{index=10}
    if (filters.round !== undefined) q = q.eq('round', filters.round);              // :contentReference[oaicite:11]{index=11}
    if (filters.team !== undefined) {
      // either team_a or team_b equals the selected team
      q = q.or(`team_a_id.eq.${filters.team},team_b_id.eq.${filters.team}`);        // :contentReference[oaicite:12]{index=12}
    }
    if (filters.confirmedOnly) {
      q = q.not('team_a_id', 'is', null).not('team_b_id', 'is', null);              // :contentReference[oaicite:13]{index=13}
    }

    // Order: scheduled ascending; finished descending (ties break by id to keep pagination stable)
    const ascending = filters.status !== 'finished';
    q = q.order('match_date', { ascending }).order('id', { ascending });

    // Pagination
    q = q.range(from, to);

    const { data, error } = await q;
    if (error) {
      // Let the page crash with a helpful message; in real apps you might log & show a friendly UI.
      throw new Error(`Failed to load matches: ${error.message}`);
    }

    const items = (data ?? []) as MatchRow[];
    const hasMore = items.length > pageSize;
    const sliced = hasMore ? items.slice(0, pageSize) : items;

    return {
      items: sliced,
      hasMore,
      nextPage: hasMore ? page + 1 : null,
    };
  },
  // Cache key (function identity) — we’ll scope by args in the options
  ['getMatches'],
  {
    // Scope caching per unique filter+page+size using key + tags.
    getKey: (...args: any[]) => {
      const [filters, page, pageSize] = args as [Filters, number, number];
      const key = `matches:${hashFilters(filters, page, pageSize)}`;
      return [key];
    },
    tags: (filters: Filters) => [tagForFilters(filters)],
    revalidate: 60, // 1 minute — tune per freshness needs
  }
);

// Optional: export a helper to revalidate all pages for a filter set after mutations.
export async function revalidateMatches(filters: Filters) {
  'use server';
  revalidateTag(tagForFilters(filters));
}

// ---------- Server Action for "Load more" ----------
export async function loadMoreAction(prevFilters: Filters, nextPage: number, pageSize: number) {
  'use server';
  return getMatches(prevFilters, nextPage, pageSize);
}

// ---------- Page ----------
export default async function MatchesPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const filters = parseFilters(searchParams);
  const page = parseNum(searchParams.page) ?? 1;
  const pageSize = parseNum(searchParams.limit) ?? PAGE_SIZE_DEFAULT;

  const initial = await getMatches(filters, page, pageSize);

  // These components are placeholders you’ll wire next:
  // - <FilterBar /> renders filter controls and writes to searchParams.
  // - <MatchesClient /> is a small Client Component that:
  //     - renders initial.items,
  //     - calls loadMoreAction(filters, nextPage, pageSize) on click/scroll,
  //     - appends items to the list (no extra DB searches while filters unchanged).
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight">Matches</h1>
        <p className="text-sm text-zinc-500">Fixtures & results</p>
      </header>

      {/* (Coming next) a server component that fetches filter options with long-lived cache */}
      {/* <FilterBar initialFilters={filters} /> */}

      {/* Hydrate the list with initial SSR data + pass the server action for pagination */}
      <MatchesClient
        initialData={initial}
        filters={filters}
        pageSize={pageSize}
        loadMore={loadMoreAction}
      />
    </div>
  );
}

// ---------- Minimal client component scaffold (keep in this file for now) ----------
/**
 * You can move this to app/matches/MatchesClient.tsx later.
 * It expects a "Load More" UX; swap with virtualization/infinite scroll as you like.
 */
'use client';
import { useState, useTransition } from 'react';

function MatchesClient({
  initialData,
  filters,
  pageSize,
  loadMore,
}: {
  initialData: PageData;
  filters: Filters;
  pageSize: number;
  loadMore: (filters: Filters, nextPage: number, pageSize: number) => Promise<PageData>;
}) {
  const [items, setItems] = useState<MatchRow[]>(initialData.items);
  const [nextPage, setNextPage] = useState<number | null>(initialData.nextPage);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {items.map((m) => (
          <li key={m.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-sm text-zinc-500">
                {m.match_date ? new Date(m.match_date).toLocaleString() : 'TBD'}
                {' · '}
                <span className="uppercase">{m.status}</span>
              </div>
              {/* Scoreline */}
              {m.status === 'finished' && (
                <div className="text-lg font-semibold tabular-nums">
                  {(m.team_a_score ?? '-') + ' : ' + (m.team_b_score ?? '-')}
                </div>
              )}
            </div>
            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <TeamBadge team={m.team_a} />
                <span className="text-xs text-zinc-400">vs</span>
                <TeamBadge team={m.team_b} />
              </div>
              <div className="text-xs text-zinc-500">
                {m.tournament?.name} · {m.stage?.name}
                {m.tgroup?.name ? ` · ${m.tgroup?.name}` : ''}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {nextPage && (
        <button
          className="mx-auto block rounded-full bg-orange-600 px-4 py-2 text-white transition hover:bg-orange-700 disabled:opacity-50"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              const res = await loadMore(filters, nextPage, pageSize);
              setItems((prev) => [...prev, ...res.items]);
              setNextPage(res.nextPage);
            })
          }
        >
          {isPending ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  );
}

function TeamBadge({ team }: { team?: { id: number; name: string | null; logo: string | null } | null }) {
  return (
    <div className="flex items-center gap-2">
      <img
        src={team?.logo ?? '/logo.jpg'}
        alt={team?.name ?? 'Team'}
        className="h-6 w-6 rounded-full object-cover"
      />
      <span className="text-sm font-medium">{team?.name ?? 'TBD'}</span>
    </div>
  );
}
