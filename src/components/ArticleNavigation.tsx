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
    <nav className="mt-12 pt-8 border-t border-neutral-200">
      <div className="flex items-center justify-between gap-4">
        {/* Previous Article */}
        {previousArticle ? (
          <Link
            href={`/article/${previousArticle.slug}`}
            className="group flex items-center gap-3 px-4 py-3 bg-white rounded-lg border border-neutral-200 hover:border-blue-500 hover:bg-blue-50 transition-all duration-500 flex-1 max-w-[calc(50%-0.5rem)] hover:scale-105 hover:shadow-[0_10px_40px_-15px_rgba(59,130,246,0.5)]"
          >
            <svg
              className="w-5 h-5 text-neutral-400 group-hover:text-neutral-900 transition-colors flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <div className="min-w-0">
              <div className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Προηγούμενο</div>
              <div className="text-sm text-neutral-900 font-medium truncate group-hover:text-blue-600 transition-colors">
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
            className="group flex items-center gap-3 px-4 py-3 bg-white rounded-lg border border-neutral-200 hover:border-blue-500 hover:bg-blue-50 transition-all duration-500 flex-1 max-w-[calc(50%-0.5rem)] justify-end text-right hover:scale-105 hover:shadow-[0_10px_40px_-15px_rgba(59,130,246,0.5)]"
          >
            <div className="min-w-0">
              <div className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Επόμενο</div>
              <div className="text-sm text-neutral-900 font-medium truncate group-hover:text-blue-600 transition-colors">
                {nextArticle.title}
              </div>
            </div>
            <svg
              className="w-5 h-5 text-neutral-400 group-hover:text-neutral-900 transition-colors flex-shrink-0"
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
