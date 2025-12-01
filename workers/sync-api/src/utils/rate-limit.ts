/**
 * Rate limiting utilities
 */

import type { Env, RateLimitEntry } from '../types';

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  login: { maxRequests: 5, windowMs: 60 * 1000 }, // 5 per minute
  register: { maxRequests: 3, windowMs: 60 * 60 * 1000 }, // 3 per hour
  password_reset: { maxRequests: 3, windowMs: 60 * 60 * 1000 }, // 3 per hour
  sync_pull: { maxRequests: 60, windowMs: 60 * 1000 }, // 60 per minute
  sync_push: { maxRequests: 30, windowMs: 60 * 1000 }, // 30 per minute
  file_upload: { maxRequests: 100, windowMs: 60 * 1000 }, // 100 per minute
};

/**
 * Check if a request is rate limited
 * @returns Seconds until rate limit resets, or 0 if not limited
 */
export async function checkRateLimit(
  db: D1Database,
  action: keyof typeof RATE_LIMITS,
  identifier: string
): Promise<number> {
  const config = RATE_LIMITS[action];
  if (!config) {
    return 0;
  }

  const key = `${action}:${identifier}`;
  const now = Date.now();

  // Get current rate limit entry
  const entry = await db
    .prepare('SELECT * FROM rate_limits WHERE key = ?')
    .bind(key)
    .first<RateLimitEntry>();

  if (!entry) {
    // Create new entry
    await db
      .prepare(
        'INSERT INTO rate_limits (key, count, window_start, expires_at) VALUES (?, 1, ?, ?)'
      )
      .bind(key, now, now + config.windowMs)
      .run();
    return 0;
  }

  // Check if window has expired
  if (now > entry.expires_at) {
    // Reset window
    await db
      .prepare(
        'UPDATE rate_limits SET count = 1, window_start = ?, expires_at = ? WHERE key = ?'
      )
      .bind(now, now + config.windowMs, key)
      .run();
    return 0;
  }

  // Check if limit exceeded
  if (entry.count >= config.maxRequests) {
    const retryAfter = Math.ceil((entry.expires_at - now) / 1000);
    return retryAfter;
  }

  // Increment count
  await db
    .prepare('UPDATE rate_limits SET count = count + 1 WHERE key = ?')
    .bind(key)
    .run();

  return 0;
}

/**
 * Clean up expired rate limit entries
 */
export async function cleanupRateLimits(db: D1Database): Promise<number> {
  const now = Date.now();
  const result = await db
    .prepare('DELETE FROM rate_limits WHERE expires_at < ?')
    .bind(now)
    .run();
  
  return result.meta.changes ?? 0;
}

/**
 * Get rate limit headers for response
 */
export function getRateLimitHeaders(
  action: keyof typeof RATE_LIMITS,
  remaining: number,
  resetAt: number
): Record<string, string> {
  const config = RATE_LIMITS[action];
  return {
    'X-RateLimit-Limit': String(config?.maxRequests ?? 0),
    'X-RateLimit-Remaining': String(Math.max(0, remaining)),
    'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
  };
}


