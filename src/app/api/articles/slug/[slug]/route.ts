// app/api/articles/slug/[slug]/route.ts
import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/app/lib/supabase/supabaseServer";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(req: Request, ctx: Ctx) {
  try {
    const { slug } = await ctx.params;
    if (!slug) return NextResponse.json({ error: "Invalid slug" }, { status: 400 });

    const supa = await createSupabaseRouteClient();

    const { data, error } = await supa
      .from("articles")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Only return published articles to non-authenticated users
    if (data.status !== "published") {
      // Check if user is admin
      const { data: { user } } = await supa.auth.getUser();
      const roles = Array.isArray(user?.app_metadata?.roles) ? user.app_metadata.roles : [];
      if (!roles.includes("admin")) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    }

    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
