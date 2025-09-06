// /src/middleware.ts  
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(req: NextRequest) {
  // create a single response so Supabase can attach refreshed cookies
  const res = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookies) {
          cookies.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not signed in → send to login and preserve intended URL
  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', req.nextUrl.pathname + req.nextUrl.search);

    // forward any Set-Cookie from `res` onto the redirect
    return NextResponse.redirect(url, { headers: res.headers });
  }

  // Check admin role from JWT
  const roles = Array.isArray(user.app_metadata?.roles)
    ? (user.app_metadata!.roles as string[])
    : [];
  const isAdmin = roles.includes('admin');

  const emailIsAdmin =
    !!process.env.ADMIN_EMAIL && user.email === process.env.ADMIN_EMAIL;

  if (!isAdmin && !emailIsAdmin) {
    const url = req.nextUrl.clone();
    url.pathname = '/403';
    url.searchParams.delete('next');
    return NextResponse.redirect(url, { headers: res.headers });
  }

  // Optional hardening headers
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; connect-src 'self' https://*.supabase.co; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'"
  );

  return res;
}

export const config = { matcher: ['/dashboard/:path*'] };
