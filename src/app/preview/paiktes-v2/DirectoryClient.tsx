// Players directory — the whole active season is in memory, so search,
// filters and sorting are instant and never leave the browser. The URL mirrors
// the state (shareable links); rows are real links to the player page.
"use client";

import {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PlayerImage } from "@/app/lib/OptimizedImage";
import { isPlaceholderPhoto } from "@/app/lib/image-config";
import {
  DEFAULT_QUERY,
  STAT_KEYS,
  STAT_LABELS,
  activeFilterCount,
  defaultDir,
  parseQuery,
  playersLabel,
  prepareDirectory,
  selectRows,
  serializeQuery,
  statValue,
  type DirectoryData,
  type DirectoryQuery,
  type DirectoryRow,
  type SortKey,
  type StatKey,
} from "./model";
import { PAIKTES_VIEW_KEY, type SavedListView } from "./paths";

/** Rows rendered at first, and added each time the end of the list nears. */
const PAGE = 100;

/** A saved list position (see paths.ts) is honoured for this long. */
const VIEW_TTL_MS = 10 * 60 * 1000;

// rank | player | stats. Phones show three stat columns, sm+ all six.
export const GRID =
  "grid items-stretch grid-cols-[2.25rem_minmax(0,1fr)_2.75rem_2.75rem_2.75rem] " +
  "sm:grid-cols-[3rem_minmax(0,1fr)_repeat(6,3.75rem)] " +
  "md:grid-cols-[3.5rem_minmax(0,1fr)_repeat(6,5rem)]";

export const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#fb923c]";

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "goals", label: "Γκολ" },
  { value: "assists", label: "Ασίστ" },
  { value: "matches", label: "Αγώνες" },
  { value: "wins", label: "Νίκες" },
  { value: "mvp", label: "Βραβεία MVP" },
  { value: "best_gk", label: "Βραβεία τερματοφύλακα" },
  { value: "name", label: "Αλφαβητικά" },
];

/**
 * The three stat columns a phone shows: always the one being sorted by, then
 * goals, matches, assists until three are picked.
 */
export function phoneStats(sort: SortKey): Set<StatKey> {
  const picked = new Set<StatKey>();
  if (sort !== "name") picked.add(sort);
  for (const key of ["goals", "matches", "assists"] as const) {
    if (picked.size < 3) picked.add(key);
  }
  return picked;
}

// ───────────────────────────────────────────────────────────────────────
// Row
// ───────────────────────────────────────────────────────────────────────

const PlayerRow = memo(function PlayerRow({
  row,
  href,
  sort,
  onPhone,
}: {
  row: DirectoryRow;
  href: string;
  sort: SortKey;
  onPhone: Set<StatKey>;
}) {
  const { entry, stats, rank } = row;
  const { player, team, extraTeams } = entry;
  const fullName = `${player.last} ${player.first}`.trim() || "—";

  const hasPhoto = !isPlaceholderPhoto(player.photo);
  const logo = team && !isPlaceholderPhoto(team.logo) ? team.logo : null;

  return (
    <li className="border-b border-[#F3EFE6]/[0.08] [content-visibility:auto] [contain-intrinsic-size:auto_57px]">
      <Link
        href={href}
        prefetch={false}
        data-player-link
        className={`${GRID} text-[#F3EFE6] transition-colors hover:bg-[#F3EFE6]/[0.05] ${FOCUS_RING}`}
      >
        <div className="flex items-center justify-center text-sm tabular-nums text-[#F3EFE6]/55">
          {rank != null ? (
            <>
              <span className="sr-only">Θέση </span>
              {rank}
            </>
          ) : (
            <span aria-hidden>–</span>
          )}
        </div>

        <div className="flex min-w-0 items-center gap-3 py-2 pr-2">
          <div className="h-10 w-10 shrink-0 overflow-hidden border border-[#F3EFE6]/15 bg-[#13131d]">
            {hasPhoto ? (
              <PlayerImage
                src={player.photo}
                alt=""
                width={40}
                height={40}
                className="h-full w-full object-cover"
                animate={false}
              />
            ) : logo ? (
              <PlayerImage
                src={logo}
                alt=""
                width={40}
                height={40}
                className="h-full w-full object-contain p-0.5"
                animate={false}
              />
            ) : (
              <div
                aria-hidden
                className="flex h-full w-full items-center justify-center text-base font-bold text-[#F3EFE6]/45"
              >
                {(player.last || player.first || "?").charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="truncate text-base leading-tight">
              <span className="font-bold">{player.last}</span>
              {player.last && player.first ? " " : ""}
              <span className="text-[#F3EFE6]/85">{player.first}</span>
              {!player.last && !player.first ? fullName : null}
            </div>
            <div className="mt-0.5 truncate text-[13px] leading-tight text-[#F3EFE6]/60">
              {team ? team.name : "Χωρίς ομάδα"}
              {extraTeams > 0 ? ` +${extraTeams}` : ""}
              {player.position ? (
                <span className="hidden sm:inline"> · {player.position}</span>
              ) : null}
            </div>
          </div>
        </div>

        {STAT_KEYS.map((key) => {
          const value = statValue(stats, key);
          const lit = sort === key;
          return (
            <div
              key={key}
              className={`${onPhone.has(key) ? "flex" : "hidden sm:flex"} items-center justify-center text-base tabular-nums ${
                lit
                  ? value === 0
                    ? "bg-[#fb923c]/[0.09] text-[#fb923c]/45"
                    : "bg-[#fb923c]/[0.09] text-lg font-bold text-[#fb923c]"
                  : value === 0
                    ? "text-[#F3EFE6]/35"
                    : "text-[#F3EFE6]/90"
              }`}
            >
              <span className="sr-only">{STAT_LABELS[key].title}: </span>
              {value}
            </div>
          );
        })}
      </Link>
    </li>
  );
});

// ───────────────────────────────────────────────────────────────────────
// Controls
// ───────────────────────────────────────────────────────────────────────

export function SelectField({
  label,
  value,
  onChange,
  children,
  showLabel = false,
  marksFilter = true,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  showLabel?: boolean;
  /** Outline the field while it narrows the list (not for the sort field). */
  marksFilter?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={className}>
      <label
        htmlFor={id}
        className={showLabel ? "mb-1.5 block text-sm text-[#F3EFE6]/70" : "sr-only"}
      >
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`h-11 w-full appearance-none truncate border bg-[#13131d] pl-3 pr-9 text-[15px] text-[#F3EFE6] transition-colors ${
            value && marksFilter ? "border-[#fb923c]" : "border-[#F3EFE6]/20 hover:border-[#F3EFE6]/40"
          } ${FOCUS_RING}`}
        >
          {children}
        </select>
        <svg
          aria-hidden
          viewBox="0 0 12 8"
          className="pointer-events-none absolute right-3 top-1/2 h-2 w-3 -translate-y-1/2 text-[#F3EFE6]/60"
        >
          <path d="M1 1l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </div>
    </div>
  );
}

export function SortHeader({
  sortKey,
  label,
  title,
  query,
  onSort,
  className = "",
  align = "center",
}: {
  sortKey: SortKey;
  label: React.ReactNode;
  title: string;
  query: DirectoryQuery;
  onSort: (key: SortKey) => void;
  className?: string;
  align?: "center" | "left";
}) {
  const active = query.sort === sortKey;
  const direction = query.dir === "asc" ? "αύξουσα" : "φθίνουσα";
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      title={title}
      aria-label={
        active
          ? `${title}: ταξινόμηση ${direction}. Πατήστε για αντιστροφή.`
          : `Ταξινόμηση κατά: ${title}`
      }
      className={`${className} h-10 items-center gap-1 text-[13px] transition-colors ${
        align === "left" ? "justify-start" : "justify-center"
      } ${
        active
          ? "bg-[#fb923c]/[0.09] font-bold text-[#fb923c]"
          : "text-[#F3EFE6]/65 hover:text-[#F3EFE6]"
      } ${FOCUS_RING}`}
    >
      <span>{label}</span>
      {active && (
        <svg aria-hidden viewBox="0 0 8 10" className="h-2.5 w-2 shrink-0">
          <path
            d={query.dir === "asc" ? "M4 1v8M1 4l3-3 3 3" : "M4 9V1M1 6l3 3 3-3"}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
      )}
    </button>
  );
}

export function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      aria-label={`Αφαίρεση φίλτρου: ${label}`}
      className={`inline-flex max-w-full items-center gap-2 border border-[#fb923c]/60 bg-[#fb923c]/10 py-1 pl-2.5 pr-2 text-sm text-[#F3EFE6] transition-colors hover:bg-[#fb923c]/20 ${FOCUS_RING}`}
    >
      <span className="truncate">{label}</span>
      <svg aria-hidden viewBox="0 0 10 10" className="h-2.5 w-2.5 shrink-0 text-[#fb923c]">
        <path d="M1 1l8 8M9 1l-8 8" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </button>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Directory
// ───────────────────────────────────────────────────────────────────────

export default function DirectoryClient({
  data,
  basePath,
}: {
  data: DirectoryData;
  /** Route this directory is mounted on; player pages live under it. */
  basePath: string;
}) {
  const pathname = usePathname() ?? basePath;
  const directory = useMemo(() => prepareDirectory(data), [data]);

  // A stale or hand-typed id means "no filter", never an empty list.
  const sanitize = useCallback(
    (query: DirectoryQuery): DirectoryQuery => ({
      ...query,
      tournamentId:
        query.tournamentId != null &&
        directory.tournamentOptions.some((t) => t.id === query.tournamentId)
          ? query.tournamentId
          : null,
      teamId:
        query.teamId != null && directory.teamsById.has(query.teamId) ? query.teamId : null,
      position: directory.positionOptions.some((o) => o.value === query.position)
        ? query.position
        : "",
    }),
    [directory],
  );

  const [query, setQuery] = useState<DirectoryQuery>(DEFAULT_QUERY);
  const [ready, setReady] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const sheetButtonRef = useRef<HTMLButtonElement | null>(null);

  // Typing stays responsive: the input updates at once, the list just behind.
  const listQuery = useDeferredValue(query);
  const rows = useMemo(() => selectRows(directory, listQuery), [directory, listQuery]);
  const listKey = serializeQuery(listQuery);

  // How many rows are rendered, remembered per filter/sort combination — a
  // new combination starts again from the first PAGE without an effect.
  // `restore` is the position saved when a player was opened: until it has
  // been applied it decides the count for its own combination, so nothing
  // (the scroll observer included) can shrink the list under it.
  const [rendered, setRendered] = useState<{ key: string; count: number }>({ key: "", count: PAGE });
  const [restore, setRestore] = useState<SavedListView | null>(null);
  const wantedCount =
    rendered.key === listKey
      ? rendered.count
      : restore && restore.search === listKey
        ? restore.count
        : PAGE;
  const visibleCount = Math.min(rows.length, wantedCount);
  const hasMore = visibleCount < rows.length;

  // The page is static, so the URL is read after mount (no server round trip).
  useEffect(() => {
    const initial = sanitize(parseQuery(window.location.search));
    setQuery(initial);
    try {
      const raw = sessionStorage.getItem(PAIKTES_VIEW_KEY);
      if (raw) {
        sessionStorage.removeItem(PAIKTES_VIEW_KEY);
        const saved = JSON.parse(raw) as SavedListView;
        if (saved.search === serializeQuery(initial) && Date.now() - saved.at < VIEW_TTL_MS) {
          setRestore(saved);
        }
      }
    } catch {
      // Storage unavailable (private window): start from the top.
    }
    setReady(true);
    // Mount only: later changes flow from the controls, not from the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mirror the state into the URL. Debounced: browsers cap replaceState calls.
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      const search = serializeQuery(query);
      const url = search ? `${pathname}?${search}` : pathname;
      if (url !== window.location.pathname + window.location.search) {
        window.history.replaceState(null, "", url);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, ready, pathname]);

  // Back from a player page: this runs after the commit that put the saved
  // number of rows on screen, so the page is tall enough to scroll back to
  // where the visitor was.
  useEffect(() => {
    if (!restore || restore.search !== listKey) return;
    const { y, count } = restore;
    setRendered({ key: listKey, count });
    setRestore(null);
    // Not cancelled on cleanup: clearing `restore` above re-runs this effect
    // before the frame fires, and the scroll must still happen.
    requestAnimationFrame(() => window.scrollTo(0, y));
  }, [restore, listKey]);

  // Render the next PAGE shortly before the end of the list scrolls into view.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const showMore = useCallback(() => {
    setRendered({ key: listKey, count: visibleCount + PAGE });
  }, [listKey, visibleCount]);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) showMore();
      },
      { rootMargin: "800px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, showMore]);

  const patch = useCallback((changes: Partial<DirectoryQuery>) => {
    setQuery((prev) => ({ ...prev, ...changes }));
  }, []);

  const onSort = useCallback((key: SortKey) => {
    setQuery((prev) =>
      prev.sort === key
        ? { ...prev, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { ...prev, sort: key, dir: defaultDir(key) },
    );
  }, []);

  const clearAll = useCallback(() => {
    setQuery((prev) => ({ ...DEFAULT_QUERY, sort: prev.sort, dir: prev.dir }));
  }, []);

  // Remember the list position when a player is opened.
  const onListClick = useCallback(
    (e: React.MouseEvent<HTMLOListElement>) => {
      if (!(e.target as HTMLElement).closest("a[data-player-link]")) return;
      try {
        const view: SavedListView = {
          search: serializeQuery(query),
          count: visibleCount,
          y: window.scrollY,
          at: Date.now(),
        };
        sessionStorage.setItem(PAIKTES_VIEW_KEY, JSON.stringify(view));
      } catch {
        // Storage unavailable: the back button still works, just from the top.
      }
    },
    [query, visibleCount],
  );

  // Phone filter sheet: Escape closes, the page behind does not scroll.
  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSheetOpen(false);
    };
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    const opener = sheetButtonRef.current;
    return () => {
      document.documentElement.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
      opener?.focus();
    };
  }, [sheetOpen]);

  const onPhone = useMemo(() => phoneStats(listQuery.sort), [listQuery.sort]);
  const headerOnPhone = useMemo(() => phoneStats(query.sort), [query.sort]);
  const filterCount = activeFilterCount(query);
  const hasSearch = query.q.trim() !== "";
  const total = data.players.length;
  const filtered = filterCount > 0 || hasSearch;

  const tournamentName =
    query.tournamentId != null
      ? directory.tournamentOptions.find((t) => t.id === query.tournamentId)?.name ?? null
      : null;
  const teamName = query.teamId != null ? directory.teamsById.get(query.teamId)?.name ?? null : null;
  const positionLabel = query.position
    ? directory.positionOptions.find((o) => o.value === query.position)?.label ?? null
    : null;
  const showPositionFilter = directory.positionOptions.length >= 2;

  const tournamentSelect = (showLabel: boolean, className = "") => (
    <SelectField
      label="Διοργάνωση"
      showLabel={showLabel}
      className={className}
      value={query.tournamentId != null ? String(query.tournamentId) : ""}
      onChange={(v) => patch({ tournamentId: v ? Number(v) : null })}
    >
      <option value="">Όλες οι διοργανώσεις</option>
      {directory.tournamentOptions.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </SelectField>
  );
  const teamSelect = (showLabel: boolean, className = "") => (
    <SelectField
      label="Ομάδα"
      showLabel={showLabel}
      className={className}
      value={query.teamId != null ? String(query.teamId) : ""}
      onChange={(v) => patch({ teamId: v ? Number(v) : null })}
    >
      <option value="">Όλες οι ομάδες</option>
      {directory.teamOptions.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </SelectField>
  );
  const positionSelect = (showLabel: boolean, className = "") =>
    showPositionFilter ? (
      <SelectField
        label="Θέση"
        showLabel={showLabel}
        className={className}
        value={query.position}
        onChange={(v) => patch({ position: v })}
      >
        <option value="">Όλες οι θέσεις</option>
        {directory.positionOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </SelectField>
    ) : null;

  return (
    <div className="min-h-screen bg-[#0a0a14] text-[#F3EFE6]">
      <div className="mx-auto max-w-6xl">
        {/* ── Title ─────────────────────────────────────────────────── */}
        <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1 px-4 pb-2 pt-5 md:px-6 md:pt-8">
          <h1 className="text-4xl font-bold italic leading-none tracking-tight md:text-5xl">
            Παίκτες
          </h1>
          <p className="text-[15px] text-[#F3EFE6]/70">
            {data.seasonLabel ? <>Σεζόν {data.seasonLabel} · </> : null}
            <Link
              href="/seasons"
              className={`underline decoration-[#F3EFE6]/30 underline-offset-4 hover:text-[#fb923c] hover:decoration-[#fb923c] ${FOCUS_RING}`}
            >
              Προηγούμενες σεζόν
            </Link>
          </p>
        </header>

        {/* ── What is listed: count, scope, removable filters ───────── */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 pb-3 md:px-6">
          <p aria-live="polite" className="text-[15px] text-[#F3EFE6]/75">
            <span className="font-bold text-[#F3EFE6]">
              {filtered ? `${rows.length} από ${playersLabel(total)}` : playersLabel(total)}
            </span>
            {" · "}
            {tournamentName ? "στατιστικά διοργάνωσης" : "στατιστικά σεζόν"}
          </p>
          {tournamentName && (
            <Chip label={tournamentName} onRemove={() => patch({ tournamentId: null })} />
          )}
          {teamName && <Chip label={teamName} onRemove={() => patch({ teamId: null })} />}
          {positionLabel && <Chip label={positionLabel} onRemove={() => patch({ position: "" })} />}
          {filterCount + (hasSearch ? 1 : 0) > 1 && (
            <button
              type="button"
              onClick={clearAll}
              className={`text-sm text-[#F3EFE6]/70 underline decoration-[#F3EFE6]/30 underline-offset-4 hover:text-[#fb923c] ${FOCUS_RING}`}
            >
              Καθαρισμός όλων
            </button>
          )}
        </div>

        {/* ── Sticky: search, filters, column header ────────────────── */}
        <div className="sticky top-14 z-20 border-y border-[#F3EFE6]/15 bg-[#0a0a14] md:top-28">
          <div className="flex gap-2 px-4 py-2.5 md:px-6">
            <div className="relative min-w-0 flex-1">
              <svg
                aria-hidden
                viewBox="0 0 16 16"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#F3EFE6]/50"
              >
                <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <path d="M11 11l4 4" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              <input
                type="search"
                value={query.q}
                onChange={(e) => patch({ q: e.target.value })}
                placeholder="Αναζήτηση παίκτη ή ομάδας"
                aria-label="Αναζήτηση παίκτη ή ομάδας"
                autoComplete="off"
                enterKeyHint="search"
                className={`h-11 w-full border border-[#F3EFE6]/20 bg-[#13131d] pl-9 pr-10 text-base text-[#F3EFE6] placeholder:text-[#F3EFE6]/45 hover:border-[#F3EFE6]/40 [&::-webkit-search-cancel-button]:hidden ${FOCUS_RING}`}
              />
              {hasSearch && (
                <button
                  type="button"
                  onClick={() => patch({ q: "" })}
                  aria-label="Καθαρισμός αναζήτησης"
                  className={`absolute right-0 top-0 flex h-11 w-10 items-center justify-center text-[#F3EFE6]/60 hover:text-[#F3EFE6] ${FOCUS_RING}`}
                >
                  <svg aria-hidden viewBox="0 0 10 10" className="h-3 w-3">
                    <path d="M1 1l8 8M9 1l-8 8" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                </button>
              )}
            </div>

            {/* md+: filters inline */}
            {tournamentSelect(false, "hidden w-56 md:block lg:w-64")}
            {teamSelect(false, "hidden w-48 md:block lg:w-56")}
            {positionSelect(false, "hidden w-40 lg:block")}

            {/* phones: filters and sorting in a sheet */}
            <button
              ref={sheetButtonRef}
              type="button"
              onClick={() => setSheetOpen(true)}
              aria-haspopup="dialog"
              className={`inline-flex h-11 shrink-0 items-center gap-2 border px-3 text-[15px] md:hidden ${
                filterCount > 0
                  ? "border-[#fb923c] text-[#fb923c]"
                  : "border-[#F3EFE6]/20 bg-[#13131d] text-[#F3EFE6]"
              } ${FOCUS_RING}`}
            >
              Φίλτρα
              {filterCount > 0 && (
                <span className="min-w-5 bg-[#fb923c] px-1 text-center text-sm font-bold tabular-nums text-[#0a0a14]">
                  {filterCount}
                </span>
              )}
            </button>
          </div>

          <div className={`${GRID} border-t border-[#F3EFE6]/10`}>
            <div className="flex h-10 items-center justify-center text-[13px] text-[#F3EFE6]/65">
              <abbr title="Θέση στην κατάταξη" className="no-underline">
                #
              </abbr>
            </div>
            <SortHeader
              sortKey="name"
              label="Παίκτης"
              title="Επώνυμο"
              query={query}
              onSort={onSort}
              align="left"
              className="flex px-2"
            />
            {STAT_KEYS.map((key) => (
              <SortHeader
                key={key}
                sortKey={key}
                label={
                  <>
                    <span className="md:hidden">{STAT_LABELS[key].short}</span>
                    <span className="hidden md:inline">{STAT_LABELS[key].full}</span>
                  </>
                }
                title={STAT_LABELS[key].title}
                query={query}
                onSort={onSort}
                className={headerOnPhone.has(key) ? "flex" : "hidden sm:flex"}
              />
            ))}
          </div>
        </div>

        {/* ── List ──────────────────────────────────────────────────── */}
        {rows.length === 0 ? (
          <div className="px-4 py-16 text-center md:px-6">
            <p className="text-2xl font-bold italic">Δεν βρέθηκαν παίκτες</p>
            <p className="mx-auto mt-2 max-w-md text-[15px] text-[#F3EFE6]/70">
              {hasSearch
                ? `Κανένας παίκτης δεν ταιριάζει με «${query.q.trim()}»${
                    filterCount > 0 ? " στα επιλεγμένα φίλτρα" : ""
                  }. Δοκιμάστε μόνο το επώνυμο ή το όνομα της ομάδας.`
                : "Κανένας παίκτης δεν ταιριάζει με τα επιλεγμένα φίλτρα."}
            </p>
            <button
              type="button"
              onClick={clearAll}
              className={`mt-5 h-11 border border-[#fb923c] px-5 text-[15px] font-bold text-[#fb923c] hover:bg-[#fb923c] hover:text-[#0a0a14] ${FOCUS_RING}`}
            >
              Καθαρισμός φίλτρων
            </button>
          </div>
        ) : (
          <>
            <ol onClick={onListClick}>
              {rows.slice(0, visibleCount).map((row) => (
                <PlayerRow
                  key={row.entry.player.id}
                  row={row}
                  href={`${basePath}/${row.entry.player.id}`}
                  sort={listQuery.sort}
                  onPhone={onPhone}
                />
              ))}
            </ol>
            {hasMore && (
              <div ref={sentinelRef} className="flex justify-center px-4 py-6">
                <button
                  type="button"
                  onClick={showMore}
                  className={`h-11 border border-[#F3EFE6]/25 px-5 text-[15px] text-[#F3EFE6] hover:border-[#fb923c] hover:text-[#fb923c] ${FOCUS_RING}`}
                >
                  Εμφάνιση περισσότερων ({rows.length - visibleCount})
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Phone sheet (outside the sticky bar: no clipping context) ── */}
      {sheetOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-end md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Φίλτρα και ταξινόμηση"
        >
          <button
            type="button"
            aria-label="Κλείσιμο"
            className="absolute inset-0 bg-black/70"
            onClick={() => setSheetOpen(false)}
          />
          <div className="relative max-h-[85vh] w-full space-y-4 overflow-y-auto border-t-2 border-[#fb923c] bg-[#0a0a14] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Φίλτρα και ταξινόμηση</h2>
              {filterCount > 0 && (
                <button
                  type="button"
                  onClick={() => patch({ tournamentId: null, teamId: null, position: "" })}
                  className={`text-sm text-[#F3EFE6]/70 underline decoration-[#F3EFE6]/30 underline-offset-4 ${FOCUS_RING}`}
                >
                  Καθαρισμός
                </button>
              )}
            </div>
            {tournamentSelect(true)}
            {teamSelect(true)}
            {positionSelect(true)}
            <SelectField
              label="Ταξινόμηση"
              showLabel
              marksFilter={false}
              value={query.sort}
              onChange={(v) => {
                const sort = v as SortKey;
                patch({ sort, dir: defaultDir(sort) });
              }}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </SelectField>
            <button
              type="button"
              autoFocus
              onClick={() => setSheetOpen(false)}
              className={`h-12 w-full bg-[#fb923c] text-base font-bold text-[#0a0a14] ${FOCUS_RING}`}
            >
              {rows.length === 0 ? "Κανένας παίκτης" : `Εμφάνιση: ${playersLabel(rows.length)}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
