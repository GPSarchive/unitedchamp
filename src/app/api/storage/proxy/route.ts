// app/api/proxy/route.ts
import { NextRequest } from "next/server";
import { requireAuth } from "@/app/lib/supabase/apiAuth";
export const runtime = "nodejs";

// Only allow proxying from our own Supabase storage to prevent SSRF abuse.
// Extend this list if you serve images from additional trusted origins.
const ALLOWED_HOSTS = (() => {
  const hosts: string[] = [];
  try {
    const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (supaUrl) hosts.push(new URL(supaUrl).hostname);
  } catch {}
  const cdnDomain = process.env.NEXT_PUBLIC_CDN_DOMAIN;
  if (cdnDomain) hosts.push(cdnDomain);
  return hosts;
})();

function isTrustedUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    return ALLOWED_HOSTS.some(
      (h) => u.hostname === h || u.hostname.endsWith(`.${h}`)
    );
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  // Require a logged-in session to prevent open-proxy / SSRF abuse.
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const src = new URL(req.url).searchParams.get("src");
  if (!src) return new Response("Missing src", { status: 400 });

  // Restrict to trusted storage origins — never forward to arbitrary hosts.
  if (!isTrustedUrl(src)) {
    return new Response("Forbidden: untrusted src", { status: 403 });
  }

  const res = await fetch(src, { headers: { Accept: "image/*" } });
  if (!res.ok || !res.body) return new Response("Fetch failed", { status: 502 });

  // Validate content-type to prevent content-sniffing attacks.
  const ct = res.headers.get("content-type") || "";
  if (!ct.startsWith("image/")) {
    return new Response("Forbidden: non-image content-type", { status: 403 });
  }

  return new Response(res.body, {
    headers: {
      "Content-Type": ct,
      "Cache-Control": "public, max-age=31536000, immutable",
      "Cross-Origin-Resource-Policy": "same-origin",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
