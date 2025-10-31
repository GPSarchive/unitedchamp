// app/api/storage/tournament-img-loader/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const BUCKET ="GPSarchive's Project";

// SSR client that reads auth cookies
async function getServerSupabase() {
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return jar.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    }
  );
}

function isHttp(url: string) {
  return /^https?:\/\//i.test(url);
}

function stripLeadingSlash(s: string) {
  return s.replace(/^\/+/, "");
}

function basename(p: string) {
  // keep last segment only
  const clean = p.split("?")[0].split("#")[0];
  const parts = clean.split("/");
  return parts[parts.length - 1] || "";
}

function slugify(input: string) {
  return String(input || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function requireAdmin() {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { ok: false as const, reason: "Not authenticated" };
  const roles = (data.user.app_metadata as any)?.roles ?? [];
  return Array.isArray(roles) && roles.includes("admin")
    ? { ok: true as const }
    : { ok: false as const, reason: "Forbidden" };
}

export async function GET(req: Request) {
  // Admin gate
  const check = await requireAdmin();
  if (!check.ok) {
    return NextResponse.json({ error: check.reason }, { status: 403 });
  }

  const url = new URL(req.url);
  const slugRaw = url.searchParams.get("slug") || "";
  const logo = url.searchParams.get("logo") || "";

  if (!logo) {
    return NextResponse.json({ error: "Missing logo" }, { status: 400 });
  }

  // Case 1: absolute URL, return as-is
  if (isHttp(logo)) {
    return NextResponse.json({ url: logo });
  }

  // Compute storage key:
  // - If logo contains a slash, treat it as a bucket key (strip leading '/')
  // - Else treat it as a filename under leagues/<slug>/logo/<filename>
  const slug = slugify(slugRaw || "tournament");
  let key: string;

  if (logo.includes("/")) {
    key = stripLeadingSlash(logo);
  } else {
    const file = basename(logo);
    if (!file) {
      return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }
    key = `leagues/${slug}/logo/${file}`; // singular "logo" per your convention
  }

  // Sign and return
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(key, 60 * 60);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ url: data?.signedUrl ?? null, key });
}
