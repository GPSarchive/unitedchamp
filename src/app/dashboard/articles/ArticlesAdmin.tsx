'use client';

import * as React from 'react';
import Link from 'next/link';

type Article = {
  id: number;
  created_at: string;
  updated_at: string;
  title: string;
  content: string;
  excerpt?: string;
  slug?: string;
  category?: string;
  tags?: string[];
  pinned: boolean;
  priority: number;
  status: 'draft' | 'published' | 'scheduled' | 'archived';
  format?: 'md' | 'html' | 'plain';
  featured_image?: string;
  author_id?: string;
  published_at?: string;
  view_count?: number;
  start_at?: string;
  end_at?: string;
};

const PAGE_SIZE = 50;

/* Small helpers */
const clamp = (s: string, n = 200) => (s.length <= n ? s : s.slice(0, n - 1) + '…');
const greekDate = (d: string) =>
  new Date(d).toLocaleString('el-GR', { dateStyle: 'medium', timeStyle: 'short' });

export default function ArticlesAdmin() {
  const [rows, setRows] = React.useState<Article[]>([]);
  const [nextOffset, setNextOffset] = React.useState<number | null>(0);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Create form state
  const [title, setTitle] = React.useState('');
  const [content, setContent] = React.useState('');
  const [excerpt, setExcerpt] = React.useState('');
  const [category, setCategory] = React.useState('');
  const [tags, setTags] = React.useState('');
  const [pinned, setPinned] = React.useState(false);
  const [priority, setPriority] = React.useState(0);

  async function loadMore() {
    if (nextOffset === null) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/articles?offset=${nextOffset}&limit=${PAGE_SIZE}`, {
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
      const payload: any = {
        title: title.trim(),
        content: content ?? '',
        format: 'md',
        status,
        pinned: Boolean(pinned),
        priority: Number(priority) || 0,
      };

      if (excerpt.trim()) payload.excerpt = excerpt.trim();
      if (category.trim()) payload.category = category.trim();
      if (tags.trim()) {
        payload.tags = tags.split(',').map((t) => t.trim()).filter(Boolean);
      }

      const res = await fetch('/api/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Αποτυχία δημιουργίας');

      // Prepend new one and reset form
      setRows((prev) => [json.data as Article, ...prev]);
      setTitle('');
      setContent('');
      setExcerpt('');
      setCategory('');
      setTags('');
      setPinned(false);
      setPriority(0);
    } catch (e: any) {
      setError(e.message ?? 'Αποτυχία δημιουργίας');
    } finally {
      setLoading(false);
    }
  }

  async function patch(id: number, data: Partial<Article>) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/articles/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Αποτυχία ενημέρωσης');
      setRows((prev) => prev.map((r) => (r.id === id ? (json.data as Article) : r)));
    } catch (e: any) {
      setError(e.message ?? 'Αποτυχία ενημέρωσης');
    } finally {
      setLoading(false);
    }
  }

  async function remove(id: number) {
    if (!confirm('Διαγραφή αυτού του άρθρου;')) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/articles/${id}`, { method: 'DELETE' });
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
      <h2 className="text-xl font-semibold text-zinc-50">Άρθρα - Διαχείριση</h2>

      {/* ---------- Create Form ---------- */}
      <div className="rounded-xl border border-white/20 bg-black/50 p-4 text-zinc-100 backdrop-blur-sm shadow-lg">
        <div className="grid gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-white/90">Τίτλος *</span>
            <input
              className="border border-white/20 bg-black/40 rounded-lg px-3 py-2 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 backdrop-blur-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Π.χ. Νέοι κανονισμοί πρωταθλήματος"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm text-white/90">Περίληψη</span>
            <input
              className="border border-white/20 bg-black/40 rounded-lg px-3 py-2 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 backdrop-blur-sm"
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="Σύντομη περιγραφή του άρθρου..."
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm text-white/90">Κείμενο *</span>
            <textarea
              className="border border-white/20 bg-black/40 rounded-lg px-3 py-2 min-h-[120px] text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 backdrop-blur-sm"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Το κύριο κείμενο του άρθρου... (υποστηρίζεται Markdown)"
            />
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-sm text-white/90">Κατηγορία</span>
              <input
                className="border border-white/20 bg-black/40 rounded-lg px-3 py-2 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 backdrop-blur-sm"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Π.χ. Νέα, Κανονισμοί, Ανακοινώσεις"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm text-white/90">Ετικέτες (διαχωρισμένες με κόμμα)</span>
              <input
                className="border border-white/20 bg-black/40 rounded-lg px-3 py-2 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 backdrop-blur-sm"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="Π.χ. πρωτάθλημα, αγώνες, ομάδες"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-sm text-white/90">Προτεραιότητα (0-100)</span>
              <input
                type="number"
                className="border border-white/20 bg-black/40 rounded-lg px-3 py-2 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 backdrop-blur-sm"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                min="0"
                max="100"
              />
            </label>

            <label className="inline-flex items-center gap-2 text-sm text-white/90 self-end pb-2">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-white/30 bg-black/40 focus:ring-2 focus:ring-indigo-500"
                checked={pinned}
                onChange={(e) => setPinned(e.target.checked)}
              />
              Καρφίτσωσε στην κορυφή
            </label>
          </div>

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

      {/* ---------- Articles List ---------- */}
      <div className="rounded-xl border border-white/20 bg-black/50 overflow-hidden backdrop-blur-sm shadow-lg">
        {rows.length === 0 && !loading ? (
          <div className="p-5 text-sm text-white/70">Δεν υπάρχουν άρθρα ακόμα.</div>
        ) : null}

        <ul className="divide-y divide-white/10">
          {rows.map((r) => (
            <ArticleRow key={r.id} article={r} onPatch={patch} onDelete={remove} />
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

/* ---------- Article Row Component ---------- */
function ArticleRow({
  article,
  onPatch,
  onDelete,
}: {
  article: Article;
  onPatch: (id: number, data: Partial<Article>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [editing, setEditing] = React.useState(false);
  const [t, setT] = React.useState(article.title);
  const [c, setC] = React.useState(article.content);
  const [ex, setEx] = React.useState(article.excerpt || '');
  const [cat, setCat] = React.useState(article.category || '');
  const [tagStr, setTagStr] = React.useState((article.tags || []).join(', '));
  const [pri, setPri] = React.useState(article.priority || 0);

  const save = async () => {
    const updates: Partial<Article> = {
      title: t,
      content: c,
      priority: pri,
    };
    if (ex.trim()) updates.excerpt = ex.trim();
    if (cat.trim()) updates.category = cat.trim();
    if (tagStr.trim()) {
      updates.tags = tagStr.split(',').map((tag) => tag.trim()).filter(Boolean);
    } else {
      updates.tags = [];
    }

    await onPatch(article.id, updates);
    setEditing(false);
  };

  const togglePin = () => onPatch(article.id, { pinned: !article.pinned });
  const togglePublish = () =>
    onPatch(article.id, { status: article.status === 'published' ? 'draft' : 'published' });

  const Status = article.status === 'published' ? (
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
              article.pinned ? 'bg-amber-300/90' : 'bg-white/30'
            }`}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2 flex-wrap">
            {article.pinned && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-200/15 border border-amber-200/30 text-amber-100">
                PINNED
              </span>
            )}
            {Status}
            {article.category && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-600/20 border border-blue-500/40 text-blue-200">
                {article.category}
              </span>
            )}
            {article.priority > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-600/20 border border-purple-500/40 text-purple-200">
                Προτ. {article.priority}
              </span>
            )}
            {article.view_count !== undefined && article.view_count > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-700/40 border border-zinc-600/50 text-zinc-300">
                👁 {article.view_count}
              </span>
            )}
            <time className="ml-auto text-[11px] text-white/60">{greekDate(article.created_at)}</time>
          </div>

          {!editing ? (
            <>
              <h4 className="font-semibold text-white leading-snug">{article.title}</h4>
              {article.excerpt && (
                <p className="mt-1 text-sm text-emerald-200/70 italic">{clamp(article.excerpt, 150)}</p>
              )}
              <p className="mt-1 text-sm text-white/80 leading-relaxed">{clamp(article.content, 200)}</p>
              {article.tags && article.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {article.tags.map((tag, i) => (
                    <span
                      key={i}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/70 border border-white/20"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="grid gap-2 mt-1">
              <input
                className="border border-white/20 bg-black/40 rounded px-2 py-1 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 backdrop-blur-sm"
                value={t}
                onChange={(e) => setT(e.target.value)}
                placeholder="Τίτλος"
              />
              <input
                className="border border-white/20 bg-black/40 rounded px-2 py-1 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 backdrop-blur-sm"
                value={ex}
                onChange={(e) => setEx(e.target.value)}
                placeholder="Περίληψη (προαιρετικό)"
              />
              <textarea
                className="border border-white/20 bg-black/40 rounded px-2 py-2 min-h-[100px] text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 backdrop-blur-sm"
                value={c}
                onChange={(e) => setC(e.target.value)}
                placeholder="Κείμενο"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="border border-white/20 bg-black/40 rounded px-2 py-1 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 backdrop-blur-sm"
                  value={cat}
                  onChange={(e) => setCat(e.target.value)}
                  placeholder="Κατηγορία"
                />
                <input
                  type="number"
                  className="border border-white/20 bg-black/40 rounded px-2 py-1 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 backdrop-blur-sm"
                  value={pri}
                  onChange={(e) => setPri(Number(e.target.value))}
                  placeholder="Προτεραιότητα"
                />
              </div>
              <input
                className="border border-white/20 bg-black/40 rounded px-2 py-1 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 backdrop-blur-sm"
                value={tagStr}
                onChange={(e) => setTagStr(e.target.value)}
                placeholder="Ετικέτες (διαχωρισμένες με κόμμα)"
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
                  {article.pinned ? 'Αφαίρεση καρφίτσας' : 'Καρφίτσωσε'}
                </button>
                <button
                  onClick={togglePublish}
                  className="px-2.5 py-1.5 text-sm rounded-md border border-emerald-600/50 bg-emerald-600/10 text-emerald-100 hover:bg-emerald-600/20 backdrop-blur-sm"
                >
                  {article.status === 'published' ? 'Απόκρυψη (πρόχειρο)' : 'Δημοσίευση'}
                </button>
                <button
                  onClick={() => onDelete(article.id)}
                  className="px-2.5 py-1.5 text-sm rounded-md border border-rose-600/50 bg-rose-600/10 text-rose-200 hover:bg-rose-600/20 backdrop-blur-sm"
                >
                  Διαγραφή
                </button>
                <Link
                  href={`/article/${article.id}`}
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
                    setT(article.title);
                    setC(article.content);
                    setEx(article.excerpt || '');
                    setCat(article.category || '');
                    setTagStr((article.tags || []).join(', '));
                    setPri(article.priority || 0);
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
