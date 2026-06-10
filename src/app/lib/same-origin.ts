// Shared same-origin guard for mutating API routes.
//
// The allow-list is built ONLY from deployment configuration — never from the
// incoming request. Deriving it from `req.url` (as some older per-route copies
// did) would let an attacker self-whitelist via a spoofed Host header.
//
// .env: ALLOWED_ORIGINS=https://app.example.com,http://localhost:3000
// When ALLOWED_ORIGINS is unset we fall back to other config-derived origins
// (NEXT_PUBLIC_SITE_URL, Vercel deployment URLs) so deployments keep working,
// and block mutations entirely if no origin can be determined.

function toOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function buildAllowedOrigins(): Set<string> {
  const configured = (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const fallbacks: string[] = [];
  if (process.env.NEXT_PUBLIC_SITE_URL) fallbacks.push(process.env.NEXT_PUBLIC_SITE_URL);
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) fallbacks.push(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
  if (process.env.VERCEL_URL) fallbacks.push(`https://${process.env.VERCEL_URL}`);

  return new Set(
    [...configured, ...fallbacks]
      .map(toOrigin)
      .filter((o): o is string => o !== null)
  );
}

const allowedOrigins = buildAllowedOrigins();

/** True when the request's Origin or Referer matches the configured allow-list. */
export function isAllowedOrigin(req: Request): boolean {
  if (allowedOrigins.size === 0) {
    console.error(
      "[same-origin] No allowed origins configured (set ALLOWED_ORIGINS or NEXT_PUBLIC_SITE_URL) — blocking mutation"
    );
    return false;
  }
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  return [origin, referer].some((val) => {
    try {
      return !!val && allowedOrigins.has(new URL(val).origin);
    } catch {
      return false;
    }
  });
}

/** Throws Error("bad-origin") for cross-origin mutating requests. Safe methods pass. */
export function ensureSameOrigin(req: Request): void {
  const m = req.method.toUpperCase();
  if (m === "GET" || m === "HEAD" || m === "OPTIONS") return;
  if (!isAllowedOrigin(req)) throw new Error("bad-origin");
}
