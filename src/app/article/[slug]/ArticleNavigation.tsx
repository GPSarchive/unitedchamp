// Previous / next article links on /article/[slug]:
// same two links, same labels, flat panels instead of white boxes.

import Link from 'next/link';
import { SURFACE, LINE, layer } from '@/app/lib/ui/flat';

interface Article {
  slug: string;
  title: string;
}

interface Props {
  previousArticle?: Article | null;
  nextArticle?: Article | null;
}

const CARD = `group flex flex-1 items-center gap-3 ${SURFACE} px-4 py-3 min-w-0 transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#181826]`;

const Arrow = ({ d }: { d: string }) => (
  <svg
    className="h-5 w-5 flex-shrink-0 text-[#F3EFE6]/40 transition-colors group-hover:text-[#fb923c]"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
  </svg>
);

const Label = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.25em] text-[#F3EFE6]/50">{children}</div>
);

const Title = ({ children }: { children: React.ReactNode }) => (
  <div className="truncate text-sm font-semibold text-[#F3EFE6] transition-colors group-hover:text-[#fb923c]">
    {children}
  </div>
);

export default function ArticleNavigation({ previousArticle, nextArticle }: Props) {
  if (!previousArticle && !nextArticle) return null;

  return (
    <nav className={`mt-14 border-t pt-8 ${LINE}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch sm:justify-between">
        {previousArticle ? (
          <Link
            href={`/article/${previousArticle.slug}`}
            className={`${CARD} sm:max-w-[calc(50%-0.5rem)]`}
            style={{ boxShadow: layer('#F3EFE6') }}
          >
            <Arrow d="M15 19l-7-7 7-7" />
            <div className="min-w-0">
              <Label>Προηγούμενο</Label>
              <Title>{previousArticle.title}</Title>
            </div>
          </Link>
        ) : (
          <div className="hidden flex-1 sm:block" />
        )}

        {nextArticle ? (
          <Link
            href={`/article/${nextArticle.slug}`}
            className={`${CARD} justify-end text-right sm:max-w-[calc(50%-0.5rem)]`}
            style={{ boxShadow: layer('#fb923c') }}
          >
            <div className="min-w-0">
              <Label>Επόμενο</Label>
              <Title>{nextArticle.title}</Title>
            </div>
            <Arrow d="M9 5l7 7-7 7" />
          </Link>
        ) : (
          <div className="hidden flex-1 sm:block" />
        )}
      </div>
    </nav>
  );
}
