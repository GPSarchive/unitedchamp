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
      <div className="space-y-4">
        {rows.map((a) => (
          <AnnouncementCard key={a.id} a={a} />
        ))}
      </div>

      {rows.length === 0 && !loading && !error && (
        <div className="text-sm text-white/70 mt-4 text-center py-8 rounded-2xl border border-white/20 bg-black/50 backdrop-blur-sm">
          Δεν υπάρχουν ανακοινώσεις.
        </div>
      )}

      {error && (
        <div className="text-sm text-rose-400 mt-4 p-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 backdrop-blur-sm">
          Σφάλμα: {error}
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        {nextOffset !== null && (
          <button
            onClick={load}
            disabled={loading}
            className="px-4 py-2 rounded-lg border border-white/30 bg-white/10 text-white hover:bg-white/20 text-sm font-medium backdrop-blur-sm transition-colors disabled:opacity-60"
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
