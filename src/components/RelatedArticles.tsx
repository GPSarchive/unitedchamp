import Link from 'next/link';

interface Article {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  featured_image: string | null;
  published_at: string | null;
}

interface RelatedArticlesProps {
  articles: Article[];
}

export default function RelatedArticles({ articles }: RelatedArticlesProps) {
  if (!articles || articles.length === 0) {
    return null;
  }

  return (
    <div className="mt-16 pt-12 border-t border-neutral-800">
      <h2 className="text-2xl font-bold text-white mb-8">Πρόσφατα Άρθρα</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {articles.map((article) => {
          const publishedDate = article.published_at
            ? new Date(article.published_at).toLocaleDateString('el-GR', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })
            : null;

          return (
            <Link
              key={article.id}
              href={`/article/${article.slug}`}
              className="group block bg-neutral-950 rounded-lg overflow-hidden border border-neutral-800 hover:border-blue-500 transition-all duration-500 hover:scale-[1.08] hover:shadow-[0_20px_60px_-15px_rgba(59,130,246,0.5)] hover:-translate-y-2"
            >
              {/* Article Image */}
              {article.featured_image ? (
                <div className="aspect-video w-full overflow-hidden bg-neutral-900">
                  <img
                    src={article.featured_image}
                    alt={article.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-125"
                  />
                </div>
              ) : (
                <div className="aspect-video w-full bg-gradient-to-br from-neutral-900 to-neutral-950 flex items-center justify-center">
                  <svg
                    className="w-16 h-16 text-neutral-700"
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

              {/* Article Content */}
              <div className="p-5">
                <h3 className="text-lg font-bold text-white mb-2 line-clamp-2 group-hover:text-blue-400 transition-colors">
                  {article.title}
                </h3>

                {article.excerpt && (
                  <p className="text-sm text-[#ffffff] mb-3 line-clamp-2">
                    {article.excerpt}
                  </p>
                )}

                {publishedDate && (
                  <time className="text-xs text-neutral-500" dateTime={article.published_at!}>
                    {publishedDate}
                  </time>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
