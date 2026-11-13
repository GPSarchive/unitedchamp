import { kv } from '@vercel/kv'
import { isCloudflareIp } from './cloudflareIp'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
export type LimitResult = {
  success: boolean
  limit: number
  remaining: number
  reset: number // unix ms when the window resets
  /** Hits counted in the current window, when known (KV answered). */
  count?: number
}

export type BatchResult = {
  success: boolean
  failedCheck?: string
  result?: LimitResult
}

type LimitCheck = {
  key: string
  limit: number
  windowSec: number
  name: string
  /** Keep the counter this long instead of just its window (traffic history). */
  keepSec?: number
}

// ─────────────────────────────────────────────────────────────
// Traffic history (read by /dashboard/traffic — lib/traffic.ts)
//
// The per-IP HOUR counters double as a 26-hour traffic record: instead of
// expiring with their window they are kept for TRAFFIC_KEEP_SEC, so the admin
// page can show each address hour by hour.
//
// Alongside it, a second hour counter counts only the requests that did NOT
// come from a real browser. Every current browser sends Sec-Fetch-* headers
// with every request; scripts (node, python-requests, curl, axios…) do not
// unless someone fakes them. That tells a program from a person without
// assuming anything about WHEN or HOW OFTEN it comes. (Limit: a scraper
// driving a real headless browser does send them — the admin page says so.)
//
// No extra KV round-trips: the counters ride in the existing pipeline. The
// first request of each hour from an address — and its first non-browser one —
// writes a short note (User-Agent, path, browser or not).
//
// IPs are personal data: they live only here, admin-only, and expire on
// their own after 26 hours.
// ─────────────────────────────────────────────────────────────
export const TRAFFIC_KEEP_SEC = 26 * 3600
/** Hour counters: `rl:v1:iph:<ip>:<hour bucket>` (hour bucket = unix hours). */
export const TRAFFIC_HOUR_PREFIX = 'rl:v1:iph:'
/** Non-browser requests only: `rl:v1:iphx:<ip>:<hour bucket>`. */
export const TRAFFIC_NOBROWSER_PREFIX = 'rl:v1:iphx:'
/** Latest note per address: `rl:visitor:<ip>` → VisitorNote. */
export const TRAFFIC_NOTE_PREFIX = 'rl:visitor:'

export type VisitorNote = { ua: string; path: string; at: number; browser?: boolean }

// ─────────────────────────────────────────────────────────────
// The limits — one table, sized for this site.
//
// Sizing notes (2026-11): the site sees ~1,000 visitors a week. One real
// visitor is NOT one request: every page view also fires Next.js link
// prefetches (20–40 on a list page) plus a few /api calls, and several
// visitors can share one IP (mobile carriers, a venue's Wi-Fi). So the
// per-IP numbers are deliberately far above anything a person produces and
// only catch machines pulling pages in bulk:
//
//   600 / minute  = 10 requests every second, sustained for a minute
//   6,000 / hour  = ~200 full page views in an hour from one address
//
// A slow, polite scraper stays under any limit that leaves people alone —
// rate limits stop hammering, not copying. Blocked requests are logged by
// proxy.ts ("[rate-limit] blocked"), which is where a repeat offender's IP
// shows up for a firewall rule.
// ─────────────────────────────────────────────────────────────
export const LIMITS = {
  /** Per IP, short burst. */
  ipMinute: { limit: 600, windowSec: 60 },
  /** Per IP, sustained — this is the one a bulk crawler runs into. */
  ipHour: { limit: 6000, windowSec: 3600 },
  /**
   * Requests whose User-Agent CLAIMS to be a search engine. The UA is trivially
   * faked, so it no longer buys an exemption — only a higher ceiling, per IP,
   * that the real Googlebot/Bingbot never reach on a site this size.
   */
  crawlerMinute: { limit: 1200, windowSec: 60 },
  crawlerHour: { limit: 20000, windowSec: 3600 },
  /** Per API path, all callers together. */
  endpoint: { limit: 3000, windowSec: 60 },
  /** Whole app, all callers together — a cost circuit-breaker, not a people limit. */
  global: { limit: 20000, windowSec: 60 },
  /** API writes: per IP per path. */
  apiWrite: { limit: 30, windowSec: 60 },
  /** API writes: per IP per day. */
  dailyWrite: { limit: 5000, windowSec: 86400 },
  /** Auth endpoints: brute-force protection. */
  auth: { limit: 10, windowSec: 60 },
} as const

// ─────────────────────────────────────────────────────────────
// KV plumbing
// ─────────────────────────────────────────────────────────────

/** No KV configured, or local dev: the limiter is off and everything passes. */
function limiterOff(): boolean {
  return !process.env.KV_REST_API_URL || process.env.NODE_ENV === 'development'
}

// Circuit breaker: if KV errors, stop calling it for a while instead of adding
// a failing network round-trip to every request. The limiter FAILS OPEN — a
// broken limiter must never lock real visitors out.
const KV_COOLDOWN_MS = 30_000
let kvDownUntil = 0

function kvAvailable(): boolean {
  return Date.now() >= kvDownUntil
}

function tripBreaker(error: unknown) {
  kvDownUntil = Date.now() + KV_COOLDOWN_MS
  console.error('[rate-limit] KV unavailable — limiter is failing OPEN for 30s:', error)
}

const pass = (limit: number, windowSec: number): LimitResult => ({
  success: true,
  limit,
  remaining: limit,
  reset: Date.now() + windowSec * 1000,
})

/**
 * Increments every counter in ONE KV round-trip and returns the new counts
 * (same order as `checks`), or null when the limiter is off / KV is down.
 */
async function hit(checks: LimitCheck[]): Promise<{ count: number; bucket: number }[] | null> {
  if (checks.length === 0 || limiterOff() || !kvAvailable()) return null

  const nowSec = Math.floor(Date.now() / 1000)
  const keys = checks.map((c) => {
    const bucket = Math.floor(nowSec / c.windowSec)
    return { bucket, ttl: c.keepSec ?? c.windowSec, kvKey: `rl:v1:${c.key}:${bucket}` }
  })

  try {
    const pipeline = kv.pipeline()
    for (const k of keys) {
      pipeline.incr(k.kvKey)
      // The bucket number is part of the key, so the TTL is only garbage
      // collection — refreshing it on every hit is harmless.
      pipeline.expire(k.kvKey, k.ttl)
    }
    const out = await pipeline.exec<number[]>()
    return keys.map((k, i) => ({ count: Number(out[i * 2]), bucket: k.bucket }))
  } catch (error) {
    tripBreaker(error)
    return null // fail open
  }
}

/** The first check (in order) whose count is over its limit, as a BatchResult. */
function firstOver(checks: LimitCheck[], counts: { count: number; bucket: number }[]): BatchResult {
  for (let i = 0; i < checks.length; i++) {
    const { limit, windowSec, name } = checks[i]
    if (counts[i].count > limit) {
      return {
        success: false,
        failedCheck: name,
        result: {
          success: false,
          limit,
          remaining: 0,
          reset: (counts[i].bucket + 1) * windowSec * 1000,
          count: counts[i].count,
        },
      }
    }
  }
  return { success: true }
}

/**
 * Fixed-window counters, all in one KV round-trip. Returns the first check (in
 * the order given) that is over its limit. Every counter in the batch is
 * incremented even when an earlier one fails — so put checks that should not
 * be inflated by blocked traffic in a later batch.
 */
export async function checkLimitsBatch(checks: LimitCheck[]): Promise<BatchResult> {
  const counts = await hit(checks)
  return counts ? firstOver(checks, counts) : { success: true }
}

/** One fixed-window counter. Used directly by the auth routes (per-email limits). */
export async function checkLimit(
  key: string,
  limit: number,
  windowSec: number
): Promise<LimitResult> {
  const counts = await hit([{ key, limit, windowSec, name: key }])
  if (!counts) return pass(limit, windowSec)

  const { count, bucket } = counts[0]
  return {
    success: count <= limit,
    limit,
    remaining: Math.max(0, limit - count),
    reset: (bucket + 1) * windowSec * 1000,
    count,
  }
}

// ─────────────────────────────────────────────────────────────
// Checks used by proxy.ts
// ─────────────────────────────────────────────────────────────

/**
 * The limits every request goes through.
 *
 * Two KV round-trips at most: the per-IP counters first, and only requests
 * that pass them are counted against the shared endpoint/global counters —
 * otherwise one address hammering the site would fill the GLOBAL counter and
 * get everybody else blocked along with it.
 *
 * `crawler` = the User-Agent claims to be a search engine (see LIMITS).
 * `ua` / `path` / `browser` feed the traffic history (see TRAFFIC_KEEP_SEC);
 * `browser` = the request carried the Sec-Fetch-* headers browsers send.
 */
export async function checkRequestLimits(opts: {
  ip: string
  endpoint?: string
  crawler?: boolean
  ua?: string
  path?: string
  browser?: boolean
}): Promise<BatchResult> {
  const perMinute = opts.crawler ? LIMITS.crawlerMinute : LIMITS.ipMinute
  const perHour = opts.crawler ? LIMITS.crawlerHour : LIMITS.ipHour

  const ipChecks: LimitCheck[] = [
    { key: `ip:${opts.ip}`, ...perMinute, name: 'ip' },
    { key: `iph:${opts.ip}`, ...perHour, name: 'ipHour', keepSec: TRAFFIC_KEEP_SEC },
  ]
  const noBrowser = opts.browser === false
  if (noBrowser) {
    // A record, not a limit: it never blocks anything.
    ipChecks.push({
      key: `iphx:${opts.ip}`,
      limit: Number.MAX_SAFE_INTEGER,
      windowSec: 3600,
      name: 'ipHourNoBrowser',
      keepSec: TRAFFIC_KEEP_SEC,
    })
  }
  const counts = await hit(ipChecks)
  if (counts) {
    const ipCheck = firstOver(ipChecks, counts)
    if (!ipCheck.success) return ipCheck
    // Note who it claims to be on its first request of the hour, and again on
    // its first NON-browser request of the hour (that is the one worth seeing).
    if (counts[1].count === 1 || (noBrowser && counts[2].count === 1)) {
      await noteVisitor(opts.ip, opts.ua, opts.path, !noBrowser)
    }
  }

  const shared: LimitCheck[] = []
  if (opts.endpoint) {
    shared.push({ key: `endpoint:${normalizePath(opts.endpoint)}`, ...LIMITS.endpoint, name: 'endpoint' })
  }
  shared.push({ key: 'global', ...LIMITS.global, name: 'global' })
  return checkLimitsBatch(shared)
}

async function noteVisitor(ip: string, ua = '', path = '', browser = true) {
  const note: VisitorNote = { ua: ua.slice(0, 200), path: path.slice(0, 200), at: Date.now(), browser }
  try {
    await kv.set(`${TRAFFIC_NOTE_PREFIX}${ip}`, note, { ex: TRAFFIC_KEEP_SEC })
  } catch {
    // Only a note for the admin page — never worth failing or slowing a request.
  }
}

/** API write operations: per IP per path. */
export async function checkApiWriteLimit(ip: string, path: string): Promise<LimitResult> {
  const { limit, windowSec } = LIMITS.apiWrite
  return checkLimit(`api:${ip}:${normalizePath(path)}`, limit, windowSec)
}

/** API write operations: per IP per day. */
export async function checkDailyLimit(ip: string): Promise<LimitResult> {
  const { limit, windowSec } = LIMITS.dailyWrite
  return checkLimit(`daily:${ip}`, limit, windowSec)
}

/** Auth endpoints: stricter limit for brute-force protection. */
export async function checkAuthLimit(ip: string): Promise<LimitResult> {
  const { limit, windowSec } = LIMITS.auth
  return checkLimit(`auth:${ip}`, limit, windowSec)
}

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

/**
 * The visitor's address. The domain sits behind Cloudflare, so the address
 * Vercel reports is usually a Cloudflare edge server shared by many people;
 * when it is, the real visitor is in cf-connecting-ip (lib/cloudflareIp.ts).
 */
export function ipFromRequest(req: Request): string {
  const xff = req.headers.get('x-forwarded-for')
  const connecting =
    ((req as any).ip as string | undefined) ||
    (xff ? xff.split(',')[0].trim() : '') ||
    req.headers.get('x-real-ip')?.trim() ||
    ''

  // Trust Cloudflare's header only when the request really came from Cloudflare.
  const cfIp = req.headers.get('cf-connecting-ip')?.trim()
  if (cfIp && connecting && isCloudflareIp(connecting)) return cfIp

  return connecting || '127.0.0.1'
}

/** Normalize path to prevent key explosion */
function normalizePath(path: string): string {
  return path
    .split('?')[0]
    .replace(/\/[a-f0-9-]{36}/gi, '/:uuid') // UUIDs
    .replace(/\/\d+/g, '/:id') // Numeric IDs
}
