'use client';

import { useEffect } from 'react';
import { createSupabaseBrowserClient } from '@/app/lib/supabase/supabaseBrowser';

export default function ViewTracker({ articleId }: { articleId: number }) {
  useEffect(() => {
    const incrementViewCount = async () => {
      const supabase = createSupabaseBrowserClient();

      // Increment view count
      await supabase.rpc('increment_article_views', { article_id: articleId });
    };

    incrementViewCount();
  }, [articleId]);

  return null;
}
