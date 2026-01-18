"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

// ================== Types ==================
type Announcement = {
  id: number;
  title: string;
  body: string;
  format: "md" | "html" | "plain";
  start_at: string | null;
  created_at: string;
  pinned: boolean;
};

// ================== Utils ==================
const TZ = "Europe/Athens";
const fmt = (d: string | null) =>
  d
    ? new Date(d).toLocaleString("el-GR", {
        timeZone: TZ,
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "";

function toPlain(body: string, format: Announcement["format"]) {
  if (format === "html") {
    return body
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim();
  }
  if (format === "md") {
    return body
      .replace(/`{1,3}[^`]*`{1,3}/g, " ")
      .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
      .replace(/\[[^\]]*\]\([^)]+\)/g, " ")
      .replace(/[#!>*_~\-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  return body.replace(/\s+/g, " ").trim();
}

function clamp(s: string, n = 180) {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

const byRecent = (a: Announcement, b: Announcement) => {
  const da = Date.parse(a.start_at || a.created_at || "");
  const db = Date.parse(b.start_at || b.created_at || "");
  return db - da; // newest first
};

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ================== Component ==================
export type MiniAnnouncementsProps = {
  /** Number of non-pinned announcements to show (3 or 4). */
  limit?: 3 | 4 | number;
  /** Pinned page size (always 3 per your request). */
  pinnedPageSize?: number; // default 3
  /** Detail route prefix (user asked for /annoucement/[id]). */
  basePath?: string;
  /** “See all” link. */
  allLinkHref?: string;
  className?: string;
};

export default function MiniAnnouncements({
  limit = 4,
  pinnedPageSize = 3,
  basePath = "/announcement",
  allLinkHref = "/announcements",
  className,
}: MiniAnnouncementsProps) {
  const [rows, setRows] = React.useState<Announcement[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [pinnedPage, setPinnedPage] = React.useState(0);

  // Fetch a generous number to cover pinned pagination without relying on API filters
  React.useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const fetchLimit = Math.max(Number(limit) + Number(pinnedPageSize) * 3 + 9, 24);
        const r = await fetch(`/api/announcements?active=1&offset=0&limit=${fetchLimit}`, {
          cache: "no-store",
        });
        const j = await r.json();
        if (j.error) throw new Error(j.error);
        const data: Announcement[] = (j.data ?? []) as Announcement[];
        // Order by pinned first, then newest
        const ordered = [...data].sort((a, b) => (Number(b.pinned) - Number(a.pinned)) || byRecent(a, b));
        setRows(ordered);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load announcements");
      } finally {
        setLoading(false);
      }
    })();
  }, [limit, pinnedPageSize]);

  // Partition and paginate pinned
  const allPinned = React.useMemo(() => rows.filter(r => r.pinned).sort(byRecent), [rows]);
  const pinnedPages = React.useMemo(() => chunk(allPinned, pinnedPageSize), [allPinned, pinnedPageSize]);
  const clampedPinnedPage = Math.min(pinnedPage, Math.max(0, pinnedPages.length - 1));
  React.useEffect(() => {
    if (clampedPinnedPage !== pinnedPage) setPinnedPage(clampedPinnedPage);
  }, [clampedPinnedPage, pinnedPage]);
  const visiblePinned = pinnedPages[clampedPinnedPage] ?? [];
  const pinnedIds = React.useMemo(() => new Set(allPinned.map(p => p.id)), [allPinned]);

  // Main list excludes all pinned; show up to 'limit'
  const mainRows = React.useMemo(
    () => rows.filter(r => !pinnedIds.has(r.id)).sort(byRecent).slice(0, Number(limit)),
    [rows, pinnedIds, limit]
  );

  // =============== UI ===============
  return (
    <section className={className} aria-label="Mini announcements list with pinned and pagination">
  <div className="mx-auto w-full max-w-none"> {/* Removed max-w-4xl */}
    {/* Shared surface: same background for pinned + list, separators only via bottom borders */}
    <div className="rounded-2xl border border-white/10 bg-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur overflow-hidden">
      {/* Header on the same background */}
      <div className="px-5 sm:px-6 py-4 flex items-end justify-between border-b border-white/10">
        <h3 className="text-lg sm:text-xl font-extrabold tracking-tight text-white">Ανακοινώσεις</h3>
        <Link
          href={allLinkHref}
          className="text-xs sm:text-sm font-semibold text-white/80 hover:text-white underline underline-offset-4"
        >
          Δες όλες
        </Link>
      </div>

      {/* Loading state (skeleton) */}
      {loading && (
        <ul className="divide-y divide-white/10">
          {/* Pinned skeleton */}
          {[0, 1, 2].map(i => (
            <li key={i} className="px-5 sm:px-6 py-5">
              <div className="h-4 w-1/5 bg-white/10 rounded mb-2 animate-pulse" />
              <div className="h-4 w-2/3 bg-white/10 rounded mb-3 animate-pulse" />
              <div className="h-3 w-full bg-white/10 rounded mb-2 animate-pulse" />
              <div className="h-3 w-5/6 bg-white/10 rounded animate-pulse" />
            </li>
          ))}
          {Array.from({ length: Number(limit) }).map((_, i) => (
            <li key={i} className="px-5 sm:px-6 py-5">
              <div className="h-4 w-2/3 bg-white/10 rounded mb-3 animate-pulse" />
              <div className="h-3 w-full bg-white/10 rounded mb-2 animate-pulse" />
              <div className="h-3 w-5/6 bg-white/10 rounded animate-pulse" />
            </li>
          ))}
        </ul>
      )}

      {!loading && error && (
        <div className="px-5 sm:px-6 py-5 text-sm text-red-400">Σφάλμα: {error}</div>
      )}

      {!loading && !error && (
        <div>
          {/* Pinned Section (paginated, 3 per page) */}
          {allPinned.length > 0 && (
            <div>
              <div className="px-5 sm:px-6 pt-4 pb-2 flex items-center gap-3">
                <div className="text-[11px] uppercase tracking-[0.12em] text-white/60">Pinned</div>
                {/* Pagination controls (only if more than one page) */}
                {pinnedPages.length > 1 && (
                  <div className="ml-auto flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPinnedPage(p => Math.max(0, p - 1))}
                      disabled={clampedPinnedPage === 0}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/15 bg-white/5 hover:bg-white/10 disabled:opacity-40"
                      aria-label="Previous pinned"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="px-2 text-[11px] text-white/70 tabular-nums">
                      {clampedPinnedPage + 1}/{pinnedPages.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPinnedPage(p => Math.min(pinnedPages.length - 1, p + 1))}
                      disabled={clampedPinnedPage >= pinnedPages.length - 1}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/15 bg-white/5 hover:bg-white/10 disabled:opacity-40"
                      aria-label="Next pinned"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              <ul className="divide-y divide-white/10">
                {visiblePinned.map((a) => (
                  <Row key={a.id} a={a} basePath={basePath} pinned />
                ))}
              </ul>

              {/* Divider between pinned and the rest */}
              {mainRows.length > 0 && <div className="border-t border-white/10" />}
            </div>
          )}

          {/* Main list (3 or 4) */}
          <ul className="divide-y divide-white/10">
            {mainRows.length === 0 && allPinned.length === 0 && (
              <li className="px-5 sm:px-6 py-5 text-sm text-white/70">Δεν υπάρχουν ενεργές ανακοινώσεις.</li>
            )}
            {mainRows.map((a) => (
              <Row key={a.id} a={a} basePath={basePath} />
            ))}
          </ul>
        </div>
      )}
    </div>
  </div>
</section>
  );
}

// ================== Row component ==================
function Row({ a, basePath, pinned = false }: { a: Announcement; basePath: string; pinned?: boolean }) {
  const date = fmt(a.start_at || a.created_at);
  const preview = clamp(toPlain(a.body, a.format), 180);

  return (
    <li className="relative px-5 sm:px-6 py-5 hover:bg-white/5 transition-colors">
      <div className="flex items-start gap-3">
        {/* Left accent dot */}
        <div className="pt-1">
          <span className={`inline-block h-2 w-2 rounded-full ${pinned ? "bg-amber-300/90" : "bg-white/30"}`} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            {pinned && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-200/15 border border-amber-200/30 text-amber-100">
                PINNED
              </span>
            )}
            <time className="ml-auto text-[11px] text-white/60">{date}</time>
          </div>

          <h4 className="font-semibold text-white leading-snug line-clamp-2 text-base sm:text-lg">{a.title}</h4>
          <p className="mt-1 text-sm sm:text-[15px] text-white/80 leading-relaxed line-clamp-2">{preview}</p>
        </div>

        <div className="hidden sm:flex items-center self-stretch pl-3">
          <Link
            href={`${basePath}/${a.id}`}
            className="text-[12px] font-bold uppercase tracking-wide text-white/90 hover:text-white underline underline-offset-4"
          >
            Περισσότερα →
          </Link>
        </div>
      </div>

      {/* Whole row tappable */}
      <Link href={`${basePath}/${a.id}`} className="absolute inset-0" aria-label={a.title} />
    </li>
  );
}
