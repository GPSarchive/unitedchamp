
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
   import EventPill from './EventPill';
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
   
   function mapIncomingEvents(list: Props['initialEvents'] = []): EventInput[] {
     return list.map((e) => ({
       id: String(e.id),
       title: e.title,
       start: toNaiveIsoClient(e.start),
       end: toNaiveIsoClient(e.end),
       allDay: Boolean(e.all_day),
       extendedProps: { teams: e.teams, logos: e.logos },
     }));
   }
   
   // ===================== Collapse overlaps into single composite events =====================
   type ClusterItem = {
     id: string;
     title: string;
     start: string;
     end: string;
     teams?: [string, string];
     logos?: [string, string];
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
   
     const byDay = new Map<string, Array<{
       id: string; title: string; start: string; end: string;
       startMin: number; endMin: number;
       teams?: [string, string]; logos?: [string, string];
     }>>();
   
     for (const e of base) {
       const key = dayKey(e.start as string);
       const teams = (e.extendedProps as any)?.teams as [string, string] | undefined;
       const logos = (e.extendedProps as any)?.logos as [string, string] | undefined;
       const arr = byDay.get(key) ?? [];
       arr.push({
         id: e.id!, title: e.title!,
         start: e.start as string, end: e.end as string,
         startMin: minutesFromNaive(e.start as string),
         endMin: minutesFromNaive(e.end as string),
         teams, logos,
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
   
         const items: ClusterItem[] = cluster.map((c) => ({
           id: c.id, title: c.title, start: c.start, end: c.end, teams: c.teams, logos: c.logos,
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
     const calendarRef = useRef<FullCalendar>(null);
   
     useEffect(() => {
       setEvents(collapseOverlapsToCompositeEvents(mapIncomingEvents(initialEvents)));
     }, [initialEvents]);
   
     const fetchFromMatches = useCallback(async () => {
       if (!fetchFromDb) return;
       setLoading(true);
       setError(null);
   
       const { data, error } = await supabase
         .from('matches')
         .select(
           `id, match_date,
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
   
       const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);
   
       const built: EventInput[] = (data ?? []).map((m: any) => {
         const a = one(m.teamA) as TeamLiteLocal | null;
         const b = one(m.teamB) as TeamLiteLocal | null;
   
         const start = toNaiveIsoClient(m.match_date);
         const end = endIsoPlusMinutes(m.match_date, 50);
   
         return {
           id: String(m.id),
           title: `${a?.name ?? 'Unknown'} vs ${b?.name ?? 'Unknown'}`,
           start,
           end,
           allDay: false,
           extendedProps: {
             teams: [a?.name ?? 'Unknown', b?.name ?? 'Unknown'] as [string, string],
             logos: [a?.logo ?? '/placeholder.png', b?.logo ?? '/placeholder.png'] as [string, string],
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
       const items = (eventInfo.event.extendedProps as any)?.items as Array<{
         id: string; title: string; start: string; end: string; teams?: [string, string]; logos?: [string, string];
       }> | undefined;
   
       if (items && items.length) {
         const EventPillAny = EventPill as any;
         return <EventPillAny items={items} />;
       }
   
       const ext = eventInfo.event.extendedProps as {
         teams?: [string, string];
         logos?: [string, string];
       };
       // @ts-ignore old signature support
       return <EventPill timeText={eventInfo.timeText} teams={ext?.teams} logos={ext?.logos} />;
     };
   
     return (
       <div
         className={`${className ?? ''} overflow-hidden border border-black shadow-black shadow-xl
                     bg-zinc-950 bg-gradient-to-br bg-black text-white`}
       >
         {/* ======= Custom Glass Header ======= */}
         <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 backdrop-blur-md bg-gradient-to-b from-black/10 to-zinc-900/60 p-4 shadow-inner border-zinc">
           <div className="flex items-center gap-3">
             <div className="p-2 rounded-lg bg-transparent border border-black-400/10">
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
           </div>
         </div>
   
         {/* Error banner */}
         {error && (
           <div className="bg-red-900/30 border border-red-500/50 p-3 rounded-lg text-red-300 mx-4 my-4">
             Error: {error}
           </div>
         )}
   
         {/* ======= Calendar container (responsive height) ======= */}
         <div className="relative overflow-hidden shadow-2xl bg-gradient-to-b from-emerald-950 via-black to-emerald-950 fc-scope">
           {/* Loading overlay (can cover grid; header will sit above via CSS below) */}
           {loading && (
             <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-md">
               <RotateCw className="h-12 w-12 animate-spin text-white-400" />
             </div>
           )}
   
           {/* Empty state overlay */}
           <AnimatePresence>
             {!loading && events.length === 0 && (
               <motion.div
                 initial={{ opacity: 0, scale: 0.95 }}
                 animate={{ opacity: 1, scale: 1 }}
                 exit={{ opacity: 0, scale: 0.95 }}
                 transition={{ duration: 0.3 }}
                 className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3"
               >
                 <div className="h-14 w-14 rounded-full border border-white-400/10 bg-black backdrop-blur-sm flex items-center justify-center">
                   <LCDays className="h-7 w-7 text-white-400/80" />
                 </div>
                 <p className="text-white/80 font-semibold">No matches scheduled for this view</p>
                 <p className="text-white/50 text-sm">Try a different week or click Refresh.</p>
               </motion.div>
             )}
           </AnimatePresence>
   
           {/* >>> Responsive height + horizontal scroll on mobile <<< */}
           <div className="h-[60vh] sm:h-[68vh] md:h-[74vh] lg:h-[80vh] xl:h-[86vh]">
             {/* On <640px, enable horizontal scroll. On ≥640px, let it behave normally */}
             <div className="overflow-x-auto sm:overflow-x-visible h-full">
               {/* Give the calendar a min width on mobile so it doesn't squash */}
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
                   slotLabelInterval="00:50:00"
                   slotMinTime="20:00:00"
                   slotMaxTime="22:30:00"
                   slotDuration="00:10:00"
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
   
         {/* SCOPED FIX: keep day headers above overlays & make them opaque */}
         <style jsx global>{`
           /* Only affects calendars inside .fc-scope wrapper */
           .fc-scope .fc .fc-col-header,
           .fc-scope .fc .fc-col-header-cell,
           .fc-scope .fc .fc-scrollgrid-section-header {
             position: sticky;
             background-color: rgba(255, 255, 255, 0.9) !important; /* opaque-ish so no dimming */
             backdrop-filter: none !important;
             z-index: 3; /* ensure above overlays while scrolling */
           }
           /* Ensure header cell content remains readable */
           .fc-scope .fc .fc-col-header-cell-cushion {
             color: #e5e7eb; /* Tailwind zinc-200-ish */
             font-weight: 800;
             letter-spacing: 0.02em;
           }
   
           /* Optional: tighter headers on very small screens */
           @media (max-width: 640px) {
             .fc-scope .fc .fc-col-header-cell-cushion {
               font-weight: 700;
               letter-spacing: 0;
               font-size: 0.9rem;
             }
           }
         `}</style>
       </div>
     );
   }