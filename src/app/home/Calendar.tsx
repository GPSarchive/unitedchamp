  /* =========================
    Client Calendar component
    ========================= */
    'use client';

    import elLocale from '@fullcalendar/core/locales/el';
    import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
    import FullCalendar from '@fullcalendar/react';
    import type { CalendarApi, EventInput, EventContentArg } from '@fullcalendar/core';
    import timeGridPlugin from '@fullcalendar/timegrid';
    import interactionPlugin from '@fullcalendar/interaction';
    import { supabase } from '@/app/lib/supabase/supabaseClient';
    import { ChevronLeft, ChevronRight, RotateCw, CalendarDays as LCDays } from 'lucide-react';
    import EventPillShrimp, { ClusterItem as ShrimpItem } from './EventPillShrimp';
    import '@/styles/fullcalendar-overrides.css';
    import { motion, AnimatePresence } from 'framer-motion';
    
    // ===================== Types =====================
    type Props = {
      height?: number | 'auto';
      className?: string;
      initialEvents?: Array<{
        id: string | number;
        title: string;
        start: string; // 'YYYY-MM-DDTHH:mm:ss' OR ISO with offset
        end: string;   // 'YYYY-MM-DDTHH:mm:ss' OR ISO with offset
        all_day?: boolean;
        teams?: [string, string];
        logos?: [string, string];
        status?: string;
        home_score?: number;
        away_score?: number;
        score?: [number, number];
        minute?: number | string;
        team_a_score?: number;
        team_b_score?: number;
      }>;
      fetchFromDb?: boolean;
    };
    
    type TeamLiteLocal = { name?: string; logo?: string | null };
    
    // ===================== Time helpers (naive, keep DB clock) =====================
    const ISO_RE_CLIENT =
      /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/;
    
    const pad2c = (n: number) => String(n).padStart(2, '0');
    
    function parseIsoPreserveClockClient(iso: string) {
      const m = ISO_RE_CLIENT.exec(iso);
      if (!m) throw new Error(`Unrecognized datetime: ${iso}`);
      const [, y, M, d, h, min, s] = m;
      return { y: +y, M: +M, d: +d, h: +h, min: +min, s: +s };
    }
    
    function toNaiveIsoClient(isoOrNaive: string) {
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(isoOrNaive)) return isoOrNaive;
      const { y, M, d, h, min, s } = parseIsoPreserveClockClient(isoOrNaive);
      return `${y}-${pad2c(M)}-${pad2c(d)}T${pad2c(h)}:${pad2c(min)}:${pad2c(s)}`;
    }
    
    function daysInMonthClient(y: number, M: number) {
      return new Date(y, M, 0).getDate();
    }
    
    function addMinutesNaiveClient(
      parts: { y: number; M: number; d: number; h: number; min: number; s: number },
      deltaMin: number
    ) {
      const start = parts.h * 60 + parts.min;
      const total = start + deltaMin;
    
      let dayDelta = Math.floor(total / 1440);
      let minutesInDay = total % 1440;
    
      if (minutesInDay < 0) {
        minutesInDay += 1440;
        dayDelta -= 1;
      }
    
      const h = Math.floor(minutesInDay / 60);
      const min = minutesInDay % 60;
    
      let { y, M, d } = parts;
      d += dayDelta;
    
      while (true) {
        const dim = daysInMonthClient(y, M);
        if (d <= dim) break;
        d -= dim;
        M += 1;
        if (M > 12) {
          M = 1;
          y += 1;
        }
      }
    
      return { y, M, d, h, min, s: parts.s };
    }
    
    function endIsoPlusMinutes(isoOrNaive: string, minutes: number) {
      const startParts = parseIsoPreserveClockClient(isoOrNaive);
      const endParts = addMinutesNaiveClient(startParts, minutes);
      return `${endParts.y}-${pad2c(endParts.M)}-${pad2c(endParts.d)}T${pad2c(endParts.h)}:${pad2c(
        endParts.min
      )}:${pad2c(endParts.s)}`;
    }
    
    // ===================== Normalizers =====================
    // Normalize various backend status strings into the literal union EventPillShrimp expects
    const normStatus = (s: unknown): ShrimpItem['status'] => {
      if (typeof s !== 'string') return undefined;
      const v = s.trim().toLowerCase();
      if (!v) return undefined;
      if (v === 'scheduled' || v === 'not_started' || v === 'upcoming') return 'scheduled';
      if (v === 'live' || v === 'inprogress' || v === 'in_progress' || v === 'ongoing') return 'live';
      if (v === 'finished' || v === 'final' || v === 'completed' || v === 'ended') return 'finished';
      return undefined;
    };
    
    const normNum = (n: unknown): number | undefined =>
      typeof n === 'number' && Number.isFinite(n) ? n : undefined;
    
    function computeScoreTuple(
      home?: number,
      away?: number
    ): [number, number] | undefined {
      return typeof home === 'number' && typeof away === 'number'
        ? [home, away]
        : undefined;
    }
    
    // Map initialEvents coming from server into FullCalendar events
    function mapIncomingEvents(list: Props['initialEvents'] = []): EventInput[] {
    return list.map((e) => {
      const home =
        e.home_score ?? e.team_a_score ?? (Array.isArray(e.score) ? e.score[0] : undefined);
      const away =
        e.away_score ?? e.team_b_score ?? (Array.isArray(e.score) ? e.score[1] : undefined);
      const score = computeScoreTuple(home, away);

      return {
        id: String(e.id),
        title: e.title,
        start: toNaiveIsoClient(e.start),
        end: toNaiveIsoClient(e.end),
        allDay: Boolean(e.all_day),
        extendedProps: {
          teams: e.teams,
          logos: e.logos,
          status: normStatus(e.status),
          home_score: typeof home === 'number' ? home : undefined,
          away_score: typeof away === 'number' ? away : undefined,
          score: score ?? undefined,
          minute: e.minute ?? undefined,
        },
      };
    });
  }
    
    // ===================== Collapse overlaps into single composite events =====================
    type DayBucketItem = {
      id: string; title: string; start: string; end: string;
      startMin: number; endMin: number;
      teams?: [string, string]; logos?: [string, string];
      status?: ShrimpItem['status'];
      home_score?: number;
      away_score?: number;
      score?: [number, number];
      minute?: number | string;
    };
    
    function minutesFromNaive(naiveIso: string) {
      const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):/.exec(naiveIso);
      if (!m) return 0;
      const hh = +m[4], mm = +m[5];
      return hh * 60 + mm;
    }
    function dayKey(naiveIso: string) {
      return naiveIso.slice(0, 10);
    }
    
    function collapseOverlapsToCompositeEvents(raw: EventInput[]): EventInput[] {
      const base = raw.map((e) => ({
        ...e,
        id: String(e.id),
        title: e.title ?? '',
        start: toNaiveIsoClient(String(e.start)),
        end: toNaiveIsoClient(String(e.end)),
        allDay: false,
        extendedProps: { ...(e.extendedProps || {}) },
      }));
    
      const byDay = new Map<string, Array<DayBucketItem>>();
    
      for (const e of base) {
        const key = dayKey(e.start as string);
        const ext = (e.extendedProps as any) || {};
    
        const teams = ext.teams as [string, string] | undefined;
        const logos = ext.logos as [string, string] | undefined;
    
        const home = normNum(ext.home_score);
        const away = normNum(ext.away_score);
        const score = Array.isArray(ext.score)
          ? (ext.score as [number, number])
          : computeScoreTuple(home, away);
    
        const arr = byDay.get(key) ?? [];
        arr.push({
          id: e.id!, title: e.title!,
          start: e.start as string, end: e.end as string,
          startMin: minutesFromNaive(e.start as string),
          endMin: minutesFromNaive(e.end as string),
          teams, logos,
          status: normStatus(ext.status),
          home_score: home,
          away_score: away,
          score: score,
          minute: ext.minute as number | string | undefined,
        });
        byDay.set(key, arr);
      }
    
      const out: EventInput[] = [];
      for (const [key, arr] of byDay) {
        arr.sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
    
        let cluster: typeof arr = [];
        let clusterEnd = -1;
        let clusterIdx = 0;
    
        const flush = () => {
          if (!cluster.length) return;
    
          let clusterStartIso = cluster[0].start;
          let clusterEndIso = cluster[0].end;
          let maxEnd = cluster[0].endMin;
          for (const c of cluster) {
            if (c.endMin > maxEnd) { maxEnd = c.endMin; clusterEndIso = c.end; }
          }
    
          // Build items typed exactly as EventPillShrimp expects
          const items: ShrimpItem[] = cluster.map((c) => ({
            id: c.id,
            title: c.title,
            start: c.start,
            end: c.end,
            teams: c.teams,
            logos: c.logos,
            status: c.status, // string | undefined
            home_score: c.home_score, // number | undefined
            away_score: c.away_score, // number | undefined
            score: c.score,           // [number, number] | undefined
    
          }));
    
          out.push({
            id: `cluster:${key}:${clusterIdx++}`,
            title: items.length > 1 ? `${items.length} events` : items[0].title,
            start: clusterStartIso,
            end: clusterEndIso,
            allDay: false,
            extendedProps: { items },
          });
    
          cluster = [];
          clusterEnd = -1;
        };
    
        for (const e of arr) {
          if (!cluster.length || e.startMin < clusterEnd) {
            cluster.push(e);
            clusterEnd = Math.max(clusterEnd, e.endMin);
          } else {
            flush();
            cluster.push(e);
            clusterEnd = e.endMin;
          }
        }
        flush();
      }
    
      return out;
    }
    
    export default function EventCalendar({
      height = 'auto',
      className,
      initialEvents = [],
      fetchFromDb = false,
                             
    }: Props) {
      const startOfCurrentWeek = useMemo(() => {
        const now = new Date();
        const day = now.getDay();
        const diffToMonday = (day + 6) % 7;
        const monday = new Date(now);
        monday.setDate(now.getDate() - diffToMonday);
        monday.setHours(0, 0, 0, 0);
        return monday;
      }, []);
    
      const [events, setEvents] = useState<EventInput[]>(() =>
        collapseOverlapsToCompositeEvents(mapIncomingEvents(initialEvents))
      );
      const [loading, setLoading] = useState(fetchFromDb);
      const [error, setError] = useState<string | null>(null);
      const [title, setTitle] = useState<string>('');
      const [canGoPrev, setCanGoPrev] = useState<boolean>(false);
    
      // ===== Mobile brightness variables =====
      const [mobileVars, setMobileVars] = useState({
        headerAlpha: 1,      // 0..1
        headerBrightness: 1, // 0.8..1.2
        topbarBg: 0.04,      // 0..0.3
        topbarBlurPx: 0      // px
      });
      type Preset = 'dim' | 'normal' | 'bright';
      const applyMobilePreset = (p: Preset) => {
        if (p === 'dim') {
          setMobileVars({ headerAlpha: 1, headerBrightness: 0.9, topbarBg: 0.08, topbarBlurPx: 0 });
        } else if (p === 'bright') {
          setMobileVars({ headerAlpha: 1, headerBrightness: 1.1, topbarBg: 0.0, topbarBlurPx: 0 });
        } else {
          setMobileVars({ headerAlpha: 1, headerBrightness: 1.0, topbarBg: 0.04, topbarBlurPx: 0 });
        }
      };
    
      const calendarRef = useRef<FullCalendar>(null);
      const scopeRef = useRef<HTMLDivElement>(null);
      const [headerH, setHeaderH] = useState(0);
    
      useEffect(() => {
        setEvents(collapseOverlapsToCompositeEvents(mapIncomingEvents(initialEvents)));
      }, [initialEvents]);
    
      // Measure FullCalendar day-header height and keep overlays below it
      useEffect(() => {
        const measure = () => {
          const header = scopeRef.current?.querySelector('.fc .fc-col-header') as HTMLElement | null;
          setHeaderH(header?.offsetHeight ?? 0);
        };
        measure();
    
        const ro = new ResizeObserver(measure);
        if (scopeRef.current) ro.observe(scopeRef.current);
        window.addEventListener('resize', measure);
        return () => {
          ro.disconnect();
          window.removeEventListener('resize', measure);
        };
      }, []);
    
      const fetchFromMatches = useCallback(async () => {
        if (!fetchFromDb) return;
        setLoading(true);
        setError(null);
    
        const { data, error } = await supabase
          .from('matches')
          .select(
            `id, match_date, status, team_a_score, team_b_score,
              teamA:teams!matches_team_a_id_fkey (name, logo),
              teamB:teams!matches_team_b_id_fkey (name, logo)`
          )
          .order('match_date', { ascending: true });
    
        if (error) {
          setError(error.message);
          setEvents([]);
          setLoading(false);
          return;
        }
        // status normalized using top-level normStatus
        
        const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);
    
        const built: EventInput[] = (data ?? []).map((m: any) => {
          const a = one(m.teamA) as TeamLiteLocal | null;
          const b = one(m.teamB) as TeamLiteLocal | null;
    
          const start = toNaiveIsoClient(m.match_date);
          const end = endIsoPlusMinutes(m.match_date, 50);
    
          const home = normNum(m.team_a_score);
          const away = normNum(m.team_b_score);
    
          return {
            id: String(m.id),
            title: `${a?.name ?? 'Unknown'} vs ${b?.name ?? 'Unknown'}`,
            start,
            end,
            allDay: false,
            extendedProps: {
              teams: [a?.name ?? 'Unknown', b?.name ?? 'Unknown'] as [string, string],
              logos: [a?.logo ?? '/placeholder.png', b?.logo ?? '/placeholder.png'] as [string, string],
              status: normStatus(m.status),
              home_score: home,
              away_score: away,
              score: computeScoreTuple(home, away),
              minute: undefined, // no live minute in schema
            },
          };
        });
    
        setEvents(collapseOverlapsToCompositeEvents(built));
        setLoading(false);
      }, [fetchFromDb]);
    
      useEffect(() => {
        if (fetchFromDb) fetchFromMatches();
      }, [fetchFromDb, fetchFromMatches]);
    
      const getApi = () => calendarRef.current?.getApi() as CalendarApi | undefined;
      const goPrev = () => getApi()?.prev();
      const goToday = () => getApi()?.today();
      const goNext = () => getApi()?.next();
    
      const renderEventContent = (eventInfo: EventContentArg) => {
        const items = (eventInfo.event.extendedProps as any)?.items as Array<ShrimpItem> | undefined;
    
        if (items && items.length) {
          return <EventPillShrimp items={items} />;
        }
    
        const ext = eventInfo.event.extendedProps as any;
        const home = normNum(ext?.home_score);
        const away = normNum(ext?.away_score);
        const score = Array.isArray(ext?.score)
          ? (ext.score as [number, number])
          : computeScoreTuple(home, away);
    
        const item: ShrimpItem = {
          id: String(eventInfo.event.id),
          title: eventInfo.event.title,
          start: String(eventInfo.event.startStr),
          end: String(eventInfo.event.endStr ?? eventInfo.event.startStr),
          teams: ext?.teams,
          logos: ext?.logos,
          status: normStatus(ext?.status),
          home_score: home,
          away_score: away,
          score,
       
        };
    
        return <EventPillShrimp items={[item]} />;
      };
    
      return (
        <div
          className={`${className ?? ''} overflow-hidden border border-black shadow-black shadow-xl bg-zinc-950 bg-gradient-to-br bg-black text-white`}
          style={{
            ['--m-header-alpha' as any]: String(mobileVars.headerAlpha),
            ['--m-header-brightness' as any]: String(mobileVars.headerBrightness),
            ['--m-topbar-bg' as any]: String(mobileVars.topbarBg),
            ['--m-topbar-blur' as any]: `${mobileVars.topbarBlurPx}px`,
          }}
        >
          {/* ======= Top bar ======= */}
          <div className="calendar-topbar relative z-[80] grid grid-cols-[1fr_auto_1fr] items-center gap-4 backdrop-blur bg-gradient-to-b from-black/0 to-zinc-900/10 p-4 shadow-inner">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-transparent border border-white/10">
                <LCDays className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold uppercase tracking-wide drop-shadow-md bg-white text-transparent bg-clip-text select-none">
                ΠΡΟΓΡΑΜΜΑ ΑΓΩΝΩΝ
              </h2>
            </div>
    
            <div className="flex items-center gap-2 justify-self-center">
              <button
                onClick={goPrev}
                disabled={!canGoPrev}
                aria-label="Previous"
                className="h-10 w-10 flex items-center justify-center rounded-full border border-white/20 bg-black text-white hover:bg-white/10 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-white/40 focus:ring-offset-2 focus:ring-offset-black"
              >
                <ChevronLeft className="h-5 w-5 text-white" />
              </button>
    
              <button
                onClick={goToday}
                aria-label="Today"
                className="px-4 h-10 rounded-full border border-white/20 bg-black text-white hover:bg-white/10 transition-colors active:scale-95 focus:outline-none focus:ring-2 focus:ring-white/40 focus:ring-offset-2 focus:ring-offset-black"
              >
                <span className="font-extrabold tracking-wide">Σήμερα</span>
              </button>
    
              <button
                onClick={goNext}
                aria-label="Next"
                className="h-10 w-10 flex items-center justify-center rounded-full border border-white/20 bg-black text-white hover:bg-white/10 active:scale-95 transition focus:outline-none focus:ring-2 focus:ring-white/40 focus:ring-offset-2 focus:ring-offset-black"
              >
                <ChevronRight className="h-5 w-5 text-white" />
              </button>
            </div>
    
            <div className="flex items-center gap-3 justify-self-end">
              <div className="text-sm text-white/80 font-medium select-none hidden sm:block">
                {title}
              </div>
              <div className="sm:hidden flex items-center gap-1">
                <button
                  onClick={() => applyMobilePreset('dim')}
                  className="px-2 py-1 text-xs rounded-full border border-white/20 bg-black/40"
                  aria-label="Dim headers"
                  title="Dim headers"
                >
                  Aa−
                </button>
                <button
                  onClick={() => applyMobilePreset('normal')}
                  className="px-2 py-1 text-xs rounded-full border border-white/20 bg-black/40"
                  aria-label="Normal headers"
                  title="Normal headers"
                >
                  Aa
                </button>
                <button
                  onClick={() => applyMobilePreset('bright')}
                  className="px-2 py-1 text-xs rounded-full border border-white/20 bg-black/40"
                  aria-label="Bright headers"
                  title="Bright headers"
                >
                  Aa+
                </button>
              </div>
            </div>
          </div>
    
          {/* Error banner */}
          {error && (
            <div className="bg-red-900/30 border border-red-500/50 p-3 rounded-lg text-red-300 mx-4 my-4">
              Error: {error}
            </div>
          )}
    
          {/* ======= Calendar container ======= */}
          <div
            ref={scopeRef}
            className="relative isolate overflow-hidden shadow-2xl fc-scope bg-white sm:bg-gradient-to-b sm:from-emerald-950 sm:via-black sm:to-emerald-950"
          >
            {loading && (
              <div
                className="pointer-events-none absolute left-0 right-0 bottom-0 z-20 flex items-center justify-center bg-black/30"
                style={{ top: headerH }}
              >
                <RotateCw className="h-12 w-12 animate-spin text-white/70" />
              </div>
            )}
    
            <AnimatePresence>
              {!loading && events.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  className="absolute left-0 right-0 bottom-0 z-10 flex flex-col items-center justify-center gap-3"
                  style={{ top: headerH }}
                >
                  <div className="h-14 w-14 rounded-full border border-black/10 bg-black/80 flex items-center justify-center">
                    <LCDays className="h-7 w-7 text-white/90" />
                  </div>
                  <p className="text-black/70 font-semibold">No matches scheduled for this view</p>
                  <p className="text-black/50 text-sm">Try a different week or click Refresh.</p>
                </motion.div>
              )}
            </AnimatePresence>
    
            <div className="h-[60vh] sm:h-[68vh] md:h-[74vh] lg:h-[80vh] xl:h-[86vh]">
              <div className="overflow-x-auto sm:overflow-x-visible h-full">
                <div className="min-w-[900px] sm:min-w-0 h-full">
                  <FullCalendar
                    ref={calendarRef}
                    plugins={[timeGridPlugin, interactionPlugin]}
                    headerToolbar={false}
                    nowIndicator={false}
                    initialView="timeGridWeek"
                    initialDate={startOfCurrentWeek}
                    validRange={{ start: startOfCurrentWeek }}
                    events={events}
                    eventContent={renderEventContent}
                    editable={false}
                    selectable={false}
                    height="100%"
                    expandRows={true}
                    firstDay={1}
                    weekends={true}
                    dayHeaders={true}
                    locales={[elLocale]}
                    locale="el"
                    slotMinTime="19:00:00"
                    slotMaxTime="24:00:00"
                    scrollTime="19:00:00"
                    scrollTimeReset={false}
                    slotDuration="00:10:00"
                    slotLabelInterval="00:50:00"
                    allDaySlot={false}
                    dayHeaderFormat={{ weekday: 'long', day: '2-digit', month: 'short' }}
                    slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
                    datesSet={(arg) => {
                      setTitle(arg.view.title);
    
                      const todayStartOfWeek = new Date(startOfCurrentWeek);
                      todayStartOfWeek.setHours(0, 0, 0, 0);
    
                      const viewStart = new Date(arg.start);
                      viewStart.setHours(0, 0, 0, 0);
    
                      setCanGoPrev(viewStart > todayStartOfWeek);
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
    
          
        </div>
      );
    }
    
