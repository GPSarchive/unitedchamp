'use client';

import * as React from 'react';
import Link from 'next/link';
import RichTextEditor from '@/components/RichTextEditor';
import ArticlePreview from '@/components/ArticlePreview';
import { Eye, EyeOff, ExternalLink } from 'lucide-react';

type Article = {
  id: number;
  title: string;
  slug: string;
  content: any;
  excerpt: string | null;
  featured_image: string | null;
  status: 'draft' | 'published' | 'archived';
  author_id: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

const PAGE_SIZE = 20;

const greekDate = (d: string) =>
  new Date(d).toLocaleString('el-GR', { dateStyle: 'medium', timeStyle: 'short' });

export default function ArticlesAdmin() {
  const [articles, setArticles] = React.useState<Article[]>([]);
  const [nextOffset, setNextOffset] = React.useState<number | null>(0);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Create form state
  const [title, setTitle] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [content, setContent] = React.useState<any>(null);
  const [excerpt, setExcerpt] = React.useState('');
  const [showPreview, setShowPreview] = React.useState(false);

  // Auto-generate slug from title
  React.useEffect(() => {
    if (title && !slug) {
      const generatedSlug = title
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 100);
      setSlug(generatedSlug);
    }
  }, [title, slug]);

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
      setArticles((prev) => prev.concat(json.data ?? []));
      setNextOffset(json.nextOffset);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load articles');
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    if (articles.length === 0 && nextOffset === 0) loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create(status: 'draft' | 'published') {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = {
        title: title.trim(),
        slug: slug.trim() || undefined,
        content: content || { type: 'doc', content: [] },
        excerpt: excerpt.trim() || null,
        status,
      };
      const res = await fetch('/api/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create article');

      // Prepend new article and reset form
      setArticles((prev) => [json.data as Article, ...prev]);
      setTitle('');
      setSlug('');
      setContent(null);
      setExcerpt('');
    } catch (e: any) {
      setError(e.message ?? 'Failed to create article');
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
      if (!res.ok) throw new Error(json.error || 'Failed to update article');
      setArticles((prev) => prev.map((a) => (a.id === id ? (json.data as Article) : a)));
    } catch (e: any) {
      setError(e.message ?? 'Failed to update article');
    } finally {
      setLoading(false);
    }
  }

  async function remove(id: number) {
    if (!confirm('Delete this article?')) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/articles/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to delete article');
      setArticles((prev) => prev.filter((a) => a.id !== id));
    } catch (e: any) {
      setError(e.message ?? 'Failed to delete article');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <h2 className="text-2xl font-semibold text-zinc-50">Articles Management</h2>

      {/* Create Article Form */}
      <div className="rounded-xl border border-white/20 bg-black/50 p-6 text-zinc-100 backdrop-blur-sm shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Create New Article</h3>
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-white/30 bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            {showPreview ? (
              <>
                <EyeOff size={16} /> Hide Preview
              </>
            ) : (
              <>
                <Eye size={16} /> Show Preview
              </>
            )}
          </button>
        </div>

        <div className={`grid ${showPreview ? 'grid-cols-2' : 'grid-cols-1'} gap-6`}>
          {/* Editor Column */}
          <div className="space-y-4">
            <label className="flex flex-col gap-2">
              <span className="text-sm text-white/90 font-medium">Title *</span>
              <input
                className="border border-white/20 bg-black/40 rounded-lg px-4 py-2 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 backdrop-blur-sm"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter article title..."
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm text-white/90 font-medium">
                URL Slug <span className="text-white/60 font-normal">(auto-generated)</span>
              </span>
              <input
                className="border border-white/20 bg-black/40 rounded-lg px-4 py-2 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 backdrop-blur-sm"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="article-url-slug"
              />
              {slug && (
                <span className="text-xs text-white/60">
                  Will be available at: /article/{slug}
                </span>
              )}
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm text-white/90 font-medium">Excerpt (Optional)</span>
              <textarea
                className="border border-white/20 bg-black/40 rounded-lg px-4 py-2 min-h-[80px] text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 backdrop-blur-sm"
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                placeholder="Short description for SEO and previews..."
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm text-white/90 font-medium">Content *</span>
              <RichTextEditor
                content={content}
                onChange={setContent}
                placeholder="Start writing your article..."
              />
            </label>

            <div className="flex flex-wrap gap-3 pt-4">
              <button
                onClick={() => create('published')}
                disabled={loading}
                className="px-4 py-2 rounded-lg border border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:opacity-60 shadow-sm transition-colors"
              >
                Publish Now
              </button>
              <button
                onClick={() => create('draft')}
                disabled={loading}
                className="px-4 py-2 rounded-lg border border-white/30 bg-white/10 text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-60 backdrop-blur-sm transition-colors"
              >
                Save as Draft
              </button>
              {error && <span className="text-sm text-rose-400 self-center">{error}</span>}
            </div>
          </div>

          {/* Preview Column */}
          {showPreview && (
            <div className="border border-white/20 rounded-lg bg-black/40 p-6 backdrop-blur-sm">
              <div className="mb-4 pb-4 border-b border-white/20">
                <h4 className="text-sm font-semibold text-white/60 uppercase tracking-wide mb-2">
                  Live Preview
                </h4>
              </div>
              <ArticlePreview content={content} title={title || 'Untitled Article'} />
            </div>
          )}
        </div>
      </div>

      {/* Articles List */}
      <div className="rounded-xl border border-white/20 bg-black/50 overflow-hidden backdrop-blur-sm shadow-lg">
        <div className="p-4 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white">Existing Articles</h3>
        </div>

        {articles.length === 0 && !loading ? (
          <div className="p-6 text-center text-sm text-white/70">No articles yet.</div>
        ) : null}

        <ul className="divide-y divide-white/10">
          {articles.map((article) => (
            <ArticleRow key={article.id} article={article} onPatch={patch} onDelete={remove} />
          ))}
        </ul>

        <div className="p-4 border-t border-white/10 flex items-center gap-3">
          {nextOffset !== null ? (
            <button
              onClick={loadMore}
              disabled={loading}
              className="px-4 py-2 rounded-lg border border-white/30 bg-white/10 text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-60 backdrop-blur-sm"
            >
              {loading ? 'Loading...' : 'Load More'}
            </button>
          ) : (
            <span className="text-xs text-white/60">All articles loaded</span>
          )}
          {error && <span className="text-sm text-rose-400">{error}</span>}
        </div>
      </div>
    </div>
  );
}

/* Individual Article Row */
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
  const [title, setTitle] = React.useState(article.title);
  const [slug, setSlug] = React.useState(article.slug);
  const [excerpt, setExcerpt] = React.useState(article.excerpt || '');
  const [content, setContent] = React.useState(article.content);
  const [showPreview, setShowPreview] = React.useState(false);

  const save = async () => {
    await onPatch(article.id, { title, slug, excerpt: excerpt || null, content });
    setEditing(false);
  };

  const togglePublish = () =>
    onPatch(article.id, { status: article.status === 'published' ? 'draft' : 'published' });

  const Status =
    article.status === 'published' ? (
      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-600/20 border border-emerald-500/40 text-emerald-200 uppercase font-semibold">
        Published
      </span>
    ) : (
      <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-700/40 border border-zinc-600/50 text-zinc-200 uppercase font-semibold">
        Draft
      </span>
    );

  return (
    <li className="p-5">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2 flex-wrap">
            {Status}
            <time className="text-[11px] text-white/60">{greekDate(article.created_at)}</time>
            {article.published_at && (
              <span className="text-[11px] text-emerald-400/80">
                Published: {greekDate(article.published_at)}
              </span>
            )}
          </div>

          {!editing ? (
            <>
              <h4 className="font-semibold text-lg text-white leading-snug mb-1">
                {article.title}
              </h4>
              <p className="text-sm text-white/60 mb-2">/article/{article.slug}</p>
              {article.excerpt && (
                <p className="text-sm text-white/80 leading-relaxed">{article.excerpt}</p>
              )}
            </>
          ) : (
            <div className="space-y-4 mt-2">
              <input
                className="w-full border border-white/20 bg-black/40 rounded px-3 py-2 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 backdrop-blur-sm"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title"
              />
              <input
                className="w-full border border-white/20 bg-black/40 rounded px-3 py-2 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 backdrop-blur-sm"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="url-slug"
              />
              <textarea
                className="w-full border border-white/20 bg-black/40 rounded px-3 py-2 min-h-[60px] text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 backdrop-blur-sm"
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                placeholder="Excerpt"
              />
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm text-white/90">Content:</span>
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="text-xs px-2 py-1 rounded border border-white/30 bg-white/10 text-white hover:bg-white/20"
                >
                  {showPreview ? 'Hide' : 'Show'} Preview
                </button>
              </div>
              <div className={`grid ${showPreview ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
                <RichTextEditor content={content} onChange={setContent} />
                {showPreview && (
                  <div className="border border-white/20 rounded-lg bg-black/40 p-4">
                    <ArticlePreview content={content} />
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {!editing ? (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className="px-3 py-1.5 text-sm rounded-md border border-white/30 bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={togglePublish}
                  className="px-3 py-1.5 text-sm rounded-md border border-emerald-600/50 bg-emerald-600/10 text-emerald-100 hover:bg-emerald-600/20 backdrop-blur-sm transition-colors"
                >
                  {article.status === 'published' ? 'Unpublish' : 'Publish'}
                </button>
                <Link
                  href={`/article/${article.slug}`}
                  target="_blank"
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border border-blue-600/50 bg-blue-600/10 text-blue-100 hover:bg-blue-600/20 backdrop-blur-sm transition-colors"
                >
                  View <ExternalLink size={14} />
                </Link>
                <button
                  onClick={() => onDelete(article.id)}
                  className="px-3 py-1.5 text-sm rounded-md border border-rose-600/50 bg-rose-600/10 text-rose-200 hover:bg-rose-600/20 backdrop-blur-sm transition-colors"
                >
                  Delete
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={save}
                  className="px-3 py-1.5 text-sm rounded-md border border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-500 shadow-sm transition-colors"
                >
                  Save Changes
                </button>
                <button
                  onClick={() => {
                    setEditing(false);
                    setTitle(article.title);
                    setSlug(article.slug);
                    setExcerpt(article.excerpt || '');
                    setContent(article.content);
                    setShowPreview(false);
                  }}
                  className="px-3 py-1.5 text-sm rounded-md border border-white/30 bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm transition-colors"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
