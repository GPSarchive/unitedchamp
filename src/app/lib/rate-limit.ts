// src/lib/rate-limit.ts
import { kv } from '@vercel/kv'

export type LimitResult = {
  success: boolean
  limit: number
  remaining: number
  reset: number // unix ms when the window resets
}

/**
 * Fixed-window limiter: counts hits inside a window, with 1 KV INCR per request.
 * Window is coarse by design (cheaper & Edge-safe).
 */
export async function checkLimit(key: string, limit: number, windowSec: number): Promise<LimitResult> {
  const nowSec = Math.floor(Date.now() / 1000)
  const bucket = Math.floor(nowSec / windowSec)
  const kvKey = `rl:v1:${key}:${bucket}`

  const count = await kv.incr(kvKey)
  // Set TTL only when the key is new (first hit in this bucket)
  if (count === 1) {
    await kv.expire(kvKey, windowSec)
  }

  const remaining = Math.max(0, limit - count)
  const reset = (bucket + 1) * windowSec * 1000
  return { success: count <= limit, limit, remaining, reset }
}

/** Extract best-effort client IP on Vercel/Edge */
export function ipFromRequest(req: Request) {
  // @ts-ignore - NextRequest has .ip at runtime; plain Request doesn't
  const direct = (req as any).ip as string | undefined
  const xf = req.headers.get('x-forwarded-for') || ''
  return direct || (xf.split(',')[0]?.trim() || '127.0.0.1')
}
