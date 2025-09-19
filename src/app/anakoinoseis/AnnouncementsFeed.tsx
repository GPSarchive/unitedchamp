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
      <div className="space-y-3">
        {rows.map((a) => (
          <AnnouncementCard key={a.id} a={a} />
        ))}
      </div>

      {rows.length === 0 && !loading && !error && (
        <div className="text-sm text-gray-500 mt-2">No announcements.</div>
      )}

      {error && (
        <div className="text-sm text-red-600 mt-2">Error: {error}</div>
      )}

      <div className="mt-4 flex items-center gap-3">
        {nextOffset !== null && (
          <button
            onClick={load}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg border bg-white hover:bg-gray-50 text-sm"
          >
            {loading ? "Loading…" : "Load more"}
          </button>
        )}
        {nextOffset === null && rows.length > 0 && (
          <span className="text-xs text-gray-500">All caught up</span>
        )}
      </div>
    </div>
  );
}
