import type { Request, RequestHandler } from 'express'
import { env } from '../config/env.js'
import { HttpError } from './errors.js'

interface MemoryBucket {
  count: number
  expiresAt: number
}

// In-memory fallback store. NOTE: this only works per instance (resets on serverless cold start / across workers).
const memoryBuckets = new Map<string, MemoryBucket>()

export interface RateLimitRule {
  /** Namespace prefix for the key (e.g. 'app:1h', 'login:15m') */
  prefix: string
  /** Maximum allowed hits inside windowSeconds */
  max: number
  /** Window duration in seconds */
  windowSeconds: number
  /** Friendly 429 error message */
  message?: string
}

async function checkUpstashLimit(
  key: string,
  max: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; count: number } | null> {
  const baseUrl = env.UPSTASH_REDIS_REST_URL?.trim().replace(/\/+$/, '')
  const token = env.UPSTASH_REDIS_REST_TOKEN?.trim()
  if (!baseUrl || !token) return null

  try {
    const res = await fetch(`${baseUrl}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', key],
        ['EXPIRE', key, String(windowSeconds), 'NX'],
      ]),
    })
    if (!res.ok) {
      return null
    }
    const data = (await res.json()) as Array<{ result?: number }>
    const count = Number(data?.[0]?.result ?? 1)
    return { allowed: count <= max, count }
  } catch {
    return null
  }
}

function checkMemoryLimit(
  key: string,
  max: number,
  windowSeconds: number,
): { allowed: boolean; count: number } {
  const now = Date.now()
  const existing = memoryBuckets.get(key)
  if (!existing || now >= existing.expiresAt) {
    memoryBuckets.set(key, { count: 1, expiresAt: now + windowSeconds * 1000 })
    return { allowed: true, count: 1 }
  }
  existing.count += 1
  return { allowed: existing.count <= max, count: existing.count }
}

/**
 * Programmatic rate-limit check for custom keys (e.g. per-IP or per-email confirmation cap).
 * Uses Upstash Redis REST API via fetch when UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
 * are configured; otherwise falls back to an in-memory Map (which only works per instance).
 */
export async function consumeRateLimit(
  identifier: string,
  rule: RateLimitRule,
): Promise<{ allowed: boolean; count: number }> {
  const fullKey = `rl:${rule.prefix}:${identifier}`
  const upstashResult = await checkUpstashLimit(fullKey, rule.max, rule.windowSeconds)
  if (upstashResult) {
    return upstashResult
  }
  return checkMemoryLimit(fullKey, rule.max, rule.windowSeconds)
}

export function getClientIp(req: Request): string {
  return (req.ip || req.socket?.remoteAddress || 'unknown').trim()
}

/**
 * Express middleware that enforces one or more rate limit rules keyed by req.ip
 * (or a custom keyExtractor).
 */
export function createRateLimiter(
  rules: RateLimitRule | RateLimitRule[],
  keyExtractor: (req: Request) => string = getClientIp,
): RequestHandler {
  const ruleList = Array.isArray(rules) ? rules : [rules]

  return async (req, _res, next) => {
    try {
      const id = keyExtractor(req) || 'unknown'
      for (const rule of ruleList) {
        const { allowed } = await consumeRateLimit(id, rule)
        if (!allowed) {
          return next(
            new HttpError(
              429,
              rule.message || 'Too many requests. Please wait before trying again.',
            ),
          )
        }
      }
      next()
    } catch (err) {
      next(err)
    }
  }
}
