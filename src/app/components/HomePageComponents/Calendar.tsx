'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import { CalendarApi } from '@fullcalendar/core';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { supabase, type DbEvent } from '@/app/lib/supabaseClient';

type Props = {
  height?: number | 'auto';
  className?: string;
  initialEvents?: DbEvent[];
  fetchFromDb?: boolean; // New prop
};

type CalEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  teams?: [string, string];
  logos?: [string, string];
};

export default function EventCalendar({
  height = 'auto',
  className,
  initialEvents = [],
  fetchFromDb = false, // Default to false
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

  const [events, setEvents] = useState<CalEvent[]>(
    initialEvents.map((e) => ({
      id: e.id,
      title: e.title,
      start: e.start,
      end: e.end,
      allDay: e.all_day,
    }))
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const calendarRef = useRef<FullCalendar>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from('events')
      .select('id, title, start, end, all_day')
      .order('start', { ascending: true });

    if (error) {
      setError(error.message);
      setEvents([]);
    } else {
      setEvents(
        (data as DbEvent[]).map((e) => ({
          id: e.id,
          title: e.title,
          start: e.start,
          end: e.end,
          allDay: e.all_day,
        }))
      );
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    if (fetchFromDb) {
      fetchEvents();
    } else {
      setLoading(false); // Skip loading state for placeholders
    }
  }, [fetchEvents, fetchFromDb]);

  const calendarPlugins = useMemo(
    () => [timeGridPlugin, interactionPlugin],
    []
  );

  const renderEventContent = (eventInfo: any) => {
    const { event } = eventInfo;
    const ext = event.extendedProps as CalEvent;

    if (!ext.teams || !ext.logos) {
      return (
        <div className="bg-[#1f2937] text-white p-2 rounded-md shadow h-full flex items-center justify-center">
          <span className="font-medium text-sm">{event.title}</span>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-between bg-[#1f2937] text-white p-2 rounded-md shadow-lg h-full">
        <div className="flex items-center gap-2">
          <img
            src={ext.logos[0]}
            alt={ext.teams[0]}
            className="h-6 w-6 object-contain rounded-full"
          />
          <span className="font-bold text-sm">{ext.teams[0]}</span>
        </div>
        <span className="text-yellow-400 font-semibold text-sm">vs</span>
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm">{ext.teams[1]}</span>
          <img
            src={ext.logos[1]}
            alt={ext.teams[1]}
            className="h-6 w-6 object-contain rounded-full"
          />
        </div>
      </div>
    );
  };

  const handleDateClick = useCallback(
    async (info: { date: Date }) => {
      const title = window.prompt('Enter match title:');
      if (!title) return;

      const start = info.date;
      const end = new Date(start.getTime() + 50 * 60 * 1000);

      const { error } = await supabase.from('events').insert({
        title,
        start: start.toISOString(),
        end: end.toISOString(),
      });

      if (error) {
        alert(`Error creating event: ${error.message}`);
      } else {
        fetchEvents();
      }
    },
    [fetchEvents]
  );

  return (
    <div
      className={`${className} p-6 rounded-2xl shadow-xl bg-gradient-to-br from-green-900 to-green-700 text-white`}
    >
      <div className="mb-6 flex items-center justify-between gap-4 backdrop-blur-md bg-white/10 p-4 rounded-xl shadow-inner border border-white/20">
        <h2 className="text-3xl font-extrabold uppercase tracking-wide drop-shadow">
          ΠΡΟΓΡΑΜΜΑ ΑΓΩΝΩΝ
        </h2>
        <button
          onClick={fetchEvents}
          className="px-5 py-2 rounded-full bg-white text-green-800 font-bold hover:bg-yellow-400 hover:text-black transition shadow-lg"
          disabled={!fetchFromDb} // Disable refresh if not fetching from DB
        >
          🔄 Refresh
        </button>
      </div>

      {loading && <div className="text-white text-sm mt-4">Loading events...</div>}
      {error && <div className="text-red-400 text-sm mt-4">Error: {error}</div>}

      <div className="rounded-xl overflow-hidden shadow-lg bg-white text-black p-2">
        <FullCalendar
          ref={calendarRef}
          plugins={calendarPlugins}
          initialView="timeGridWeek"
          initialDate={startOfCurrentWeek}
          validRange={{ start: startOfCurrentWeek }}
          events={events}
          eventContent={renderEventContent}
          editable={false}
          selectable={false}
          height={height}
          firstDay={1}
          slotMinTime="20:00:00"
          slotMaxTime="23:00:00"
          slotDuration="00:10:00"
          allDaySlot={false}
          dateClick={handleDateClick}
          customButtons={{
            prev: {
              text: '←',
              click: () => {
                const api = calendarRef.current?.getApi() as CalendarApi;
                const prevWeekStart = new Date(api.view.currentStart);
                prevWeekStart.setDate(prevWeekStart.getDate() - 7);
                if (prevWeekStart >= startOfCurrentWeek) api.prev();
              },
            },
          }}
          datesSet={(arg) => {
            const btn = document.querySelector(
              '.fc-prev-button'
            ) as HTMLButtonElement | null;
            if (!btn) return;
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const viewStart = new Date(arg.start);
            viewStart.setHours(0, 0, 0, 0);
            const disable = viewStart <= today;
            btn.disabled = disable;
            btn.classList.toggle('opacity-50', disable);
            btn.style.filter = disable ? 'grayscale(100%)' : '';
          }}
        />
      </div>

      <style jsx global>{`
        .fc {
          font-family: 'Poppins', sans-serif;
        }
        .fc-toolbar-title {
          font-size: 1.25rem;
          font-weight: 700;
          color: #064e3b;
        }
        .fc-button {
          background-color: #16a34a !important;
          border: none !important;
          border-radius: 9999px !important;
          color: white !important;
          font-weight: 600;
        }
        .fc-button:hover {
          background-color: #166534 !important;
        }
        .fc-daygrid-event,
        .fc-timegrid-event {
          border: none !important;
        }
        .fc-col-header-cell-cushion {
          color: #111827;
          font-weight: 600;
        }
        .fc-timegrid-slot-label-cushion {
          font-size: 0.85rem;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
}