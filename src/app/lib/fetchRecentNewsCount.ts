import { cache } from 'react';
import { supabaseAdmin } from '@/app/lib/supabase/supabaseAdmin';

export const fetchRecentNewsCount = cache(async (): Promise<number> => {
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  const twoDaysAgoISO = twoDaysAgo.toISOString();

  const [{ count: announcementsCount }, { count: articlesCount }] = await Promise.all([
    supabaseAdmin
      .from('announcements')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'published')
      .gte('created_at', twoDaysAgoISO),
    supabaseAdmin
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'published')
      .gte('published_at', twoDaysAgoISO),
  ]);

  return (announcementsCount ?? 0) + (articlesCount ?? 0);
});
