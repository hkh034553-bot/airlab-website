import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { AdminModel } from '../models/Admin.js'
import { env, isProd } from '../config/env.js'
import {
  requireAdmin,
  computePasswordFingerprint,
  JWT_ISSUER,
  JWT_AUDIENCE,
  type AuthRequest,
} from '../middleware/auth.js'
import { createRateLimiter } from '../middleware/rateLimit.js'
import { HttpError } from '../middleware/errors.js'

export const authRouter = Router()

// Precomputed bcrypt hash used when email is not found to prevent timing-based user enumeration
const DUMMY_BCRYPT_HASH = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'

const FREE_FAILURES_THRESHOLD = 5
const MAX_BACKOFF_SECONDS = 30

// Shared IP rate limiter: 10 attempts per IP per 15 minutes
const loginIpLimiter = createRateLimiter({
  prefix: 'auth-login:15m',
  max: 10,
  windowSeconds: 15 * 60,
  message: 'Too many login attempts from this IP address. Please wait 15 minutes before trying again.',
})

function computeAccountBackoffMs(failedAttempts: number): number {
  if (failedAttempts <= FREE_FAILURES_THRESHOLD) return 0
  // After 5 failures: 6th -> 1s, 7th -> 2s, 8th -> 4s, ..., capped at 30s
  const exponent = failedAttempts - (FREE_FAILURES_THRESHOLD + 1)
  const delaySec = Math.min(MAX_BACKOFF_SECONDS, Math.pow(2, exponent))
  return delaySec * 1000
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProd,
  sameSite: 'strict' as const,
  path: '/',
}

const LoginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(256),
})

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters long')
    .max(256),
})

authRouter.post('/login', loginIpLimiter, async (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')

  try {
    const { email, password } = LoginSchema.parse(req.body)
    const normalizedEmail = email.toLowerCase().trim()

    // Strictly authenticate against the database (bcrypt hash comparison)
    const admin = await AdminModel.findOne({ email: normalizedEmail }).select(
      '+passwordHash +failedLoginAttempts +lockUntil'
    )

    // Short progressive per-account backoff (prevents targeted account-lockout DoS while slowing brute force)
    const now = Date.now()
    if (admin?.lockUntil) {
      const waitMs = new Date(admin.lockUntil).getTime() - now
      if (waitMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, Math.min(waitMs, MAX_BACKOFF_SECONDS * 1000)))
      }
    }

    const hashToCompare = admin?.passwordHash || DUMMY_BCRYPT_HASH
    const isValid = await bcrypt.compare(password, hashToCompare)

    if (!admin || !isValid) {
      if (admin) {
        const attempts = (admin.failedLoginAttempts || 0) + 1
        admin.failedLoginAttempts = attempts
        const backoffMs = computeAccountBackoffMs(attempts)
        admin.lockUntil = backoffMs > 0 ? new Date(Date.now() + backoffMs) : null
        await admin.save()
      }
      throw new HttpError(401, 'Invalid email or password')
    }

    // Reset failed attempts on successful login
    admin.failedLoginAttempts = 0
    admin.lockUntil = null
    admin.lastLoginAt = new Date()
    await admin.save()

    const pwdFingerprint = computePasswordFingerprint(admin.passwordHash)
    const token = jwt.sign(
      {
        id: String(admin._id),
        email: admin.email,
        name: admin.name,
        pwdFingerprint,
      },
      env.JWT_SECRET,
      {
        algorithm: 'HS256',
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        expiresIn: '12h',
      }
    )

    res.cookie('token', token, {
      ...COOKIE_OPTIONS,
      maxAge: 12 * 60 * 60 * 1000,
    })

    res.json({
      success: true,
      admin: {
        id: String(admin._id),
        email: admin.email,
        name: admin.name,
      },
    })
  } catch (err) {
    next(err)
  }
})

authRouter.post('/logout', (_req, res) => {
  res.clearCookie('token', COOKIE_OPTIONS)
  res.json({ success: true, message: 'Logged out successfully' })
})

authRouter.get('/me', requireAdmin, async (req: AuthRequest, res, next) => {
  try {
    if (!req.admin?.id) {
      throw new HttpError(401, 'Unauthorized')
    }

    res.json({
      admin: {
        id: req.admin.id,
        email: req.admin.email,
        name: req.admin.name,
      },
    })
  } catch (err) {
    next(err)
  }
})

authRouter.post('/change-password', requireAdmin, async (req: AuthRequest, res, next) => {
  try {
    if (!req.admin?.id) {
      throw new HttpError(401, 'Unauthorized')
    }

    const { currentPassword, newPassword } = ChangePasswordSchema.parse(req.body)
    const admin = await AdminModel.findById(req.admin.id).select('+passwordHash')
    if (!admin) {
      throw new HttpError(401, 'Admin account not found')
    }

    const matches = await bcrypt.compare(currentPassword, admin.passwordHash)
    if (!matches) {
      throw new HttpError(400, 'Current password is incorrect')
    }

    admin.passwordHash = await bcrypt.hash(newPassword, 12)
    admin.failedLoginAttempts = 0
    admin.lockUntil = null
    await admin.save()

    const pwdFingerprint = computePasswordFingerprint(admin.passwordHash)
    const newToken = jwt.sign(
      {
        id: String(admin._id),
        email: admin.email,
        name: admin.name,
        pwdFingerprint,
      },
      env.JWT_SECRET,
      {
        algorithm: 'HS256',
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        expiresIn: '12h',
      }
    )

    res.cookie('token', newToken, {
      ...COOKIE_OPTIONS,
      maxAge: 12 * 60 * 60 * 1000,
    })

    res.json({
      success: true,
      message: 'Password updated successfully. All other sessions have been invalidated.',
    })
  } catch (err) {
    next(err)
  }
})
