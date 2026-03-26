import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import {
  checkRateLimits,
  checkApiWriteLimit,
  checkDailyLimit,
  ipFromRequest,
  type LimitResult,
} from '@/app/lib/rate-limit'

const REPORT_ONLY = process.env.CSP_REPORT_ONLY === '1'

// Resolve origins safely from env
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const APP_ORIGIN = process.env.NEXT_PUBLIC_APP_ORIGIN || ''
const CDN_DOMAIN = process.env.NEXT_PUBLIC_CDN_DOMAIN || 'images.ultrachamp.gr'

const originFrom = (u: string) => {
  try {
    return u ? new URL(u).origin : ''
  } catch {
    return ''
  }
}
const supabaseOrigin = originFrom(SUPABASE_URL)
const appOrigin = originFrom(APP_ORIGIN)

// Known search engine crawlers — exempt from rate limiting
const SEARCH_ENGINE_BOT_RE =
  /googlebot|bingbot|yandexbot|baiduspider|duckduckbot|slurp|msnbot|apis-google|mediapartners-google|adsbot-google/i

function isSearchEngineBot(req: NextRequest): boolean {
  const ua = req.headers.get('user-agent') || ''
  return SEARCH_ENGINE_BOT_RE.test(ua)
}

function makeNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s)
}

// ─────────────────────────────────────────────────────────────
// Rate Limit Response Helpers
// ─────────────────────────────────────────────────────────────

const RATE_LIMIT_MESSAGES: Record<string, string> = {
  global: 'Service is experiencing high traffic. Please try again later.',
  endpoint: 'This endpoint is receiving too many requests.',
  ip: 'Too many requests from your IP address.',
  apiWrite: 'Rate limit exceeded for this action.',
  daily: 'Daily request limit exceeded. Please try again tomorrow.',
  auth: 'Too many authentication attempts. Please wait before trying again.',
}

function createRateLimitResponse(
  req: NextRequest,
  result: LimitResult,
  checkName: string = 'ip'
): NextResponse {
  const retryAfter = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000))
  const message = RATE_LIMIT_MESSAGES[checkName] || 'Too Many Requests'
  const isApi = req.nextUrl.pathname.startsWith('/api')

  // API requests get JSON
  if (isApi) {
    return new NextResponse(
      JSON.stringify({
        error: message,
        code: 'RATE_LIMITED',
        limit: result.limit,
        remaining: result.remaining,
        retryAfter,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(result.limit),
          'X-RateLimit-Remaining': String(result.remaining),
          'X-RateLimit-Reset': String(result.reset),
          'Retry-After': String(retryAfter),
        },
      }
    )
  }

  // Page requests get styled HTML with countdown
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rate Limited</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      padding: 48px;
      max-width: 420px;
      width: 100%;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    }
    .icon { font-size: 64px; margin-bottom: 16px; }
    h1 { color: #1a1a2e; font-size: 24px; margin-bottom: 8px; }
    p { color: #6b7280; margin-bottom: 24px; line-height: 1.6; }
    .countdown-box {
      background: #f3f4f6;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
    }
    .countdown-label { font-size: 14px; color: #9ca3af; margin-bottom: 8px; }
    .countdown {
      font-size: 48px;
      font-weight: bold;
      color: #1a1a2e;
      font-family: monospace;
    }
    .progress-bar {
      height: 6px;
      background: #e5e7eb;
      border-radius: 3px;
      margin-top: 16px;
      overflow: hidden;
    }
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #667eea, #764ba2);
      transition: width 1s linear;
    }
    .btn {
      display: block;
      width: 100%;
      padding: 14px 24px;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      margin-bottom: 12px;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .btn-primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .btn-primary:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-secondary {
      background: transparent;
      color: #6b7280;
      border: 1px solid #e5e7eb;
    }
    .btn-secondary:hover { background: #f9fafb; }
    .help { font-size: 12px; color: #9ca3af; margin-top: 24px; }
    .help a { color: #667eea; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">⏱️</div>
    <h1>Slow Down!</h1>
    <p>${message}</p>
    <div class="countdown-box">
      <div class="countdown-label">You can try again in</div>
      <div class="countdown" id="countdown">${retryAfter}</div>
      <div class="progress-bar">
        <div class="progress-fill" id="progress" style="width: 100%"></div>
      </div>
    </div>
    <button class="btn btn-primary" id="retryBtn" disabled onclick="location.reload()">
      Wait ${retryAfter}s...
    </button>
    <a href="/" class="btn btn-secondary">Go to Homepage</a>
    <p class="help">Think this is a mistake? <a href="/contact">Contact support</a></p>
  </div>
  <script>
    (function() {
      let seconds = ${retryAfter};
      const total = ${retryAfter};
      const countdownEl = document.getElementById('countdown');
      const progressEl = document.getElementById('progress');
      const btnEl = document.getElementById('retryBtn');
      const timer = setInterval(() => {
        seconds--;
        countdownEl.textContent = seconds;
        progressEl.style.width = ((seconds / total) * 100) + '%';
        if (seconds <= 0) {
          clearInterval(timer);
          btnEl.disabled = false;
          btnEl.textContent = 'Try Again';
        } else {
          btnEl.textContent = 'Wait ' + seconds + 's...';
        }
      }, 1000);
    })();
  </script>
</body>
</html>`.trim()

  return new NextResponse(html, {
    status: 429,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-RateLimit-Limit': String(result.limit),
      'X-RateLimit-Remaining': String(result.remaining),
      'X-RateLimit-Reset': String(result.reset),
      'Retry-After': String(retryAfter),
    },
  })
}

// ─────────────────────────────────────────────────────────────
// Main Proxy Function
// ─────────────────────────────────────────────────────────────

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname
  const method = req.method.toUpperCase()

  // ─────────────────────────────────────────────────────────────
  // SKIP: Static assets and preflight requests
  // ─────────────────────────────────────────────────────────────
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

  const isCrawler = isSearchEngineBot(req)
  const ip = ipFromRequest(req)
  const isApi = path.startsWith('/api')
  const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
  const isAuthEndpoint = path.startsWith('/api/auth')

  // ─────────────────────────────────────────────────────────────
  // RATE LIMITING — Multi-layer protection
  // Search engine crawlers bypass rate limiting to avoid 429s
  // that kill indexation. They still get security headers + CSP.
  // ─────────────────────────────────────────────────────────────

  // Layer 1: Global + IP + Endpoint limits
  if (!isCrawler) {
    const baseCheck = await checkRateLimits({
      global: true,
      ip: ip,
      endpoint: isApi ? path : undefined,
    })

    if (!baseCheck.success) {
      return createRateLimitResponse(req, baseCheck.result!, baseCheck.failedCheck!)
    }
  }

  // Layer 2: Auth endpoint protection (stricter)
  if (!isCrawler && isAuthEndpoint) {
    const authCheck = await checkRateLimits({ auth: ip })
    if (!authCheck.success) {
      return createRateLimitResponse(req, authCheck.result!, 'auth')
    }
  }

  // Layer 3: API write operations (per-path + daily)
  let writeRateLimitResult: LimitResult | null = null

  if (isApi && isWrite && !isAuthEndpoint) {
    const perPath = await checkApiWriteLimit(ip, path)
    if (!perPath.success) {
      return createRateLimitResponse(req, perPath, 'apiWrite')
    }
    writeRateLimitResult = perPath

    const daily = await checkDailyLimit(ip)
    if (!daily.success) {
      return createRateLimitResponse(req, daily, 'daily')
    }
  }

  // ─────────────────────────────────────────────────────────────
  // NONCE: Generate and inject into REQUEST headers only
  // ─────────────────────────────────────────────────────────────
  const nonce = makeNonce()
  const reqHeaders = new Headers(req.headers)
  reqHeaders.set('x-nonce', nonce)

  const res = NextResponse.next({
    request: { headers: reqHeaders },
  })

  // Add rate limit headers to successful responses
  if (writeRateLimitResult) {
    res.headers.set('X-RateLimit-Limit', String(writeRateLimitResult.limit))
    res.headers.set('X-RateLimit-Remaining', String(writeRateLimitResult.remaining))
    res.headers.set('X-RateLimit-Reset', String(writeRateLimitResult.reset))
  }

  // ─────────────────────────────────────────────────────────────
  // AUTH — Dashboard + API mutation protection
  // ─────────────────────────────────────────────────────────────
  const PUBLIC_API_PREFIXES = ['/api/auth/', '/api/public/']
  const isPublicApi = PUBLIC_API_PREFIXES.some((p) => path.startsWith(p))
  const isApiMutation = isApi && !isPublicApi && isWrite

  const needsDashboardAuth = path.startsWith('/dashboard')

  if (needsDashboardAuth || isApiMutation) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => req.cookies.getAll(),
          setAll: (cookies) => {
            cookies.forEach(({ name, value, options }) =>
              res.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (isApiMutation && !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (needsDashboardAuth) {
      if (!user) {
        const url = req.nextUrl.clone()
        url.pathname = '/login'
        url.searchParams.set('next', req.nextUrl.pathname + req.nextUrl.search)
        return NextResponse.redirect(url, { headers: res.headers })
      }

      const roles = Array.isArray(user.app_metadata?.roles)
        ? (user.app_metadata!.roles as string[])
        : []
      const isAdmin = roles.includes('admin')
      const emailIsAdmin =
        !!process.env.ADMIN_EMAIL && user.email === process.env.ADMIN_EMAIL

      if (!isAdmin && !emailIsAdmin) {
        const url = req.nextUrl.clone()
        url.pathname = '/403'
        url.searchParams.delete('next')
        return NextResponse.redirect(url, { headers: res.headers })
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // SECURITY HEADERS
  // ─────────────────────────────────────────────────────────────
  res.headers.set('X-Frame-Options', 'SAMEORIGIN')
  res.headers.set('Cross-Origin-Opener-Policy', 'same-origin')
  res.headers.set('Cross-Origin-Resource-Policy', 'same-origin')
  res.headers.set('Origin-Agent-Cluster', '?1')
  res.headers.set('X-Permitted-Cross-Domain-Policies', 'none')
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set('X-DNS-Prefetch-Control', 'off')
  res.headers.set(
    'Strict-Transport-Security',
    'max-age=63072000; includeSubDomains; preload'
  )
  // Signal indexability for public pages
  if (!path.startsWith('/dashboard') && !path.startsWith('/api') && !path.startsWith('/login')) {
    res.headers.set('X-Robots-Tag', 'index, follow')
  }

  res.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=()'
  )

  // ─────────────────────────────────────────────────────────────
  // CSP — Content Security Policy
  // ─────────────────────────────────────────────────────────────
  const imgSrc = [
    "'self'",
    'data:',
    'blob:',
    supabaseOrigin,
    appOrigin,
    ...(CDN_DOMAIN ? [`https://${CDN_DOMAIN}`] : []),
    'https://lh3.googleusercontent.com',
    'https://avatars.githubusercontent.com',
  ]
    .filter(Boolean)
    .join(' ')

  const connectSrc = [
    "'self'",
    'https://*.supabase.co',
    'wss://*.supabase.co',
    supabaseOrigin,
    appOrigin,
  ]
    .filter(Boolean)
    .join(' ')

  const scriptSrcParts = ["'self'", `'nonce-${nonce}'`, 'https://cdnjs.cloudflare.com']
  if (process.env.NODE_ENV !== 'production') scriptSrcParts.push("'unsafe-eval'")
  const scriptSrc = scriptSrcParts.join(' ')

  const styleSources = [
    "'self'",
    "'unsafe-inline'",
    'https://fonts.googleapis.com',
    'https://cdnjs.cloudflare.com',
    'https://cdn.jsdelivr.net',
    'https://unpkg.com',
  ].join(' ')

  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'self' https://digitalfootprint.gr https://www.digitalfootprint.gr",
    `img-src ${imgSrc}`,
    `script-src ${scriptSrc}`,
    `style-src ${styleSources}`,
    `style-src-elem ${styleSources}`,
    `style-src-attr 'unsafe-inline'`,
    "font-src 'self' data: https://fonts.gstatic.com",
    `connect-src ${connectSrc}`,
    "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com",
    "worker-src 'self' blob:",
    "form-action 'self'",
    "object-src 'none'",
    'upgrade-insecure-requests',
  ].join('; ')

  res.headers.set(
    REPORT_ONLY ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy',
    csp
  )

  return res
}

export const config = {
  matcher: [
    '/((?!_next/|static/|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|txt|css|js|map)$).*)',
  ],
}