// «Πρόσφατα Άρθρα» on /article/[slug]:
// same three cards (image, title, excerpt, date), drawn like the /articles cards.

import Link from 'next/link';
import { SURFACE, LINE, layers } from '@/app/lib/ui/flat';
import { formatInstant } from '@/app/lib/datetime';

interface Article {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  featured_image: string | null;
  published_at: string | null;
}

export default function RelatedArticles({ articles }: { articles: Article[] }) {
  if (!articles || articles.length === 0) return null;

  return (
    <section className={`mt-16 border-t pt-12 ${LINE}`}>
      <div className="mb-2 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.3em] text-[#fb923c]">
        <span className="h-[2px] w-8 bg-[#fb923c]" />
        Συνέχεια
      </div>
      <h2 className="mb-8 font-[var(--f-display)] text-2xl font-black italic tracking-[-0.01em] text-[#F3EFE6] md:text-3xl">
        Πρόσφατα Άρθρα
      </h2>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-6">
        {articles.map((article) => {
          const publishedDate = formatInstant(article.published_at, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          });

          return (
            <Link key={article.id} href={`/article/${article.slug}`} className="group block">
              <article
                className={`h-full ${SURFACE} overflow-hidden transition-all duration-500 hover:-translate-y-1`}
                style={{ boxShadow: layers('#3b82f6') }}
              >
                {article.featured_image ? (
                  <div className="aspect-video w-full overflow-hidden bg-neutral-900">
                    <img
                      src={article.featured_image}
                      alt={article.title}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                  </div>
                ) : (
                  <div className="flex aspect-video w-full items-center justify-center bg-gradient-to-br from-neutral-900 to-black">
                    <svg className="h-14 w-14 text-white/25" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
                      />
                    </svg>
                  </div>
                )}

                <div className="p-5">
                  <h3 className="mb-2 line-clamp-2 text-lg font-bold text-[#F3EFE6] transition-colors group-hover:text-blue-400">
                    {article.title}
                  </h3>
                  {article.excerpt && (
                    <p className="mb-3 line-clamp-2 text-sm text-[#F3EFE6]/65">{article.excerpt}</p>
                  )}
                  {publishedDate && (
                    <time
                      className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#F3EFE6]/45"
                      dateTime={article.published_at!}
                    >
                      {publishedDate}
                    </time>
                  )}
                </div>
              </article>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
