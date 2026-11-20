import express, { type Request, type Response, type NextFunction } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import morgan from 'morgan'
import cookieParser from 'cookie-parser'
import mongoose from 'mongoose'
import { env, isProd } from './config/env.js'
import { contentRouter } from './routes/content.js'
import { mediaRouter } from './routes/media.js'
import { positionsRouter } from './routes/positions.js'
import { authRouter } from './routes/auth.js'
import { applicationsRouter } from './routes/applications.js'
import { adminCrudRouter } from './routes/admin.js'
import { settingsRouter } from './routes/settings.js'
import { verifyAdminFromCookie } from './middleware/auth.js'
import { errorHandler, notFound } from './middleware/errors.js'

const VERCEL_PREVIEW_RE = /^https:\/\/airlab-website-[a-z0-9-]+\.vercel\.app$/

export function isAllowedOrigin(origin: string): boolean {
  const normalized = origin.replace(/\/+$/, '')
  const allowed = new Set<string>([
    ...env.CORS_ORIGINS.map(o => o.replace(/\/+$/, '')),
    'https://airlab-website-peach.vercel.app',
  ])
  if (!isProd) {
    allowed.add('http://localhost:5173')
  }
  if (allowed.has(normalized)) return true
  if (VERCEL_PREVIEW_RE.test(normalized)) return true
  return false
}

function enforceCsrfOrigin(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next()
  }
  const origin = req.headers.origin
  if (origin && !isAllowedOrigin(origin)) {
    return res.status(403).json({ error: 'Forbidden: untrusted origin' })
  }
  next()
}

export function createApp() {
  const app = express()

  // Behind Nginx/Apache in production – needed for correct client IPs (rate limiting) and secure cookies.
  app.set('trust proxy', 1)
  app.disable('x-powered-by')

  app.use(helmet())
  app.use(compression())
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no Origin header (same-origin, curl)
        if (!origin) {
          return callback(null, true)
        }
        if (isAllowedOrigin(origin)) {
          return callback(null, true)
        }
        // Reject untrusted origin by omitting CORS headers without throwing a 500
        return callback(null, false)
      },
      credentials: true, // admin auth uses httpOnly cookies
    }),
  )
  app.use(cookieParser())
  app.use(morgan(isProd ? 'combined' : 'dev'))

  // Mount /api/admin with its own 10mb JSON parser (inside adminCrudRouter) before the global 100kb parser
  app.use('/api/admin', enforceCsrfOrigin, adminCrudRouter)

  // Global JSON body limit of 100kb for all non-admin routes (skips if body is already parsed)
  app.use((req, res, next) => {
    if (req.body !== undefined && typeof req.body === 'object') {
      return next()
    }
    express.json({ limit: '100kb' })(req, res, next)
  })

  app.get('/api/health', async (req, res) => {
    const admin = await verifyAdminFromCookie(req)
    if (!admin) {
      res.json({ status: 'ok' })
      return
    }
    const dbStates: Record<number, string> = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' }
    res.json({
      status: 'ok',
      db: dbStates[mongoose.connection.readyState] ?? 'uninitialized',
      uptime: Math.round(process.uptime()),
    })
  })

  app.use('/api/auth/change-password', enforceCsrfOrigin)
  app.use('/api/applications/admin', enforceCsrfOrigin)

  app.use('/api/auth', authRouter)
  app.use('/api/content', contentRouter)
  app.use('/api/media', mediaRouter)
  app.use('/api/positions', positionsRouter)
  app.use('/api/applications', applicationsRouter)
  app.use('/api/settings', settingsRouter)

  app.use('/api', notFound)
  app.use(errorHandler)

  return app
}
