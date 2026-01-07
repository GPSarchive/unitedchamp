// Rate limiting utilities for API protection

import { headers } from "next/headers";

type RateLimitStore = {
  [key: string]: {
    count: number;
    resetTime: number;
  };
};

// In-memory store (for production, use Redis or similar)
const rateLimitStore: RateLimitStore = {};

// Clean up old entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  Object.keys(rateLimitStore).forEach((key) => {
    if (rateLimitStore[key].resetTime < now) {
      delete rateLimitStore[key];
    }
  });
}, 10 * 60 * 1000);

export type RateLimitConfig = {
  maxRequests: number; // Max requests allowed
  windowMs: number; // Time window in milliseconds
};

/**
 * Check if a request is rate limited
 * @returns true if rate limit exceeded, false otherwise
 */
export async function isRateLimited(
  config: RateLimitConfig
): Promise<boolean> {
  // Get client identifier (IP address)
  const headersList = await headers();
  const forwarded = headersList.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0] : "unknown";

  const key = `ratelimit:${ip}`;
  const now = Date.now();

  // Get or create rate limit entry
  let entry = rateLimitStore[key];

  if (!entry || entry.resetTime < now) {
    // First request or window expired - reset
    rateLimitStore[key] = {
      count: 1,
      resetTime: now + config.windowMs,
    };
    return false;
  }

  // Increment count
  entry.count++;

  // Check if limit exceeded
  return entry.count > config.maxRequests;
}

/**
 * Get remaining requests for current window
 */
export async function getRateLimitInfo(
  config: RateLimitConfig
): Promise<{ remaining: number; resetTime: number }> {
  const headersList = await headers();
  const forwarded = headersList.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0] : "unknown";

  const key = `ratelimit:${ip}`;
  const now = Date.now();
  const entry = rateLimitStore[key];

  if (!entry || entry.resetTime < now) {
    return {
      remaining: config.maxRequests,
      resetTime: now + config.windowMs,
    };
  }

  return {
    remaining: Math.max(0, config.maxRequests - entry.count),
    resetTime: entry.resetTime,
  };
}

/**
 * Rate limit configuration presets
 */
export const RATE_LIMITS = {
  // Search: 30 requests per minute
  SEARCH: {
    maxRequests: 30,
    windowMs: 60 * 1000,
  },

  // General page load: 60 requests per minute
  PAGE_LOAD: {
    maxRequests: 60,
    windowMs: 60 * 1000,
  },

  // Strict: 10 requests per minute (for expensive operations)
  STRICT: {
    maxRequests: 10,
    windowMs: 60 * 1000,
  },
} as const;
