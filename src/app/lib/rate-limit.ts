import { kv } from '@vercel/kv'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
export type LimitResult = {
  success: boolean
  limit: number
  remaining: number
  reset: number // unix ms when the window resets
}

// ─────────────────────────────────────────────────────────────
// Core Rate Limit Function (Fixed Window)
// ─────────────────────────────────────────────────────────────

/**
 * Fixed-window rate limiter using Vercel KV
 * Counts hits inside a time window with 1 KV INCR per request
 */
export async function checkLimit(
  key: string,
  limit: number,
  windowSec: number
): Promise<LimitResult> {
  if (!process.env.KV_REST_API_URL || process.env.NODE_ENV === 'development') {
    return {
      success: true,
      limit,
      remaining: limit,
      reset: Date.now() + windowSec * 1000,
    }
  }

  const nowSec = Math.floor(Date.now() / 1000)
  const bucket = Math.floor(nowSec / windowSec)
  const kvKey = `rl:v1:${key}:${bucket}`

  try {
    const count = await kv.incr(kvKey)

    // Set TTL only when the key is new (first hit in this bucket)
    if (count === 1) {
      await kv.expire(kvKey, windowSec)
    }

    const remaining = Math.max(0, limit - count)
    const reset = (bucket + 1) * windowSec * 1000

    return {
      success: count <= limit,
      limit,
      remaining,
      reset,
    }
  } catch (error) {
    console.error('Rate limit error:', error)
    // Fail open - allow request if KV is down
    return {
      success: true,
      limit,
      remaining: limit,
      reset: Date.now() + windowSec * 1000,
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Pre-configured Rate Limit Checks
// ─────────────────────────────────────────────────────────────

/** Global limit: protects entire app from DDoS (10k req/min) */
export async function checkGlobalLimit(): Promise<LimitResult> {
  return checkLimit('global', 10000, 60)
}

/** Per-endpoint limit: protects individual API routes (1k req/min) */
export async function checkEndpointLimit(path: string): Promise<LimitResult> {
  const normalized = normalizePath(path)
  return checkLimit(`endpoint:${normalized}`, 800, 60)
}

/** Per-IP general limit (200 req/min) */
export async function checkIpLimit(ip: string): Promise<LimitResult> {
  return checkLimit(`ip:${ip}`, 200, 60)
}

/** API write operations: per IP per path (30 req/min) */
export async function checkApiWriteLimit(ip: string, path: string): Promise<LimitResult> {
  const normalized = normalizePath(path)
  return checkLimit(`api:${ip}:${normalized}`, 30, 60)
}

/** Daily limit per IP (500 req/day) */
export async function checkDailyLimit(ip: string): Promise<LimitResult> {
  return checkLimit(`daily:${ip}`, 500, 86400)
}

/** Auth endpoints: stricter limit for brute-force protection (10 req/min) */
export async function checkAuthLimit(ip: string): Promise<LimitResult> {
  return checkLimit(`auth:${ip}`, 10, 60)
}

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

/** Extract best-effort client IP */
export function ipFromRequest(req: Request): string {
  // Vercel/Next.js specific
  const direct = (req as any).ip as string | undefined
  if (direct) return direct

  // X-Forwarded-For (most proxies)
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()

  // X-Real-IP (nginx)
  const realIp = req.headers.get('x-real-ip')
  if (realIp) return realIp.trim()

  // Cloudflare
  const cfIp = req.headers.get('cf-connecting-ip')
  if (cfIp) return cfIp.trim()

  return '127.0.0.1'
}

/** Normalize path to prevent key explosion */
function normalizePath(path: string): string {
  return path
    .split('?')[0]
    .replace(/\/[a-f0-9-]{36}/gi, '/:uuid') // UUIDs
    .replace(/\/\d+/g, '/:id') // Numeric IDs
}

// ─────────────────────────────────────────────────────────────
// Batch Rate Limit Check (reduces KV calls)
// ─────────────────────────────────────────────────────────────

export type RateLimitConfig = {
  global?: boolean
  endpoint?: string
  ip?: string
  apiWrite?: { ip: string; path: string }
  daily?: string
  auth?: string
}

export type BatchResult = {
  success: boolean
  failedCheck?: string
  result?: LimitResult
}

/**
 * Check multiple rate limits - returns on first failure
 */
export async function checkRateLimits(config: RateLimitConfig): Promise<BatchResult> {
  if (config.global) {
    const result = await checkGlobalLimit()
    if (!result.success) {
      return { success: false, failedCheck: 'global', result }
    }
  }

  if (config.endpoint) {
    const result = await checkEndpointLimit(config.endpoint)
    if (!result.success) {
      return { success: false, failedCheck: 'endpoint', result }
    }
  }

  if (config.ip) {
    const result = await checkIpLimit(config.ip)
    if (!result.success) {
      return { success: false, failedCheck: 'ip', result }
    }
  }

  if (config.apiWrite) {
    const result = await checkApiWriteLimit(config.apiWrite.ip, config.apiWrite.path)
    if (!result.success) {
      return { success: false, failedCheck: 'apiWrite', result }
    }
  }

  if (config.daily) {
    const result = await checkDailyLimit(config.daily)
    if (!result.success) {
      return { success: false, failedCheck: 'daily', result }
    }
  }

  if (config.auth) {
    const result = await checkAuthLimit(config.auth)
    if (!result.success) {
      return { success: false, failedCheck: 'auth', result }
    }
  }

  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// Optimized Batch Check (Single Pipeline - Fewer KV Calls)
// ─────────────────────────────────────────────────────────────

type LimitCheck = {
  key: string
  limit: number
  windowSec: number
  name: string
}

/**
 * Check multiple limits in a single pipeline operation
 * More efficient for multiple checks
 */
export async function checkLimitsBatch(checks: LimitCheck[]): Promise<BatchResult> {
  const nowSec = Math.floor(Date.now() / 1000)

  // Build keys and buckets
  const keysData = checks.map(({ key, windowSec, limit, name }) => {
    const bucket = Math.floor(nowSec / windowSec)
    return {
      kvKey: `rl:v1:${key}:${bucket}`,
      bucket,
      windowSec,
      limit,
      name,
    }
  })

  try {
    // Increment all keys in pipeline
    const pipeline = kv.pipeline()
    keysData.forEach(({ kvKey }) => pipeline.incr(kvKey))
    const counts = await pipeline.exec<number[]>()

    // Set TTLs for new keys (fire and forget)
    const ttlPipeline = kv.pipeline()
    counts.forEach((count, i) => {
      if (count === 1) {
        ttlPipeline.expire(keysData[i].kvKey, keysData[i].windowSec)
      }
    })
    ttlPipeline.exec() // Don't await

    // Check each limit
    for (let i = 0; i < checks.length; i++) {
      const count = counts[i]
      const { limit, windowSec, bucket, name } = keysData[i]

      if (count > limit) {
        return {
          success: false,
          failedCheck: name,
          result: {
            success: false,
            limit,
            remaining: 0,
            reset: (bucket + 1) * windowSec * 1000,
          },
        }
      }
    }

    return { success: true }
  } catch (error) {
    console.error('Batch rate limit error:', error)
    return { success: true } // Fail open
  }
}