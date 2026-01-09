import Link from 'next/link';

interface Article {
  slug: string;
  title: string;
}

interface ArticleNavigationProps {
  previousArticle?: Article | null;
  nextArticle?: Article | null;
}

export default function ArticleNavigation({ previousArticle, nextArticle }: ArticleNavigationProps) {
  if (!previousArticle && !nextArticle) {
    return null;
  }

  return (
    <nav className="mt-12 pt-8 border-t border-slate-700/50">
      <div className="flex items-center justify-between gap-4">
        {/* Previous Article */}
        {previousArticle ? (
          <Link
            href={`/article/${previousArticle.slug}`}
            className="group flex items-center gap-3 px-4 py-3 bg-slate-800/40 rounded-lg border border-slate-700/50 hover:border-slate-500 hover:bg-slate-800/60 transition-all duration-300 flex-1 max-w-[calc(50%-0.5rem)]"
          >
            <svg
              className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <div className="min-w-0">
              <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Προηγούμενο</div>
              <div className="text-sm text-white font-medium truncate group-hover:text-blue-400 transition-colors">
                {previousArticle.title}
              </div>
            </div>
          </Link>
        ) : (
          <div className="flex-1"></div>
        )}

        {/* Next Article */}
        {nextArticle ? (
          <Link
            href={`/article/${nextArticle.slug}`}
            className="group flex items-center gap-3 px-4 py-3 bg-slate-800/40 rounded-lg border border-slate-700/50 hover:border-slate-500 hover:bg-slate-800/60 transition-all duration-300 flex-1 max-w-[calc(50%-0.5rem)] justify-end text-right"
          >
            <div className="min-w-0">
              <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Επόμενο</div>
              <div className="text-sm text-white font-medium truncate group-hover:text-blue-400 transition-colors">
                {nextArticle.title}
              </div>
            </div>
            <svg
              className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        ) : (
          <div className="flex-1"></div>
        )}
      </div>
    </nav>
  );
}
