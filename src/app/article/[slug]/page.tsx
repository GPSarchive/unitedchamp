import { notFound } from 'next/navigation';
import { generateHTML } from '@tiptap/html';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { createSupabaseRSCClient } from '@/app/lib/supabase/supabaseServer';

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-black to-zinc-900">
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
            <p className="text-xl text-white/70 mb-4 leading-relaxed">{article.excerpt}</p>
          )}

          {publishedDate && (
            <time className="text-sm text-white/50" dateTime={article.published_at!}>
              {publishedDate}
            </time>
          )}
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
