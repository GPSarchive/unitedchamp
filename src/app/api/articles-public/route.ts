import { NextResponse } from 'next/server';
import { createSupabaseRSCClient } from '@/app/lib/supabase/supabaseServer';

export async function GET() {
  try {
    const supabase = await createSupabaseRSCClient();

    const { data: articles, error } = await supabase
      .from('articles')
      .select('id, title, slug, content, excerpt, featured_image, published_at, view_count')
      .eq('status', 'published')
      .order('published_at', { ascending: false });

    if (error) {
      console.error('Error fetching articles:', error);
      return NextResponse.json({ error: error.message, articles: [] }, { status: 500 });
    }

    return NextResponse.json({ articles: articles || [] });
  } catch (error: any) {
    console.error('Error in articles-public API:', error);
    return NextResponse.json({ error: error.message, articles: [] }, { status: 500 });
  }
}
