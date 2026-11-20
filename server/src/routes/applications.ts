import { Router } from 'express'
import multer from 'multer'
import mongoose from 'mongoose'
import { z } from 'zod'
import { ApplicationModel, APPLICATION_STATUSES } from '../models/Application.js'
import { PositionModel } from '../models/Position.js'
import { HttpError } from '../middleware/errors.js'
import { requireAdmin } from '../middleware/auth.js'
import { createRateLimiter, getClientIp } from '../middleware/rateLimit.js'
import { sendApplicationNotification } from '../services/email.js'
import { getVacancySettings } from '../services/siteSettings.js'
import { env } from '../config/env.js'
import { connectDB } from '../db.js'
import { extractBlobIdsFromDoc, deleteMediaBlobsByIds } from '../services/mediaStorage.js'

export const applicationsRouter = Router()

const MAX_CV_BYTES = 4 * 1024 * 1024 // 4 MB (below Vercel's ~4.5 MB request body limit)

// Memory storage keeps file buffers accessible for serverless / cloud deployment
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_CV_BYTES },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true)
    } else {
      cb(new HttpError(400, 'Only PDF resumes/CVs are accepted'))
    }
  },
})

const optionalHttpsUrl = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z
    .string()
    .trim()
    .max(500)
    .url('Must be a valid URL')
    .refine((u) => u.startsWith('https://'), 'Must be an absolute https:// URL')
    .optional(),
)

const optionalObjectId = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z
    .string()
    .trim()
    .refine((val) => mongoose.Types.ObjectId.isValid(val), 'Invalid positionId')
    .optional(),
)

const ApplicationBodySchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(120),
    email: z.string().trim().email('Invalid email address').max(254),
    phone: z.string().trim().min(1, 'Phone is required').max(30),
    university: z.string().trim().min(1, 'University is required').max(200),
    degreeYear: z.string().trim().min(1, 'Degree / Year is required').max(50),
    rollNo: z.string().trim().max(100).optional(),
    department: z.string().trim().max(100).optional(),
    program: z.string().trim().max(100).optional(),
    track: z.string().trim().max(100).optional(),
    statement: z.string().trim().max(3000).optional(),
    coverNote: z.string().trim().max(3000).optional(),
    github: optionalHttpsUrl,
    linkedin: optionalHttpsUrl,
    resumeUrl: optionalHttpsUrl,
    positionId: optionalObjectId,
    positionTitle: z.string().trim().max(150).optional(),
    designation: z.string().trim().max(150).optional(),
    turnstileToken: z.string().trim().max(2048).optional(),
  })
  .strip()

const applicationLimiter = createRateLimiter([
  {
    prefix: 'app:1h',
    max: 3,
    windowSeconds: 60 * 60,
    message:
      'You have submitted the maximum number of applications allowed per hour (3). Please wait a while before applying again.',
  },
  {
    prefix: 'app:24h',
    max: 20,
    windowSeconds: 24 * 60 * 60,
    message:
      'Daily application limit reached for this network (20 per 24 hours). Please try again tomorrow.',
  },
])

async function verifyTurnstileToken(token: string | undefined, remoteIp: string): Promise<boolean> {
  const secret = env.TURNSTILE_SECRET_KEY?.trim()
  if (!secret) return true
  if (!token) return false

  try {
    const form = new URLSearchParams()
    form.set('secret', secret)
    form.set('response', token)
    if (remoteIp && remoteIp !== 'unknown') {
      form.set('remoteip', remoteIp)
    }
    const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    })
    if (!resp.ok) return false
    const result = (await resp.json()) as { success?: boolean }
    return result?.success === true
  } catch {
    return false
  }
}

// Public endpoint for submitting applications
applicationsRouter.post('/', applicationLimiter, upload.single('cv'), async (req, res, next) => {
  try {
    if (req.file) {
      if (req.file.size > MAX_CV_BYTES) {
        throw new HttpError(400, 'Resume PDF must be 4 MB or smaller')
      }
      const magic = req.file.buffer.subarray(0, 5).toString('ascii')
      if (magic !== '%PDF-') {
        throw new HttpError(400, 'Uploaded file is not a valid PDF document')
      }
    }

    const parsedBody = ApplicationBodySchema.parse(req.body ?? {})

    if (env.TURNSTILE_SECRET_KEY?.trim()) {
      const turnstileOk = await verifyTurnstileToken(parsedBody.turnstileToken, getClientIp(req))
      if (!turnstileOk) {
        throw new HttpError(
          400,
          'CAPTCHA verification failed. Please complete the challenge and try again.',
        )
      }
    }

    if (mongoose.connection.readyState !== 1) {
      try {
        await connectDB()
      } catch (connErr) {
        console.warn('⚠️ MongoDB reconnect attempt failed during application submission:', connErr)
      }
    }

    const {
      positionId,
      name,
      email,
      phone,
      university,
      degreeYear,
      coverNote,
      github,
      linkedin,
      resumeUrl,
      rollNo,
      department,
      program,
      track,
      statement,
    } = parsedBody
    const positionTitleFromBody = parsedBody.positionTitle || parsedBody.designation

    const vacancy = await getVacancySettings()
    if (vacancy.status === 'Closed') {
      throw new HttpError(403, vacancy.closedMessage)
    }

    // Verify position or select default
    let assignedPosition: any = positionId
    try {
      if (!assignedPosition && mongoose.connection.readyState === 1) {
        const defaultPos = await PositionModel.findOne({ isOpen: true }).maxTimeMS(2000)
        if (defaultPos) assignedPosition = defaultPos._id
      }
    } catch {
      // Ignore position lookup error
    }

    // Never store client input in cv.key: only server-generated data URI or literal 'none'
    const cvData = {
      key: req.file ? `data:application/pdf;base64,${req.file.buffer.toString('base64')}` : 'none',
      originalName: req.file ? req.file.originalname : undefined,
      size: req.file ? req.file.size : 0,
    }

    let applicationId = 'temp-' + Date.now()
    let savedToDb = false
    try {
      if (mongoose.connection.readyState === 1) {
        const application = await ApplicationModel.create({
          position: assignedPosition,
          positionTitle: positionTitleFromBody || 'Research Intern',
          designation: positionTitleFromBody || 'Research Intern',
          name,
          email,
          phone,
          university,
          degreeYear,
          rollNo,
          department,
          program,
          track,
          statement,
          coverNote,
          github,
          linkedin,
          resumeUrl,
          cv: cvData,
          status: 'New',
        })
        applicationId = String(application._id)
        savedToDb = true
      }
    } catch (dbErr) {
      console.warn(
        '⚠️ Could not save to DB (Atlas IP whitelist / connection timeout), proceeding with email delivery:',
        dbErr,
      )
    }

    console.log(`📩 Application received from ${name} (${email})`)

    let positionTitle: string | undefined = positionTitleFromBody
    try {
      if (!positionTitle && assignedPosition && mongoose.connection.readyState === 1) {
        const posDoc = await PositionModel.findById(assignedPosition).lean()
        if (posDoc) positionTitle = posDoc.title
      }
    } catch {
      // ignore
    }

    // Dispatch notification email to admin and confirmation to applicant (never fails the request)
    try {
      const emailResult = await sendApplicationNotification({
        applicantName: name,
        applicantEmail: email,
        applicantPhone: phone,
        university,
        degreeYear,
        positionTitle: positionTitle || 'Research Intern',
        coverNote,
        github,
        linkedin,
        cvFile: req.file
          ? {
              originalName: req.file.originalname,
              buffer: req.file.buffer,
              contentType: req.file.mimetype,
            }
          : undefined,
      })
      if (savedToDb && emailResult?.sent && mongoose.Types.ObjectId.isValid(applicationId)) {
        await ApplicationModel.findByIdAndUpdate(applicationId, { $set: { emailSent: true } }).catch(
          () => {},
        )
      }
    } catch (emailErr) {
      console.error('⚠️ Failed to dispatch application notification email:', emailErr)
    }

    res.status(201).json({
      success: true,
      message: 'Application successfully received by the AIR Lab committee!',
      id: applicationId,
    })
  } catch (err) {
    next(err)
  }
})

// Protected Admin endpoints
applicationsRouter.get('/admin', requireAdmin, async (_req, res, next) => {
  try {
    const applications = await ApplicationModel.find()
      .populate('position', 'title track')
      .sort({ createdAt: -1 })
      .maxTimeMS(10000)
      .lean()
    res.json(applications)
  } catch (err) {
    next(err)
  }
})

// Fallback streaming endpoint for any application CV
applicationsRouter.get('/admin/:id/cv', requireAdmin, async (req, res, next) => {
  try {
    const id = String(req.params.id)
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new HttpError(400, 'Invalid application ID')
    }
    const app: any = await ApplicationModel.findById(id).select('cv').lean()
    if (!app?.cv?.key || app.cv.key === 'none') {
      throw new HttpError(404, 'CV not found')
    }
    if (app.cv.key.startsWith('/api/media/blob/')) {
      res.redirect(app.cv.key)
      return
    }
    const match = /^data:(application\/pdf);base64,(.*)$/s.exec(app.cv.key)
    if (!match) {
      throw new HttpError(404, 'CV not found')
    }
    const [, mime, b64] = match
    res.set({
      'Content-Type': mime,
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(app.cv.originalName || 'resume.pdf')}"`,
    })
    res.send(Buffer.from(b64, 'base64'))
  } catch (err) {
    next(err)
  }
})

applicationsRouter.patch('/admin/:id/status', requireAdmin, async (req, res, next) => {
  try {
    const id = String(req.params.id)
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new HttpError(400, 'Invalid application ID')
    }
    const { status, adminNotes } = req.body
    if (status && !APPLICATION_STATUSES.includes(status)) {
      throw new HttpError(400, 'Invalid application status')
    }
    const update: Record<string, unknown> = {}
    if (typeof status === 'string') update.status = status
    if (typeof adminNotes === 'string') update.adminNotes = adminNotes.trim()

    const app = await ApplicationModel.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true, runValidators: true },
    )
    if (!app) throw new HttpError(404, 'Application not found')
    res.json(app)
  } catch (err) {
    next(err)
  }
})

applicationsRouter.delete('/admin/:id', requireAdmin, async (req, res, next) => {
  try {
    const id = String(req.params.id)
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new HttpError(400, 'Invalid application ID')
    }
    const deleted = await ApplicationModel.findByIdAndDelete(id).lean()
    if (!deleted) throw new HttpError(404, 'Application not found')
    const blobIds = extractBlobIdsFromDoc(deleted)
    if (blobIds.size > 0) {
      await deleteMediaBlobsByIds(blobIds)
    }
    res.json({ success: true, message: 'Application deleted' })
  } catch (err) {
    next(err)
  }
})
