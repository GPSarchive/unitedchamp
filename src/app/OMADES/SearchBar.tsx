// app/components/OMADESPageComponents/SearchBar.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface SearchBarProps {
  initialSearch: string;
}

export default function SearchBar({ initialSearch }: SearchBarProps) {
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      const params = new URLSearchParams();
      if (searchTerm) {
        params.set('search', searchTerm);
      }
      params.set('page', '1');
      router.push(`${pathname}?${params.toString()}`);
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, router, pathname]);

  return (
    <div className="mb-6">
      <input
      type="text"
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      placeholder="Search teams..."
      className="w-full p-3 rounded-lg bg-neutral-900 text-white placeholder-gray-400 
                border border-neutral-700 focus:outline-none focus:ring-2 
                focus:ring-white/70 focus:border-white/70 transition-all duration-300"
    />
    </div>
  );
}