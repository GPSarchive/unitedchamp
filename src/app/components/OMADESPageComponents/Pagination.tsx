// app/components/OMADESPageComponents/Pagination.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  search: string;
}

export default function Pagination({ currentPage, totalPages, search }: PaginationProps) {
  const pathname = usePathname();
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <nav className="mt-8 flex justify-center">
      <ul className="inline-flex items-center gap-2">
        {pages.map((p) => {
          const active = p === currentPage;
          return (
            <li key={p}>
              <Link
                href={`${pathname}?page=${p}${search ? `&search=${encodeURIComponent(search)}` : ''}`}
                className={[
                  "px-3 py-2 rounded-lg text-sm font-medium transition",
                  "ring-1 ring-inset ring-zinc-300/70 dark:ring-zinc-700/70",
                  active
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                    : "bg-white/70 hover:bg-white dark:bg-zinc-900/50 dark:hover:bg-zinc-900/70 text-zinc-900 dark:text-zinc-100"
                ].join(' ')}
                aria-current={active ? 'page' : undefined}
              >
                {p}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
