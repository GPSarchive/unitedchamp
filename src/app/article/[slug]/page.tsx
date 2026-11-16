// /article/[slug] in the site's dark "flat layered" look.

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { generateHTML } from '@tiptap/html';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TiptapLink from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { Paragraph } from '@tiptap/extension-paragraph';
import { Fraunces, JetBrains_Mono, Figtree } from 'next/font/google';
import { createSupabaseRSCClient } from '@/app/lib/supabase/supabaseServer';
import { supabaseAdmin } from '@/app/lib/supabase/supabaseAdmin';
import { canEditContent } from '@/app/lib/supabase/apiAuth';
import { formatInstant } from '@/app/lib/datetime';
import { SURFACE, layers, LINE, CHIP_ORANGE } from '@/app/lib/ui/flat';
import ArticleNavigation from './ArticleNavigation';
import RelatedArticles from './RelatedArticles';
import styles from './article.module.css';

const fraunces = Fraunces({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '600', '700', '900'],
  style: ['normal', 'italic'],
  variable: '--f-display',
  display: 'swap',
});
const jetbrains = JetBrains_Mono({
  subsets: ['latin', 'greek'],
  weight: ['400', '500', '700'],
  variable: '--f-mono',
  display: 'swap',
});
const figtree = Figtree({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
  variable: '--f-body',
  display: 'swap',
});

type PageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamic = 'force-dynamic';

// Articles are read with the service role: the anon key has no table access
// (migrations/lock-anon-reads.sql), so the "published only" rule is enforced
// HERE. Keep the status checks.
async function getArticle(slug: string) {
  const { data, error } = await supabaseAdmin
    .from('articles')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (error || !data) return null;

  if (data.status !== 'published') {
    const supabase = await createSupabaseRSCClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!canEditContent(user)) return null;
  }

  return data;
}

// First image anywhere in a TipTap doc (the same idea as /articles' cards).
function firstImage(node: any): string | null {
  if (!node || typeof node !== 'object') return null;
  if (node.type === 'image' && typeof node.attrs?.src === 'string') return node.attrs.src;
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      const src = firstImage(child);
      if (src) return src;
    }
  }
  return null;
}

// The articles table has no `featured_image` column (selecting it made this
// query fail, so «Πρόσφατα Άρθρα» never rendered). Each card takes the first
// image in its article body, like the /articles cards.
async function getRelatedArticles(currentArticleDate: string, limit = 3) {
  const { data, error } = await supabaseAdmin
    .from('articles')
    .select('id, title, slug, excerpt, content, published_at')
    .eq('status', 'published')
    .lt('published_at', currentArticleDate)
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching related articles:', error);
    return [];
  }
  return (data || []).map(({ content, ...a }) => ({ ...a, featured_image: firstImage(content) }));
}

async function getAdjacentArticles(currentArticleDate: string) {
  const [{ data: previousArticle }, { data: nextArticle }] = await Promise.all([
    supabaseAdmin
      .from('articles')
      .select('slug, title')
      .eq('status', 'published')
      .lt('published_at', currentArticleDate)
      .order('published_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from('articles')
      .select('slug, title')
      .eq('status', 'published')
      .gt('published_at', currentArticleDate)
      .order('published_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);
  return { previousArticle, nextArticle };
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) return { title: 'Article Not Found' };
  return {
    title: article.title,
    description: article.excerpt || `Read ${article.title}`,
  };
}

// The page ground used across the site (tournaments, standings, …).
const Atmosphere = () => (
  <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
    <div
      className="absolute inset-0"
      style={{
        background:
          'radial-gradient(ellipse at 20% 0%, #1a1a2e 0%, #0a0a14 45%, #08080f 100%)',
      }}
    />
    <div
      className="absolute -top-40 -left-40 h-[60rem] w-[60rem] rounded-full opacity-[0.16] blur-3xl"
      style={{ background: 'radial-gradient(closest-side, #fb923c 0%, rgba(251,146,60,0) 70%)' }}
    />
    <div
      className="absolute -bottom-60 -right-40 h-[55rem] w-[55rem] rounded-full opacity-[0.12] blur-3xl"
      style={{ background: 'radial-gradient(closest-side, #a855f7 0%, rgba(168,85,247,0) 70%)' }}
    />
    <svg className="absolute inset-0 h-full w-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="agrid" width="48" height="48" patternUnits="userSpaceOnUse">
          <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#F3EFE6" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#agrid)" />
    </svg>
  </div>
);

const BackLink = () => (
  <Link
    href="/articles"
    className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[#F3EFE6]/60 hover:text-[#fb923c] transition-colors"
  >
    <span aria-hidden>←</span> Πίσω στα Άρθρα
  </Link>
);

export default async function ArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) notFound();

  const [relatedArticles, { previousArticle, nextArticle }] = article.published_at
    ? await Promise.all([
        getRelatedArticles(article.published_at),
        getAdjacentArticles(article.published_at),
      ])
    : [[], { previousArticle: null, nextArticle: null }];

  const contentHTML = article.content
    ? generateHTML(article.content, [
        StarterKit.configure({
          paragraph: false,
          hardBreak: { keepMarks: true },
        }),
        Paragraph.extend({
          renderHTML({ node, HTMLAttributes }) {
            // Empty paragraphs are the editors' way of adding space: keep their height.
            const isEmpty = !node.textContent || node.textContent.trim() === '';
            return ['p', { ...HTMLAttributes, class: isEmpty ? 'min-h-[24px]' : undefined }, 0];
          },
        }),
        Underline,
        TiptapLink.configure({ openOnClick: true }),
        Image,
      ])
    : '';

  const publishedDate = formatInstant(article.published_at, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div
      className={`${fraunces.variable} ${jetbrains.variable} ${figtree.variable} relative min-h-screen text-[#F3EFE6] font-[var(--f-body)] selection:bg-[#fb923c] selection:text-[#0a0a14]`}
    >
      <Atmosphere />

      {/* Header with back navigation */}
      <div className={`border-b ${LINE}`}>
        <div className="mx-auto max-w-4xl px-4 py-4">
          <BackLink />
        </div>
      </div>

      <article className="mx-auto max-w-4xl px-4 py-8 md:py-12">
        {/* Status badge for drafts (admin only) */}
        {article.status !== 'published' && (
          <div
            className={`mb-6 inline-flex items-center gap-2 ${CHIP_ORANGE} px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.25em] text-[#fb923c]`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#fb923c]" />
            Πρόχειρο · Προεπισκόπηση
          </div>
        )}

        {/* Content panel */}
        <div className={`${SURFACE} overflow-hidden`} style={{ boxShadow: layers('#fb923c') }}>
          {/* Featured image */}
          {article.featured_image && (
            <div className="relative w-full bg-black/40">
              <img
                src={article.featured_image}
                alt={article.title}
                className="w-full h-auto max-h-[500px] object-cover"
              />
              {/* fade the photo into the panel */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#12121e] to-transparent"
              />
            </div>
          )}

          <div className="px-5 py-8 sm:px-8 md:px-12 md:py-10">
            {/* Article header */}
            <header className={`mb-8 border-b pb-8 ${LINE}`}>
              <div className="mb-4 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.3em] text-[#fb923c]">
                <span className="h-[2px] w-8 bg-[#fb923c]" />
                Άρθρο
              </div>

              <h1
                className="mb-4 font-[var(--f-display)] font-black italic leading-[1.05] tracking-[-0.02em] text-[#F3EFE6]"
                style={{ fontSize: 'clamp(2rem, 5vw, 3.25rem)' }}
              >
                {article.title}
              </h1>

              {article.excerpt && (
                <p className="mb-6 text-lg leading-relaxed text-[#F3EFE6]/70 md:text-xl">
                  {article.excerpt}
                </p>
              )}

              {publishedDate && (
                <div className="flex flex-wrap items-center gap-4 font-mono text-[11px] uppercase tracking-[0.2em] text-[#F3EFE6]/55">
                  <time dateTime={article.published_at!}>{publishedDate}</time>
                </div>
              )}
            </header>

            {/* Article content */}
            <div className={styles.body} dangerouslySetInnerHTML={{ __html: contentHTML }} />
          </div>
        </div>

        {/* Previous / next */}
        <ArticleNavigation previousArticle={previousArticle} nextArticle={nextArticle} />

        {/* Related articles */}
        <RelatedArticles articles={relatedArticles} />

        {/* Footer */}
        <footer className={`mt-12 border-t pt-8 ${LINE}`}>
          <BackLink />
        </footer>
      </article>
    </div>
  );
}
