"use client";

import Link from "next/link";
import { Bell } from "lucide-react";

type Props = {
  count: number;
};

export default function RecentAnnouncementsBubble({ count }: Props) {
  if (count === 0) return null;

  return (
    <Link
      href="/anakoinoseis"
      className="group fixed top-24 left-4 sm:left-6 z-50 flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 rounded-full bg-black/80 ring-1 ring-black hover:ring-white/25 backdrop-blur-2xl shadow-xl shadow-black/40 transition-all duration-200 hover:scale-105 active:scale-95"
      aria-label={`${count} νέες ανακοινώσεις`}
    >
      <div className="relative">
        <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-white group-hover:text-white/95 transition-colors" />
        {count > 0 && (
          <span className="absolute -top-1.5 -right-1.5 sm:-top-2 sm:-right-2 flex items-center justify-center min-w-[18px] sm:min-w-[20px] h-4 sm:h-5 px-1 sm:px-1.5 rounded-full bg-amber-500 text-white text-[10px] sm:text-xs font-bold">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </div>
      <span className="text-xs sm:text-sm font-medium text-white/90 group-hover:text-white transition-colors">
        Νέες Ανακοινώσεις
      </span>
    </Link>
  );
}
