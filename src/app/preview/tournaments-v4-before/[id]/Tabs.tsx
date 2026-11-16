// The tournament's pages as a row of tabs, drawn as the old page's bordered
// labels: the open one filled orange. Each tab is a page of its own (its own
// address, cached on its own), so the browser's back button and a shared link
// both land on the tab that was open. The only thing done in the browser is
// knowing which one that is.
"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { MONO } from "./tokens";

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
      <ul className="flex min-w-max gap-2">
        {tabs.map((tab) => {
          const current = tab.segment === open;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                // Stay where the reader is: the tabs do not jump back to the top of the page.
                scroll={false}
                aria-current={current ? "page" : undefined}
                className={`${MONO} flex h-11 items-center border-2 px-4 text-[12px] uppercase tracking-[0.2em] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#fb923c] md:px-5 ${
                  current
                    ? "border-[#fb923c] bg-[#fb923c] font-bold text-[#0a0a14]"
                    : "border-[#F3EFE6]/20 bg-[#0a0a14] text-[#F3EFE6]/80 hover:border-[#fb923c] hover:text-[#F3EFE6]"
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
