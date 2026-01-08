// Increment view count for an article by slug
import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/app/lib/supabase/supabaseServer";

type Ctx = { params: Promise<{ slug: string }> };

export async function POST(req: Request, ctx: Ctx) {
  try {
    const { slug } = await ctx.params;
    if (!slug || typeof slug !== 'string' || slug.trim() === '') {
      return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
    }

    const supa = await createSupabaseRouteClient();

    // Try to increment using the database function (most efficient)
    const { data, error } = await supa.rpc('increment_article_view_count', {
      article_slug: slug
    });

    if (error) {
      console.warn('RPC increment failed, falling back to manual update:', error.message);

      // Fallback: Manual increment with retry logic
      const { data: article } = await supa
        .from("articles")
        .select("id, view_count, status")
        .eq("slug", slug)
        .eq("status", "published")
        .maybeSingle();

      if (!article) {
        // Don't increment draft articles or non-existent articles
        return NextResponse.json({
          success: false,
          error: "Article not found or not published"
        }, { status: 404 });
      }

      const newViewCount = (article.view_count || 0) + 1;

      const { error: updateError } = await supa
        .from("articles")
        .update({ view_count: newViewCount })
        .eq("id", article.id)
        .eq("view_count", article.view_count || 0); // Optimistic locking

      if (updateError) {
        console.error('View count update error:', updateError);
        // Don't fail the request if view count update fails (non-critical)
        return NextResponse.json({
          success: false,
          error: "Failed to increment view count"
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        view_count: newViewCount
      });
    }

    // RPC succeeded
    return NextResponse.json({
      success: true,
      view_count: data || 0
    });

  } catch (e: any) {
    console.error('View count increment error:', e);
    // Return success even on error to not block page load
    return NextResponse.json({
      success: false,
      error: "Server error"
    }, { status: 200 }); // Return 200 to not trigger error in client
  }
}
