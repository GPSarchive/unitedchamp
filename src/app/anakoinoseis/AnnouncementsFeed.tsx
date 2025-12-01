// components/announcements/AnnouncementsFeed.tsx
"use client";
import * as React from "react";
import AnnouncementCard, { type Announcement } from "./AnnouncementCard";

type Props = {
  pageSize: number;           // e.g. 5 on home, 20 on the page
  className?: string;
};

export default function AnnouncementsFeed({ pageSize, className }: Props) {
  const [rows, setRows] = React.useState<Announcement[]>([]);
  const [nextOffset, setNextOffset] = React.useState<number | null>(0);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = async () => {
    if (nextOffset === null) return;
    setLoading(true);
    setError(null);

    try {
      const r = await fetch(
        `/api/announcements?active=1&offset=${nextOffset}&limit=${pageSize}`,
        { cache: "no-store" }
      );
      const { data, nextOffset: nOff, error: e } = await r.json();
      if (e) throw new Error(e);
      setRows((prev) => prev.concat(data ?? []));
      setNextOffset(nOff);
    } catch (err: any) {
      setError(err.message ?? "Failed to load announcements");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    // initial load
    if (rows.length === 0 && nextOffset === 0) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={className}>
      <div className="space-y-5">
        {rows.map((a) => (
          <AnnouncementCard key={a.id} a={a} />
        ))}
      </div>

      {rows.length === 0 && !loading && !error && (
        <div className="text-sm text-white/75 text-center py-12 rounded-2xl bg-black/80 ring-1 ring-black backdrop-blur-2xl shadow-xl shadow-black/40">
          Δεν υπάρχουν ανακοινώσεις.
        </div>
      )}

      {error && (
        <div className="text-sm text-rose-300 p-6 rounded-2xl bg-rose-950/40 ring-1 ring-rose-500/30 backdrop-blur-2xl shadow-xl shadow-black/40">
          Σφάλμα: {error}
        </div>
      )}

      <div className="mt-8 flex items-center justify-center gap-3">
        {nextOffset !== null && (
          <button
            onClick={load}
            disabled={loading}
            className="px-6 py-2.5 rounded-lg bg-black/80 ring-1 ring-black hover:ring-white/25 text-white hover:bg-black/90 text-sm font-medium backdrop-blur-2xl shadow-lg shadow-black/40 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Φόρτωση…" : "Φόρτωσε περισσότερα"}
          </button>
        )}
        {nextOffset === null && rows.length > 0 && (
          <span className="text-xs text-white/60">Όλα φορτώθηκαν</span>
        )}
      </div>
    </div>
  );
}
