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
        <div className="text-center text-white/50 mt-8 py-12
                       bg-black/20 backdrop-blur-sm border border-white/5 rounded-xl">
          Δεν υπάρχουν ανακοινώσεις.
        </div>
      )}

      {error && (
        <div className="text-sm text-red-400 mt-4 p-4 rounded-xl
                       bg-red-500/10 border border-red-500/20 backdrop-blur-sm">
          Σφάλμα: {error}
        </div>
      )}

      <div className="mt-6 flex items-center justify-center gap-4">
        {nextOffset !== null && (
          <button
            onClick={load}
            disabled={loading}
            className="px-6 py-3 rounded-lg
                     bg-black/40 backdrop-blur-sm
                     border border-white/10
                     text-white/90 font-medium text-sm tracking-wide
                     shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_4px_12px_rgba(0,0,0,0.6)]
                     hover:bg-gradient-to-br hover:from-[#FFD700]/10 hover:to-transparent
                     hover:border-[#FFD700]/30
                     hover:text-white
                     active:scale-[0.98]
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-all duration-200"
          >
            {loading ? "Φόρτωση…" : "Φόρτωση περισσότερων"}
          </button>
        )}
        {nextOffset === null && rows.length > 0 && (
          <span className="text-sm text-white/40 tracking-wide">
            Όλα τα νέα εμφανίζονται
          </span>
        )}
      </div>
    </div>
  );
}
