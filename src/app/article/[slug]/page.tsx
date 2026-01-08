import { notFound } from 'next/navigation';
import { generateHTML } from '@tiptap/html';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { createSupabaseRSCClient } from '@/app/lib/supabase/supabaseServer';
import { calculateReadTime, formatViewCount, formatReadTime } from '@/lib/articleUtils';
import ArticleViewCounter from '@/components/ArticleViewCounter';
import RelatedArticles from '@/components/RelatedArticles';
import ArticleNavigation from '@/components/ArticleNavigation';

type PageProps = {
  params: Promise<{ slug: string }>;
};

async function getArticle(slug: string) {
  const supabase = await createSupabaseRSCClient();

  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  // Only show published articles to non-admin users
  if (data.status !== 'published') {
    const { data: { user } } = await supabase.auth.getUser();
    const roles = Array.isArray(user?.app_metadata?.roles) ? user.app_metadata.roles : [];
    if (!roles.includes('admin')) {
      return null;
    }
  }

  return data;
}

async function getRelatedArticles(currentArticleDate: string, limit: number = 3) {
  const supabase = await createSupabaseRSCClient();

  const { data, error } = await supabase
    .from('articles')
    .select('id, title, slug, excerpt, featured_image, published_at')
    .eq('status', 'published')
    .lt('published_at', currentArticleDate)
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching related articles:', error);
    return [];
  }

  return data || [];
}

async function getAdjacentArticles(currentArticleDate: string) {
  const supabase = await createSupabaseRSCClient();

  // Get previous article (older)
  const { data: previousArticle } = await supabase
    .from('articles')
    .select('slug, title')
    .eq('status', 'published')
    .lt('published_at', currentArticleDate)
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Get next article (newer)
  const { data: nextArticle } = await supabase
    .from('articles')
    .select('slug, title')
    .eq('status', 'published')
    .gt('published_at', currentArticleDate)
    .order('published_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  return { previousArticle, nextArticle };
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const article = await getArticle(slug);

  if (!article) {
    return {
      title: 'Article Not Found',
    };
  }

  return {
    title: article.title,
    description: article.excerpt || `Read ${article.title}`,
  };
}

export default async function ArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const article = await getArticle(slug);

  if (!article) {
    notFound();
  }

  // Fetch related articles and navigation
  const relatedArticles = article.published_at
    ? await getRelatedArticles(article.published_at)
    : [];

  const { previousArticle, nextArticle } = article.published_at
    ? await getAdjacentArticles(article.published_at)
    : { previousArticle: null, nextArticle: null };

  // Generate HTML from TipTap JSON
  const contentHTML = article.content
    ? generateHTML(article.content, [
        StarterKit,
        Underline,
        Link.configure({
          openOnClick: true,
          HTMLAttributes: {
            class: 'text-blue-400 underline hover:text-blue-300 transition-colors',
          },
        }),
        Image.configure({
          HTMLAttributes: {
            class: 'max-w-full h-auto rounded-lg my-6 shadow-lg',
          },
        }),
      ])
    : '';

  const publishedDate = article.published_at
    ? new Date(article.published_at).toLocaleDateString('el-GR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  // Calculate read time
  const readTime = calculateReadTime(article.content);
  const viewCount = article.view_count || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-black to-zinc-900">
      {/* View counter (hidden, just for tracking) */}
      <ArticleViewCounter slug={slug} />

      {/* Header with back navigation */}
      <div className="border-b border-white/10 bg-black/30 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <a
            href="/"
            className="inline-flex items-center text-sm text-white/70 hover:text-white transition-colors"
          >
            ← Back to Home
          </a>
        </div>
      </div>

      {/* Article content */}
      <article className="max-w-4xl mx-auto px-4 py-12">
        {/* Status badge for drafts (admin only) */}
        {article.status !== 'published' && (
          <div className="mb-6 inline-block px-3 py-1 rounded-full bg-amber-600/20 border border-amber-500/40 text-amber-200 text-sm font-semibold">
            DRAFT - Preview Mode
          </div>
        )}

        {/* Article header */}
        <header className="mb-8 pb-8 border-b border-white/10">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
            {article.title}
          </h1>

          {article.excerpt && (
            <p className="text-xl text-white/70 mb-6 leading-relaxed">{article.excerpt}</p>
          )}

          {/* Article metadata */}
          <div className="flex items-center gap-4 flex-wrap text-sm text-white/50">
            {publishedDate && (
              <time className="flex items-center gap-1.5" dateTime={article.published_at!}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {publishedDate}
              </time>
            )}

            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {formatReadTime(readTime)}
            </span>

            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              {formatViewCount(viewCount)}
            </span>
          </div>
        </header>

        {/* Featured image */}
        {article.featured_image && (
          <div className="mb-8">
            <img
              src={article.featured_image}
              alt={article.title}
              className="w-full h-auto rounded-xl shadow-2xl"
            />
          </div>
        )}

        {/* Article content */}
        <div
          className="prose prose-invert prose-lg max-w-none
            prose-headings:text-white prose-headings:font-bold
            prose-h1:text-3xl prose-h1:mb-4
            prose-h2:text-2xl prose-h2:mb-3 prose-h2:mt-8
            prose-h3:text-xl prose-h3:mb-2 prose-h3:mt-6
            prose-p:text-white/90 prose-p:leading-relaxed prose-p:mb-4
            prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline
            prose-strong:text-white prose-strong:font-semibold
            prose-ul:text-white/90 prose-ul:list-disc prose-ul:pl-6
            prose-ol:text-white/90 prose-ol:list-decimal prose-ol:pl-6
            prose-li:mb-2
            prose-blockquote:border-l-4 prose-blockquote:border-white/30
            prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-white/70
            prose-code:text-emerald-400 prose-code:bg-black/50 prose-code:px-1 prose-code:rounded
            prose-pre:bg-black/70 prose-pre:border prose-pre:border-white/20 prose-pre:rounded-lg
            prose-img:rounded-lg prose-img:shadow-xl"
          dangerouslySetInnerHTML={{ __html: contentHTML }}
        />

        {/* Article Navigation (Previous/Next) */}
        <ArticleNavigation previousArticle={previousArticle} nextArticle={nextArticle} />

        {/* Related Articles */}
        <RelatedArticles articles={relatedArticles} />

        {/* Article footer */}
        <footer className="mt-12 pt-8 border-t border-white/10">
          <div className="flex items-center justify-between">
            <a
              href="/"
              className="text-sm text-white/70 hover:text-white transition-colors"
            >
              ← Back to Home
            </a>
          </div>
        </footer>
      </article>
    </div>
  );
}
