'use client';

import { useEffect } from 'react';

interface ArticleViewCounterProps {
  slug: string;
}

export default function ArticleViewCounter({ slug }: ArticleViewCounterProps) {
  useEffect(() => {
    // Increment view count when component mounts
    const incrementView = async () => {
      try {
        await fetch(`/api/articles/slug/${slug}/view`, {
          method: 'POST',
        });
      } catch (error) {
        console.error('Failed to increment view count:', error);
      }
    };

    incrementView();
  }, [slug]);

  // This component doesn't render anything
  return null;
}
