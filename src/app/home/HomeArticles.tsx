import Link from 'next/link';
import { supabaseAdmin } from '@/app/lib/supabase/supabaseAdmin';

type Article = {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  featured_image: string | null;
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

export default async function HomeArticles() {
  const { data: articles } = await supabaseAdmin
    .from('articles')
    .select('id, title, slug, excerpt, featured_image, published_at, content')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(4);

  if (!articles || articles.length === 0) return null;

  return (
    <section className="py-12 sm:py-16 bg-zinc-950 text-white">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Section header */}
        <div className="flex items-center justify-between mb-8 sm:mb-10">
          <h2 className="text-2xl sm:text-4xl font-bold text-white">Άρθρα</h2>
          <Link
            href="/articles"
            className="hidden sm:flex items-center gap-2 text-orange-400 hover:text-orange-300 font-medium transition-colors duration-200"
          >
            Δείτε περισσότερα
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>

        {/* 4-column grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {articles.map((article: Article) => {
            const image = article.featured_image || extractFirstImage(article.content);
            const publishedDate = new Date(article.published_at).toLocaleDateString('el-GR', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            });

            return (
              <Link key={article.id} href={`/article/${article.slug}`} className="group block">
                <article className="h-full flex flex-col bg-black/80 ring-1 ring-black hover:ring-white/25 backdrop-blur-2xl shadow-xl shadow-black/40 rounded-2xl overflow-hidden transition-all duration-500 hover:scale-[1.02] hover:shadow-[0_20px_60px_-15px_rgba(249,115,22,0.4)]">
                  {/* Image */}
                  {image ? (
                    <div className="aspect-video w-full overflow-hidden bg-neutral-900">
                      <img
                        src={image}
                        alt={article.title}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                    </div>
                  ) : (
                    <div className="aspect-video w-full bg-gradient-to-br from-neutral-900 to-black flex items-center justify-center">
                      <svg
                        className="w-12 h-12 text-white/20 transition-transform duration-500 group-hover:scale-110"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
                        />
                      </svg>
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex flex-col flex-1 p-4">
                    <p className="text-xs text-white/50 mb-2 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <time dateTime={article.published_at}>{publishedDate}</time>
                    </p>

                    <h3 className="text-base font-semibold text-white line-clamp-2 group-hover:text-orange-400 transition-colors duration-300 leading-snug mb-2">
                      {article.title}
                    </h3>

                    {article.excerpt && (
                      <p className="text-sm text-white/60 line-clamp-2 leading-relaxed flex-1">
                        {article.excerpt}
                      </p>
                    )}

                    <div className="mt-3 flex items-center gap-1 text-orange-400 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <span>Διαβάστε περισσότερα</span>
                      <svg className="w-3 h-3 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </article>
              </Link>
            );
          })}
        </div>

        {/* Mobile "See more" link */}
        <div className="mt-8 text-center sm:hidden">
          <Link
            href="/articles"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-black/80 ring-1 ring-white/20 text-orange-400 hover:text-orange-300 hover:ring-orange-400/40 font-medium transition-all duration-200"
          >
            Δείτε περισσότερα
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
