// src/app/api/auth/sign-out/route.ts
import { NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/app/lib/supabase/supabaseServer';

// Sign-out via cross-site form is a nuisance attack (attacker logs the user
// out from their site). We block it by requiring the request's Origin or
// Referer to match a configured allow-list — the same pattern the mutating
// match endpoints use. We don't use the CSRF token system here because the
// existing sign-out forms (4 call sites) do not embed `_csrf` and changing
// them all is unnecessary when an origin check suffices.
const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
);

function ensureSameOrigin(req: Request): boolean {
  if (allowedOrigins.size === 0) return false;
  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');
  return [origin, referer].some((val) => {
    try {
      return !!val && allowedOrigins.has(new URL(val).origin);
    } catch {
      return false;
    }
  });
}

// Support both POST (recommended) and GET (for simple anchor links)
export async function POST(req: Request) {
  if (!ensureSameOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const supabase = await createSupabaseRouteClient();
  await supabase.auth.signOut(); // clears auth cookies for this session
  return NextResponse.redirect(new URL('/login', req.url));
}

export async function GET(req: Request) {
  return POST(req);
}
