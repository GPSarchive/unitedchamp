import Image from 'next/image';
import Link from 'next/link';
import { supabaseAdmin } from '@/app/lib/supabase/supabaseAdmin';

type Article = {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  published_at: string;
  content: any;
};

function extractFirstImage(content: any): string | null {
  if (!content) return null;
  try {
    if (content.content && Array.isArray(content.content)) {
      for (const node of content.content) {
        if (node.type === 'image' && node.attrs?.src) return node.attrs.src;
        if (node.content && Array.isArray(node.content)) {
          for (const child of node.content) {
            if (child.type === 'image' && child.attrs?.src) return child.attrs.src;
          }
        }
      }
    }
  } catch {}
  return null;
}

const ArticleIcon = () => (
  <svg className="w-8 h-8 sm:w-12 sm:h-12 text-white/15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
      d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
    />
  </svg>
);

export default async function HomeArticles() {
  const { data: articles, error } = await supabaseAdmin
    .from('articles')
    .select('id, title, slug, content, excerpt, published_at')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(4);

  if (error) {
    console.error('HomeArticles fetch error:', error.message);
    return null;
  }

  if (!articles || articles.length === 0) return null;

  return (
    <section className="relative py-20 sm:py-32 overflow-hidden">
      {/* Ambient warm glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
        <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-amber-400/15 blur-[160px]" />
        <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] bg-yellow-500/10 blur-[160px]" />
      </div>

      <div className="container mx-auto px-4 relative z-10 max-w-7xl">

        {/* ── Section title ─────────────────────────────────── */}
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-4xl sm:text-6xl font-bold text-white mb-4 tracking-tight">
            ΑΡΘΡΑ
          </h2>
          <div className="w-32 h-1 bg-gradient-to-r from-transparent via-orange-500 to-transparent mx-auto" />
          <p className="mt-5 text-base sm:text-lg text-white font-light">
            Τελευταία νέα και αναλύσεις αγώνων
          </p>
        </div>

        {/* ── 4-col grid ────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-2 sm:gap-5 lg:gap-6">
          {(articles as Article[]).map((article, index) => {
            const image = extractFirstImage(article.content);
            const publishedDate = new Date(article.published_at).toLocaleDateString('el-GR', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            });

            return (
              <Link
                key={article.id}
                href={`/article/${article.slug}`}
                className="group block"
              >
                <article className="relative h-full flex flex-col bg-gradient-to-b from-neutral-900 to-black border-2 border-white/10 overflow-hidden transition-all duration-500 group-hover:border-orange-500/50 group-hover:shadow-[0_0_40px_rgba(249,115,22,0.3)]">

                  {/* ── Image ───────────────────────────────── */}
                  <div className="relative overflow-hidden aspect-video flex-shrink-0">
                    {image ? (
                      <Image
                        src={image}
                        alt={article.title}
                        fill
                        className="object-cover transition-transform duration-700 group-hover:scale-110"
                        sizes="(max-width: 768px) 100vw, 50vw"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-neutral-800 to-black flex items-center justify-center transition-transform duration-500 group-hover:scale-110">
                        <ArticleIcon />
                      </div>
                    )}

                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />

                    {/* Index counter badge */}
                    <div className="absolute top-1.5 left-1.5 sm:top-3 sm:left-3 font-mono text-[10px] sm:text-xs font-bold text-orange-400 bg-black/70 backdrop-blur-sm px-1.5 py-0.5 sm:px-2 sm:py-1 tracking-widest">
                      {String(index + 1).padStart(2, '0')}
                    </div>

                  </div>

                  {/* ── Card body — desktop only ─────────────── */}
                  <div className="flex flex-col flex-1 p-3 sm:p-4 lg:p-5">
                    {/* Date */}
                    <p className="text-[11px] text-gray-500 mb-2 flex items-center gap-1 uppercase tracking-wider">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <time dateTime={article.published_at}>{publishedDate}</time>
                    </p>

                    {/* Title */}
                    <h3 className="text-sm lg:text-base font-bold text-white line-clamp-2 group-hover:text-orange-400 transition-colors duration-300 leading-snug mb-2 flex-1">
                      {article.title}
                    </h3>

                    {/* Excerpt */}
                    {article.excerpt && (
                      <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed mb-3">
                        {article.excerpt}
                      </p>
                    )}

                    {/* Read more */}
                    <div className="flex items-center gap-1.5 text-orange-400 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300 mt-auto">
                      <span>Διαβάστε περισσότερα</span>
                      <svg className="w-3 h-3 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>

                  {/* ── Corner bracket accents (hover) ───────── */}
                  <div className="absolute top-0 left-0 w-6 h-6 sm:w-8 sm:h-8 border-t-2 border-l-2 border-orange-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                  <div className="absolute bottom-0 right-0 w-6 h-6 sm:w-8 sm:h-8 border-b-2 border-r-2 border-orange-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                </article>
              </Link>
            );
          })}
        </div>

        {/* ── CTA ───────────────────────────────────────────── */}
        <div className="mt-10 sm:mt-16 text-center">
          <Link
            href="/articles"
            className="inline-flex items-center gap-3 px-7 sm:px-10 py-3.5 sm:py-4 border-2 border-white/50 text-white hover:bg-white/10 hover:border-white transition-all duration-300 font-medium tracking-widest text-sm uppercase"
          >
            Δείτε Περισσότερα
            <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>

      </div>
    </section>
  );
}
