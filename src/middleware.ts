// /src/middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { checkLimit, ipFromRequest } from '@/app/lib/rate-limit' // ← ensure this path is correct

// Rollout helper: set CSP_REPORT_ONLY=1 to log violations without blocking
const REPORT_ONLY = process.env.CSP_REPORT_ONLY === '1'

// Resolve origins safely from env
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const APP_ORIGIN   = process.env.NEXT_PUBLIC_APP_ORIGIN || ''
const originFrom = (u: string) => { try { return u ? new URL(u).origin : '' } catch { return '' } }
const supabaseOrigin = originFrom(SUPABASE_URL)
const appOrigin = originFrom(APP_ORIGIN)

// Edge-safe nonce (Web Crypto; no Node 'crypto' import)
function makeNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s)
}

export async function middleware(req: NextRequest) {
  const path   = req.nextUrl.pathname
  const method = req.method.toUpperCase()

  // Skip assets/static quickly to save KV ops
  const isStatic =
    path.startsWith('/_next') ||
    path.startsWith('/static') ||
    path === '/favicon.png' ||
    path === '/robots.txt' ||
    path === '/sitemap.xml' ||
    /\.(?:png|jpg|jpeg|gif|svg|webp|ico|txt|css|js|map)$/.test(path)
  if (isStatic || method === 'OPTIONS') {
    return NextResponse.next()
  }

  const isApi = path.startsWith('/api')

  // ---- Rate limit ALL public pages (non-API GET/HEAD) ----
  let perPath:
    | { success: boolean; limit: number; remaining: number; reset: number }
    | null = null

  if (!isApi && (method === 'GET' || method === 'HEAD')) {
    const ip = ipFromRequest(req)

    // Per-path burst control (tweak to taste)
    perPath = await checkLimit(`page:${ip}:${path}`, 120, 60)
    // Site-wide safety net (UTC day)
    const daily = await checkLimit(`day:${ip}`, 3000, 24 * 60 * 60)

    // If any window is exceeded, block until the LONGER reset
    const failures = [perPath, daily].filter(x => !x.success)
    if (failures.length) {
      const over = failures.reduce((a, b) => (a.reset > b.reset ? a : b))
      const headers = new Headers()
      headers.set('X-RateLimit-Limit', String(perPath!.limit))
      headers.set('X-RateLimit-Remaining', String(Math.max(0, perPath!.remaining)))
      headers.set('X-RateLimit-Reset', String(over.reset))
      headers.set('Retry-After', String(Math.max(1, Math.ceil((over.reset - Date.now()) / 1000))))
      return new NextResponse('Too Many Requests', { status: 429, headers })
    }
  }

  // Build response we can mutate
  const res = NextResponse.next({ request: req })

  // Expose rate headers when limiter ran (useful for debugging)
  if (perPath) {
    res.headers.set('X-RateLimit-Limit', String(perPath.limit))
    res.headers.set('X-RateLimit-Remaining', String(Math.max(0, perPath.remaining)))
    res.headers.set('X-RateLimit-Reset', String(perPath.reset))
  }

  // Nonce for layout.tsx
  const nonce = makeNonce()
  res.headers.set('x-nonce', nonce)

  // ---- Auth gate ONLY for /dashboard/** (public pages stay public) ----
  const needsAuth = path.startsWith('/dashboard')
  if (needsAuth) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => req.cookies.getAll(),
          setAll: (cookies) => { cookies.forEach(({ name, value, options }) => res.cookies.set(name, value, options)) },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      const url = req.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('next', req.nextUrl.pathname + req.nextUrl.search)
      return NextResponse.redirect(url, { headers: res.headers })
    }

    const roles = Array.isArray(user.app_metadata?.roles) ? (user.app_metadata!.roles as string[]) : []
    const isAdmin = roles.includes('admin')
    const emailIsAdmin = !!process.env.ADMIN_EMAIL && user.email === process.env.ADMIN_EMAIL
    if (!isAdmin && !emailIsAdmin) {
      const url = req.nextUrl.clone()
      url.pathname = '/403'
      url.searchParams.delete('next')
      return NextResponse.redirect(url, { headers: res.headers })
    }
  }

  // ---- Security headers + CSP (loosened just enough for images/styles) ----
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  res.headers.set('Cross-Origin-Opener-Policy', 'same-origin')
  // res.headers.set('Cross-Origin-Embedder-Policy', 'require-corp')
  res.headers.set('Cross-Origin-Resource-Policy', 'same-origin')
  res.headers.set('Origin-Agent-Cluster', '?1')
  res.headers.set('X-Permitted-Cross-Domain-Policies', 'none')

  // Images: allow all HTTPS to avoid layout collapses from blocked remotes
  const imgSrc = [
    "'self'",
    'data:',
    'blob:',
    'https:',
    supabaseOrigin,
    appOrigin,
  ].filter(Boolean).join(' ')

  const connectSrc = [
    "'self'",
    'https://*.supabase.co',
    'wss://*.supabase.co',
    supabaseOrigin,
    appOrigin,
  ].filter(Boolean).join(' ')

  // Scripts
  const scriptSrcParts = ["'self'", `'nonce-${nonce}'`, 'https://cdnjs.cloudflare.com']
  if (process.env.NODE_ENV !== 'production') scriptSrcParts.push("'unsafe-eval'")
  const scriptSrc = scriptSrcParts.join(' ')

  // Styles: cover both element and attribute cases + common CDNs
  const styleSources = [
    "'self'",
    "'unsafe-inline'",               // inline <style> and style="" attributes
    `'nonce-${nonce}'`,
    'https://fonts.googleapis.com',
    'https://cdnjs.cloudflare.com',
    'https://cdn.jsdelivr.net',
    'https://unpkg.com',
  ].join(' ')

  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    `img-src ${imgSrc}`,
    `script-src ${scriptSrc}`,
    `style-src ${styleSources}`,      // fallback when -elem/-attr not supported
    `style-src-elem ${styleSources}`, // explicit for modern browsers
    `style-src-attr 'unsafe-inline'`, // ensure style="" works everywhere
    "font-src 'self' data: https://fonts.gstatic.com https:",
    `connect-src ${connectSrc}`,
    "frame-src 'self'",
    "worker-src 'self' blob:",
    "form-action 'self'",
    "object-src 'none'",
    'upgrade-insecure-requests',
  ].join('; ')

  res.headers.set(REPORT_ONLY ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy', csp)
  return res
}

// Apply to (almost) everything; exclude assets/static
export const config = {
  matcher: [
    '/((?!_next/|static/|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|txt|css|js|map)$).*)'
  ]
}
