import { createSupabaseRSCClient } from '@/app/lib/supabase/supabaseServer';
import { calculateReadTime, formatViewCount, formatReadTime } from '@/lib/articleUtils';
import Link from 'next/link';

export const metadata = {
  title: 'Άρθρα | United Champ',
  description: 'Διαβάστε τα τελευταία άρθρα και ενημερώσεις',
};

async function getArticles() {
  const supabase = await createSupabaseRSCClient();

  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('status', 'published')
    .order('published_at', { ascending: false });

  if (error) {
    console.error('Error fetching articles:', error);
    return [];
  }

  return data || [];
}

export default async function ArticlesPage() {
  const articles = await getArticles();

  return (
    <div className="min-h-screen bg-black">
      {/* Hero Section */}
      <div className="border-b border-neutral-800 bg-neutral-950/90 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-16">
          <div className="text-center animate-fade-in">
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">
              Άρθρα
            </h1>
            <p className="text-xl text-white max-w-2xl mx-auto">
              Διαβάστε τα τελευταία νέα, αναλύσεις αγώνων και ενημερώσεις
            </p>
          </div>
        </div>
      </div>

      {/* Articles Grid */}
      <div className="max-w-7xl mx-auto px-4 py-16">
        {articles.length === 0 ? (
          <div className="text-center py-20">
            <div className="inline-block p-6 rounded-full bg-neutral-900 mb-6">
              <svg
                className="w-16 h-16 text-neutral-500"
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
            <h2 className="text-2xl font-bold text-white mb-2">Δεν υπάρχουν άρθρα</h2>
            <p className="text-neutral-400">Τα άρθρα θα εμφανιστούν εδώ μόλις δημοσιευτούν</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {articles.map((article, index) => {
              const publishedDate = article.published_at
                ? new Date(article.published_at).toLocaleDateString('el-GR', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })
                : null;

              const readTime = calculateReadTime(article.content);
              const viewCount = article.view_count || 0;

              return (
                <Link
                  key={article.id}
                  href={`/article/${article.slug}`}
                  className="group block animate-slide-up"
                  style={{
                    animationDelay: `${index * 0.1}s`,
                    opacity: 0,
                    animationFillMode: 'forwards',
                  }}
                >
                  <article className="h-full bg-neutral-950 rounded-xl overflow-hidden border border-neutral-800 hover:border-neutral-600 transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl hover:shadow-blue-500/20">
                    {/* Article Image */}
                    {article.featured_image ? (
                      <div className="aspect-video w-full overflow-hidden bg-neutral-900">
                        <img
                          src={article.featured_image}
                          alt={article.title}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                      </div>
                    ) : (
                      <div className="aspect-video w-full bg-gradient-to-br from-neutral-900 to-neutral-950 flex items-center justify-center">
                        <svg
                          className="w-20 h-20 text-neutral-700 transition-transform duration-500 group-hover:scale-110"
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
                    <div className="p-6">
                      {/* Metadata */}
                      <div className="flex items-center gap-3 mb-4 text-xs text-neutral-500">
                        {publishedDate && (
                          <time className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {publishedDate}
                          </time>
                        )}

                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {formatReadTime(readTime)}
                        </span>

                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          {formatViewCount(viewCount)}
                        </span>
                      </div>

                      {/* Title */}
                      <h2 className="text-2xl font-bold text-white mb-3 line-clamp-2 group-hover:text-blue-400 transition-colors duration-300">
                        {article.title}
                      </h2>

                      {/* Excerpt */}
                      {article.excerpt && (
                        <p className="text-white mb-4 line-clamp-3 leading-relaxed">
                          {article.excerpt}
                        </p>
                      )}

                      {/* Read More */}
                      <div className="flex items-center gap-2 text-blue-400 font-medium group-hover:gap-3 group-hover:text-blue-300 transition-all duration-300">
                        <span>Διαβάστε περισσότερα</span>
                        <svg
                          className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                      </div>
                    </div>
                  </article>
                </Link>
              );
            })}
          </div>
        )}

        {/* Article Count */}
        {articles.length > 0 && (
          <div className="text-center mt-16 animate-fade-in" style={{ animationDelay: '0.5s' }}>
            <p className="text-neutral-500">
              Εμφάνιση {articles.length} {articles.length === 1 ? 'άρθρου' : 'άρθρων'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
