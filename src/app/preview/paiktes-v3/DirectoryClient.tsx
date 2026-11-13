// Players directory v3. Same search / filters / sorting as v2 (all in the
// browser), with two differences:
//   · each row carries the player's card (the profile card's shield, flat) and
//     a large gold name;
//   · clicking a row opens the profile ON TOP of the list — the row's card
//     spins and grows into place (see ProfileOverlay) — instead of leaving it.
// The open profile is part of the URL (?player=ID), so it can be shared and
// the browser's back button closes it.
"use client";

import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  type DirectoryQuery,
  type DirectoryRow,
  type DirectoryTeam,
  type SortKey,
  type StatKey,
} from "../paiktes-v2/model";
import {
  Chip,
  FOCUS_RING,
  GRID,
  SORT_OPTIONS,
  SelectField,
  SortHeader,
  phoneStats,
} from "../paiktes-v2/DirectoryClient";
import MiniCard from "./MiniCard";
import ProfileOverlay from "./ProfileOverlay";
import { seasonStanding } from "./standing";
import type { TableLine } from "./SeasonStats";
import { NameStylePicker, nameStyle, useNameStyle, type NameStyleId } from "./nameStyles";
import type { DirectoryV3 } from "./data";

/** Rows rendered at first, and added each time the end of the list nears. */
const PAGE = 100;

// ───────────────────────────────────────────────────────────────────────
// Row
// ───────────────────────────────────────────────────────────────────────

const PlayerRow = memo(function PlayerRow({
  row,
  href,
  sort,
  onPhone,
  away,
  lettering,
  onOpen,
}: {
  row: DirectoryRow;
  href: string;
  sort: SortKey;
  onPhone: Set<StatKey>;
  /** The row's card is out flying (its profile is open): leave its place empty. */
  away: boolean;
  /** Which lettering the name is set in. */
  lettering: NameStyleId;
  onOpen: (id: number, e: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
  const { entry, stats, rank } = row;
  const { player, team, extraTeams } = entry;
  const letters = nameStyle(lettering);

  return (
    <li className="border-b border-[#F3EFE6]/[0.08] [content-visibility:auto] [contain-intrinsic-size:auto_93px]">
      <a
        href={href}
        data-player-id={player.id}
        onClick={(e) => onOpen(player.id, e)}
        className={`${GRID} group text-[#F3EFE6] transition-colors hover:bg-[#F3EFE6]/[0.05] ${FOCUS_RING}`}
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

        <div className="flex min-w-0 items-center gap-3 py-2 pr-2 md:gap-4">
          <div
            data-card-id={player.id}
            className="w-[3.25rem] shrink-0 transition-transform duration-200 group-hover:scale-105 md:w-14"
            style={away ? { visibility: "hidden" } : undefined}
          >
            <MiniCard
              photo={player.photo}
              logo={team?.logo ?? null}
              initial={(player.last || player.first || "?").charAt(0).toUpperCase()}
            />
          </div>
          <div className="min-w-0">
            {player.first && player.last ? (
              <div className="truncate text-[0.8rem] uppercase leading-none tracking-[0.08em] text-[#F3EFE6]/70">
                {player.first}
              </div>
            ) : null}
            <div
              className={`mt-1 truncate pr-2 uppercase leading-[1.08] ${letters.row}`}
              style={letters.style}
            >
              {player.last || player.first || "—"}
            </div>
            <div className="mt-1 truncate text-[13px] leading-tight text-[#F3EFE6]/60">
              {team ? team.name : "Χωρίς ομάδα"}
              {extraTeams > 0 ? ` +${extraTeams}` : ""}
              {player.position ? <span className="hidden sm:inline"> · {player.position}</span> : null}
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
                    : "bg-[#fb923c]/[0.09] text-xl font-bold text-[#fb923c]"
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
      </a>
    </li>
  );
});

// ───────────────────────────────────────────────────────────────────────
// Directory
// ───────────────────────────────────────────────────────────────────────

type Opened = { id: number; origin: DOMRect | null };

export default function DirectoryClient({
  data,
  basePath,
}: {
  data: DirectoryV3;
  /** Route this directory is mounted on. */
  basePath: string;
}) {
  const pathname = usePathname() ?? basePath;
  const directory = useMemo(() => prepareDirectory(data), [data]);
  const entryById = useMemo(
    () => new Map(directory.players.map((e) => [e.player.id, e] as const)),
    [directory],
  );

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
  const [lettering, setLettering] = useNameStyle();
  const sheetButtonRef = useRef<HTMLButtonElement | null>(null);

  // The open profile, and whether it is on its way out.
  const [opened, setOpened] = useState<Opened | null>(null);
  const [closing, setClosing] = useState(false);
  /** True when the open profile sits on a history entry of its own. */
  const ownEntryRef = useRef(false);
  const queryRef = useRef(query);
  queryRef.current = query;
  const openedRef = useRef(opened);
  openedRef.current = opened;

  // Typing stays responsive: the input updates at once, the list just behind.
  const listQuery = useDeferredValue(query);
  const rows = useMemo(() => selectRows(directory, listQuery), [directory, listQuery]);
  const listKey = serializeQuery(listQuery);

  // How many rows are rendered, remembered per filter/sort combination — a
  // new combination starts again from the first PAGE without an effect.
  const [rendered, setRendered] = useState<{ key: string; count: number }>({ key: "", count: PAGE });
  const visibleCount = Math.min(rows.length, rendered.key === listKey ? rendered.count : PAGE);
  const hasMore = visibleCount < rows.length;

  /** The player named by ?player=, if that player is in this directory. */
  const playerInUrl = useCallback((): number | null => {
    const id = Number(new URLSearchParams(window.location.search).get("player"));
    return Number.isInteger(id) && entryById.has(id) ? id : null;
  }, [entryById]);

  const urlFor = useCallback(
    (q: DirectoryQuery, playerId: number | null) => {
      const params = new URLSearchParams(serializeQuery(q));
      if (playerId != null) params.set("player", String(playerId));
      const search = params.toString();
      return search ? `${pathname}?${search}` : pathname;
    },
    [pathname],
  );

  // The page is static, so the URL is read after mount (no server round trip).
  useEffect(() => {
    setQuery(sanitize(parseQuery(window.location.search)));
    const id = playerInUrl();
    if (id != null) setOpened({ id, origin: null });
    setReady(true);
    // Mount only: later changes flow from the controls, not from the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mirror the state into the URL. Debounced: browsers cap replaceState calls.
  const shownId = opened && !closing ? opened.id : null;
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      const url = urlFor(query, shownId);
      if (url !== window.location.pathname + window.location.search) {
        window.history.replaceState(null, "", url);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, ready, urlFor, shownId]);

  // ── Profile overlay ───────────────────────────────────────────────────
  const openPlayer = useCallback(
    (id: number, e: React.MouseEvent<HTMLAnchorElement>) => {
      // Let the browser handle "open in new tab" and friends.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      const card = e.currentTarget.querySelector<HTMLElement>("[data-card-id]");
      setClosing(false);
      setOpened({ id, origin: card?.getBoundingClientRect() ?? null });
      window.history.pushState(null, "", urlFor(queryRef.current, id));
      ownEntryRef.current = true;
    },
    [urlFor],
  );

  const requestClose = useCallback(() => {
    if (!openedRef.current) return;
    if (ownEntryRef.current) {
      // Go back to the list's own entry; `popstate` below starts the way out.
      ownEntryRef.current = false;
      window.history.back();
    } else {
      window.history.replaceState(null, "", urlFor(queryRef.current, null));
      setClosing(true);
    }
  }, [urlFor]);

  // Back / forward buttons open and close the profile.
  useEffect(() => {
    const onPopState = () => {
      const id = playerInUrl();
      if (id != null) {
        ownEntryRef.current = true;
        setClosing(false);
        setOpened((current) => (current && current.id === id ? current : { id, origin: null }));
      } else if (openedRef.current) {
        ownEntryRef.current = false;
        setClosing(true);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [playerInUrl]);

  const onExited = useCallback(() => {
    const id = openedRef.current?.id;
    setOpened(null);
    setClosing(false);
    if (id != null) {
      document.querySelector<HTMLElement>(`a[data-player-id="${id}"]`)?.focus({ preventScroll: true });
    }
  }, []);

  const openedEntry = opened ? entryById.get(opened.id) ?? null : null;
  const openedTeams = useMemo<DirectoryTeam[]>(
    () =>
      openedEntry
        ? openedEntry.player.teamIds
            .map((id) => directory.teamsById.get(id))
            .filter((t): t is DirectoryTeam => t !== undefined)
        : [],
    [openedEntry, directory],
  );
  // Where the opened player stands among everyone this season.
  const openedStanding = useMemo(
    () => (openedEntry ? seasonStanding(data.players, openedEntry.player.id) : null),
    [openedEntry, data.players],
  );
  // The opened player's season split by team, with each team's name and logo.
  // A team archived during the season is not in the directory: it is named
  // from `extraTeams` and gets no link.
  const extraTeamsById = useMemo(() => new Map(data.extraTeams.map((t) => [t.id, t] as const)), [data.extraTeams]);
  const openedTeamLines = useMemo<TableLine[]>(() => {
    if (!openedEntry) return [];
    return (data.extras[openedEntry.player.id]?.teams ?? []).map((line) => {
      const listed = directory.teamsById.get(line.teamId);
      const team = listed ?? extraTeamsById.get(line.teamId);
      return {
        key: `team-${line.teamId}`,
        label: team?.name || "Ομάδα",
        href: listed ? `/OMADA/${line.teamId}` : null,
        logo: team?.logo ?? null,
        stats: line.stats,
      };
    });
  }, [openedEntry, data.extras, directory, extraTeamsById]);

  // ── List plumbing (as v2) ─────────────────────────────────────────────
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
          <h1 className="text-4xl font-bold italic leading-none tracking-tight md:text-5xl">Παίκτες</h1>
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
          {tournamentName && <Chip label={tournamentName} onRemove={() => patch({ tournamentId: null })} />}
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

        <NameStylePicker value={lettering} onChange={setLettering} />

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
            <ol>
              {rows.slice(0, visibleCount).map((row) => (
                <PlayerRow
                  key={row.entry.player.id}
                  row={row}
                  href={`${basePath}?player=${row.entry.player.id}`}
                  sort={listQuery.sort}
                  onPhone={onPhone}
                  away={opened?.id === row.entry.player.id}
                  lettering={lettering}
                  onOpen={openPlayer}
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

      {/* ── Profile, on top of the list ─────────────────────────────── */}
      {opened && openedEntry && (
        <ProfileOverlay
          key={opened.id}
          entry={openedEntry}
          teams={openedTeams}
          extra={data.extras[opened.id] ?? null}
          tournaments={data.tournaments}
          seasonLabel={data.seasonLabel}
          standing={openedStanding}
          teamLines={openedTeamLines}
          lettering={lettering}
          origin={opened.origin}
          closing={closing}
          onRequestClose={requestClose}
          onExited={onExited}
        />
      )}
    </div>
  );
}
