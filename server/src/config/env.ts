import crypto from 'node:crypto'
import { z } from 'zod'

const WEAK_PLACEHOLDER_SECRETS = new Set([
  '',
  'airlab-secret-key-fallback-2026',
  'super-secret-key-change-in-production',
  'change-this-to-a-64-byte-cryptographic-random-hex-secret',
])

const fallbackRuntimeEntropy = crypto.randomBytes(64).toString('hex')

/**
 * Validates environment variables once at startup so misconfiguration fails fast
 * with a readable message instead of a cryptic runtime error later.
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGO_URI: z.string().optional().default(''),
  JWT_SECRET: z.string().optional().default(''),
  /** Comma-separated list of origins allowed to call the API (only needed when frontend is on another origin). */
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)),
  PUBLIC_SITE_URL: z
    .string()
    .default('https://airlab-website-peach.vercel.app')
    .transform((v) => v.trim().replace(/\/+$/, '') || 'https://airlab-website-peach.vercel.app'),
  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z.coerce.number().default(465),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  ADMIN_NOTIFICATION_EMAIL: z.string().optional().default(''),
  UPSTASH_REDIS_REST_URL: z.string().optional().default(''),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional().default(''),
  TURNSTILE_SECRET_KEY: z.string().optional().default(''),
})

const parsed = EnvSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('\n❌ Invalid server environment configuration:')
  for (const issue of parsed.error.issues) {
    console.error(`   • ${issue.path.join('.') || '(root)'}: ${issue.message}`)
  }
  console.error('')
  process.exit(1)
}

export const isProd = parsed.data.NODE_ENV === 'production'

const rawJwtSecret = (parsed.data.JWT_SECRET ?? '').trim()
const rawMongoUri = (parsed.data.MONGO_URI ?? '').trim()

export const isJwtSecretValid =
  (rawJwtSecret.length >= 32 && !WEAK_PLACEHOLDER_SECRETS.has(rawJwtSecret)) ||
  rawMongoUri.length > 0

function resolveJwtSecret(): string {
  if (rawJwtSecret.length >= 32 && !WEAK_PLACEHOLDER_SECRETS.has(rawJwtSecret)) {
    return rawJwtSecret
  }
  if (rawMongoUri.length > 0) {
    // Derive a high-entropy 512-bit cryptographic secret tied to the private MONGO_URI
    // (and any configured JWT_SECRET) so admin sessions stay consistent across serverless workers.
    return crypto
      .createHmac('sha512', 'airlab-neduet-admin-jwt-signing-key-v2')
      .update(`${rawJwtSecret}:${rawMongoUri}`)
      .digest('hex')
  }
  if (isProd) {
    console.error(
      '\n❌ Security error: JWT_SECRET (or MONGO_URI) must be configured in production.',
    )
    if (!process.env.VERCEL) {
      process.exit(1)
    }
    return fallbackRuntimeEntropy
  }
  console.warn(
    '⚠️ JWT_SECRET is missing or weak; using random per-process entropy for development.',
  )
  return fallbackRuntimeEntropy
}

export const isServerMisconfigured = isProd && !isJwtSecretValid

export const env = {
  ...parsed.data,
  JWT_SECRET: resolveJwtSecret(),
}

