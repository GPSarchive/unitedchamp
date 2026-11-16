// The tournament's pages as one strip of tabs, the open one filled ivory. Each
// tab is a page of its own (its own address, cached on its own), so the
// browser's back button and a shared link both land on the tab that was open.
// The only thing done in the browser is knowing which one that is.
"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { LINE } from "@/app/lib/ui/flat";

export type Tab = {
  /** The page's folder under the tournament; null = the tournament's own address. */
  segment: string | null;
  label: string;
  href: string;
};

export default function Tabs({ tabs }: { tabs: Tab[] }) {
  const open = useSelectedLayoutSegment();
  return (
    // On a phone the tabs share the screen's width, so all of them show; only
    // if they cannot fit does the strip scroll sideways. The padding (taken
    // back by the margin) is room for the keyboard's outline.
    <nav
      aria-label="Ενότητες της διοργάνωσης"
      className="-mx-4 -my-1.5 overflow-x-auto px-4 py-1.5 [scrollbar-width:none] md:mx-0 md:px-1.5 md:-ml-1.5 [&::-webkit-scrollbar]:hidden"
    >
      <ul className="flex w-max min-w-full rounded-lg bg-[#F3EFE6]/[0.08] md:min-w-0">
        {tabs.map((tab, index) => {
          const current = tab.segment === open;
          return (
            <li key={tab.href} className={`flex-1 md:flex-none ${index > 0 ? `border-l ${LINE}` : ""}`}>
              <Link
                href={tab.href}
                // Stay where the reader is: the tabs do not jump back to the top of the page.
                scroll={false}
                aria-current={current ? "page" : undefined}
                className={`relative flex h-11 items-center justify-center whitespace-nowrap rounded-lg px-2 text-sm font-bold leading-tight transition-colors focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#fb923c] md:px-7 md:text-base ${
                  current
                    ? "bg-[#F3EFE6] text-[#0a0a14]"
                    : "text-[#F3EFE6]/75 hover:bg-[#F3EFE6]/[0.07] hover:text-[#F3EFE6]"
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
