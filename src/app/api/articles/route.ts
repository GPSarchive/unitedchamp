// app/api/articles/route.ts
import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/app/lib/supabase/supabaseServer";

// ---- same-origin guard ----
function ensureSameOrigin(req: Request) {
  const m = req.method.toUpperCase();
  if (m === "GET" || m === "HEAD" || m === "OPTIONS") return;

  const whitelist = new Set(
    (process.env.ALLOWED_ORIGINS ?? "")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean)
  );
  try { whitelist.add(new URL(req.url).origin); } catch {}

  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const ok = [origin, referer].some(val => {
    try { return !!val && whitelist.has(new URL(val).origin); } catch { return false; }
  });
  if (!ok) throw new Error("bad-origin");
}
// ---------------------------

function toBool(v: string | null) {
  return v === "1" || v === "true";
}

// Helper to generate URL-safe slug from title
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[^\w\s-]/g, "") // remove special chars
    .trim()
    .replace(/\s+/g, "-") // spaces to hyphens
    .replace(/-+/g, "-") // collapse multiple hyphens
    .substring(0, 100); // limit length
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { Allow: "GET,POST,OPTIONS,HEAD" } });
}

export async function HEAD() {
  return new NextResponse(null, { status: 200, headers: { Allow: "GET,POST,OPTIONS,HEAD" } });
}

export async function GET(req: Request) {
  const supa = await createSupabaseRouteClient();
  const url = new URL(req.url);
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? "0"));
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "10"), 1), 50);
  const published = toBool(url.searchParams.get("published"));

  let q = supa
    .from("articles")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  // Filter to only published articles if requested
  if (published) {
    q = q.eq("status", "published");
  }

  const { data, error, count } = await q.range(offset, offset + limit - 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const total = typeof count === "number" ? count : null;
  const nextOffset = total !== null && offset + limit < total ? offset + limit : null;

  return NextResponse.json({
    data,
    page: Math.floor(offset / limit) + 1,
    limit,
    total,
    nextOffset,
  });
}

export async function POST(req: Request) {
  try {
    ensureSameOrigin(req);

    const supa = await createSupabaseRouteClient();

    // Require authenticated admin
    const { data: { user }, error: userErr } = await supa.auth.getUser();
    if (userErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const roles = Array.isArray(user.app_metadata?.roles) ? user.app_metadata.roles : [];
    if (!roles.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const payload = await req.json().catch(() => null);
    if (!payload || typeof payload !== "object") {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    // Validate required fields
    if (!payload.title || typeof payload.title !== "string") {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    // Generate slug from title if not provided
    if (!payload.slug) {
      payload.slug = generateSlug(payload.title);
    }

    // Drop system fields
    ["id", "created_at", "updated_at"].forEach(k => delete (payload as any)[k]);

    // Set author_id to current user
    payload.author_id = user.id;

    // Set published_at if status is being set to published
    if (payload.status === "published" && !payload.published_at) {
      payload.published_at = new Date().toISOString();
    }

    const { data, error } = await supa
      .from("articles")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      // Check for unique constraint violation on slug
      if (error.code === "23505") {
        return NextResponse.json({ error: "Slug already exists, please choose a different title" }, { status: 400 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ data }, { status: 201 });
  } catch (e: any) {
    const msg = String(e?.message ?? "");
    if (msg === "bad-origin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
