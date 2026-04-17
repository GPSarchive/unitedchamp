"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  search: string;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

export default function Pagination({
  currentPage,
  totalPages,
  search,
}: PaginationProps) {
  const pathname = usePathname();
  if (totalPages <= 1) return null;

  // Build a compact window of page numbers around the current page.
  const windowSize = 2;
  const pages: (number | "…")[] = [];
  for (let p = 1; p <= totalPages; p++) {
    if (
      p === 1 ||
      p === totalPages ||
      (p >= currentPage - windowSize && p <= currentPage + windowSize)
    ) {
      pages.push(p);
    } else if (pages[pages.length - 1] !== "…") {
      pages.push("…");
    }
  }

  const href = (p: number) =>
    `${pathname}?page=${p}${
      search ? `&search=${encodeURIComponent(search)}` : ""
    }`;

  const prev = Math.max(1, currentPage - 1);
  const next = Math.min(totalPages, currentPage + 1);

  return (
    <nav className="mt-10 flex items-center justify-between gap-3 border-t-2 border-[#F3EFE6]/15 pt-5">
      <Link
        href={href(prev)}
        aria-disabled={currentPage <= 1}
        tabIndex={currentPage <= 1 ? -1 : 0}
        className={`border-2 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.22em] transition-colors ${
          currentPage <= 1
            ? "border-[#F3EFE6]/10 text-[#F3EFE6]/25 pointer-events-none"
            : "border-[#F3EFE6]/20 bg-[#13131d] text-[#F3EFE6]/75 hover:border-[#fb923c] hover:text-[#fb923c]"
        }`}
      >
        ← Προηγ.
      </Link>

      <ul className="flex items-center gap-1.5">
        {pages.map((p, i) =>
          p === "…" ? (
            <li
              key={`dot-${i}`}
              className="font-mono text-[10px] tracking-[0.2em] text-[#F3EFE6]/35"
            >
              …
            </li>
          ) : (
            <li key={p}>
              <Link
                href={href(p)}
                aria-current={p === currentPage ? "page" : undefined}
                className={`border-2 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tabular-nums transition-colors ${
                  p === currentPage
                    ? "border-[#fb923c] bg-[#fb923c] text-[#0a0a14]"
                    : "border-[#F3EFE6]/20 bg-[#13131d] text-[#F3EFE6]/75 hover:border-[#F3EFE6]/50 hover:text-[#F3EFE6]"
                }`}
              >
                {pad2(p)}
              </Link>
            </li>
          )
        )}
      </ul>

      <Link
        href={href(next)}
        aria-disabled={currentPage >= totalPages}
        tabIndex={currentPage >= totalPages ? -1 : 0}
        className={`border-2 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.22em] transition-colors ${
          currentPage >= totalPages
            ? "border-[#F3EFE6]/10 text-[#F3EFE6]/25 pointer-events-none"
            : "border-[#F3EFE6]/20 bg-[#13131d] text-[#F3EFE6]/75 hover:border-[#fb923c] hover:text-[#fb923c]"
        }`}
      >
        Επόμ. →
      </Link>
    </nav>
  );
}
