"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

interface SearchBarProps {
  initialSearch: string;
}

export default function SearchBar({ initialSearch }: SearchBarProps) {
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams();
      if (searchTerm) params.set("search", searchTerm);
      params.set("page", "1");
      router.push(`${pathname}?${params.toString()}`);
    }, 300);
    return () => clearTimeout(t);
  }, [searchTerm, router, pathname]);

  return (
    <div className="relative w-full max-w-md">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[10px] uppercase tracking-[0.3em] text-[#F3EFE6]/40 pointer-events-none">
        AΝΑΖ·
      </span>
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Αναζήτηση ομάδας..."
        className="w-full border-2 border-[#F3EFE6]/20 bg-[#0a0a14] pl-16 pr-4 py-3 font-[var(--f-body)] text-sm text-[#F3EFE6] placeholder:text-[#F3EFE6]/30 focus:border-[#fb923c] focus:outline-none transition-colors"
      />
    </div>
  );
}
