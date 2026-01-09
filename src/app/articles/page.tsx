import { createSupabaseRSCClient } from '@/app/lib/supabase/supabaseServer';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { el } from 'date-fns/locale';

export const dynamic = 'force-dynamic';

async function getPublishedArticles() {
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

function formatReadTime(content: any): string {
  if (!content) return '1 λεπτό ανάγνωσης';

  // Estimate read time based on word count (average reading speed: 200 words/min)
  const text = JSON.stringify(content);
  const wordCount = text.split(/\s+/).length;
  const minutes = Math.ceil(wordCount / 200);

  return minutes === 1 ? '1 λεπτό ανάγνωσης' : `${minutes} λεπτά ανάγνωσης`;
}

export default async function ArticlesPage() {
  const articles = await getPublishedArticles();

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-black to-zinc-900">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-black/30 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">
            Ανακοινώσεις & Άρθρα
          </h1>
          <p className="text-zinc-400 text-lg">
            Νέα, ανακοινώσεις, αναφορές αγώνων και επιτεύγματα της ομάδας
          </p>
        </div>
      </header>

      {/* Articles Grid */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        {articles.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-zinc-400 text-lg">Δεν υπάρχουν διαθέσιμες ανακοινώσεις</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {articles.map((article) => {
              const publishedDate = article.published_at
                ? new Date(article.published_at)
                : new Date(article.created_at);

              const timeAgo = formatDistanceToNow(publishedDate, {
                addSuffix: true,
                locale: el,
              });

              return (
                <Link
                  key={article.id}
                  href={`/article/${article.slug}`}
                  className="group"
                >
                  <article className="h-full bg-white rounded-2xl shadow-xl border border-zinc-200 overflow-hidden hover:shadow-2xl hover:scale-[1.02] transition-all duration-300">
                    {/* Featured Image */}
                    {article.featured_image && (
                      <div className="aspect-video overflow-hidden bg-zinc-100">
                        <img
                          src={article.featured_image}
                          alt={article.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    )}

                    {/* Content */}
                    <div className="p-6">
                      {/* Meta Info */}
                      <div className="flex items-center gap-4 mb-3 text-sm text-zinc-500">
                        <time dateTime={article.published_at || article.created_at}>
                          {timeAgo}
                        </time>
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          {article.view_count || 0}
                        </span>
                      </div>

                      {/* Title */}
                      <h2 className="text-xl font-bold text-zinc-900 mb-3 line-clamp-2 group-hover:text-blue-600 transition-colors">
                        {article.title}
                      </h2>

                      {/* Excerpt */}
                      {article.excerpt && (
                        <p className="text-zinc-600 line-clamp-3 mb-4">
                          {article.excerpt}
                        </p>
                      )}

                      {/* Read More */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-blue-600 group-hover:text-blue-700">
                          Διαβάστε περισσότερα →
                        </span>
                        <span className="text-xs text-zinc-400">
                          {formatReadTime(article.content)}
                        </span>
                      </div>
                    </div>
                  </article>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
