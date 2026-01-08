// Increment view count for an article by slug
import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/app/lib/supabase/supabaseServer";

type Ctx = { params: Promise<{ slug: string }> };

export async function POST(req: Request, ctx: Ctx) {
  try {
    const { slug } = await ctx.params;
    if (!slug) {
      return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
    }

    const supa = await createSupabaseRouteClient();

    // Increment the view count using SQL
    const { data, error } = await supa.rpc('increment_article_view_count', {
      article_slug: slug
    });

    if (error) {
      // Fallback to manual increment if RPC doesn't exist
      const { data: article } = await supa
        .from("articles")
        .select("id, view_count")
        .eq("slug", slug)
        .maybeSingle();

      if (!article) {
        return NextResponse.json({ error: "Article not found" }, { status: 404 });
      }

      const { error: updateError } = await supa
        .from("articles")
        .update({ view_count: (article.view_count || 0) + 1 })
        .eq("id", article.id);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        view_count: (article.view_count || 0) + 1
      });
    }

    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    console.error('View count increment error:', e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
