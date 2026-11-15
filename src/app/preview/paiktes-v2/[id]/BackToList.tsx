"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PAIKTES_BASE_PATH, PAIKTES_VIEW_KEY, type SavedListView } from "../paths";

/**
 * Link back to the directory. If the visitor came from the list, it carries
 * the filters they had, so the list reopens on the same row; a visitor who
 * landed here directly gets the plain list.
 */
export default function BackToList() {
  const [href, setHref] = useState(PAIKTES_BASE_PATH);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(PAIKTES_VIEW_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as SavedListView;
      if (saved.search) setHref(`${PAIKTES_BASE_PATH}?${saved.search}`);
    } catch {
      // Storage unavailable: the plain list is the right fallback.
    }
  }, []);

  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 text-[15px] text-[#F3EFE6]/75 underline decoration-[#F3EFE6]/30 underline-offset-4 hover:text-[#fb923c] hover:decoration-[#fb923c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#fb923c]"
    >
      <svg aria-hidden viewBox="0 0 10 10" className="h-2.5 w-2.5">
        <path d="M6 1L2 5l4 4" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      Όλοι οι παίκτες
    </Link>
  );
}
