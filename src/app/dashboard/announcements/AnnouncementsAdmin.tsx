'use client';

import * as React from 'react';
import Link from 'next/link';

type Ann = {
  id: number;
  created_at: string;
  updated_at: string;
  title: string;
  body: string;
  pinned: boolean;
  status: 'draft' | 'published' | 'scheduled' | 'archived';
  format?: 'md' | 'html' | 'plain';
};

const PAGE_SIZE = 50;

/* Small helpers */
const clamp = (s: string, n = 200) => (s.length <= n ? s : s.slice(0, n - 1) + '…');
const greekDate = (d: string) =>
  new Date(d).toLocaleString('el-GR', { dateStyle: 'medium', timeStyle: 'short' });

export default function AnnouncementsAdmin() {
  const [rows, setRows] = React.useState<Ann[]>([]);
  const [nextOffset, setNextOffset] = React.useState<number | null>(0);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Simple create form state
  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');
  const [pinned, setPinned] = React.useState(false);

  async function loadMore() {
    if (nextOffset === null) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/announcements?offset=${nextOffset}&limit=${PAGE_SIZE}`, {
        cache: 'no-store',
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setRows((prev) => prev.concat(json.data ?? []));
      setNextOffset(json.nextOffset);
    } catch (e: any) {
      setError(e.message ?? 'Αποτυχία φόρτωσης');
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    if (rows.length === 0 && nextOffset === 0) loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create(status: 'draft' | 'published') {
    if (!title.trim()) {
      setError('Γράψε έναν τίτλο');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = {
        title: title.trim(),
        body: body ?? '',
        format: 'md',
        status,
        pinned: Boolean(pinned),
      };
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Αποτυχία δημιουργίας');

      // Prepend new one and reset form
      setRows((prev) => [json.data as Ann, ...prev]);
      setTitle('');
      setBody('');
      setPinned(false);
    } catch (e: any) {
      setError(e.message ?? 'Αποτυχία δημιουργίας');
    } finally {
      setLoading(false);
    }
  }

  async function patch(id: number, data: Partial<Ann>) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/announcements/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Αποτυχία ενημέρωσης');
      setRows((prev) => prev.map((r) => (r.id === id ? (json.data as Ann) : r)));
    } catch (e: any) {
      setError(e.message ?? 'Αποτυχία ενημέρωσης');
    } finally {
      setLoading(false);
    }
  }

  async function remove(id: number) {
    if (!confirm('Διαγραφή αυτής της ανακοίνωσης;')) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/announcements/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Αποτυχία διαγραφής');
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (e: any) {
      setError(e.message ?? 'Αποτυχία διαγραφής');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-zinc-50">Ανακοινώσεις (Απλή διαχείριση)</h2>

      {/* ---------- Create: super simple ---------- */}
      <div className="rounded-xl border border-white/20 bg-black/50 p-4 text-zinc-100 backdrop-blur-sm shadow-lg">
        <div className="grid gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-white/90">Τίτλος</span>
            <input
              className="border border-white/20 bg-black/40 rounded-lg px-3 py-2 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 backdrop-blur-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Π.χ. Νέο πρόγραμμα αγώνων"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm text-white/90">Κείμενο</span>
            <textarea
              className="border border-white/20 bg-black/40 rounded-lg px-3 py-2 min-h-[120px] text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 backdrop-blur-sm"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Το κείμενο της ανακοίνωσης…"
            />
          </label>

          <label className="inline-flex items-center gap-2 text-sm text-white/90">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-white/30 bg-black/40 focus:ring-2 focus:ring-indigo-500"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
            />
            Καρφιτσώστε επάνω
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => create('published')}
              disabled={loading}
              className="px-3 py-2 rounded-lg border border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:opacity-60 shadow-sm"
            >
              Δημοσίευση τώρα
            </button>
            <button
              onClick={() => create('draft')}
              disabled={loading}
              className="px-3 py-2 rounded-lg border border-white/30 bg-white/10 text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-60 backdrop-blur-sm"
            >
              Αποθήκευση ως πρόχειρο
            </button>
            {error && <span className="text-sm text-rose-400 self-center">{error}</span>}
          </div>
        </div>
      </div>

      {/* ---------- List: clean cards, easy actions ---------- */}
      <div className="rounded-xl border border-white/20 bg-black/50 overflow-hidden backdrop-blur-sm shadow-lg">
        {rows.length === 0 && !loading ? (
          <div className="p-5 text-sm text-white/70">Δεν υπάρχουν ανακοινώσεις ακόμα.</div>
        ) : null}

        <ul className="divide-y divide-white/10">
          {rows.map((r) => (
            <CardRow key={r.id} a={r} onPatch={patch} onDelete={remove} />
          ))}
        </ul>

        <div className="p-3 border-t border-white/10 flex items-center gap-3">
          {nextOffset !== null ? (
            <button
              onClick={loadMore}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg border border-white/30 bg-white/10 text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-60 backdrop-blur-sm"
            >
              {loading ? 'Φόρτωση…' : 'Δες περισσότερα'}
            </button>
          ) : (
            <span className="text-xs text-white/60">Όλα φορτώθηκαν</span>
          )}
          {error && <span className="text-sm text-rose-400">{error}</span>}
        </div>
      </div>
    </div>
  );
}

/* ---------- One simple editable row ---------- */
function CardRow({
  a,
  onPatch,
  onDelete,
}: {
  a: Ann;
  onPatch: (id: number, data: Partial<Ann>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [editing, setEditing] = React.useState(false);
  const [t, setT] = React.useState(a.title);
  const [b, setB] = React.useState(a.body);

  const save = async () => {
    await onPatch(a.id, { title: t, body: b });
    setEditing(false);
  };

  const togglePin = () => onPatch(a.id, { pinned: !a.pinned });
  const togglePublish = () =>
    onPatch(a.id, { status: a.status === 'published' ? 'draft' : 'published' });

  const Status = a.status === 'published' ? (
    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-600/20 border border-emerald-500/40 text-emerald-200">
      ΔΗΜΟΣΙΕΥΜΕΝΟ
    </span>
  ) : (
    <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-700/40 border border-zinc-600/50 text-zinc-200">
      ΠΡΟΧΕΙΡΟ
    </span>
  );

  return (
    <li className="p-4">
      <div className="flex items-start gap-3">
        <div className="pt-1 shrink-0">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              a.pinned ? 'bg-amber-300/90' : 'bg-white/30'
            }`}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            {a.pinned && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-200/15 border border-amber-200/30 text-amber-100">
                PINNED
              </span>
            )}
            {Status}
            <time className="ml-auto text-[11px] text-white/60">{greekDate(a.created_at)}</time>
          </div>

          {!editing ? (
            <>
              <h4 className="font-semibold text-white leading-snug">{a.title}</h4>
              <p className="mt-1 text-sm text-white/80 leading-relaxed">{clamp(a.body, 260)}</p>
            </>
          ) : (
            <div className="grid gap-2 mt-1">
              <input
                className="border border-white/20 bg-black/40 rounded px-2 py-1 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 backdrop-blur-sm"
                value={t}
                onChange={(e) => setT(e.target.value)}
              />
              <textarea
                className="border border-white/20 bg-black/40 rounded px-2 py-2 min-h-[100px] text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 backdrop-blur-sm"
                value={b}
                onChange={(e) => setB(e.target.value)}
              />
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            {!editing ? (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className="px-2.5 py-1.5 text-sm rounded-md border border-white/30 bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm"
                >
                  Επεξεργασία
                </button>
                <button
                  onClick={togglePin}
                  className="px-2.5 py-1.5 text-sm rounded-md border border-amber-600/50 bg-amber-600/10 text-amber-100 hover:bg-amber-600/20 backdrop-blur-sm"
                >
                  {a.pinned ? 'Αφαίρεση καρφίτσας' : 'Καρφίτσωσε'}
                </button>
                <button
                  onClick={togglePublish}
                  className="px-2.5 py-1.5 text-sm rounded-md border border-emerald-600/50 bg-emerald-600/10 text-emerald-100 hover:bg-emerald-600/20 backdrop-blur-sm"
                >
                  {a.status === 'published' ? 'Απόκρυψη (πρόχειρο)' : 'Δημοσίευση'}
                </button>
                <button
                  onClick={() => onDelete(a.id)}
                  className="px-2.5 py-1.5 text-sm rounded-md border border-rose-600/50 bg-rose-600/10 text-rose-200 hover:bg-rose-600/20 backdrop-blur-sm"
                >
                  Διαγραφή
                </button>
                <Link
                  href={`/announcement/${a.id}`}
                  className="ml-auto text-xs font-semibold text-white/80 hover:text-white underline underline-offset-4"
                >
                  Προβολή →
                </Link>
              </>
            ) : (
              <>
                <button
                  onClick={save}
                  className="px-2.5 py-1.5 text-sm rounded-md border border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-500 shadow-sm"
                >
                  Αποθήκευση
                </button>
                <button
                  onClick={() => {
                    setEditing(false);
                    setT(a.title);
                    setB(a.body);
                  }}
                  className="px-2.5 py-1.5 text-sm rounded-md border border-white/30 bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm"
                >
                  Άκυρο
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
