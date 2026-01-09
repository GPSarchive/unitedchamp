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
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-black/50 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <a
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors duration-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Home
          </a>
        </div>
      </header>

      {/* Main Article */}
      <main className="max-w-4xl mx-auto px-6 py-16">
        <article>
          {/* Draft Badge */}
          {article.status !== 'published' && (
            <div className="mb-8">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm font-semibold">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                Draft Preview Mode
              </span>
            </div>
          )}

          {/* Article Header */}
          <header className="mb-12">
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight tracking-tight">
              {article.title}
            </h1>

            {article.excerpt && (
              <p className="text-xl text-zinc-300 mb-6 leading-relaxed">
                {article.excerpt}
              </p>
            )}

            {publishedDate && (
              <time
                className="inline-block text-sm text-zinc-500 font-medium uppercase tracking-wider"
                dateTime={article.published_at!}
              >
                {publishedDate}
              </time>
            )}
          </header>

          {/* Featured Image */}
          {article.featured_image && (
            <figure className="mb-12">
              <img
                src={article.featured_image}
                alt={article.title}
                className="w-full h-auto rounded-2xl shadow-2xl ring-1 ring-white/10"
              />
            </figure>
          )}

          {/* Article Content */}
          <div
            className="prose prose-invert prose-lg max-w-none
              prose-headings:text-white prose-headings:font-bold prose-headings:tracking-tight
              prose-h1:text-4xl prose-h1:mb-6 prose-h1:mt-12
              prose-h2:text-3xl prose-h2:mb-4 prose-h2:mt-10
              prose-h3:text-2xl prose-h3:mb-3 prose-h3:mt-8
              prose-p:text-white prose-p:leading-relaxed prose-p:mb-6
              prose-a:text-blue-400 prose-a:font-medium prose-a:no-underline hover:prose-a:underline hover:prose-a:text-blue-300
              prose-strong:text-white prose-strong:font-bold
              prose-em:text-white
              prose-ul:text-white prose-ul:list-disc prose-ul:pl-6 prose-ul:mb-6
              prose-ol:text-white prose-ol:list-decimal prose-ol:pl-6 prose-ol:mb-6
              prose-li:mb-2 prose-li:leading-relaxed
              prose-blockquote:border-l-4 prose-blockquote:border-blue-500/50
              prose-blockquote:pl-6 prose-blockquote:italic prose-blockquote:text-zinc-300 prose-blockquote:bg-zinc-900/50 prose-blockquote:py-4 prose-blockquote:rounded-r-lg
              prose-code:text-emerald-400 prose-code:bg-zinc-900 prose-code:px-2 prose-code:py-1 prose-code:rounded prose-code:font-mono prose-code:text-sm prose-code:before:content-none prose-code:after:content-none
              prose-pre:bg-zinc-950 prose-pre:border prose-pre:border-zinc-800 prose-pre:rounded-xl prose-pre:p-6 prose-pre:overflow-x-auto
              prose-img:rounded-xl prose-img:shadow-2xl prose-img:ring-1 prose-img:ring-white/10"
            dangerouslySetInnerHTML={{ __html: contentHTML }}
          />
        </article>

        {/* Article Footer */}
        <footer className="mt-16 pt-8 border-t border-zinc-800">
          <div className="flex items-center justify-between">
            <a
              href="/"
              className="inline-flex items-center gap-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors duration-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Home
            </a>
          </div>
        </footer>
      </main>
    </div>
  );
}
