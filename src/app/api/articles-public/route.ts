import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/app/lib/supabase/supabaseAdmin';

// Public list of PUBLISHED articles. Read with the service role: the anon key
// has no table access (migrations/lock-anon-reads.sql), so the
// status = 'published' filters below are what keep drafts private.
export async function GET() {
  try {
    // First, try to fetch with all columns including view_count and featured_image
    let { data: articles, error } = await supabase
      .from('articles')
      .select('id, title, slug, content, excerpt, featured_image, published_at, view_count')
      .eq('status', 'published')
      .order('published_at', { ascending: false });

    // If we get an error about missing columns, try again without those columns
    if (error && error.message?.includes('column')) {
      console.log('Trying without optional columns (view_count, featured_image)...');
      const fallbackResult = await supabase
        .from('articles')
        .select('id, title, slug, content, excerpt, published_at, status, created_at')
        .eq('status', 'published')
        .order('published_at', { ascending: false });

      error = fallbackResult.error;

      // Add missing fields with default values
      if (fallbackResult.data) {
        articles = fallbackResult.data.map(article => ({
          ...article,
          featured_image: null,
          view_count: 0,
        }));
      } else {
        articles = null;
      }
    }

    if (error) {
      console.error('Error fetching articles:', error);
      return NextResponse.json({ error: error.message, articles: [] }, { status: 500 });
    }

    console.log(`Successfully fetched ${articles?.length || 0} articles`);
    return NextResponse.json({ articles: articles || [] });
  } catch (error: any) {
    console.error('Error in articles-public API:', error);
    return NextResponse.json({ error: error.message, articles: [] }, { status: 500 });
  }
}
