// /src/middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { checkLimit, ipFromRequest } from '@/app/lib/rate-limit'

// Rollout helper: set CSP_REPORT_ONLY=1 to start in report-only mode
const REPORT_ONLY = process.env.CSP_REPORT_ONLY === '1'

// Resolve origins safely from env
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const APP_ORIGIN   = process.env.NEXT_PUBLIC_APP_ORIGIN || ''

function originFrom(url: string): string {
  try { return url ? new URL(url).origin : '' } catch { return '' }
}
const supabaseOrigin = originFrom(SUPABASE_URL)
const appOrigin = originFrom(APP_ORIGIN)

// Edge-safe nonce (no Node 'crypto' import)
function makeNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  let str = ''
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i])
  return btoa(str)
}

export async function middleware(req: NextRequest) {
  const path   = req.nextUrl.pathname
  const method = req.method.toUpperCase()

  // Skip obvious non-pages quickly (your matcher already narrows scope, this is just cheap guardrails)
  const isStatic =
    path.startsWith('/_next') ||
    path.startsWith('/static') ||
    path === '/favicon.ico' ||
    /\.(?:png|jpg|jpeg|gif|svg|webp|ico|txt|css|js|map)$/.test(path)
  if (isStatic || method === 'OPTIONS' || method === 'HEAD') {
    return NextResponse.next()
  }

  // --- Rate limit (per IP + per path) BEFORE expensive work ---
  const ip = ipFromRequest(req)
  // e.g. 60 requests per minute per IP per path inside /dashboard
  const perPath = await checkLimit(`page:${ip}:${path}`, 2, 60)
  // Optional daily umbrella (tune or remove)
  const daily   = await checkLimit(`day:${ip}`, 2000, 24 * 60 * 60)

  if (!perPath.success || !daily.success) {
    const resetMs = !perPath.success ? perPath.reset : daily.reset
    const headers = new Headers()
    headers.set('X-RateLimit-Limit', String(perPath.limit))
    headers.set('X-RateLimit-Remaining', String(Math.max(0, perPath.remaining)))
    headers.set('X-RateLimit-Reset', String(resetMs))
    headers.set('Retry-After', String(Math.max(1, Math.ceil((resetMs - Date.now()) / 1000))))
    return new NextResponse('Too Many Requests', { status: 429, headers })
  }

  // From here on, request is allowed — create a response object we can mutate
  const res = NextResponse.next({ request: req })

  // Include rate-limit headers on successful responses (handy for client/debugging)
  res.headers.set('X-RateLimit-Limit', String(perPath.limit))
  res.headers.set('X-RateLimit-Remaining', String(Math.max(0, perPath.remaining)))
  res.headers.set('X-RateLimit-Reset', String(perPath.reset))

  // --- Create per-request CSP nonce (Edge-safe) ---
  const nonce = makeNonce()
  res.headers.set('x-nonce', nonce)

  // --- Supabase SSR client (auth/roles) ---
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll() },
        setAll(cookies) {
          cookies.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Not signed in → redirect to /login with ?next=<intended>
  if (!user) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', req.nextUrl.pathname + req.nextUrl.search)
    return NextResponse.redirect(url, { headers: res.headers })
  }

  // Admin gate (roles or explicit ADMIN_EMAIL)
  const roles = Array.isArray(user.app_metadata?.roles)
    ? (user.app_metadata!.roles as string[])
    : []
  const isAdmin = roles.includes('admin')
  const emailIsAdmin = !!process.env.ADMIN_EMAIL && user.email === process.env.ADMIN_EMAIL

  if (!isAdmin && !emailIsAdmin) {
    const url = req.nextUrl.clone()
    url.pathname = '/403'
    url.searchParams.delete('next')
    return NextResponse.redirect(url, { headers: res.headers })
  }

  // --- Hardening headers (non-CSP) ---
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set('X-Frame-Options', 'DENY') // legacy; CSP frame-ancestors covers modern browsers
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  res.headers.set('Cross-Origin-Opener-Policy', 'same-origin')
  // res.headers.set('Cross-Origin-Embedder-Policy', 'require-corp') // enable if all embeds are CORP/CORS-ready
  res.headers.set('Cross-Origin-Resource-Policy', 'same-origin')
  res.headers.set('Origin-Agent-Cluster', '?1')
  res.headers.set('X-Permitted-Cross-Domain-Policies', 'none')

  // --- Content Security Policy (nonce-based) ---
  const imgSrc = [
    "'self'",
    'data:',
    'blob:',
    'https://lh3.googleusercontent.com',
    'https://avatars.githubusercontent.com',
    supabaseOrigin,
    appOrigin,
  ].filter(Boolean).join(' ')

  const connectSrc = [
    "'self'",
    supabaseOrigin,
    appOrigin,
    'https://*.supabase.co',
    'wss://*.supabase.co', // Supabase Realtime
  ].filter(Boolean).join(' ')

  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    'https://cdnjs.cloudflare.com', // allow p5 + vanta from cdnjs
    // "'strict-dynamic'",           // optional
  ].join(' ')

  const styleSrc = [
    "'self'",
    `'nonce-${nonce}'`,
  ].join(' ')

  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    `img-src ${imgSrc}`,
    `script-src ${scriptSrc}`,
    `style-src ${styleSrc}`,
    "font-src 'self' data:",
    `connect-src ${connectSrc}`,
    "worker-src 'self' blob:",
    "form-action 'self'",
    "object-src 'none'",
    'upgrade-insecure-requests',
  ].join('; ')

  const cspHeaderName = REPORT_ONLY ? 'Content-Security-Policy-Report-Only'
                                    : 'Content-Security-Policy'
  res.headers.set(cspHeaderName, csp)

  return res
}

// Currently protects only /dashboard/*
// If you also want API/global page limiting, widen this matcher (e.g., the regex we used earlier).
export const config = { matcher: ['/dashboard/:path*'] }
