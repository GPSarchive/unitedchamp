// The tournament's pages as a row of tabs. Each tab is a page of its own (its
// own address, cached on its own), so the browser's back button and a shared
// link both land on the tab that was open. The only thing done in the browser
// is knowing which one that is.
"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";

export type Tab = {
  /** The page's folder under the tournament; null = the tournament's own address. */
  segment: string | null;
  label: string;
  href: string;
};

export default function Tabs({ tabs }: { tabs: Tab[] }) {
  const open = useSelectedLayoutSegment();
  return (
    // On a phone the row scrolls sideways, edge to edge.
    <nav
      aria-label="Ενότητες της διοργάνωσης"
      className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden"
    >
      <ul className="flex min-w-max gap-1 border-b border-[#F3EFE6]/15">
        {tabs.map((tab) => {
          const current = tab.segment === open;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                // Stay where the reader is: the tabs do not jump back to the top of the page.
                scroll={false}
                aria-current={current ? "page" : undefined}
                className={`-mb-px flex h-12 items-center border-b-[3px] px-3.5 text-[17px] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#fb923c] md:px-5 ${
                  current
                    ? "border-[#fb923c] font-bold text-[#F3EFE6]"
                    : "border-transparent text-[#F3EFE6]/65 hover:text-[#F3EFE6]"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
